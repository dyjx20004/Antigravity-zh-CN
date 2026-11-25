---
name: usage
description: 在对话中弹出交互式内嵌卡片，查看 Antigravity 本地 Token 用量统计（当前会话、近 5 小时、今日、近 7 天、按模型分布及逐轮调用明细）。当用户输入 /usage 或询问当前用量、Token 消耗、缓存命中率时触发。
---

# 用量统计技能 (`/usage`)

用于在当前对话中直接渲染交互式 Token 用量内嵌卡片（Inline MCP App Card）。

## 使用方式

1. 当用户调用 `/usage` 或询问当前用量 / Token 统计时，调用 MCP 工具 `usage-tracker_tracker` 下的 `show_usage_card`：
   - 传入 `conversationId`（若环境中有当前会话 ID，请传入；未传时服务端会自动定位最近活跃会话）；
   - 根据用户意图传入 `range`：`"session"`（默认，当前会话）、`"5h"`（近 5 小时）、`"today"`（今日）、`"7d"`（近 7 天）、`"all"`（全部）。
2. 工具返回后，内嵌卡片会自动渲染在对话流中；用户可直接在卡片内切换时间维度与刷新数据，无需重复发起对话。
3. 回复文字保持简洁，无需把卡片里的明细表格再重复粘贴一遍。
