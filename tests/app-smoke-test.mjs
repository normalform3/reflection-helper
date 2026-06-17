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
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];

    for (const match of value.matchAll(/<textarea([^>]*)>([\s\S]*?)<\/textarea>|<textarea([^>]*)><\/textarea>/g)) {
      const attrs = match[1] ?? match[3] ?? "";
      const index = attrs.match(/data-prompt-index="(\d+)"/)?.[1];
      this.children.push(
        new FakeElement("textarea", {
          dataset: index === undefined ? {} : { promptIndex: index },
          value: match[2] ?? "",
        }),
      );
    }

    if (value.includes("<button")) this.children.push(new FakeElement("button"));
    if (value.includes("<input")) this.children.push(new FakeElement("input"));
    if (value.includes("<select")) this.children.push(new FakeElement("select"));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
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
    "sidebarToggle",
    "entryHeading",
    "entryDate",
    "energyLevel",
    "energyOutput",
    "entryForm",
    "freeNote",
    "saveEntryButton",
    "deleteEntryButton",
    "newEntryButton",
    "contextPanel",
    "contextToggleButton",
    "closeContextButton",
    "dayEntries",
    "selectedDayLabel",
    "jumpTodayButton",
    "calendarTitle",
    "calendarGrid",
    "prevMonthButton",
    "nextMonthButton",
    "streakCount",
    "nextReminder",
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
  ids.get("energyLevel").value = "6";
  ids.get("reviewRange").value = "30";
  ids.get("searchInput").value = "";
  ids.get("freeNote").tagName = "textarea";

  const navItems = ["write", "review", "templates", "settings"].map((view) => new FakeElement("button", { dataset: { view } }));
  const segments = ["daily", "weekly", "monthly"].map((type) => new FakeElement("button", { dataset: { type } }));
  const templateTabs = ["daily", "weekly", "monthly"].map((template) => new FakeElement("button", { dataset: { template } }));
  const views = ["writeView", "reviewView", "templatesView", "settingsView"].map(() => new FakeElement("section"));

  return {
    querySelector(selector) {
      if (!selector.startsWith("#")) return null;
      return ids.get(selector.slice(1));
    },
    querySelectorAll(selector) {
      if (selector === ".nav-item") return navItems;
      if (selector === ".segment") return segments;
      if (selector === ".template-tab") return templateTabs;
      if (selector === ".view") return views;
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    ids,
  };
}

const storage = new Map();
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
    webkit: undefined,
  },
};
context.window.window = context.window;

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

context.toggleSidebar();
assert.equal(fakeDocument.ids.get("appShell").classList.contains("is-sidebar-collapsed"), true);
context.toggleSidebar();
assert.equal(fakeDocument.ids.get("appShell").classList.contains("is-sidebar-collapsed"), false);
context.setContextPanelOpen(true);
assert.equal(fakeDocument.ids.get("contextPanel").classList.contains("is-open"), true);
context.setContextPanelOpen(false);
assert.equal(fakeDocument.ids.get("contextPanel").classList.contains("is-open"), false);

context.selectDate("2026-06-15");
for (const type of ["daily", "weekly", "monthly"]) {
  context.setEntryType(type);
  const textareas = fakeDocument.ids.get("entryForm").querySelectorAll("textarea");
  textareas.forEach((textarea, index) => {
    textarea.value = `${type} answer ${index}`;
  });
  fakeDocument.ids.get("freeNote").value = `${type} free note`;
  context.saveCurrentEntry();
}

let saved = JSON.parse(storage.get("reflection-helper-state-v1"));
assert.deepEqual(
  saved.entries.filter((entry) => entry.date === "2026-06-15").map((entry) => entry.type).sort(),
  ["daily", "monthly", "weekly"],
);

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
saved = JSON.parse(storage.get("reflection-helper-state-v1"));
assert.deepEqual(
  saved.entries.filter((entry) => entry.date === "2026-06-15").map((entry) => entry.type).sort(),
  ["monthly", "weekly"],
);

console.log("app smoke test passed");
