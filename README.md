# Antigravity 汉化、用量统计与代理整合工具

本仓库整合了 **Antigravity 中文汉化（OTA 跨版本自愈）**、**进程级代理启动与快捷方式自愈**，以及 **本地 Token 用量统计组件与官方 MCP App 插件**。

## 核心功能

1. **全模块中文汉化（适配 Antigravity v2.35+）**：
   - `assets/dom-translator.js`：前端 DOM 动态翻译引擎（4,216 条 Web UI 词条 + 121 条核心短语 + Shadow DOM / SPA 路由支持）。
   - `assets/menu-translator.js` & `assets/menu_dict.json`：顶部菜单栏、聊天列表右键菜单与系统弹窗翻译（134 条菜单词条）。
   - `assets/main_patches.json`：覆盖 17 个主进程 JS 模块（系统托盘、更新提示、WSL、Remote SSH 断连页/凭据弹窗、Passkey、安全弹窗等）。
2. **界面快捷用量胶囊（`assets/quota-widget.js`）**：
   - 自动在 **聊天输入框模型选择器右侧** 与 **左下角「设置」同行右侧** 挂载用量胶囊；
   - 点击弹出悬浮卡片，打开即自动增量读取本地会话日志并展示 **本会话累计（含缓存命中率）、近 5 小时 / 今日累计、最近一轮输入输出**。
3. **官方用量统计插件（`usage-tracker/`）**：
   - 支持 `/usage` 在对话中渲染交互式内嵌图表卡片（支持切换当前会话 / 近 5 小时 / 今日 / 近 7 天 / 全部、按模型分布与逐轮明细）；
   - 包含每轮回复末尾简洁 Token 摘要规则与 `Stop` 生命周期钩子静默缓存。
4. **进程级代理与开机快捷方式自愈**：
   - 仅在启动 Antigravity 子进程时注入 `HTTP_PROXY` / `HTTPS_PROXY`（默认 `http://127.0.0.1:7897`），不污染全局环境变量；
   - 通过 `repoint-shortcuts.ps1` 与 `self-heal-shortcuts.ps1` 自动修复被官方更新重置的快捷方式。

## 常用入口

- **一键汉化修复并代理启动**：双击 [`one-click-zh-proxy.cmd`](one-click-zh-proxy.cmd)（或桌面 `Antigravity-一键汉化修复.lnk`）
- **日常带代理直接启动**：[`launch-proxy.cmd`](launch-proxy.cmd)（开始菜单 `Antigravity.lnk`）
- **无损还原官方英文版**：[`restore-en.cmd`](restore-en.cmd)
- **修改代理端口**：编辑 [`config.json`](config.json) 中的 `proxy` 字段（默认 `http://127.0.0.1:7897`）

## 安装插件（新电脑开箱即用，零依赖免 npm install）

仓库内的 `usage-tracker/` 与 `plugin-manager/` 均已内置单文件打包产物（`dist/mcp-server.cjs` 与 `dist/*.html`），无需执行 `npm install`：

1. **推荐：安装「插件管理中心」（`plugin-manager`）**
   将仓库内的 `plugin-manager/` 目录复制到 `%USERPROFILE%\.gemini\config\plugins\plugin-manager\` 即可在 Antigravity 左侧插件栏或右侧辅助栏启用插件管理中心（支持从 GitHub 仓库/子目录、npm 包或本地目录安装、检查更新与卸载）。
2. **安装 `/usage` 与每轮用量摘要（`usage-tracker`）**
   - **方式 A**：在「插件管理中心」点击 `+ 添加插件`，输入 `https://github.com/dyjx20004/Antigravity-zh-CN#usage-tracker` 一键安装（后续可一键检查更新）。
   - **方式 B**：手动将仓库内的 `usage-tracker/` 目录复制到 `%USERPROFILE%\.gemini\config\plugins\usage-tracker\` 即可生效。
