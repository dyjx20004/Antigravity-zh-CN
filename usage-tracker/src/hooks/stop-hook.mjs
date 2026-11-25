import { collectUsage, resolveDataDir } from '../core/collector.mjs';

async function main() {
  const dataDir = resolveDataDir();
  const conversationId = process.env.ANTIGRAVITY_CONVERSATION_ID || undefined;
  await collectUsage({ dataDir, conversationId, range: '5h' });
}

main().catch(() => {
  process.exit(0);
});
