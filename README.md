# Reflection Helper

> 写下行为，回到自己。

一个面向 macOS 的轻量级个人复盘桌面工具。零依赖、纯前端实现，数据完全存储在本地 `localStorage` 中，也可打包为独立 macOS 应用。

> **⚠️ 项目正在积极开发中，功能和界面可能随时变化。**

## 功能

- **三阶记录** — 日报 / 周报 / 月报，内置可自定义的复盘问题模板
- **专注主界面** — 首页围绕记录和当前迭代展开，日历按需从右侧滑出，设置固定在左下角
- **横向复盘板** — 模板问题横向铺开，回答按行自动编号，每一行都可贴到左侧迭代板
- **迭代提醒板** — 集中查看从反思里提炼出的「继续 / 调整 / 尝试」，支持归档
- **回顾与洞察** — 设置中按时间范围和关键词筛选，自动汇总复盘信号，并处理当前迭代项
- **提醒系统** — 设置中分别配置日报、周报、月报提醒；macOS 应用支持系统级本地通知
- **模板自定义** — 设置中为每种记录类型编辑复盘问题和提示
- **数据导出** — 设置中一键导出 JSON，方便备份或迁移

## 快速开始

### 浏览器直接打开

```bash
open index.html
```

> 浏览器版本需要保持页面打开才能触发提醒。

### 构建 macOS 应用

需要 macOS + Xcode Command Line Tools（提供 `swiftc`）。

```bash
bash scripts/build-mac.sh
open "build/Reflection Helper.app"
```

macOS 应用会将提醒同步到系统本地通知，无需保持页面打开。

## 技术栈

- **纯前端**：HTML + CSS + Vanilla JavaScript，零依赖
- **存储**：`localStorage`
- **macOS 壳**：Swift + WebKit + UserNotifications，通过构建脚本打包为 `.app`

## 项目结构

```
├── index.html          # 主页面
├── app.js              # 应用逻辑
├── styles.css           # 样式
├── mac/
│   ├── Info.plist       # macOS 应用配置
│   └── ReflectionHelperLauncher.swift  # macOS 原生壳
├── scripts/
│   └── build-mac.sh     # macOS 应用构建脚本
└── tests/
    └── app-smoke-test.mjs  # 冒烟测试
```

## Roadmap

- [ ] 菜单栏驻留 & 开机启动
- [ ] 本地文件备份 & 可选加密
- [ ] 趋势可视化（记录频率、关键词变化等）
- [ ] 本地 AI 复盘摘要 & 行为模式识别

## License

MIT
