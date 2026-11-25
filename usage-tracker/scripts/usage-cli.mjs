import { buildSummaryLine, collectUsage, resolveDataDir } from '../src/core/collector.mjs';

function parseArgs(argv) {
  const args = {
    cmd: 'summary',
    format: 'line',
    range: 'session',
    conversationId: process.env.ANTIGRAVITY_CONVERSATION_ID || '',
    dataDir: '',
  };

  if (argv.length > 0 && !argv[0].startsWith('-')) {
    args.cmd = argv[0];
    argv = argv.slice(1);
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--format' && argv[i + 1]) args.format = argv[++i];
    else if (a.startsWith('--format=')) args.format = a.slice('--format='.length);
    else if (a === '--range' && argv[i + 1]) args.range = argv[++i];
    else if (a.startsWith('--range=')) args.range = a.slice('--range='.length);
    else if (a === '--conversation-id' && argv[i + 1]) args.conversationId = argv[++i];
    else if (a.startsWith('--conversation-id=')) args.conversationId = a.slice('--conversation-id='.length);
    else if (a === '--data-dir' && argv[i + 1]) args.dataDir = argv[++i];
    else if (a.startsWith('--data-dir=')) args.dataDir = a.slice('--data-dir='.length);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataDir = resolveDataDir(args.dataDir);

  if (args.cmd === 'summary' && !args.conversationId && args.format === 'line') {
    return;
  }

  const snapshot = await collectUsage({
    dataDir,
    conversationId: args.conversationId || undefined,
    range: args.range,
  });

  if (args.cmd === 'refresh' || args.format === 'json') {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
    return;
  }

  const line = buildSummaryLine(snapshot);
  if (line) {
    process.stdout.write(line + '\n');
  }
}

main().catch(() => {
  // Silent graceful degradation so chat replies are never disrupted.
  process.exit(0);
});
