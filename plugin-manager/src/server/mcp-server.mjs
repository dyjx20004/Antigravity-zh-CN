import { existsSync } from 'node:fs';
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
import {
  checkPluginUpdates,
  installPlugin,
  listInstalledPlugins,
  resolveDataDir,
  resolvePluginsDir,
  uninstallInstalledPlugin,
  updateInstalledPlugin,
} from '../core/manager.mjs';

const BASE_DIR = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const APP_URI = 'ui://plugin-manager/app.html';
const DEFAULT_HTML_PATH = existsSync(path.join(BASE_DIR, 'app.html'))
  ? path.join(BASE_DIR, 'app.html')
  : path.resolve(BASE_DIR, '..', '..', 'dist', 'app.html');

function parseCliArg(argv, flag) {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
    if (a === flag && i + 1 < argv.length) return argv[i + 1];
  }
  return '';
}

function getAppHtmlPath() {
  return process.env.PLUGIN_MANAGER_APP_HTML || DEFAULT_HTML_PATH;
}

function toolReply(text, structuredContent, isError = false) {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
    ...(isError ? { isError: true } : {}),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const dataDir = resolveDataDir(parseCliArg(argv, '--data-dir'));
  const pluginsDir = resolvePluginsDir(parseCliArg(argv, '--plugins-dir'));

  const server = new McpServer({
    name: 'plugin-manager',
    version: '1.0.0',
  });

  registerAppResource(
    server,
    '插件管理中心',
    APP_URI,
    {
      description: 'DSH 风格插件安装、更新与卸载可视化管理中心',
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: false,
        },
      },
    },
    async () => {
      const html = await readFile(getAppHtmlPath(), 'utf8');
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
    'open_plugin_manager',
    {
      title: '插件管理中心',
      description:
        '打开 DSH 风格的插件管理中心，支持通过 GitHub 仓库（含 #子目录）、npm 包名或本地目录安装、检查更新及卸载 Antigravity 插件。',
      inputSchema: {
        initialTab: z.enum(['installed', 'discover']).optional(),
        openAddModal: z.boolean().optional(),
        prefillSource: z.string().optional(),
      },
      _meta: {
        ui: {
          resourceUri: APP_URI,
        },
        'com.google.antigravity/ui': {
          entrypoints: [
            { type: 'global', title: '插件管理中心' },
            { type: 'aux_pane', title: '插件管理中心' },
          ],
        },
      },
    },
    async ({ initialTab = 'installed', openAddModal = false, prefillSource = '' } = {}) => {
      const snapshot = await listInstalledPlugins({ pluginsDir, dataDir });
      return toolReply(
        `已打开插件管理中心：当前已发现 ${snapshot.installed.length} 个全局插件。`,
        {
          ...snapshot,
          initialTab,
          openAddModal,
          prefillSource,
        },
      );
    },
  );

  registerAppTool(
    server,
    'pm_list_plugins',
    {
      title: '列出插件',
      description: '读取全局插件列表与发现目录。',
      inputSchema: {},
      _meta: { ui: { visibility: ['app'] } },
    },
    async () => {
      const snapshot = await listInstalledPlugins({ pluginsDir, dataDir });
      return toolReply(`共 ${snapshot.installed.length} 个已安装插件`, snapshot);
    },
  );

  registerAppTool(
    server,
    'pm_install_plugin',
    {
      title: '安装插件',
      description: '从 GitHub、npm 或本地目录安装 Antigravity 插件。',
      inputSchema: {
        source: z.string(),
        sourceMode: z.enum(['auto', 'github', 'npm', 'local']).optional(),
        githubMirror: z.enum(['proxy', 'direct', 'ghfast', 'ghproxy']).optional(),
        npmMirror: z.enum(['npmmirror', 'official']).optional(),
        localMode: z.enum(['copy', 'link']).optional(),
        targetName: z.string().optional(),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async (args) => {
      try {
        const res = await installPlugin({ ...args, pluginsDir, dataDir });
        const list = await listInstalledPlugins({ pluginsDir, dataDir });
        return toolReply(res.message || '操作完成', { ...res, ...list }, !res.ok && !res.requiresSubdirSelection);
      } catch (err) {
        const msg = err?.message || String(err);
        return toolReply(msg, { ok: false, error: msg }, true);
      }
    },
  );

  registerAppTool(
    server,
    'pm_check_updates',
    {
      title: '检查插件更新',
      description: '检查已安装的可管理插件是否有远程或本地更新。',
      inputSchema: {
        githubMirror: z.enum(['proxy', 'direct', 'ghfast', 'ghproxy']).optional(),
        npmMirror: z.enum(['npmmirror', 'official']).optional(),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ githubMirror = 'proxy', npmMirror = 'npmmirror' } = {}) => {
      const res = await checkPluginUpdates({ pluginsDir, dataDir, githubMirror, npmMirror });
      const count = Object.values(res.results || {}).filter((r) => r.hasUpdate).length;
      return toolReply(`检查完成，发现 ${count} 个可更新插件。`, res);
    },
  );

  registerAppTool(
    server,
    'pm_update_plugin',
    {
      title: '更新插件',
      description: '更新指定的已安装插件到最新版本。',
      inputSchema: {
        dirName: z.string(),
        githubMirror: z.enum(['proxy', 'direct', 'ghfast', 'ghproxy']).optional(),
        npmMirror: z.enum(['npmmirror', 'official']).optional(),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ dirName, githubMirror, npmMirror }) => {
      try {
        const res = await updateInstalledPlugin({ dirName, githubMirror, npmMirror, pluginsDir, dataDir });
        const list = await listInstalledPlugins({ pluginsDir, dataDir });
        return toolReply(res.message || '更新成功', { ...res, ...list });
      } catch (err) {
        const msg = err?.message || String(err);
        return toolReply(msg, { ok: false, error: msg }, true);
      }
    },
  );

  registerAppTool(
    server,
    'pm_uninstall_plugin',
    {
      title: '卸载插件',
      description: '卸载指定的全局插件目录。',
      inputSchema: {
        dirName: z.string(),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ dirName }) => {
      try {
        const res = await uninstallInstalledPlugin({ dirName, pluginsDir, dataDir });
        const list = await listInstalledPlugins({ pluginsDir, dataDir });
        return toolReply(res.message || '卸载成功', { ...res, ...list });
      } catch (err) {
        const msg = err?.message || String(err);
        return toolReply(msg, { ok: false, error: msg }, true);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[plugin-manager] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
