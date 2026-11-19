# coding: utf-8
"""
Antigravity 桌面端中文汉化补丁 (基于 MIMICTE/Antigravity-zh-CN 二次开发，全面适配 v2.33.0+)

特性：
- 纯原生 Python ASAR 解包器（零第三方依赖）
- 模块化词典与补丁规则（zh_data/*.json + dom_engine.js），支持源码运行与 PyInstaller 单文件 exe 打包
- 覆盖 Web UI (preload.js / wizardPreload.js)、应用菜单、右键菜单、系统托盘、更新弹窗、
  远程 SSH / 断连页 / 凭据弹窗、WSL、Passkey/WebAuthn、安全弹窗及 v2.33.0 Computer Use HUD
- 修复 Windows OTA 更新后 app.asar 与 app.asar.disabled 并存导致的 WinError 183 冲突
- 支持 --no-launch / --no-pause / --force-reextract / --dry-run / --app-dir 参数
"""

import argparse
import datetime
import json
import os
import shutil
import struct
import subprocess
import sys
import time


def _configure_stdio():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def get_default_app_dir():
    if sys.platform == "win32":
        return os.path.join(os.getenv("LOCALAPPDATA", ""), "Programs", "antigravity")
    if sys.platform == "darwin":
        return "/Applications/Antigravity.app"
    return ""


def get_resources_dir(app_dir):
    if sys.platform == "darwin":
        return os.path.join(app_dir, "Contents", "Resources")
    return os.path.join(app_dir, "resources")


def get_data_dir():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "zh_data")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "zh_data")


def load_zh_assets():
    data_dir = get_data_dir()
    required = ["ui_dict.json", "core_words.json", "dom_engine.js", "menu_dict.json", "main_patches.json"]
    for name in required:
        p = os.path.join(data_dir, name)
        if not os.path.exists(p):
            raise FileNotFoundError(f"缺少汉化资源文件: {p}")

    with open(os.path.join(data_dir, "ui_dict.json"), "r", encoding="utf-8") as f:
        ui_dict = json.load(f)
    with open(os.path.join(data_dir, "core_words.json"), "r", encoding="utf-8") as f:
        core_words = json.load(f)
    with open(os.path.join(data_dir, "dom_engine.js"), "r", encoding="utf-8") as f:
        dom_template = f.read()
    with open(os.path.join(data_dir, "menu_dict.json"), "r", encoding="utf-8") as f:
        menu_dict = json.load(f)
    with open(os.path.join(data_dir, "main_patches.json"), "r", encoding="utf-8") as f:
        main_patches = json.load(f)

    dom_injection = (
        dom_template
        .replace("/*__UI_DICT__*/", json.dumps(ui_dict, ensure_ascii=False))
        .replace("/*__CORE_WORDS__*/", json.dumps(core_words, ensure_ascii=False))
    )

    menu_map_json = json.dumps(menu_dict, ensure_ascii=False, indent=2)
    menu_injection = f"""
// Antigravity Chinese Localization Engine - Menu (v2.33.0+)
const menuTranslationMap = {menu_map_json};
function translateMenu(menuItem) {{
  if (!menuItem) return;
  if (menuItem.label && menuTranslationMap[menuItem.label]) {{
    menuItem.label = menuTranslationMap[menuItem.label];
  }}
  if (menuItem.submenu) {{
    if (menuItem.submenu.items && Array.isArray(menuItem.submenu.items)) {{
      menuItem.submenu.items.forEach(translateMenu);
    }} else if (Array.isArray(menuItem.submenu)) {{
      menuItem.submenu.forEach(translateMenu);
    }}
  }}
}}
(function() {{
  try {{
    const {{ Menu }} = require('electron');
    if (Menu && Menu.buildFromTemplate && !Menu.__agyZhTranslated) {{
      const originalBuildFromTemplate = Menu.buildFromTemplate;
      Menu.buildFromTemplate = function(template) {{
        if (template && Array.isArray(template)) {{
          template.forEach(translateMenu);
        }}
        return originalBuildFromTemplate.call(this, template);
      }};
      Menu.__agyZhTranslated = true;
    }}
  }} catch (e) {{
    console.error('Menu hooking failed:', e);
  }}
}})();
"""

    context_menu_injection = f"""
// Antigravity Chinese Localization Engine - ContextMenu (v2.33.0+)
const contextMenuTranslationMap = {menu_map_json};
function translateContextLabel(lbl) {{
  if (!lbl) return '';
  const trimmed = typeof lbl === 'string' ? lbl.trim() : '';
  return contextMenuTranslationMap[lbl] || contextMenuTranslationMap[trimmed] || lbl;
}}
"""

    return {
        "ui_dict_count": len(ui_dict),
        "core_words_count": len(core_words),
        "menu_dict_count": len(menu_dict),
        "dom_injection": dom_injection,
        "menu_injection": menu_injection,
        "context_menu_injection": context_menu_injection,
        "main_patches": main_patches,
    }


