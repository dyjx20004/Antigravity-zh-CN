# Antigravity-zh-CN（增强二次开发版）

<div align="center">

**Google Antigravity 桌面端深度汉化 · 快捷方式自动修复 · 进程级代理启动 一体化工具集**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)](https://www.microsoft.com/windows)
[![Target](https://img.shields.io/badge/Antigravity-v2.33.0%2B-brightgreen.svg)](#)
[![Python](https://img.shields.io/badge/Python-3.8%2B-yellow.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](Antigravity-zh-CN/LICENSE)

</div>

---

## 📦 直接下载安装（推荐 · 新电脑免装 Python）

1. 前往 [**Releases 最新版本页面**](https://github.com/dyjx20004/Antigravity-zh-CN/releases/latest) 下载 **`Antigravity-zh-CN-Windows-x64.zip`**（内置已编译好的 `Antigravity-Patcher.exe` 与 `Restore.exe`）；
2. 解压到本地任意目录（例如 `D:\Tools\Antigravity-zh-CN`）；
3. （可选）如果本地代理不是 `127.0.0.1:7897`，用记事本打开 [`config.cmd`](config.cmd) 修改 `ANTIGRAVITY_PROXY`；
4. 双击 **`run-all.cmd`** 即可一键完成「**中文汉化 → 快捷方式修复 → 代理启动**」！

> 💡 **提示**：首次运行后，可运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-desktop-shortcut.ps1` 在桌面生成一键快捷方式。每次 Antigravity 官方更新后，再双击一次即可恢复中文与代理。

---

## ✨ 项目简介

本项目基于开源项目 [MIMICTE/Antigravity-zh-CN](https://github.com/MIMICTE/Antigravity-zh-CN) 进行了针对 **Antigravity v2.33.0+** 的全面二次开发，并将日常使用所需的三个核心流程整合为**一键脚本**：

1. **深度中文汉化（模块化解耦 + OTA 冲突自愈）**：
   - 相比原版仅覆盖 `v2.21.1` 的单文件脚本，本项目将词典与规则拆分为 `zh_data/` 模块化资源，Web UI 词典扩充至 **4,216 条**，并补全了应用菜单、右键上下文菜单、系统托盘、更新提示、Remote SSH / 断连页 / 凭据弹窗、WSL、Passkey、Computer Use HUD 等 **17 个主进程模块**。
   - 修正了原版词库中模型 `New` 徽章误译为「新建」、`Tab` 误译为「制表符」、`Quote Ctrl+L` 正则失效等历史问题，并统一了全站术语。
   - 修复 Windows 下官方 OTA 更新释放新版 `app.asar` 时与旧 `app.asar.disabled` 共存导致的 `WinError 183` 冲突。
2. **自动修复快捷方式**：
   - 扫描桌面、开始菜单与任务栏固定栏中的 Antigravity 快捷方式，自动备份原 `.lnk` 至 `backups\`，并统一重指向本项目的代理启动脚本 `Antigravity-Proxy.cmd`（内置白名单保护，不会误改一键工具快捷方式）。
3. **进程级代理启动**：
   - 仅在启动 Antigravity 子进程时注入 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`（默认 `http://127.0.0.1:7897`），不污染 Windows 全局环境变量，解决 Go 核心服务（`language_server.exe`）忽略系统代理导致卡加载的问题。

---

## 🚀 快速开始

### 方式一：直接使用（无需编译，需本机有 Python 3.8+）
1. 克隆本仓库：
   ```bash
   git clone https://github.com/dyjx20004/Antigravity-zh-CN.git
   cd Antigravity-zh-CN
   ```
2. （可选）如本地代理端口不是 `7897`，编辑 [`config.cmd`](config.cmd) 中的 `ANTIGRAVITY_PROXY`。
3. 双击运行 **`run-all.cmd`**（自动依次执行：汉化注入 → 修复快捷方式 → 代理启动）。
   - 若目录中存在编译后的 `dist\Antigravity-Patcher.exe` 会优先调用；否则自动回退使用 `python Antigravity-zh-CN\Antigravity-Patcher.py` 执行。

### 方式二：编译独立 `.exe` 后使用（推荐日常双击）
1. 确保已安装 PyInstaller（`pip install pyinstaller`）；
2. 双击运行 **`build.cmd`**，将在 `dist\` 下生成：
   - `dist\Antigravity-Patcher.exe`（内嵌 `zh_data` 全部词典与规则）
   - `dist\Restore.exe`
3. （可选）运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-desktop-shortcut.ps1` 在桌面生成一键快捷方式 `Antigravity-一键汉化修复.lnk`。

> **客户端更新后怎么办？**
> 当 Antigravity 自动更新导致界面恢复英文或快捷方式被重置时，只需再次双击 **`run-all.cmd`**（或桌面快捷方式），脚本会自动归档旧备份、解包新版并重新绑定代理。

---

## 📁 目录结构

```text
.
├── run-all.cmd                       # 【主入口】一键运行全部 3 个流程
├── Antigravity-Proxy.cmd             # 进程级代理启动脚本（快捷方式最终目标）
├── install-zh-patch.cmd              # 单步：仅安装/更新中文汉化补丁
├── fix-shortcut.cmd                  # 单步：仅修复系统内 Antigravity 快捷方式
├── restore-en.cmd                    # 单步：一键还原官方纯净英文原版并代理重启
├── build.cmd                         # 编译入口：使用 PyInstaller 生成 dist\*.exe
├── config.cmd                        # 统一代理配置（默认 http://127.0.0.1:7897）
├── AGENT.md                          # AI 编程助手协作与二次开发规范
├── Antigravity-zh-CN\                # 汉化核心源码与模块化词典
│   ├── Antigravity-Patcher.py        # 纯原生 Python ASAR 解包与全模块注入器
│   ├── Restore.py                    # 官方英文原版还原脚本
│   └── zh_data\
│       ├── ui_dict.json              # Web UI 精确英中词典（4,216 条）
│       ├── core_words.json           # 短语兜底核心词（121 条）
│       ├── dom_engine.js             # 前端 DOM 拦截引擎（Shadow DOM / SPA / 防代码误翻）
│       ├── menu_dict.json            # 应用菜单与右键上下文菜单词典（132 条）
│       └── main_patches.json         # 17 个主进程 JS 模块替换规则
└── scripts\
    ├── run-all.ps1                   # 三步流程编排（支持 -DryRun / -UseSource / -NoLaunch）
    ├── repoint-shortcut.ps1          # 快捷方式扫描、防误改过滤与备份重指向
    ├── build-exe.ps1                 # PyInstaller 自动化打包脚本
    └── create-desktop-shortcut.ps1   # 创建桌面一键快捷方式
```

---

## 🛠️ 二次开发与命令参数

### 补充或修改翻译
1. 直接编辑 `Antigravity-zh-CN\zh_data\` 下对应的 JSON 或 JS 文件；
2. 如需立即生效测试，运行：
   ```powershell
   .\run-all.cmd -UseSource
   ```
3. 确认无误后运行 `build.cmd` 重新编译 `dist\*.exe`。

### 常用命令行参数
```powershell
# 安全演练（不关闭运行中的 Antigravity，不修改任何系统文件）
.\run-all.cmd -DryRun

# 强制使用 Python 源码而非编译版 exe 执行
.\run-all.cmd -UseSource

# 仅执行汉化与修复快捷方式，不启动客户端
.\run-all.cmd -NoLaunch
```

---

## 📄 开源协议与致谢

- 基于 [MIMICTE/Antigravity-zh-CN](https://github.com/MIMICTE/Antigravity-zh-CN) 进行二次开发，遵循 [MIT License](Antigravity-zh-CN/LICENSE)。
- 本工具仅在本地修改界面展示文本与启动进程环境变量，不涉及账号认证、网络抓包或核心逻辑修改。
