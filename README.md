# Reflection Helper

> 写下行为，回到自己。

一个面向 macOS 的轻量级个人复盘桌面工具。零依赖、纯前端实现，数据完全存储在本地 `localStorage` 中，也可打包为独立 macOS 应用。

> **⚠️ 项目正在积极开发中，功能和界面可能随时变化。**

## 功能

- **三阶记录** — 日报 / 周报 / 月报，内置可自定义的复盘问题模板
- **日历视图** — 直观展示记录分布，点击任意日期快速跳转
- **回顾与洞察** — 按时间范围和关键词筛选，自动汇总复盘信号与「继续 / 停止 / 尝试」迭代清单
- **能量追踪** — 每条记录附带 1–10 能量评分，回顾时自动识别高/低能量模式
- **提醒系统** — 可分别设置日报、周报、月报提醒；macOS 应用支持系统级本地通知
- **模板自定义** — 为每种记录类型编辑复盘问题和提示
- **数据导出** — 一键导出 JSON，方便备份或迁移
- **可收缩侧边栏** — 日历与当天记录按需从右侧调出

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
- [ ] 趋势可视化（能量曲线、记录频率等）
- [ ] 本地 AI 复盘摘要 & 行为模式识别

## License

MIT