def extract_asar(asar_path, dest_dir):
    """Pure-Python ASAR archive extractor."""
    with open(asar_path, "rb") as f:
        header_bytes = f.read(16)
        if len(header_bytes) < 16:
            raise ValueError("ASAR 文件头不完整")
        _magic, size, _u1, header_size = struct.unpack("<4I", header_bytes)
        header_json = f.read(header_size).decode("utf-8")
        header = json.loads(header_json)
        base_offset = 8 + size

        def extract_node(node, current_path):
            os.makedirs(current_path, exist_ok=True)
            for name, info in node.items():
                target_path = os.path.join(current_path, name)
                if "files" in info:
                    extract_node(info["files"], target_path)
                elif "offset" in info and "size" in info:
                    offset = int(info["offset"])
                    file_size = int(info["size"])
                    f.seek(base_offset + offset)
                    content = f.read(file_size)
                    with open(target_path, "wb") as out:
                        out.write(content)

        extract_node(header.get("files", {}), dest_dir)


def kill_antigravity_processes():
    """Terminate running Antigravity processes and wait briefly for file locks to release."""
    print("[执行] 正在关闭运行中的 Antigravity 进程...")
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/F", "/IM", "Antigravity.exe"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        # Wait up to 5 seconds for process exit & file lock release
        for _ in range(10):
            check = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq Antigravity.exe", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                check=False,
            )
            if "Antigravity.exe" not in (check.stdout or ""):
                break
            time.sleep(0.5)
        time.sleep(0.3)
    elif sys.platform == "darwin":
        subprocess.run(
            ["pkill", "-f", "Antigravity"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        time.sleep(0.5)


def append_once(filepath, content, marker, label):
    if not os.path.exists(filepath):
        print(f"[跳过] 未找到目标文件 ({label}): {filepath}")
        return False
    with open(filepath, "r", encoding="utf-8") as f:
        existing = f.read()
    if marker in existing:
        print(f"[跳过] {label} 已注入 ({os.path.basename(filepath)})")
        return True
    with open(filepath, "a", encoding="utf-8") as f:
        f.write("\n\n" + content)
    print(f"[成功] 已注入 {label} ({os.path.basename(filepath)})")
    return True


def patch_menu_js(menu_path, menu_injection):
    if not os.path.exists(menu_path):
        print(f"[跳过] 未找到菜单文件: {menu_path}")
        return False
    with open(menu_path, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False
    # 1. Hook setApplicationMenu(menu) idempotently
    hook_marker = "if (typeof translateMenu === 'function') { menu.items.forEach(translateMenu); }"
    target_call = "electron_1.Menu.setApplicationMenu(menu);"
    if hook_marker not in content and target_call in content:
        content = content.replace(
            target_call,
            f"{hook_marker}\n    {target_call}",
        )
        changed = True

    # 2. Ensure addItemToSubmenu still finds submenu after translation
    old_find = "const submenuItem = appMenu.items.find((item) => item.label === submenuLabel);"
    new_find = (
        'const submenuItem = appMenu.items.find((item) => '
        'item.label === submenuLabel || '
        '(typeof menuTranslationMap !== "undefined" && item.label === menuTranslationMap[submenuLabel]));'
    )
    if old_find in content:
        content = content.replace(old_find, new_find)
        changed = True

    # 3. Ensure configureViewZoomMenu still finds View menu after translation
    old_view = "const viewMenuItem = appMenu.items?.find((item) => item.label === 'View');"
    new_view = (
        "const viewMenuItem = appMenu.items?.find((item) => "
        "item.label === 'View' || item.label === '视图');"
    )
    if old_view in content:
        content = content.replace(old_view, new_view)
        changed = True

    if changed:
        with open(menu_path, "w", encoding="utf-8") as f:
            f.write(content)

    return append_once(
        menu_path,
        menu_injection,
        "Antigravity Chinese Localization Engine - Menu",
        "应用菜单栏汉化",
    )


def apply_main_patches(unpacked_dir, main_patches, context_menu_injection):
    total_files_hit = 0
    total_rules_hit = 0
    for rel_path, rules in main_patches.items():
        full_path = os.path.join(unpacked_dir, *rel_path.split("/"))
        if not os.path.exists(full_path):
            continue
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()

        file_hits = 0
        for old_str, new_str in rules:
            if new_str in content:
                continue
            if old_str in content:
                content = content.replace(old_str, new_str)
                file_hits += 1

        if file_hits > 0:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            total_files_hit += 1
            total_rules_hit += file_hits
            print(f"[成功] {rel_path}: 应用 {file_hits} 处汉化")

    # Append context menu translator helper into dist/ipcHandlers.js
    ipc_path = os.path.join(unpacked_dir, "dist", "ipcHandlers.js")
    if os.path.exists(ipc_path):
        append_once(
            ipc_path,
            context_menu_injection,
            "Antigravity Chinese Localization Engine - ContextMenu",
            "右键上下文菜单汉化",
        )
    return total_files_hit, total_rules_hit


def apply_patch(
    app_dir=None,
    backup_dir=None,
    no_launch=False,
    force_reextract=False,
    dry_run=False,
):
    default_app_dir = get_default_app_dir()
    if not app_dir:
        app_dir = default_app_dir
    if not app_dir:
        print("[错误] 当前仅支持 Windows 和 macOS 系统。")
        return False

    is_live_install = os.path.normcase(os.path.abspath(app_dir)) == os.path.normcase(
        os.path.abspath(default_app_dir)
    )
    resources_dir = get_resources_dir(app_dir)
    asar_path = os.path.join(resources_dir, "app.asar")
    disabled_path = asar_path + ".disabled"
    unpacked_dir = os.path.join(resources_dir, "app")

    print("==================================================================")
    print("        Antigravity 桌面端 中文汉化补丁 (v2.33.0+ 二次开发版)       ")
    print("==================================================================")

    assets = load_zh_assets()
    print(
        f"[资源] 已加载词典: Web UI {assets['ui_dict_count']} 条 | "
        f"核心词 {assets['core_words_count']} 条 | "
        f"菜单 {assets['menu_dict_count']} 条 | "
        f"主进程模块 {len(assets['main_patches'])} 个"
    )
    print(f"[目标] 资源目录: {resources_dir}")

    if not os.path.exists(resources_dir):
        print(f"[错误] 未找到 Antigravity 资源目录: {resources_dir}")
        return False

    has_asar = os.path.exists(asar_path)
    has_disabled = os.path.exists(disabled_path)
    has_unpacked = os.path.exists(unpacked_dir)

    if not has_asar and not has_disabled:
        print(f"[错误] 未找到 app.asar 或 app.asar.disabled: {resources_dir}")
        return False

    if dry_run:
        print("[演练] Dry-Run 模式：不关闭进程，不修改任何文件。")
        print(
            f"[演练] 当前状态: app.asar={has_asar}, "
            f"app.asar.disabled={has_disabled}, unpacked_app={has_unpacked}"
        )
        if has_asar and has_disabled:
            print("[演练] 检测到官方 OTA 更新残留冲突，正式执行时将自动备份旧 disabled 并重新解包新版。")
        elif force_reextract:
            print("[演练] 已指定 --force-reextract，正式执行时将清理旧解包目录并全量重注入。")
        print("[演练] 检查全部通过。")
        return True

    if is_live_install:
        kill_antigravity_processes()
    else:
        print("[状态] 检测到自定义 --app-dir，跳过关闭系统 Antigravity 进程。")

    # 1. 处理官方 OTA 更新冲突（app.asar 与 app.asar.disabled 同时存在）
    if has_asar and has_disabled:
        print("[状态] 检测到官方更新释放了新版 app.asar，正在处理旧版 app.asar.disabled 冲突...")
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        if backup_dir:
            os.makedirs(backup_dir, exist_ok=True)
            archived = os.path.join(backup_dir, f"app.asar.disabled.{stamp}.bak")
            shutil.move(disabled_path, archived)
            print(f"[备份] 旧版 app.asar.disabled 已归档至: {archived}")
        else:
            os.remove(disabled_path)
            print("[清理] 已移除旧版 app.asar.disabled")
        has_disabled = False
        if os.path.exists(unpacked_dir):
            print("[状态] 正在清理旧版解包目录...")
            shutil.rmtree(unpacked_dir)
            has_unpacked = False

    # 2. 若官方全新安装或强制重解包，清理旧解包目录确保全量注入最新词典
    is_fresh_install = has_asar and not has_disabled
    if (is_fresh_install or force_reextract) and os.path.exists(unpacked_dir):
        reason = "检测到软件更新" if is_fresh_install else "已启用全量重解包"
        print(f"[状态] {reason}，正在清理旧的解包缓存...")
        shutil.rmtree(unpacked_dir)
        has_unpacked = False

    # 3. 解包 app.asar
    if not os.path.exists(unpacked_dir):
        source_asar = asar_path if os.path.exists(asar_path) else disabled_path
        print(f"[执行] 正在解包核心文件: {os.path.basename(source_asar)} -> app/")
        extract_asar(source_asar, unpacked_dir)
        print("[完成] ASAR 解包完毕。")
    else:
        print(f"[状态] 复用已解包目录: {unpacked_dir}")

    # 4. 注入 Web UI 翻译引擎（主窗口 preload.js + 安装向导 wizardPreload.js）
    preload_path = os.path.join(unpacked_dir, "dist", "preload.js")
    wizard_preload_path = os.path.join(unpacked_dir, "dist", "ideInstall", "wizardPreload.js")
    append_once(
        preload_path,
        assets["dom_injection"],
        "Antigravity Chinese Localization Engine",
        "Web UI 汉化引擎",
    )
    if os.path.exists(wizard_preload_path):
        append_once(
            wizard_preload_path,
            assets["dom_injection"],
            "Antigravity Chinese Localization Engine",
            "引导向导汉化引擎",
        )

    # 5. 注入应用菜单栏汉化
    menu_path = os.path.join(unpacked_dir, "dist", "menu.js")
    patch_menu_js(menu_path, assets["menu_injection"])

    # 6. 应用主进程各模块汉化（托盘、更新、远程 SSH、WSL、HUD、弹窗等）
    files_hit, rules_hit = apply_main_patches(
        unpacked_dir, assets["main_patches"], assets["context_menu_injection"]
    )
    print(f"[汇总] 主进程模块更新: {files_hit} 个文件，应用 {rules_hit} 处替换。")

    # 7. 禁用原生 app.asar，强制 Electron 读取解包后的 app/
    if os.path.exists(asar_path):
        print("[执行] 正在禁用官方 app.asar -> app.asar.disabled ...")
        if os.path.exists(disabled_path):
            os.remove(disabled_path)
        os.rename(asar_path, disabled_path)
        print("[成功] app.asar -> app.asar.disabled")

    print("==================================================================")
    print("                     中文汉化补丁注入成功！                        ")
    print("==================================================================")

    if not no_launch:
        if sys.platform == "win32":
            exe_path = os.path.join(app_dir, "Antigravity.exe")
            if os.path.exists(exe_path):
                print("[启动] 正在启动 Antigravity...")
                DETACHED_PROCESS = 0x00000008
                CREATE_NEW_PROCESS_GROUP = 0x00000200
                subprocess.Popen(
                    [exe_path],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                    close_fds=True,
                )
        elif sys.platform == "darwin":
            subprocess.Popen(["open", app_dir])
    else:
        print("[提示] 已启用 --no-launch，跳过自动启动（交由代理启动脚本拉起）。")

    return True


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Antigravity 桌面端中文汉化补丁 (v2.33.0+ 二次开发版)"
    )
    parser.add_argument("--app-dir", default=None, help="自定义 Antigravity 安装目录（用于测试或非标准路径）")
    parser.add_argument("--backup-dir", default=None, help="OTA 更新冲突时旧 app.asar.disabled 备份目录")
    parser.add_argument("--no-launch", action="store_true", help="汉化后不自动启动 Antigravity")
    parser.add_argument("--no-pause", action="store_true", help="执行完毕后不等待按回车退出")
    parser.add_argument("--force-reextract", action="store_true", help="强制清理旧解包目录并全量重注入最新词典")
    parser.add_argument("--dry-run", action="store_true", help="演练模式：仅检查不修改任何文件")
    return parser.parse_args(argv)


def main(argv=None):
    _configure_stdio()
    args = parse_args(argv)
    exit_code = 0
    try:
        ok = apply_patch(
            app_dir=args.app_dir,
            backup_dir=args.backup_dir,
            no_launch=args.no_launch,
            force_reextract=args.force_reextract,
            dry_run=args.dry_run,
        )
        if not ok:
            exit_code = 1
    except KeyboardInterrupt:
        print("\n[提示] 用户取消操作。")
        exit_code = 130
    except Exception as e:
        print(f"\n[错误] 执行过程中出现异常: {e}")
        exit_code = 1

    if not args.no_pause:
        try:
            input("\n执行完毕，按 Enter 键退出...")
        except EOFError:
            pass
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
