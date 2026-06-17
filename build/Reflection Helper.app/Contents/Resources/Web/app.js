const STORAGE_KEY = "reflection-helper-state-v1";

const typeLabels = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
};

const typeOrder = ["daily", "weekly", "monthly"];

const defaultTemplates = {
  daily: [
    { title: "今天最值得保留的行为是什么？", hint: "具体到场景、动作和触发条件。" },
    { title: "今天的阻力来自哪里？", hint: "写下环境、情绪、他人反馈或选择成本。" },
    { title: "明天只改一个动作，会改什么？", hint: "越小越好，最好能在 10 分钟内开始。" },
  ],
  weekly: [
    { title: "这一周最有效的三个行为是什么？", hint: "找出可以复制的节奏。" },
    { title: "哪件事反复拖慢了你？", hint: "记录模式，不急着责备自己。" },
    { title: "下周的一个实验是什么？", hint: "写成可观察、可验证的动作。" },
  ],
  monthly: [
    { title: "这个月的主线是什么？", hint: "用一句话概括你的注意力流向。" },
    { title: "哪些行为正在改变你的长期方向？", hint: "区分短期忙碌和长期复利。" },
    { title: "下个月要主动放弃什么？", hint: "为真正重要的东西腾出空间。" },
  ],
};

const defaultReminders = {
  daily: { enabled: false, time: "21:30", day: "everyday" },
  weekly: { enabled: false, time: "18:00", day: "5" },
  monthly: { enabled: false, time: "20:00", day: "last" },
};

const state = loadState();
let activeView = "write";
let activeType = "daily";
let activeTemplateType = "daily";
let selectedDate = toDateInputValue(new Date());
let calendarCursor = firstDayOfMonth(new Date());
let reminderTimer = null;
let pendingDeleteId = null;
let pendingDeleteTimer = null;

