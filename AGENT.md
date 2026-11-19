# AGENT.md

本文件为 AI 编程助手（Antigravity / Codex / Claude 等）在本仓库中开展维护与二次开发时的项目规范与工程约束。

## 1. 项目定位与架构

本项目是 **Google Antigravity 桌面端（Windows）** 的一键中文汉化、快捷方式修复与进程级代理启动工具集：

- **汉化引擎（`Antigravity-zh-CN/`）**：
  - `Antigravity-Patcher.py`：零第三方依赖的纯 Python ASAR 解包与注入器。支持源码运行及 PyInstaller 单文件打包（通过 `getattr(sys, "_MEIPASS", ...)` 自动定位 `zh_data/`）。
  - `Restore.py`：将 `app.asar.disabled` 还原为 `app.asar` 并清理 `resources\app\`。
  - `zh_data/`：模块化汉化数据，**修改翻译只改这里，无需改动 Python 逻辑**：
    - `ui_dict.json`：Web UI 精确英中词典（构建 `lowerDictionary` 进行 O(1) 大小写不敏感查表，同词不同大小写译文应尽量保持一致）。
    - `core_words.json`：仅用于 `<= 3` 个英文单词且无中文/路径符号的短语兜底分词。**严禁加入高频多义词（如 `new`、`tab`、`notice`、`high`、`medium`、`low`）**，否则会误伤徽章与模型选择器。
    - `dom_engine.js`：注入 `preload.js` / `wizardPreload.js` 的 DOM `MutationObserver` 引擎（含 `Shadow DOM`、SPA 路由监听、动态正则规则及代码块/思考过程/输入框保护）。
    - `menu_dict.json`：Electron 顶部菜单（`dist/menu.js`）与右键菜单（`dist/ipcHandlers.js`）词典。
    - `main_patches.json`：按文件精确匹配的 17 个主进程 JS 模块替换规则（幂等：`new_str` 已存在时跳过）。
- **编排与系统集成（根目录 `*.cmd` + `scripts/*.ps1`）**：
  - `config.cmd`：统一定义默认代理 `ANTIGRAVITY_PROXY=http://127.0.0.1:7897`。
  - `scripts/run-all.ps1`：按序执行「汉化注入 → 修复快捷方式 → 代理启动」，支持 `-UseSource`、`-NoLaunch`、`-DryRun`。
  - `scripts/repoint-shortcut.ps1`：扫描桌面/开始菜单/任务栏 `.lnk`，内置 `$protectedTargets` 白名单保护 `run-all.cmd` 等工具快捷方式不被误改。
  - `scripts/build-exe.ps1`：使用 PyInstaller 打包 `Antigravity-Patcher.exe`（内嵌 `zh_data`）与 `Restore.exe` 至 `dist/`（`.gitignore` 已忽略 `dist/` 与 `.build/`）。

## 2. 开发与修改规范

1. **脚本编码约束**：
   - 所有 `scripts\*.ps1` 文件**必须使用 UTF-8 with BOM** 保存，以兼容 Windows PowerShell 5.1；修改后需用 `[System.Management.Automation.Language.Parser]::ParseFile` 校验 AST 零错误。
   - `zh_data\*.json` 与 `zh_data\dom_engine.js` 使用 UTF-8（无 BOM），JSON 写入须保证合法格式（`json.load` 可解析）。
2. **翻译质量红线**：
   - 禁止翻译真实文件名（如 `implementation_plan.md`、`walkthrough.md`）、代码注释或斜杠命令。
   - 保持全站核心术语统一：Artifact → **产物**，Turn → **轮 / 轮次**，Steer → **实时引导**，Tab（按键/补全）→ **Tab**，No agents running → **没有运行中的智能体**。
   - 编写 `dom_engine.js` 正则时注意转义（如 `\s+`、`Ctrl\+`、`Cmd\+`），并在替换动态路径/名称时优先使用函数式 `replace` 回调避免 `$` 符号被误解析。
3. **安全验证红线（严禁破坏当前会话）**：
   - **禁止**在自动化测试中直接对本机 `%LOCALAPPDATA%\Programs\antigravity` 执行真实注入或 `taskkill /F /IM Antigravity.exe`（会强杀当前正在运行的宿主客户端）。
   - 所有实包测试必须通过 `--app-dir <临时沙箱目录>` 与 `--no-launch --no-pause` 参数在隔离目录完成。

## 3. 标准验证流程

每次修改 `zh_data/`、Python 或 PowerShell 脚本后，按以下顺序验证：

1. **静态与语法检查**：
   - Python：`python -m py_compile Antigravity-zh-CN\Antigravity-Patcher.py Antigravity-zh-CN\Restore.py`
   - JSON：校验 `Antigravity-zh-CN\zh_data\*.json` 可正常解析
   - PowerShell：AST 解析 `scripts\*.ps1` 无报错
2. **沙箱注入 + JS 语法 + 翻译单元测试**：
   - 将 `%LOCALAPPDATA%\Programs\antigravity\resources\app.asar.disabled`（或 `app.asar`）复制到临时沙箱 `resources\app.asar`；
   - 运行 `Antigravity-Patcher.py`（或重新编译后的 `dist\Antigravity-Patcher.exe`）对该沙箱执行 `--app-dir <沙箱> --no-launch --no-pause --force-reextract`；
   - 使用 `node --check` 验证注入后的全部 `dist\*.js` 无语法错误；
   - 在 Node.js `vm` 中加载注入后的 `dom_engine.js` 验证 `translateString` 核心回归用例（如 `New`、`New Conversation`、`Tab`、`Quote Ctrl+L`、文件名原样保留等）。
3. **全链路 Dry-Run**：
   - 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-all.ps1 -DryRun` 确认退出码为 `0`。
