import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  toggle(value, force) {
    if (force === undefined) {
      if (this.contains(value)) this.remove(value);
      else this.add(value);
    } else if (force) this.add(value);
    else this.remove(value);
    return this.contains(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName = "div", attrs = {}) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = attrs.dataset ?? {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.classList = new FakeClassList();
    this.disabled = false;
    this.value = attrs.value ?? "";
    this.textContent = "";
    this.type = attrs.type ?? "";
    this.id = attrs.id ?? "";
    this.checked = attrs.checked ?? false;
    this.parent = null;
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];

    for (const match of value.matchAll(/<textarea([^>]*)>([\s\S]*?)<\/textarea>|<textarea([^>]*)><\/textarea>/g)) {
      const attrs = match[1] ?? match[3] ?? "";
      const index = attrs.match(/data-prompt-index="(\d+)"/)?.[1];
      const textarea = new FakeElement("textarea", {
        dataset: index === undefined ? {} : { promptIndex: index },
        value: match[2] ?? "",
      });
      textarea.parent = this;
      this.children.push(textarea);
    }

    if (value.includes('class="line-action-list"')) {
      const lineActions = new FakeElement("div");
      lineActions.className = "line-action-list";
      lineActions.parent = this;
      this.children.push(lineActions);
    }

    for (const match of value.matchAll(/<button([^>]*)>/g)) {
      const attrs = match[1] ?? "";
      const button = new FakeElement("button", {
        dataset: {
          ...(attrs.match(/data-line-index="(\d+)"/)?.[1] === undefined ? {} : { lineIndex: attrs.match(/data-line-index="(\d+)"/)?.[1] }),
          ...(attrs.match(/data-action="([^"]+)"/)?.[1] === undefined ? {} : { action: attrs.match(/data-action="([^"]+)"/)?.[1] }),
        },
      });
      button.className = attrs.match(/class="([^"]+)"/)?.[1] ?? "";
      button.parent = this;
      this.children.push(button);
    }

    for (const match of value.matchAll(/<input([^>]*)>/g)) {
      const attrs = match[1] ?? "";
      const input = new FakeElement("input");
      input.className = attrs.match(/class="([^"]+)"/)?.[1] ?? "";
      input.checked = attrs.includes("checked");
      input.parent = this;
      this.children.push(input);
    }

    if (value.includes("<select")) {
      const select = new FakeElement("select");
      select.parent = this;
      this.children.push(select);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (selector.startsWith(".") && node.className.split(/\s+/).includes(selector.slice(1))) matches.push(node);
      if (selector.startsWith("[data-action='") && node.dataset.action === selector.match(/\[data-action='([^']+)'\]/)?.[1]) matches.push(node);
      if (selector === "textarea" && node.tagName === "textarea") matches.push(node);
      if (selector === "button" && node.tagName === "button") matches.push(node);
      if (selector === "input" && node.tagName === "input") matches.push(node);
      if (selector === "input[type='checkbox']" && node.tagName === "input") matches.push(node);
      if (selector === "input[type='time']" && node.tagName === "input") matches.push(node);
      if (selector === "select" && node.tagName === "select") matches.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }

  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (selector.startsWith(".") && node.className.split(/\s+/).includes(selector.slice(1))) return node;
      if (selector === "button[data-line-index]" && node.tagName === "button" && node.dataset.lineIndex !== undefined) return node;
      node = node.parent;
    }
    return null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function createDom() {
  const ids = new Map();
  const make = (id, tagName = "div") => {
    const element = new FakeElement(tagName);
    ids.set(id, element);
    return element;
  };

  [
    "todayLabel",
    "appShell",
    "entryHeading",
    "entryDate",
    "entryForm",
    "freeNote",
    "saveEntryButton",
    "deleteEntryButton",
    "newEntryButton",
    "contextPanel",
    "contextToggleButton",
    "closeContextButton",
    "settingsDrawer",
    "settingsToggleButton",
    "closeSettingsButton",
    "drawerBackdrop",
    "dayEntries",
    "selectedDayLabel",
    "jumpTodayButton",
    "calendarTitle",
    "calendarGrid",
    "prevMonthButton",
    "nextMonthButton",
    "nextReminder",
    "iterationList",
    "iterationCount",
    "reviewRange",
    "searchInput",
    "metrics",
    "signals",
    "keepList",
    "stopList",
    "tryList",
    "templateTitle",
    "templatePrompts",
    "addPromptButton",
    "reminderList",
    "permissionButton",
    "exportButton",
    "toast",
  ].forEach((id) => make(id));

  ids.get("entryDate").value = "2026-06-17";
  ids.get("reviewRange").value = "30";
  ids.get("searchInput").value = "";
  ids.get("freeNote").tagName = "textarea";

  const segments = ["daily", "weekly", "monthly"].map((type) => new FakeElement("button", { dataset: { type } }));
  const templateTabs = ["daily", "weekly", "monthly"].map((template) => new FakeElement("button", { dataset: { template } }));
  const settingsTabs = ["review", "templates", "reminders", "data"].map((section) => new FakeElement("button", { dataset: { settingsSection: section } }));
  const settingsSections = ["reviewSection", "templatesSection", "remindersSection", "dataSection"].map((id) => {
    const element = new FakeElement("section");
    element.id = id;
    return element;
  });

  return {
    querySelector(selector) {
      if (!selector.startsWith("#")) return null;
      return ids.get(selector.slice(1));
    },
    querySelectorAll(selector) {
      if (selector === ".segment") return segments;
      if (selector === ".template-tab") return templateTabs;
      if (selector === ".settings-tab") return settingsTabs;
      if (selector === ".settings-section") return settingsSections;
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    ids,
  };
}

const storage = new Map();
const nativeWrites = [];
const fakeDocument = createDom();
const context = {
  console,
  document: fakeDocument,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  Notification: undefined,
  Intl,
  Date,
  Map,
  Set,
  JSON,
  RegExp,
  String,
  Number,
  Array,
  window: {
    confirm: () => true,
    clearTimeout: () => {},
    setTimeout: () => 0,
    prompt: (_message, value) => `${value} rewritten`,
    __REFLECTION_HELPER_NATIVE_STORAGE__: true,
    __REFLECTION_HELPER_NATIVE_STATE__: null,
    webkit: {
      messageHandlers: {
        reflectionStorage: {
          postMessage: (value) => nativeWrites.push(value),
        },
      },
    },
  },
};
context.window.window = context.window;

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

context.setContextPanelOpen(true);
assert.equal(fakeDocument.ids.get("contextPanel").classList.contains("is-open"), true);
context.setContextPanelOpen(false);
assert.equal(fakeDocument.ids.get("contextPanel").classList.contains("is-open"), false);
context.setSettingsDrawerOpen(true);
assert.equal(fakeDocument.ids.get("settingsDrawer").classList.contains("is-open"), true);
context.setSettingsSection("templates");
context.setSettingsDrawerOpen(false);
assert.equal(fakeDocument.ids.get("settingsDrawer").classList.contains("is-open"), false);

context.selectDate("2026-06-15");
for (const type of ["daily", "weekly", "monthly"]) {
  context.setEntryType(type);
  const textareas = fakeDocument.ids.get("entryForm").querySelectorAll("textarea");
  textareas.forEach((textarea, index) => {
    textarea.value = index === 0 ? `${type} answer ${index}\n${type} next ${index}` : `${type} answer ${index}`;
  });
  fakeDocument.ids.get("freeNote").value = `${type} free note`;
  context.saveCurrentEntry();
}

let saved = JSON.parse(nativeWrites[nativeWrites.length - 1]);
assert.deepEqual(saved.iterationItems, []);
assert.deepEqual(
  saved.entries.filter((entry) => entry.date === "2026-06-15").map((entry) => entry.type).sort(),
  ["daily", "monthly", "weekly"],
);
assert.equal(saved.entries.find((entry) => entry.id === "daily-2026-06-15").answers[0], "daily answer 0\ndaily next 0");

context.setEntryType("daily");
context.createIterationFromLine(0, "daily next 0");
context.createIterationFromLine(0, "daily next 0");
saved = JSON.parse(nativeWrites[nativeWrites.length - 1]);
assert.equal(saved.iterationItems.length, 1);
assert.equal(saved.iterationItems[0].text, "daily next 0");
assert.equal(saved.iterationItems[0].sourceEntryId, "daily-2026-06-15");
assert.equal(saved.iterationItems[0].kind, "keep");
assert.equal(saved.iterationItems[0].status, "active");
assert.equal(fakeDocument.ids.get("iterationCount").textContent, "1");

context.rewriteIterationItem(saved.iterationItems[0].id, "明天尝试早 10 分钟开始");
saved = JSON.parse(nativeWrites[nativeWrites.length - 1]);
assert.equal(saved.iterationItems[0].text, "明天尝试早 10 分钟开始");
assert.equal(saved.iterationItems[0].kind, "try");

context.archiveIterationItem(saved.iterationItems[0].id);
saved = JSON.parse(nativeWrites[nativeWrites.length - 1]);
assert.equal(saved.iterationItems[0].status, "archived");
assert.ok(saved.iterationItems[0].archivedAt);
assert.equal(fakeDocument.ids.get("iterationCount").textContent, "0");

context.renderCalendar();
const day15 = fakeDocument.ids
  .get("calendarGrid")
  .children.find((child) => child.attributes["aria-label"]?.includes("2026年6月15日星期一"));
assert.ok(day15.attributes["aria-label"].includes("日报、周报、月报"));

context.renderSelectedDayEntries();
assert.equal(fakeDocument.ids.get("dayEntries").children.length, 3);
assert.equal(fakeDocument.ids.get("deleteEntryButton").disabled, false);

context.setEntryType("daily");
context.deleteCurrentEntry();
assert.equal(fakeDocument.ids.get("deleteEntryButton").textContent, "确认删除");
context.deleteCurrentEntry();
saved = JSON.parse(nativeWrites[nativeWrites.length - 1]);
assert.deepEqual(
  saved.entries.filter((entry) => entry.date === "2026-06-15").map((entry) => entry.type).sort(),
  ["monthly", "weekly"],
);

const legacyStorage = new Map([
  [
    "reflection-helper-state-v1",
    JSON.stringify({
      entries: [],
      templates: {},
      reminders: {},
      todos: [
        {
          id: "todo-open",
          text: "legacy open",
          done: false,
          sourceEntryId: "daily-2026-06-10",
          sourceType: "daily",
          sourceDate: "2026-06-10",
          promptTitle: "明天只改一个动作，会改什么？",
          createdAt: "2026-06-10T12:00:00.000Z",
        },
        {
          id: "todo-done",
          text: "legacy done",
          done: true,
          sourceEntryId: "daily-2026-06-11",
          sourceType: "daily",
          sourceDate: "2026-06-11",
          promptTitle: "明天只改一个动作，会改什么？",
          createdAt: "2026-06-11T12:00:00.000Z",
        },
      ],
    }),
  ],
]);
const legacyDocument = createDom();
const legacyNativeWrites = [];
const legacyContext = {
  ...context,
  document: legacyDocument,
  localStorage: {
    getItem: (key) => legacyStorage.get(key) ?? null,
    setItem: (key, value) => legacyStorage.set(key, value),
  },
};
legacyContext.window = {
  ...context.window,
  __REFLECTION_HELPER_NATIVE_STORAGE__: true,
  __REFLECTION_HELPER_NATIVE_STATE__: null,
  webkit: {
    messageHandlers: {
      reflectionStorage: {
        postMessage: (value) => legacyNativeWrites.push(value),
      },
    },
  },
};
legacyContext.window.window = legacyContext.window;
vm.createContext(legacyContext);
vm.runInContext(fs.readFileSync("app.js", "utf8"), legacyContext);
const migrated = JSON.parse(legacyNativeWrites[legacyNativeWrites.length - 1]).iterationItems;
assert.equal(migrated.length, 1);
assert.equal(migrated[0].text, "legacy open");
assert.equal(migrated[0].kind, "try");
assert.equal(migrated[0].status, "active");

const previewStorage = new Map();
const previewDocument = createDom();
const previewContext = {
  ...context,
  document: previewDocument,
  localStorage: {
    getItem: (key) => previewStorage.get(key) ?? null,
    setItem: (key, value) => previewStorage.set(key, value),
  },
};
previewContext.window = {
  ...context.window,
  __REFLECTION_HELPER_NATIVE_STORAGE__: false,
  __REFLECTION_HELPER_NATIVE_STATE__: null,
  webkit: undefined,
};
previewContext.window.window = previewContext.window;
vm.createContext(previewContext);
vm.runInContext(fs.readFileSync("app.js", "utf8"), previewContext);
previewContext.selectDate("2026-06-16");
previewContext.saveCurrentEntry();
assert.equal(previewStorage.get("reflection-helper-state-v1"), undefined);

console.log("app smoke test passed");