const dom = {
  appShell: document.querySelector("#appShell"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  todayLabel: document.querySelector("#todayLabel"),
  entryHeading: document.querySelector("#entryHeading"),
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  typeSegments: document.querySelectorAll(".segment"),
  entryDate: document.querySelector("#entryDate"),
  energyLevel: document.querySelector("#energyLevel"),
  energyOutput: document.querySelector("#energyOutput"),
  entryForm: document.querySelector("#entryForm"),
  freeNote: document.querySelector("#freeNote"),
  saveEntryButton: document.querySelector("#saveEntryButton"),
  deleteEntryButton: document.querySelector("#deleteEntryButton"),
  newEntryButton: document.querySelector("#newEntryButton"),
  contextPanel: document.querySelector("#contextPanel"),
  contextToggleButton: document.querySelector("#contextToggleButton"),
  closeContextButton: document.querySelector("#closeContextButton"),
  dayEntries: document.querySelector("#dayEntries"),
  selectedDayLabel: document.querySelector("#selectedDayLabel"),
  jumpTodayButton: document.querySelector("#jumpTodayButton"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  streakCount: document.querySelector("#streakCount"),
  nextReminder: document.querySelector("#nextReminder"),
  reviewRange: document.querySelector("#reviewRange"),
  searchInput: document.querySelector("#searchInput"),
  metrics: document.querySelector("#metrics"),
  signals: document.querySelector("#signals"),
  keepList: document.querySelector("#keepList"),
  stopList: document.querySelector("#stopList"),
  tryList: document.querySelector("#tryList"),
  templateTabs: document.querySelectorAll(".template-tab"),
  templateTitle: document.querySelector("#templateTitle"),
  templatePrompts: document.querySelector("#templatePrompts"),
  addPromptButton: document.querySelector("#addPromptButton"),
  reminderList: document.querySelector("#reminderList"),
  permissionButton: document.querySelector("#permissionButton"),
  exportButton: document.querySelector("#exportButton"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  dom.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full" }).format(new Date());
  dom.entryDate.value = selectedDate;
  bindEvents();
  renderAll();
  scheduleReminders();
}

function bindEvents() {
  dom.sidebarToggle.addEventListener("click", toggleSidebar);
  dom.navItems.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  dom.typeSegments.forEach((button) => {
    button.addEventListener("click", () => setEntryType(button.dataset.type));
  });

  dom.entryDate.addEventListener("change", () => selectDate(dom.entryDate.value));
  dom.energyLevel.addEventListener("input", () => {
    dom.energyOutput.textContent = dom.energyLevel.value;
  });
  dom.saveEntryButton.addEventListener("click", saveCurrentEntry);
  dom.deleteEntryButton.addEventListener("click", deleteCurrentEntry);
  dom.contextToggleButton.addEventListener("click", () => setContextPanelOpen(!dom.contextPanel.classList.contains("is-open")));
  dom.closeContextButton.addEventListener("click", () => setContextPanelOpen(false));
  dom.newEntryButton.addEventListener("click", () => {
    selectDate(toDateInputValue(new Date()), { keepType: true });
    clearFormFields();
    showToast("已准备好一条新的记录。");
  });
  dom.prevMonthButton.addEventListener("click", () => moveCalendar(-1));
  dom.nextMonthButton.addEventListener("click", () => moveCalendar(1));
  dom.jumpTodayButton.addEventListener("click", () => selectDate(toDateInputValue(new Date()), { preferExisting: true }));
  dom.reviewRange.addEventListener("change", renderReview);
  dom.searchInput.addEventListener("input", renderReview);

  dom.templateTabs.forEach((button) => {
    button.addEventListener("click", () => {
      activeTemplateType = button.dataset.template;
      renderTemplates();
    });
  });

  dom.addPromptButton.addEventListener("click", () => {
    state.templates[activeTemplateType].push({
      title: "新的复盘问题",
      hint: "写一点提示，帮助未来的自己回答。",
    });
    persist();
    renderTemplates();
    renderEntryForm();
    loadEntryIntoForm();
  });

  dom.permissionButton.addEventListener("click", requestNotificationPermission);
  dom.exportButton.addEventListener("click", exportData);
}

function renderAll() {
  renderEntryForm();
  loadEntryIntoForm();
  renderCalendar();
  renderSelectedDayEntries();
  renderReview();
  renderTemplates();
  renderReminders();
  renderStats();
}

function setView(view) {
  activeView = view;
  dom.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  dom.views.forEach((item) => item.classList.toggle("is-visible", item.id === `${view}View`));
  if (view === "review") renderReview();
  setContextPanelOpen(false);
}

function toggleSidebar() {
  const collapsed = dom.appShell.classList.toggle("is-sidebar-collapsed");
  dom.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  dom.sidebarToggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
}

function setContextPanelOpen(open) {
  dom.contextPanel.classList.toggle("is-open", open);
  dom.contextPanel.setAttribute("aria-hidden", String(!open));
  dom.contextToggleButton.setAttribute("aria-expanded", String(open));
}

function setEntryType(type) {
  activeType = type;
  dom.typeSegments.forEach((segment) => segment.classList.toggle("is-active", segment.dataset.type === type));
  renderEntryForm();
  loadEntryIntoForm();
  updateEntryHeading();
}

function selectDate(date, options = {}) {
  if (!date) return;
  selectedDate = date;
  dom.entryDate.value = date;

  const dateObject = parseDate(date);
  calendarCursor = firstDayOfMonth(dateObject);

  if (options.preferExisting) {
    const firstEntry = getEntriesForDate(date)[0];
    if (firstEntry && !options.keepType) activeType = firstEntry.type;
  }

  dom.typeSegments.forEach((segment) => segment.classList.toggle("is-active", segment.dataset.type === activeType));
  renderEntryForm();
  loadEntryIntoForm();
  renderCalendar();
  renderSelectedDayEntries();
}

function moveCalendar(delta) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
  renderCalendar();
}

function renderEntryForm() {
  const template = state.templates[activeType] ?? defaultTemplates[activeType];
  dom.entryForm.innerHTML = "";

  template.forEach((prompt, index) => {
    const field = document.createElement("section");
    field.className = "prompt-card";
    field.innerHTML = `
      <label>
        <strong>${escapeHtml(prompt.title)}</strong>
        <textarea data-prompt-index="${index}" rows="4" placeholder="${escapeHtml(prompt.hint)}"></textarea>
      </label>
    `;
    dom.entryForm.appendChild(field);
  });
}

function loadEntryIntoForm() {
  const entry = findEntry(activeType, selectedDate);
  const answers = entry?.answers ?? [];
  dom.entryForm.querySelectorAll("textarea").forEach((textarea) => {
    textarea.value = answers[Number(textarea.dataset.promptIndex)] ?? "";
  });
  dom.freeNote.value = entry?.freeNote ?? "";
  dom.energyLevel.value = entry?.energy ?? 6;
  dom.energyOutput.textContent = String(entry?.energy ?? 6);
  dom.deleteEntryButton.disabled = !entry;
  resetDeleteConfirmation();
  updateEntryHeading();
}

function clearFormFields() {
  dom.entryForm.querySelectorAll("textarea").forEach((textarea) => {
    textarea.value = "";
  });
  dom.freeNote.value = "";
  dom.energyLevel.value = 6;
  dom.energyOutput.textContent = "6";
  dom.deleteEntryButton.disabled = true;
  resetDeleteConfirmation();
}

function updateEntryHeading() {
  dom.entryHeading.textContent = `${formatReadableDate(selectedDate)}的${typeLabels[activeType]}`;
}

function saveCurrentEntry() {
  const answers = [...dom.entryForm.querySelectorAll("textarea")].map((textarea) => textarea.value.trim());
  const entry = {
    id: `${activeType}-${selectedDate}`,
    type: activeType,
    date: selectedDate,
    energy: Number(dom.energyLevel.value),
    answers,
    freeNote: dom.freeNote.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = entry;
  } else {
    state.entries.push(entry);
  }

  sortEntries();
  persist();
  renderCalendar();
  renderSelectedDayEntries();
  renderReview();
  renderStats();
  loadEntryIntoForm();
  showToast(`${typeLabels[activeType]}已保存。`);
}

function deleteCurrentEntry() {
  const entry = findEntry(activeType, selectedDate);
  if (!entry) return;

  if (pendingDeleteId !== entry.id) {
    pendingDeleteId = entry.id;
    dom.deleteEntryButton.textContent = "确认删除";
    dom.deleteEntryButton.classList.add("is-confirming");
    window.clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = window.setTimeout(resetDeleteConfirmation, 4200);
    showToast("再点一次删除当前记录。");
    return;
  }

  state.entries = state.entries.filter((item) => item.id !== entry.id);
  persist();
  clearFormFields();
  renderCalendar();
  renderSelectedDayEntries();
  renderReview();
  renderStats();
  showToast(`${typeLabels[activeType]}已删除。`);
}

function resetDeleteConfirmation() {
  pendingDeleteId = null;
  window.clearTimeout(pendingDeleteTimer);
  dom.deleteEntryButton.textContent = "删除";
  dom.deleteEntryButton.classList.remove("is-confirming");
}

function renderCalendar() {
  dom.calendarTitle.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(calendarCursor);

  const start = startOfCalendar(calendarCursor);
  const today = toDateInputValue(new Date());
  const markers = getCalendarMarkers();
  dom.calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const current = addDays(start, index);
    const dateValue = toDateInputValue(current);
    const button = document.createElement("button");
    const dayMarkers = markers.get(dateValue) ?? [];
    button.className = [
      "calendar-day",
      current.getMonth() !== calendarCursor.getMonth() ? "is-outside" : "",
      dateValue === today ? "is-today" : "",
      dateValue === selectedDate ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.type = "button";
    button.setAttribute("aria-label", `${formatFullDate(dateValue)}，${dayMarkers.map((type) => typeLabels[type]).join("、") || "没有记录"}`);
    button.innerHTML = `
      <span>${current.getDate()}</span>
      <span class="marks">${dayMarkers.map((type) => `<i class="${type}"></i>`).join("")}</span>
    `;
    button.addEventListener("click", () => selectDate(dateValue, { preferExisting: true }));
    dom.calendarGrid.appendChild(button);
  }
}

function renderSelectedDayEntries() {
  dom.selectedDayLabel.textContent = formatFullDate(selectedDate);
  const entries = getEntriesForDate(selectedDate);
  dom.dayEntries.innerHTML = "";

  if (!entries.length) {
    dom.dayEntries.innerHTML = `<div class="empty-state">这一天还没有记录。选择类型后直接开始写。</div>`;
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "day-entry-card";
    card.innerHTML = `
      <button type="button">
        <strong>
          <span class="type-pill ${entry.type}">${typeLabels[entry.type]}</span>
          <span>${entry.energy}/10</span>
        </strong>
        <p>${escapeHtml(getEntryPreview(entry))}</p>
      </button>
      <small>更新于 ${formatDateTime(entry.updatedAt)}</small>
    `;
    card.querySelector("button").addEventListener("click", () => {
      activeType = entry.type;
      setEntryType(entry.type);
      setView("write");
    });
    dom.dayEntries.appendChild(card);
  });
}

function renderReview() {
  const filtered = getFilteredEntries();
  renderMetrics(filtered);
  renderSignals(filtered);
  renderIteration(filtered);
}

function renderMetrics(entries) {
  const averageEnergy = entries.length
    ? (entries.reduce((sum, entry) => sum + entry.energy, 0) / entries.length).toFixed(1)
    : "-";
  const totalWords = entries.reduce((sum, entry) => sum + getEntryText(entry).length, 0);

  dom.metrics.innerHTML = [
    ["记录数", entries.length],
    ["平均能量", averageEnergy],
    ["日报天数", entries.filter((entry) => entry.type === "daily").length],
    ["文字量", totalWords],
    ["复盘数", entries.filter((entry) => entry.type !== "daily").length],
    ["连续天数", calculateStreak()],
  ]
    .map(
      ([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `,
    )
    .join("");
}

function renderSignals(entries) {
  dom.signals.innerHTML = "";

  if (!entries.length) {
    dom.signals.innerHTML = `<div class="empty-state">这个范围内还没有足够材料。</div>`;
    return;
  }

  const lowEnergy = entries.filter((entry) => entry.energy <= 4);
  const highEnergy = entries.filter((entry) => entry.energy >= 8);
  const repeatedWords = getRepeatedWords(entries);
  const recent = entries[0];

  const signals = [
    {
      title: "高能量样本",
      body: highEnergy.length
        ? `${highEnergy.length} 条记录能量达到 8 分以上。优先复盘这些日子的环境和行为。`
        : "暂时没有 8 分以上的记录，先关注能量被消耗的位置。",
    },
    {
      title: "低能量样本",
      body: lowEnergy.length
        ? `${lowEnergy.length} 条记录能量不高。可以找出共同触发条件。`
        : "低能量记录很少，当前节奏看起来相对稳定。",
    },
    {
      title: "反复出现的词",
      body: repeatedWords.length ? repeatedWords.join("、") : "还没有明显重复词，继续积累样本。",
    },
    {
      title: "最近一次复盘",
      body: `${typeLabels[recent.type]} ${formatDate(recent.date)}：${getEntryPreview(recent)}`,
    },
  ];

  signals.forEach((signal) => {
    const card = document.createElement("article");
    card.className = "signal-card";
    card.innerHTML = `<strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.body)}</p>`;
    dom.signals.appendChild(card);
  });
}

function renderIteration(entries) {
  const buckets = buildIterationBuckets(entries);
  renderList(dom.keepList, buckets.keep);
  renderList(dom.stopList, buckets.stop);
  renderList(dom.tryList, buckets.try);
}

function renderList(node, items) {
  node.innerHTML = "";
  if (!items.length) {
    node.innerHTML = "<li>继续记录后这里会自动汇总。</li>";
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    node.appendChild(li);
  });
}

function renderTemplates() {
  dom.templateTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.template === activeTemplateType);
  });
  dom.templateTitle.textContent = `${typeLabels[activeTemplateType]}模板`;
  dom.templatePrompts.innerHTML = "";

  state.templates[activeTemplateType].forEach((prompt, index) => {
    const card = document.createElement("article");
    card.className = "template-card";
    card.innerHTML = `
      <strong>问题 ${index + 1}</strong>
      <button class="mini-button" type="button">删除</button>
      <input aria-label="问题标题" value="${escapeAttribute(prompt.title)}" />
      <textarea aria-label="问题提示">${escapeHtml(prompt.hint)}</textarea>
    `;

    const deleteButton = card.querySelector("button");
    const titleInput = card.querySelector("input");
    const hintInput = card.querySelector("textarea");

    deleteButton.addEventListener("click", () => {
      if (state.templates[activeTemplateType].length === 1) {
        showToast("每个模板至少保留一个问题。");
        return;
      }
      state.templates[activeTemplateType].splice(index, 1);
      persist();
      renderTemplates();
      renderEntryForm();
      loadEntryIntoForm();
    });

    titleInput.addEventListener("input", () => {
      state.templates[activeTemplateType][index].title = titleInput.value;
      persist();
      renderEntryForm();
      loadEntryIntoForm();
    });

    hintInput.addEventListener("input", () => {
      state.templates[activeTemplateType][index].hint = hintInput.value;
      persist();
      renderEntryForm();
      loadEntryIntoForm();
    });

    dom.templatePrompts.appendChild(card);
  });
}

function renderReminders() {
  dom.reminderList.innerHTML = "";
  Object.entries(state.reminders).forEach(([type, reminder]) => {
    const card = document.createElement("article");
    card.className = "reminder-card";
    card.innerHTML = `
      <input aria-label="启用${typeLabels[type]}提醒" type="checkbox" ${reminder.enabled ? "checked" : ""} />
      <strong>${typeLabels[type]}</strong>
      ${renderDaySelector(type, reminder.day)}
      <input aria-label="${typeLabels[type]}提醒时间" type="time" value="${reminder.time}" />
    `;

    const checkbox = card.querySelector("input[type='checkbox']");
    const selector = card.querySelector("select");
    const time = card.querySelector("input[type='time']");

    checkbox.addEventListener("change", () => {
      reminder.enabled = checkbox.checked;
      persist();
      scheduleReminders();
      renderStats();
    });
    selector.addEventListener("change", () => {
      reminder.day = selector.value;
      persist();
      scheduleReminders();
      renderStats();
    });
    time.addEventListener("change", () => {
      reminder.time = time.value;
      persist();
      scheduleReminders();
      renderStats();
    });

    dom.reminderList.appendChild(card);
  });
}

function renderDaySelector(type, value) {
  if (type === "daily") {
    return `<select aria-label="日报提醒周期"><option value="everyday">每天</option></select>`;
  }
  if (type === "weekly") {
    return `
      <select aria-label="周报提醒星期">
        ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
          .map((label, index) => `<option value="${index}" ${String(index) === value ? "selected" : ""}>${label}</option>`)
          .join("")}
      </select>
    `;
  }
  return `
    <select aria-label="月报提醒日期">
      <option value="last" ${value === "last" ? "selected" : ""}>每月最后一天</option>
      ${Array.from({ length: 28 }, (_, index) => index + 1)
        .map((day) => `<option value="${day}" ${String(day) === value ? "selected" : ""}>每月 ${day} 日</option>`)
        .join("")}
    </select>
  `;
}

function renderStats() {
  dom.streakCount.textContent = `${calculateStreak()} 天`;
  const next = getNextReminder();
  dom.nextReminder.textContent = next
    ? `下次提醒：${typeLabels[next.type]} ${formatDateTime(next.date.toISOString())}`
    : "尚未开启提醒";
}

function getFilteredEntries() {
  const days = Number(dom.reviewRange.value);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const keyword = dom.searchInput.value.trim().toLowerCase();

  return state.entries.filter((entry) => {
    const inRange = new Date(`${entry.date}T23:59:59`) >= cutoff;
    const matched = !keyword || getEntryText(entry).toLowerCase().includes(keyword);
    return inRange && matched;
  });
}

function buildIterationBuckets(entries) {
  const textByPrompt = entries.flatMap((entry) => {
    const template = state.templates[entry.type] ?? [];
    return entry.answers.map((answer, index) => ({
      prompt: template[index]?.title ?? "",
      answer,
      energy: entry.energy,
    }));
  });

  const keep = textByPrompt
    .filter((item) => item.energy >= 7 || /保留|有效|完成|顺利|开心|推进|专注/.test(item.prompt + item.answer))
    .map((item) => summarizeAnswer(item.answer));
  const stop = textByPrompt
    .filter((item) => item.energy <= 4 || /阻力|拖慢|放弃|停止|卡住|消耗/.test(item.prompt + item.answer))
    .map((item) => summarizeAnswer(item.answer));
  const tryNext = textByPrompt
    .filter((item) => /明天|下周|下个月|尝试|实验|改|迭代/.test(item.prompt + item.answer))
    .map((item) => summarizeAnswer(item.answer));

  return {
    keep: dedupe(keep).filter(Boolean),
    stop: dedupe(stop).filter(Boolean),
    try: dedupe(tryNext).filter(Boolean),
  };
}

function scheduleReminders() {
  if (reminderTimer) window.clearTimeout(reminderTimer);
  syncNativeReminders();
  const next = getNextReminder();
  if (!next) return;

  const delay = Math.max(1000, next.date.getTime() - Date.now());
  reminderTimer = window.setTimeout(() => {
    notify(next.type);
    scheduleReminders();
    renderStats();
  }, Math.min(delay, 2147483647));
}

function getNextReminder() {
  const enabled = Object.entries(state.reminders)
    .filter(([, reminder]) => reminder.enabled)
    .map(([type, reminder]) => ({
      type,
      date: computeNextReminderDate(type, reminder),
    }))
    .filter((item) => item.date);

  return enabled.sort((a, b) => a.date - b.date)[0] ?? null;
}

function computeNextReminderDate(type, reminder) {
  const [hour, minute] = reminder.time.split(":").map(Number);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);

  if (type === "daily") {
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  if (type === "weekly") {
    const targetDay = Number(reminder.day);
    const daysUntil = (targetDay - candidate.getDay() + 7) % 7;
    candidate.setDate(candidate.getDate() + daysUntil);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 7);
    return candidate;
  }

  if (reminder.day === "last") {
    candidate.setDate(lastDayOfMonth(candidate));
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setDate(lastDayOfMonth(candidate));
    }
    return candidate;
  }

  candidate.setDate(Number(reminder.day));
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

function requestNotificationPermission() {
  syncNativeReminders();
  if (!("Notification" in window)) {
    showToast("已尝试同步到 macOS 通知；当前环境不支持浏览器通知。");
    return;
  }
  Notification.requestPermission().then((permission) => {
    showToast(permission === "granted" ? "通知权限已开启。" : "没有获得通知权限。");
  });
}

function notify(type) {
  const title = `该写${typeLabels[type]}了`;
  const body = "花几分钟给未来的自己留一点材料。";
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  } else {
    showToast(`${title}：${body}`);
  }
}

function syncNativeReminders() {
  const bridge = window.webkit?.messageHandlers?.reflectionReminders;
  if (!bridge) return;
  bridge.postMessage(state.reminders);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reflection-helper-${toDateInputValue(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("数据已导出。");
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      entries: [],
      templates: deepClone(defaultTemplates),
      reminders: deepClone(defaultReminders),
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      entries: parsed.entries ?? [],
      templates: { ...deepClone(defaultTemplates), ...(parsed.templates ?? {}) },
      reminders: { ...deepClone(defaultReminders), ...(parsed.reminders ?? {}) },
    };
  } catch {
    return {
      entries: [],
      templates: deepClone(defaultTemplates),
      reminders: deepClone(defaultReminders),
    };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findEntry(type, date) {
  return state.entries.find((entry) => entry.type === type && entry.date === date);
}

function getEntriesForDate(date) {
  return state.entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
}

function getCalendarMarkers() {
  const markers = new Map();
  state.entries.forEach((entry) => {
    if (!markers.has(entry.date)) markers.set(entry.date, []);
    const list = markers.get(entry.date);
    if (!list.includes(entry.type)) list.push(entry.type);
    list.sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
  });
  return markers;
}

function sortEntries() {
  state.entries.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
  });
}

function calculateStreak() {
  const dailyDates = new Set(state.entries.filter((entry) => entry.type === "daily").map((entry) => entry.date));
  let cursor = new Date();
  let count = 0;

  while (dailyDates.has(toDateInputValue(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

function getEntryText(entry) {
  return [...entry.answers, entry.freeNote].join(" ");
}

function getEntryPreview(entry) {
  const text = getEntryText(entry).trim();
  return text ? `${text.slice(0, 76)}${text.length > 76 ? "..." : ""}` : "这条记录还很安静。";
}

function getRepeatedWords(entries) {
  const ignored = new Set(["今天", "这个", "一个", "自己", "没有", "因为", "所以", "还是", "感觉", "记录"]);
  const counts = {};
  entries
    .flatMap((entry) => getEntryText(entry).match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) ?? [])
    .map((word) => word.toLowerCase())
    .filter((word) => !ignored.has(word))
    .forEach((word) => {
      counts[word] = (counts[word] ?? 0) + 1;
    });

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => `${word}(${count})`);
}

function summarizeAnswer(answer) {
  return answer.trim().replace(/\s+/g, " ").slice(0, 54);
}

function dedupe(items) {
  return [...new Set(items)];
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCalendar(date) {
  const start = firstDayOfMonth(date);
  const mondayIndex = (start.getDay() + 6) % 7;
  return addDays(start, -mondayIndex);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function toDateInputValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(parseDate(dateString));
}

function formatReadableDate(dateString) {
  const date = parseDate(dateString);
  const today = toDateInputValue(new Date());
  if (dateString === today) return "今天";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatFullDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(parseDate(dateString));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => dom.toast.classList.remove("is-visible"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}
