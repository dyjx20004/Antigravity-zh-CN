# -*- coding: utf-8 -*-
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import time

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(TOOLS_DIR, "assets")
DOM_ASSET_PATH = os.path.join(ASSETS_DIR, "dom-translator.js")
MENU_ASSET_PATH = os.path.join(ASSETS_DIR, "menu-translator.js")
QUOTA_ASSET_PATH = os.path.join(ASSETS_DIR, "quota-widget.js")
MAIN_PATCHES_PATH = os.path.join(ASSETS_DIR, "main_patches.json")
MENU_DICT_PATH = os.path.join(ASSETS_DIR, "menu_dict.json")

DOM_MARKER = "// Antigravity 2.0 Chinese Localization Engine Enhanced"
MENU_MARKER = "// Antigravity Chinese Localization Engine - Menu"
QUOTA_MARKER = "// Antigravity Quota & Usage Widget"
CONTEXT_MENU_MARKER = "// Antigravity Chinese Localization Engine - ContextMenu"
META_FILENAME = ".zh-patch-meta.json"


def default_resources_dir():
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        "Programs",
        "antigravity",
        "resources",
    )


def compute_assets_hash():
    h = hashlib.sha256()
    for p in (DOM_ASSET_PATH, MENU_ASSET_PATH, QUOTA_ASSET_PATH, MAIN_PATCHES_PATH, MENU_DICT_PATH):
        if os.path.exists(p):
            with open(p, "rb") as f:
                h.update(f.read())
    return h.hexdigest()


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_text(path, content):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def stop_antigravity():
    print("[执行] 正在关闭 Antigravity 相关进程...")
    for proc_name in ("Antigravity.exe", "language_server.exe"):
        subprocess.run(
            ["taskkill", "/F", "/T", "/IM", proc_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    deadline = time.time() + 6.0
    while time.time() < deadline:
        res = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq Antigravity.exe", "/NH"],
            capture_output=True,
            text=True,
            check=False,
        )
        if "Antigravity.exe" not in (res.stdout or ""):
            break
        time.sleep(0.25)


def extract_asar(asar_path, dest_dir):
    """Pure-Python ASAR archive extractor supporting unpacked entries."""
    with open(asar_path, "rb") as f:
        header_prefix = f.read(16)
        if len(header_prefix) < 16:
            raise ValueError("ASAR 文件头长度不足")
        _, size, _, header_size = struct.unpack("<4I", header_prefix)
        header_json = f.read(header_size).decode("utf-8")
        header = json.loads(header_json)
        base_offset = 8 + size

        def extract_node(node, current_path):
            os.makedirs(current_path, exist_ok=True)
            for name, info in node.items():
                target = os.path.join(current_path, name)
                if "files" in info:
                    extract_node(info["files"], target)
                elif "offset" in info:
                    if info.get("unpacked"):
                        continue
                    f.seek(base_offset + int(info["offset"]))
                    remaining = int(info["size"])
                    with open(target, "wb") as out_f:
                        while remaining > 0:
                            chunk = f.read(min(remaining, 1024 * 1024))
                            if not chunk:
                                break
                            out_f.write(chunk)
                            remaining -= len(chunk)

        extract_node(header.get("files", {}), dest_dir)


def upsert_injection(file_path, injection_code, marker, label):
    if not os.path.exists(file_path):
        print(f"[跳过] 未找到 {os.path.relpath(file_path)}，跳过 {label}")
        return False

    existing = read_text(file_path)
    idx = existing.find(marker)
    if idx != -1:
        base = existing[:idx].rstrip()
        write_text(file_path, base + "\n\n" + injection_code.strip() + "\n")
        print(f"[更新] 已热更新 {label} ({os.path.basename(file_path)})")
        return True

    write_text(file_path, existing.rstrip() + "\n\n" + injection_code.strip() + "\n")
    print(f"[成功] 已注入 {label} ({os.path.basename(file_path)})")
    return True


def patch_menu_js(menu_path, menu_code):
    if not os.path.exists(menu_path):
        print("[跳过] 未找到 dist/menu.js，跳过菜单汉化")
        return

    content = read_text(menu_path)
    old_lookup = "item.label === submenuLabel"
    compat_lookup = (
        '(item.label === submenuLabel || (typeof __agyMenuZhMap !== "undefined" '
        "&& item.label === __agyMenuZhMap[submenuLabel]))"
    )
    if old_lookup in content and "__agyMenuZhMap" not in content:
        content = content.replace(old_lookup, compat_lookup)
        write_text(menu_path, content)
        print("[兼容] 已增强 addItemToSubmenu 中文标签查找兼容")

    upsert_injection(menu_path, menu_code, MENU_MARKER, "应用与右键菜单汉化")


def patch_tray_js(tray_path):
    if not os.path.exists(tray_path):
        print("[跳过] 未找到 dist/tray.js，跳过托盘动态文案汉化")
        return

    content = read_text(tray_path)
    if "个智能体运行中" in content:
        print("[跳过] dist/tray.js 已汉化")
        return

    pattern = re.compile(
        r"countItem\.label\s*=\s*\(\s*count\s*>\s*0\s*\?\s*`\$\{count\}`\s*:\s*'No'\s*\)\s*\+\s*' agent'\s*\+\s*\(count\s*===\s*1\s*\?\s*''\s*:\s*'s'\)\s*\+\s*' running';",
        re.MULTILINE,
    )
    replacement = (
        "countItem.label = count > 0 ? `${count} 个智能体运行中` : '没有智能体在运行';"
    )
    new_content, n = pattern.subn(replacement, content)
    if n > 0:
        write_text(tray_path, new_content)
        print("[成功] 已汉化系统托盘动态智能体计数 (dist/tray.js)")
    else:
        print("[提示] dist/tray.js 动态计数结构已变更，保留原样以防出错")


def patch_loading_overlay_js(loading_path):
    if not os.path.exists(loading_path):
        return
    content = read_text(loading_path)
    if ">Loading Antigravity<" in content:
        write_text(
            loading_path,
            content.replace(">Loading Antigravity<", ">正在加载 Antigravity<"),
        )
        print("[成功] 已汉化启动加载界面 (dist/loadingOverlay.js)")


def rename_with_retry(src, dst, retries=10, delay=0.3):
    last_err = None
    for _ in range(retries):
        try:
            if os.path.exists(dst):
                os.remove(dst)
            os.rename(src, dst)
            return
        except OSError as e:
            last_err = e
            time.sleep(delay)
    raise last_err


def rmtree_with_retry(target_dir, retries=8, delay=0.3):
    if not os.path.exists(target_dir):
        return
    last_err = None
    for _ in range(retries):
        try:
            shutil.rmtree(target_dir)
            return
        except OSError as e:
            last_err = e
            time.sleep(delay)
    raise last_err


def apply_main_patches(app_dir):
    if not os.path.exists(MAIN_PATCHES_PATH):
        return
    main_patches = json.loads(read_text(MAIN_PATCHES_PATH))
    files_hit = 0
    rules_hit = 0
    for rel_path, rules in main_patches.items():
        full_path = os.path.join(app_dir, *rel_path.split("/"))
        if not os.path.exists(full_path):
            continue
        content = read_text(full_path)
        file_hits = 0
        for old_str, new_str in rules:
            if new_str in content:
                continue
            if old_str in content:
                content = content.replace(old_str, new_str)
                file_hits += 1
        if file_hits > 0:
            write_text(full_path, content)
            files_hit += 1
            rules_hit += file_hits
            print(f"[成功] {rel_path}: 应用 {file_hits} 处汉化")

    if os.path.exists(MENU_DICT_PATH):
        ipc_path = os.path.join(app_dir, "dist", "ipcHandlers.js")
        menu_dict_json = read_text(MENU_DICT_PATH).strip()
        ctx_code = (
            f"{CONTEXT_MENU_MARKER}\n"
            f"const contextMenuTranslationMap = {menu_dict_json};\n"
            "function translateContextLabel(lbl) {\n"
            "  if (!lbl) return '';\n"
            "  const trimmed = typeof lbl === 'string' ? lbl.trim() : '';\n"
            "  return contextMenuTranslationMap[lbl] || contextMenuTranslationMap[trimmed] || lbl;\n"
            "}\n"
            "(function () {\n"
            "  if (globalThis.__agyZhUsageIpcRegistered) return;\n"
            "  globalThis.__agyZhUsageIpcRegistered = true;\n"
            "  try {\n"
            "    const fs = require('fs');\n"
            "    const os = require('os');\n"
            "    const p = require('path');\n"
            "    electron_1.ipcMain.handle('agy-zh:get-usage-summary', async (_event, convId) => {\n"
            "      try {\n"
            "        const baseDir = p.join(os.homedir(), '.gemini', 'antigravity');\n"
            "        const brainDir = p.join(baseDir, 'brain');\n"
            "        const cacheFile = p.join(baseDir, 'plugin_data', 'usage-tracker', 'usage-cache.json');\n"
            "        let cache = { version: 1, conversations: {} };\n"
            "        try {\n"
            "          if (fs.existsSync(cacheFile)) {\n"
            "            const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));\n"
            "            if (parsed && parsed.conversations) cache = parsed;\n"
            "          }\n"
            "        } catch (_) {}\n"
            "        const prevConvs = cache.conversations || {};\n"
            "        const convs = {};\n"
            "        let dirty = false;\n"
            "        if (fs.existsSync(brainDir)) {\n"
            "          const entries = fs.readdirSync(brainDir, { withFileTypes: true });\n"
            "          for (const ent of entries) {\n"
            "            if (!ent.isDirectory()) continue;\n"
            "            const cid = ent.name;\n"
            "            const logPath = p.join(brainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');\n"
            "            let st;\n"
            "            try { st = fs.statSync(logPath); } catch (_) { continue; }\n"
            "            const prev = prevConvs[cid];\n"
            "            if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size && Array.isArray(prev.turns)) {\n"
            "              convs[cid] = prev;\n"
            "              continue;\n"
            "            }\n"
            "            dirty = true;\n"
            "            const turns = [];\n"
            "            const lines = fs.readFileSync(logPath, 'utf8').split(/\\r?\\n/);\n"
            "            for (const line of lines) {\n"
            "              if (!line || !line.includes('input_tokens')) continue;\n"
            "              try {\n"
            "                const obj = JSON.parse(line);\n"
            "                if (typeof obj.model === 'string' && typeof obj.input_tokens === 'number' && typeof obj.output_tokens === 'number') {\n"
            "                  const pts = obj.created_at ? Date.parse(obj.created_at) : NaN;\n"
            "                  const tsMs = Number.isFinite(pts) ? pts : st.mtimeMs;\n"
            "                  turns.push({\n"
            "                    ts: obj.created_at || new Date(tsMs).toISOString(),\n"
            "                    tsMs,\n"
            "                    model: obj.model,\n"
            "                    input: obj.input_tokens,\n"
            "                    output: obj.output_tokens,\n"
            "                    cacheRead: typeof obj.cache_read_tokens === 'number' ? obj.cache_read_tokens : 0,\n"
            "                    step: typeof obj.step_index === 'number' ? obj.step_index : null,\n"
            "                  });\n"
            "                }\n"
            "              } catch (_) {}\n"
            "            }\n"
            "            const lastTurnTs = turns.length > 0 ? turns[turns.length - 1].tsMs : st.mtimeMs;\n"
            "            convs[cid] = { mtimeMs: st.mtimeMs, size: st.size, lastTurnTs, turns };\n"
            "          }\n"
            "        }\n"
            "        if (dirty) {\n"
            "          try {\n"
            "            fs.mkdirSync(p.dirname(cacheFile), { recursive: true });\n"
            "            fs.writeFileSync(cacheFile, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), conversations: convs }), 'utf8');\n"
            "          } catch (_) {}\n"
            "        }\n"
            "        const now = Date.now();\n"
            "        const start5h = now - 5 * 3600 * 1000;\n"
            "        const d = new Date(now); d.setHours(0, 0, 0, 0);\n"
            "        const startToday = d.getTime();\n"
            "        let fiveHourTotal = 0, todayTotal = 0;\n"
            "        let activeId = convId && convs[convId] ? convId : '';\n"
            "        let latestTs = -1;\n"
            "        for (const [cid, info] of Object.entries(convs)) {\n"
            "          const turns = Array.isArray(info.turns) ? info.turns : [];\n"
            "          const lt = info.lastTurnTs || info.mtimeMs || 0;\n"
            "          if (!convId && turns.length > 0 && lt > latestTs) { latestTs = lt; activeId = cid; }\n"
            "          for (const t of turns) {\n"
            "            const tot = (t.input || 0) + (t.output || 0);\n"
            "            if ((t.tsMs || 0) >= start5h) fiveHourTotal += tot;\n"
            "            if ((t.tsMs || 0) >= startToday) todayTotal += tot;\n"
            "          }\n"
            "        }\n"
            "        const activeTurns = activeId && convs[activeId] && Array.isArray(convs[activeId].turns) ? convs[activeId].turns : [];\n"
            "        let sessionInput = 0, sessionOutput = 0, sessionCacheRead = 0;\n"
            "        for (const t of activeTurns) {\n"
            "          sessionInput += (t.input || 0);\n"
            "          sessionOutput += (t.output || 0);\n"
            "          sessionCacheRead += (t.cacheRead || 0);\n"
            "        }\n"
            "        const sessionTotal = sessionInput + sessionOutput;\n"
            "        const denom = sessionInput + sessionCacheRead;\n"
            "        const cacheHitRate = denom > 0 ? Math.round((sessionCacheRead / denom) * 1000) / 10 : 0;\n"
            "        const lastTurn = activeTurns.length > 0 ? activeTurns[activeTurns.length - 1] : null;\n"
            "        return {\n"
            "          activeConvId: activeId,\n"
            "          sessionTurns: activeTurns.length,\n"
            "          sessionTotal,\n"
            "          sessionInput,\n"
            "          sessionOutput,\n"
            "          sessionCacheRead,\n"
            "          cacheHitRate,\n"
            "          fiveHourTotal,\n"
            "          todayTotal,\n"
            "          lastTurn,\n"
            "          updatedAt: now,\n"
            "        };\n"
            "      } catch (_) {\n"
            "        return null;\n"
            "      }\n"
            "    });\n"
            "  } catch (_) {}\n"
            "})();\n"
        )
        upsert_injection(ipc_path, ctx_code, CONTEXT_MENU_MARKER, "右键上下文菜单与用量桥接")
    print(f"[汇总] 主进程模块更新: {files_hit} 个文件，应用 {rules_hit} 处替换。")


def inject_all(app_dir, dom_code, menu_code, quota_code=""):
    preload_path = os.path.join(app_dir, "dist", "preload.js")
    wizard_preload_path = os.path.join(app_dir, "dist", "ideInstall", "wizardPreload.js")
    ssh_preload_path = os.path.join(app_dir, "dist", "remote", "sshPromptPreload.js")
    menu_path = os.path.join(app_dir, "dist", "menu.js")
    tray_path = os.path.join(app_dir, "dist", "tray.js")
    loading_path = os.path.join(app_dir, "dist", "loadingOverlay.js")

    upsert_injection(preload_path, dom_code, DOM_MARKER, "主界面 DOM 汉化引擎")
    if quota_code:
        upsert_injection(preload_path, quota_code, QUOTA_MARKER, "用量与剩余额度前端组件")
    upsert_injection(wizard_preload_path, dom_code, DOM_MARKER, "IDE 安装向导 DOM 汉化引擎")
    upsert_injection(ssh_preload_path, dom_code, DOM_MARKER, "SSH 弹窗 DOM 汉化引擎")
    patch_menu_js(menu_path, menu_code)
    apply_main_patches(app_dir)
    patch_tray_js(tray_path)
    patch_loading_overlay_js(loading_path)


def write_meta(app_dir, asar_stat, assets_hash):
    meta_path = os.path.join(app_dir, META_FILENAME)
    payload = {
        "asarSize": asar_stat.st_size if asar_stat else None,
        "asarMtime": asar_stat.st_mtime if asar_stat else None,
        "assetsHash": assets_hash,
        "patchedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    write_text(meta_path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def load_meta(app_dir):
    meta_path = os.path.join(app_dir, META_FILENAME)
    if not os.path.exists(meta_path):
        return {}
    try:
        return json.loads(read_text(meta_path))
    except Exception:
        return {}


def launch_antigravity():
    launcher = os.path.join(TOOLS_DIR, "launch-proxy.cmd")
    if os.path.exists(launcher):
        subprocess.Popen(["cmd", "/c", launcher], close_fds=True)


def run_patch(resources_dir, force=False, no_kill=False, no_launch=False):
    if not os.path.exists(DOM_ASSET_PATH) or not os.path.exists(MENU_ASSET_PATH):
        print(f"[错误] 缺少汉化资产文件: {ASSETS_DIR}")
        return 1

    asar_path = os.path.join(resources_dir, "app.asar")
    disabled_path = asar_path + ".disabled"
    app_dir = os.path.join(resources_dir, "app")
    assets_hash = compute_assets_hash()
    dom_code = read_text(DOM_ASSET_PATH)
    menu_code = read_text(MENU_ASSET_PATH)
    quota_code = read_text(QUOTA_ASSET_PATH) if os.path.exists(QUOTA_ASSET_PATH) else ""

    # 情况 A：存在原生 app.asar（首次安装或官方 OTA 自动更新后释放了新包）
    if os.path.exists(asar_path):
        print("[状态] 检测到官方 app.asar（首次汉化或官方刚完成版本更新），准备解包注入...")
        if not no_kill:
            stop_antigravity()

        if os.path.exists(disabled_path):
            os.remove(disabled_path)
        if os.path.exists(app_dir):
            print("[执行] 清理旧版解包目录...")
            rmtree_with_retry(app_dir)

        asar_stat = os.stat(asar_path)
        print("[执行] 正在解包官方 app.asar...")
        extract_asar(asar_path, app_dir)
        inject_all(app_dir, dom_code, menu_code, quota_code)
        write_meta(app_dir, asar_stat, assets_hash)

        print("[执行] 正在切换为汉化加载模式 (app.asar -> app.asar.disabled)...")
        rename_with_retry(asar_path, disabled_path)
        print("[完成] Antigravity 汉化补丁注入成功！")
        if not no_launch:
            launch_antigravity()
        return 0

    # 情况 B：已禁用 app.asar，且存在解包后的 app 目录
    if os.path.exists(disabled_path) and os.path.exists(app_dir):
        meta = load_meta(app_dir)
        if force:
            print("[执行] 强制模式：正在从 app.asar.disabled 重新解包并注入汉化...")
            if not no_kill:
                stop_antigravity()
            rmtree_with_retry(app_dir)
            asar_stat = os.stat(disabled_path)
            extract_asar(disabled_path, app_dir)
            inject_all(app_dir, dom_code, menu_code, quota_code)
            write_meta(app_dir, asar_stat, assets_hash)
            print("[完成] 强制重新汉化完成！")
        elif meta.get("assetsHash") != assets_hash:
            print("[执行] 检测到汉化词典有更新，正在热更新注入...")
            if not no_kill:
                stop_antigravity()
            inject_all(app_dir, dom_code, menu_code, quota_code)
            write_meta(app_dir, os.stat(disabled_path), assets_hash)
            print("[完成] 汉化词典热更新完成！")
        else:
            print("[OK] 当前已是最新汉化版本，无需重复解包。")
        if not no_launch:
            launch_antigravity()
        return 0

    # 情况 C：异常残缺状态（有 disabled 但没有 app 目录）
    if os.path.exists(disabled_path):
        print("[恢复] 检测到 app 目录缺失，正在从 app.asar.disabled 重建汉化目录...")
        if not no_kill:
            stop_antigravity()
        asar_stat = os.stat(disabled_path)
        extract_asar(disabled_path, app_dir)
        inject_all(app_dir, dom_code, menu_code, quota_code)
        write_meta(app_dir, asar_stat, assets_hash)
        print("[完成] 重建汉化目录成功！")
        if not no_launch:
            launch_antigravity()
        return 0

    print(f"[错误] 未找到 app.asar 或 app.asar.disabled: {resources_dir}")
    return 1


def run_restore(resources_dir, no_kill=False, no_launch=False):
    asar_path = os.path.join(resources_dir, "app.asar")
    disabled_path = asar_path + ".disabled"
    app_dir = os.path.join(resources_dir, "app")

    if not no_kill:
        stop_antigravity()

    if os.path.exists(disabled_path):
        if os.path.exists(asar_path):
            os.remove(asar_path)
        rename_with_retry(disabled_path, asar_path)
        print("[成功] 已还原官方原版 app.asar")
    elif os.path.exists(asar_path):
        print("[状态] 当前已是官方原版 app.asar")
    else:
        print(f"[警告] 未找到 app.asar.disabled 或 app.asar: {resources_dir}")

    if os.path.exists(app_dir):
        rmtree_with_retry(app_dir)
        print("[成功] 已清理汉化解包目录")

    print("[完成] 已无损还原为官方英文原版。")
    if not no_launch:
        launch_antigravity()
    return 0


def main():
    parser = argparse.ArgumentParser(description="Antigravity OTA 跨版本汉化与还原工具")
    parser.add_argument("--restore", action="store_true", help="还原为官方英文原版")
    parser.add_argument("--force", action="store_true", help="强制重新解包注入汉化")
    parser.add_argument("--resources-dir", default="", help="指定 Antigravity resources 目录")
    parser.add_argument("--no-kill", action="store_true", help="不关闭运行中的 Antigravity 进程")
    parser.add_argument("--no-launch", action="store_true", help="执行完毕后不自动启动 Antigravity")
    args = parser.parse_args()

    resources_dir = args.resources_dir or default_resources_dir()
    if not os.path.isdir(resources_dir):
        print(f"[错误] resources 目录不存在: {resources_dir}")
        return 1

    if args.restore:
        return run_restore(resources_dir, no_kill=args.no_kill, no_launch=args.no_launch)
    return run_patch(
        resources_dir,
        force=args.force,
        no_kill=args.no_kill,
        no_launch=args.no_launch,
    )


if __name__ == "__main__":
    sys.exit(main())
