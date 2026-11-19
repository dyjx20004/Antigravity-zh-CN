# coding: utf-8
"""
Antigravity 桌面端纯净英文原版还原工具 (二次开发增强版)
支持 --no-launch / --no-pause / --app-dir 参数
"""

import argparse
import os
import shutil
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


def kill_antigravity_processes():
    print("[执行] 正在关闭运行中的 Antigravity 进程...")
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/F", "/IM", "Antigravity.exe"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
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


def restore(app_dir=None, no_launch=False):
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
    print("             Antigravity 桌面端 纯净英文原版还原工具                ")
    print("==================================================================")

    if not os.path.exists(resources_dir):
        print(f"[错误] 未找到 Antigravity 资源目录: {resources_dir}")
        return False

    if is_live_install:
        kill_antigravity_processes()
    else:
        print("[状态] 检测到自定义 --app-dir，跳过关闭系统 Antigravity 进程。")

    if os.path.exists(disabled_path):
        print("[执行] 找到已禁用的原始文件: app.asar.disabled")
        if os.path.exists(asar_path):
            os.remove(asar_path)
        os.rename(disabled_path, asar_path)
        if os.path.exists(unpacked_dir):
            shutil.rmtree(unpacked_dir)
        print("[成功] 已恢复官方原版 app.asar 并清理汉化解包目录。")
    elif os.path.exists(unpacked_dir):
        print("[状态] 未发现 app.asar.disabled，正在清理残留解包目录...")
        shutil.rmtree(unpacked_dir)
        print("[成功] 清理完成，软件当前已是原版状态。")
    else:
        print("[状态] 软件当前已经是原版纯净状态，无需还原。")

    if not no_launch:
        if sys.platform == "win32":
            exe_path = os.path.join(app_dir, "Antigravity.exe")
            if os.path.exists(exe_path):
                print("[启动] 正在启动纯净版 Antigravity...")
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
        print("[提示] 已启用 --no-launch，跳过自动启动。")

    return True


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Antigravity 纯净原版还原工具")
    parser.add_argument("--app-dir", default=None, help="自定义 Antigravity 安装目录")
    parser.add_argument("--no-launch", action="store_true", help="还原后不自动启动 Antigravity")
    parser.add_argument("--no-pause", action="store_true", help="执行完毕后不等待按回车退出")
    return parser.parse_args(argv)


def main(argv=None):
    _configure_stdio()
    args = parse_args(argv)
    exit_code = 0
    try:
        ok = restore(app_dir=args.app_dir, no_launch=args.no_launch)
        if not ok:
            exit_code = 1
    except KeyboardInterrupt:
        print("\n[提示] 用户取消操作。")
        exit_code = 130
    except Exception as e:
        print(f"\n[错误] 还原过程中出现异常: {e}")
        exit_code = 1

    if not args.no_pause:
        try:
            input("\n执行完毕，按 Enter 键退出...")
        except EOFError:
            pass
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
