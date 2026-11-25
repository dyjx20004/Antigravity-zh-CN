import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { collectUsage, formatTokens, resolveDataDir } from '../core/collector.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const APP_URI = 'ui://usage-tracker/card.html';
const DEFAULT_HTML_PATH = path.join(PLUGIN_ROOT, 'dist', 'card.html');

function parseDataDirArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--data-dir=')) return a.slice('--data-dir='.length);
    if (a === '--data-dir' && i + 1 < argv.length) return argv[i + 1];
  }
  return '';
}

function getCardHtmlPath() {
  return process.env.USAGE_TRACKER_CARD_HTML || DEFAULT_HTML_PATH;
}

const RANGE_LABELS = {
  session: '当前会话',
  '5h': '近 5 小时',
  today: '今日',
  '7d': '近 7 天',
  all: '全部时间',
};

function buildTextSummary(snapshot) {
  const label = RANGE_LABELS[snapshot.range] || snapshot.range;
  const t = snapshot.totals;
  return (
    `已统计【${label}】Token 用量：共 ${t.turns} 轮调用，` +
    `总计 ${formatTokens(t.total)}（输入 ${formatTokens(t.input)}，输出 ${formatTokens(t.output)}，` +
    `缓存命中率 ${t.cacheHitRate}%）。`
  );
}

async function main() {
  const dataDir = resolveDataDir(parseDataDirArg(process.argv.slice(2)));
  const server = new McpServer({
    name: 'usage-tracker',
    version: '1.0.0',
  });

  registerAppResource(
    server,
    'Token 用量统计卡片',
    APP_URI,
    {
      description: 'Antigravity 对话内嵌 Token 用量与模型分布卡片',
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: false,
        },
      },
    },
    async () => {
      const html = await readFile(getCardHtmlPath(), 'utf8');
      return {
        contents: [
          {
            uri: APP_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: false,
              },
            },
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    'show_usage_card',
    {
      title: '查看当前用量',
      description:
        '在当前对话中渲染交互式 Token 用量内嵌卡片，支持查看当前会话、近 5 小时、今日、近 7 天及全部时间的输入/输出/缓存命中率、模型分布与逐轮明细。',
      inputSchema: {
        conversationId: z.string().optional(),
        range: z.enum(['session', '5h', 'today', '7d', 'all']).optional(),
      },
      _meta: {
        ui: {
          resourceUri: APP_URI,
        },
      },
    },
    async ({ conversationId, range = 'session' } = {}) => {
      const snapshot = await collectUsage({
        dataDir,
        conversationId: conversationId || process.env.ANTIGRAVITY_CONVERSATION_ID || undefined,
        range,
      });
      return {
        content: [{ type: 'text', text: buildTextSummary(snapshot) }],
        structuredContent: snapshot,
      };
    },
  );

  registerAppTool(
    server,
    'query_usage_data',
    {
      title: '刷新用量数据',
      description: '供内嵌用量卡片内部切换时间范围与刷新数据的 app-only 工具。',
      inputSchema: {
        conversationId: z.string().optional(),
        range: z.enum(['session', '5h', 'today', '7d', 'all']).optional(),
      },
      _meta: {
        ui: {
          visibility: ['app'],
        },
      },
    },
    async ({ conversationId, range = 'session' } = {}) => {
      const snapshot = await collectUsage({
        dataDir,
        conversationId: conversationId || undefined,
        range,
      });
      return {
        content: [{ type: 'text', text: buildTextSummary(snapshot) }],
        structuredContent: snapshot,
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[usage-tracker] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
