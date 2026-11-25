---
name: plugin-manager
description: 打开 DSH 风格的「插件管理中心」可视化面板，支持通过 GitHub 仓库（含 #子目录）、npm 包名或本地目录安装、检查更新与卸载 Antigravity 插件。当用户输入 /plugin-manager 或要求安装/更新第三方或自研插件时触发。
---

# 插件管理中心 (`/plugin-manager`)

用于打开交互式「插件管理中心」面板，支持从 GitHub、npm 或本地路径安装并管理 Antigravity 全局插件。

## 使用方式

1. 当用户调用 `/plugin-manager` 或希望通过界面安装、更新、卸载插件时，调用 `plugin-manager_manager` 下的 `open_plugin_manager` 工具。
2. 工具返回后会在左侧边栏/辅助栏或对话卡片中展示管理中心，用户可直接在界面中点击「+ 添加插件」「检查更新」「更新」「卸载」。
