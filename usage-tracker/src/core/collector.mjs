import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function resolveBrainDir() {
  if (process.env.ANTIGRAVITY_BRAIN_DIR) {
    return path.resolve(process.env.ANTIGRAVITY_BRAIN_DIR);
  }
  return path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
}

export function resolveDataDir(explicitDir) {
  if (explicitDir) return path.resolve(explicitDir);
  if (process.env.PLUGIN_DATA) return path.resolve(process.env.PLUGIN_DATA);
  return path.join(os.homedir(), '.gemini', 'antigravity', 'plugin_data', 'usage-tracker');
}

export function formatTokens(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}k`;
  return String(Math.round(num));
}

function emptyStats() {
  return {
    turns: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    total: 0,
    cacheHitRate: 0,
    conversations: 0,
  };
}

function aggregateTurns(turns) {
  const stats = emptyStats();
  const convSet = new Set();
  for (const t of turns) {
    stats.turns += 1;
    stats.input += t.input;
    stats.output += t.output;
    stats.cacheRead += t.cacheRead;
    if (t.conversationId) convSet.add(t.conversationId);
  }
  stats.total = stats.input + stats.output;
  const denom = stats.input + stats.cacheRead;
  stats.cacheHitRate = denom > 0 ? Math.round((stats.cacheRead / denom) * 1000) / 10 : 0;
  stats.conversations = convSet.size;
  return stats;
}

function aggregateByModel(turns) {
  const map = new Map();
  for (const t of turns) {
    const key = t.model || 'unknown';
    let item = map.get(key);
    if (!item) {
      item = { model: key, turns: 0, input: 0, output: 0, cacheRead: 0, total: 0 };
      map.set(key, item);
    }
    item.turns += 1;
    item.input += t.input;
    item.output += t.output;
    item.cacheRead += t.cacheRead;
    item.total += t.input + t.output;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

async function readCache(cachePath) {
  try {
    const raw = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.conversations && typeof parsed.conversations === 'object') {
      return parsed;
    }
  } catch {
    // Ignore missing or corrupt cache; rebuild cleanly.
  }
  return { version: 1, conversations: {} };
}

async function writeCacheAtomic(cachePath, payload) {
  const dir = path.dirname(cachePath);
  await mkdir(dir, { recursive: true });
  const tmp = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(payload), 'utf8');
  try {
    await rename(tmp, cachePath);
  } catch {
    await writeFile(cachePath, JSON.stringify(payload), 'utf8');
  }
}

async function parseTranscriptFile(filePath, fallbackTsMs) {
  const raw = await readFile(filePath, 'utf8');
  const turns = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || !line.includes('input_tokens')) continue;
    try {
      const obj = JSON.parse(line);
      if (
        typeof obj.model === 'string' &&
        typeof obj.input_tokens === 'number' &&
        typeof obj.output_tokens === 'number'
      ) {
        const parsedTs = obj.created_at ? Date.parse(obj.created_at) : NaN;
        const tsMs = Number.isFinite(parsedTs) ? parsedTs : fallbackTsMs;
        turns.push({
          ts: obj.created_at || new Date(tsMs).toISOString(),
          tsMs,
          model: obj.model,
          input: obj.input_tokens,
          output: obj.output_tokens,
          cacheRead: typeof obj.cache_read_tokens === 'number' ? obj.cache_read_tokens : 0,
          step: typeof obj.step_index === 'number' ? obj.step_index : null,
        });
      }
    } catch {
      // Skip malformed line without breaking whole scan.
    }
  }
  return turns;
}

export async function syncCache({ dataDir, brainDir } = {}) {
  const resolvedDataDir = resolveDataDir(dataDir);
  const resolvedBrainDir = brainDir ? path.resolve(brainDir) : resolveBrainDir();
  const cachePath = path.join(resolvedDataDir, 'usage-cache.json');
  const cache = await readCache(cachePath);
  const nextConversations = {};
  let dirty = false;

  let entries = [];
  try {
    entries = await readdir(resolvedBrainDir, { withFileTypes: true });
  } catch {
    return { cache: { version: 1, conversations: {} }, brainDir: resolvedBrainDir, dataDir: resolvedDataDir };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const convId = entry.name;
    const logPath = path.join(resolvedBrainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
    let st;
    try {
      st = await stat(logPath);
    } catch {
      continue;
    }

    const prev = cache.conversations[convId];
    if (prev && prev.mtimeMs === st.mtimeMs && prev.size === st.size && Array.isArray(prev.turns)) {
      nextConversations[convId] = prev;
      continue;
    }

    dirty = true;
    const turns = await parseTranscriptFile(logPath, st.mtimeMs);
    const lastTurnTs = turns.length > 0 ? turns[turns.length - 1].tsMs : st.mtimeMs;
    nextConversations[convId] = {
      mtimeMs: st.mtimeMs,
      size: st.size,
      lastTurnTs,
      turns,
    };
  }

  if (!dirty && Object.keys(cache.conversations).length !== Object.keys(nextConversations).length) {
    dirty = true;
  }

  const nextCache = { version: 1, updatedAt: new Date().toISOString(), conversations: nextConversations };
  if (dirty) {
    await writeCacheAtomic(cachePath, nextCache);
  }
  return { cache: nextCache, brainDir: resolvedBrainDir, dataDir: resolvedDataDir };
}

function getWindowStart(range, nowMs) {
  if (range === '5h') return nowMs - 5 * 3600 * 1000;
  if (range === 'today') {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (range === '7d') return nowMs - 7 * 24 * 3600 * 1000;
  return 0;
}

export async function collectUsage({ dataDir, brainDir, conversationId, range = 'session', nowMs = Date.now() } = {}) {
  const validRanges = new Set(['session', '5h', 'today', '7d', 'all']);
  const normalizedRange = validRanges.has(range) ? range : 'session';
  const { cache } = await syncCache({ dataDir, brainDir });
  const convMap = cache.conversations || {};

  const allTurns = [];
  let latestConvId = '';
  let latestTs = -1;

  for (const [convId, info] of Object.entries(convMap)) {
    const turns = Array.isArray(info.turns) ? info.turns : [];
    if (turns.length > 0 && (info.lastTurnTs || info.mtimeMs || 0) > latestTs) {
      latestTs = info.lastTurnTs || info.mtimeMs || 0;
      latestConvId = convId;
    }
    for (const t of turns) {
      allTurns.push({ ...t, conversationId: convId });
    }
  }

  const activeConversationId =
    conversationId && convMap[conversationId] ? conversationId : conversationId || latestConvId;

  const sessionTurns = activeConversationId
    ? allTurns.filter((t) => t.conversationId === activeConversationId)
    : [];

  const start5h = getWindowStart('5h', nowMs);
  const startToday = getWindowStart('today', nowMs);
  const start7d = getWindowStart('7d', nowMs);

  const turns5h = allTurns.filter((t) => t.tsMs >= start5h);
  const turnsToday = allTurns.filter((t) => t.tsMs >= startToday);
  const turns7d = allTurns.filter((t) => t.tsMs >= start7d);

  let selectedTurns;
  if (normalizedRange === 'session') selectedTurns = sessionTurns;
  else if (normalizedRange === '5h') selectedTurns = turns5h;
  else if (normalizedRange === 'today') selectedTurns = turnsToday;
  else if (normalizedRange === '7d') selectedTurns = turns7d;
  else selectedTurns = allTurns;

  const sortedRecent = [...selectedTurns].sort((a, b) => b.tsMs - a.tsMs).slice(0, 40);
  const lastSessionTurn = sessionTurns.length > 0 ? sessionTurns[sessionTurns.length - 1] : null;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    range: normalizedRange,
    activeConversationId: activeConversationId || '',
    totalConversationsIndexed: Object.keys(convMap).length,
    totals: aggregateTurns(selectedTurns),
    byModel: aggregateByModel(selectedTurns),
    recentTurns: sortedRecent,
    lastSessionTurn,
    windows: {
      session: aggregateTurns(sessionTurns),
      '5h': aggregateTurns(turns5h),
      today: aggregateTurns(turnsToday),
      '7d': aggregateTurns(turns7d),
      all: aggregateTurns(allTurns),
    },
  };
}

export function buildSummaryLine(snapshot) {
  if (!snapshot) return '';
  const sess = snapshot.windows?.session || emptyStats();
  const win5h = snapshot.windows?.['5h'] || emptyStats();
  const winToday = snapshot.windows?.today || emptyStats();
  const last = snapshot.lastSessionTurn;

  if (sess.turns === 0 && win5h.turns === 0) return '';

  const lines = ['> **📊 Token 用量统计**'];
  if (last) {
    lines.push(
      `> - **最近一轮**：输入 \`${formatTokens(last.input)}\` · 输出 \`${formatTokens(last.output)}\` · 模型 \`${last.model}\``,
    );
  }
  if (sess.turns > 0) {
    lines.push(
      `> - **本会话累计**：\`${formatTokens(sess.total)}\`（\`${sess.turns}\` 轮 · 缓存命中 \`${sess.cacheHitRate}%\`）`,
    );
  }
  lines.push(
    `> - **近 5h / 今日**：\`${formatTokens(win5h.total)}\` / \`${formatTokens(winToday.total)}\``,
  );
  return lines.join('\n');
}
