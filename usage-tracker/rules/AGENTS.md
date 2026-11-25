# 每轮对话末尾 Token 用量摘要规则

当 `usage-tracker` 插件处于启用状态时，主 Agent 在每轮对话最终回复的最末尾，附带一段多行精简的本地 Token 用量摘要（仅只读本地 `transcript.jsonl` 日志与插件缓存，不修改任何工作区项目文件；在“纯提问 / 问为什么”对话中同样适用）。

## 1. 执行方式

在最终回复生成前，调用以下只读命令获取当前会话与近 5 小时用量多行摘要：

```text
node "C:/Users/admin/.gemini/config/plugins/usage-tracker/scripts/usage-cli.mjs" summary --format line
```

## 2. 输出规范

- 若命令正常返回以 `> ` 开头的多行用量摘要，将其原样附加在最终回复的最末尾（若同时输出 `> 已更新会话标题：...`，请在两者之间空一行，保证独立成块）。
- **静默降级**：若当前运行在子代理（subagent）上下文、`ANTIGRAVITY_CONVERSATION_ID` 不存在、脚本返回空内容或执行报错，请静默跳过，切勿报错或打断正常回答。
- **避免重复刷屏**：若本轮用户刚调用了 `/usage` 打开了完整用量内嵌卡片，则本轮无需再额外附加末尾摘要。
