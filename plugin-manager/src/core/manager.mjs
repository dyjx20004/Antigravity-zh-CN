import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const GITHUB_MIRRORS = {
  proxy: '本地代理 (127.0.0.1:7897)',
  direct: '直连 GitHub',
  ghfast: '国内镜像 (ghfast.top)',
  ghproxy: '国内镜像 (ghproxy)',
};

export const NPM_MIRRORS = {
  npmmirror: 'https://registry.npmmirror.com',
  official: 'https://registry.npmjs.org',
};

export const DISCOVER_CATALOG = [
  {
    id: 'usage-tracker',
    name: 'usage-tracker',
    displayName: '用量统计',
    description: '本地直读会话日志，提供 /usage 内嵌 Token 统计卡片、每轮末尾精简摘要与 Stop 钩子静默缓存（免 npm install）。',
    source: 'https://github.com/dyjx20004/Antigravity-zh-CN#usage-tracker',
    sourceType: 'github',
    tags: ['官方插件格式', 'Token 统计', '内嵌卡片'],
  },
  {
    id: 'plugin-manager',
    name: 'plugin-manager',
    displayName: '插件管理中心',
    description: 'DSH 风格插件安装与更新管理器：支持 GitHub / npm / 本地目录安装、版本比对更新与一键卸载。',
    source: 'https://github.com/dyjx20004/Antigravity-zh-CN#plugin-manager',
    sourceType: 'github',
    tags: ['插件管理', '自动更新'],
  },
];

export function resolvePluginsDir(explicitDir) {
  if (explicitDir) return path.resolve(explicitDir);
  if (process.env.ANTIGRAVITY_PLUGINS_DIR) return path.resolve(process.env.ANTIGRAVITY_PLUGINS_DIR);
  return path.join(os.homedir(), '.gemini', 'config', 'plugins');
}

export function resolveDataDir(explicitDir) {
  if (explicitDir) return path.resolve(explicitDir);
  if (process.env.PLUGIN_DATA) return path.resolve(process.env.PLUGIN_DATA);
  return path.join(os.homedir(), '.gemini', 'antigravity', 'plugin_data', 'plugin-manager');
}

function getRegistryPath(dataDir) {
  return path.join(resolveDataDir(dataDir), 'installed-registry.json');
}

async function readJsonSafe(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonPretty(filePath, obj) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function readRegistry(dataDir) {
  const reg = await readJsonSafe(getRegistryPath(dataDir), { version: 1, plugins: {} });
  if (!reg || typeof reg !== 'object' || !reg.plugins) return { version: 1, plugins: {} };
  return reg;
}

async function writeRegistry(dataDir, reg) {
  await writeJsonPretty(getRegistryPath(dataDir), reg);
}

function sanitizeDirName(rawName) {
  const clean = String(rawName || '')
    .trim()
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!clean || clean === '.' || clean === '..') return 'custom-plugin';
  return clean;
}

function getProxyUrl() {
  return process.env.ANTIGRAVITY_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:7897';
}

function buildGitEnv(githubMirror) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
  if (githubMirror === 'proxy') {
    const proxy = getProxyUrl();
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
    env.http_proxy = proxy;
    env.https_proxy = proxy;
  } else if (githubMirror === 'direct') {
    delete env.HTTP_PROXY;
    delete env.HTTPS_PROXY;
    delete env.http_proxy;
    delete env.https_proxy;
  }
  return env;
}

function applyGitMirrorUrl(repoUrl, githubMirror) {
  if (!/^https:\/\/github\.com\//i.test(repoUrl)) return repoUrl;
  if (githubMirror === 'ghfast') return `https://ghfast.top/${repoUrl}`;
  if (githubMirror === 'ghproxy') return `https://mirror.ghproxy.com/${repoUrl}`;
  return repoUrl;
}

async function runCmd(cmd, args, { cwd, env, timeoutMs = 120_000 } = {}) {
  const isWin = process.platform === 'win32';
  const needsShell = isWin && /\.(cmd|bat)$/i.test(cmd);
  const finalCmd = isWin && (cmd === 'npm' || cmd === 'npx') ? `${cmd}.cmd` : cmd;
  const res = await execFileAsync(finalCmd, args, {
    cwd,
    env: env || process.env,
    timeout: timeoutMs,
    windowsHide: true,
    shell: needsShell || (isWin && /\.(cmd|bat)$/i.test(finalCmd)),
    maxBuffer: 10 * 1024 * 1024,
  });
  return res;
}

export function parseSourceInput(rawInput, forcedMode = 'auto') {
  const input = String(rawInput || '').trim();
  if (!input) throw new Error('请输入插件包名、GitHub 仓库地址或本地目录路径');

  const hashIdx = input.indexOf('#');
  const mainPart = hashIdx >= 0 ? input.slice(0, hashIdx).trim() : input;
  const subdir = hashIdx >= 0 ? input.slice(hashIdx + 1).replace(/^[/\\]+|[/\\]+$/g, '') : '';

  const looksLikeLocal =
    forcedMode === 'local' ||
    /^[a-zA-Z]:[/\\]/.test(mainPart) ||
    mainPart.startsWith('\\\\') ||
    mainPart.startsWith('./') ||
    mainPart.startsWith('../') ||
    mainPart.startsWith('/') ||
    existsSync(mainPart);

  if (looksLikeLocal && forcedMode !== 'github' && forcedMode !== 'npm') {
    return { sourceType: 'local', localPath: path.resolve(mainPart), subdir };
  }

  // GitHub tree URL: https://github.com/owner/repo/tree/branch/subdir
  const treeMatch = mainPart.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/tree\/([^/]+)\/(.+)$/i);
  if (treeMatch) {
    return {
      sourceType: 'github',
      repoUrl: `https://github.com/${treeMatch[1]}/${treeMatch[2]}.git`,
      rawRepoUrl: `https://github.com/${treeMatch[1]}/${treeMatch[2]}`,
      branch: treeMatch[3],
      subdir: subdir || treeMatch[4].replace(/^\/+|\/+$/g, ''),
      repoName: treeMatch[2],
    };
  }

  // GitHub full URL or SSH URL
  const ghUrlMatch = mainPart.match(/^(?:https?:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (ghUrlMatch) {
    return {
      sourceType: 'github',
      repoUrl: `https://github.com/${ghUrlMatch[1]}/${ghUrlMatch[2]}.git`,
      rawRepoUrl: `https://github.com/${ghUrlMatch[1]}/${ghUrlMatch[2]}`,
      branch: '',
      subdir,
      repoName: ghUrlMatch[2],
    };
  }

  // GitHub shorthand owner/repo (no leading @)
  const shortMatch = mainPart.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
  if ((forcedMode === 'github' || (forcedMode === 'auto' && shortMatch && !mainPart.startsWith('@'))) && shortMatch) {
    return {
      sourceType: 'github',
      repoUrl: `https://github.com/${shortMatch[1]}/${shortMatch[2]}.git`,
      rawRepoUrl: `https://github.com/${shortMatch[1]}/${shortMatch[2]}`,
      branch: '',
      subdir,
      repoName: shortMatch[2],
    };
  }

  return { sourceType: 'npm', packageSpec: input };
}

async function findPluginCandidates(rootDir) {
  const candidates = [];
  if (existsSync(path.join(rootDir, 'plugin.json'))) {
    const pj = await readJsonSafe(path.join(rootDir, 'plugin.json'), {});
    candidates.push({
      subdir: '',
      name: pj?.name || path.basename(rootDir),
      displayName: pj?.displayName || pj?.name || path.basename(rootDir),
      description: pj?.description || '',
      version: pj?.version || '',
    });
    return candidates;
  }

  const entries = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const sub = path.join(rootDir, ent.name);
    if (existsSync(path.join(sub, 'plugin.json'))) {
      const pj = await readJsonSafe(path.join(sub, 'plugin.json'), {});
      candidates.push({
        subdir: ent.name,
        name: pj?.name || ent.name,
        displayName: pj?.displayName || pj?.name || ent.name,
        description: pj?.description || '',
        version: pj?.version || '',
      });
    }
  }
  return candidates;
}

async function resolvePluginSubdir(baseDir, requestedSubdir, rawSource, emptyMessage) {
  if (requestedSubdir) {
    const pluginSrcDir = path.join(baseDir, requestedSubdir);
    if (!existsSync(path.join(pluginSrcDir, 'plugin.json'))) {
      throw new Error(`子目录 "${requestedSubdir}" 中未找到 plugin.json`);
    }
    return { chosenSubdir: requestedSubdir, pluginSrcDir };
  }

  const candidates = await findPluginCandidates(baseDir);
  if (candidates.length === 0) {
    throw new Error(emptyMessage);
  }
  if (candidates.length > 1) {
    return {
      selectionRequired: {
        ok: false,
        requiresSubdirSelection: true,
        rawSource,
        candidates,
        message: `该目录/仓库包含 ${candidates.length} 个插件，请选择要安装的插件：`,
      },
    };
  }
  const chosenSubdir = candidates[0].subdir;
  return {
    chosenSubdir,
    pluginSrcDir: chosenSubdir ? path.join(baseDir, chosenSubdir) : baseDir,
  };
}

async function needsNpmInstall(pluginDir) {
  const pkg = await readJsonSafe(path.join(pluginDir, 'package.json'), null);
  if (!pkg || !pkg.dependencies || Object.keys(pkg.dependencies).length === 0) return false;
  if (existsSync(path.join(pluginDir, 'node_modules'))) return false;

  const mcpCfg = await readJsonSafe(path.join(pluginDir, 'mcp_config.json'), null);
  if (mcpCfg && mcpCfg.mcpServers) {
    const serialized = JSON.stringify(mcpCfg.mcpServers);
    const hasBundled = /dist[\\/][^"]+\.(?:cjs|mjs|js)/.test(serialized);
    const hasSrc = /src[\\/]/.test(serialized);
    if (hasBundled && !hasSrc) return false;
  }
  return true;
}

async function installNpmDepsIfNeeded(pluginDir, npmMirror = 'npmmirror') {
  if (!(await needsNpmInstall(pluginDir))) return false;
  const registry = NPM_MIRRORS[npmMirror] || NPM_MIRRORS.npmmirror;
  await runCmd('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', `--registry=${registry}`], {
    cwd: pluginDir,
    timeoutMs: 180_000,
  });
  return true;
}

async function inspectPluginCapabilities(pluginDir) {
  const hasMcp = existsSync(path.join(pluginDir, 'mcp_config.json'));
  const hasHooks = existsSync(path.join(pluginDir, 'hooks.json'));
  const hasRules = existsSync(path.join(pluginDir, 'rules', 'AGENTS.md'));
  let skillsCount = 0;
  try {
    const skillDirs = await readdir(path.join(pluginDir, 'skills'), { withFileTypes: true });
    for (const d of skillDirs) {
      if (d.isDirectory() && existsSync(path.join(pluginDir, 'skills', d.name, 'SKILL.md'))) {
        skillsCount += 1;
      }
    }
  } catch {}
  return { hasMcp, hasHooks, hasRules, skillsCount };
}

export async function listInstalledPlugins({ pluginsDir, dataDir } = {}) {
  const resolvedPluginsDir = resolvePluginsDir(pluginsDir);
  const resolvedDataDir = resolveDataDir(dataDir);
  const registry = await readRegistry(resolvedDataDir);

  let entries = [];
  try {
    entries = await readdir(resolvedPluginsDir, { withFileTypes: true });
  } catch {
    return {
      pluginsDir: resolvedPluginsDir,
      installed: [],
      catalog: DISCOVER_CATALOG,
    };
  }

  const installed = [];
  for (const ent of entries) {
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    const fullDir = path.join(resolvedPluginsDir, ent.name);
    const pjPath = path.join(fullDir, 'plugin.json');
    if (!existsSync(pjPath)) continue;

    const pj = await readJsonSafe(pjPath, {});
    const localMeta = await readJsonSafe(path.join(fullDir, '.agy-install.json'), null);
    const meta = localMeta || registry.plugins[ent.name] || null;

    let isLink = false;
    try {
      const lst = await lstat(fullDir);
      isLink = lst.isSymbolicLink();
    } catch {}

    const caps = await inspectPluginCapabilities(fullDir);
    installed.push({
      dirName: ent.name,
      path: fullDir,
      name: pj?.name || ent.name,
      displayName: pj?.displayName || pj?.name || ent.name,
      description: pj?.description || '',
      version: pj?.version || '0.0.0',
      isLink,
      capabilities: caps,
      managed: Boolean(meta),
      installMeta: meta,
    });
  }

  installed.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'));

  const installedIds = new Set(installed.map((p) => p.dirName));
  const catalog = DISCOVER_CATALOG.map((item) => ({
    ...item,
    installed: installedIds.has(item.id),
  }));

  return {
    pluginsDir: resolvedPluginsDir,
    installed,
    catalog,
  };
}

export async function installPlugin({
  source,
  sourceMode = 'auto',
  githubMirror = 'proxy',
  npmMirror = 'npmmirror',
  localMode = 'copy',
  targetName = '',
  pluginsDir,
  dataDir,
} = {}) {
  const resolvedPluginsDir = resolvePluginsDir(pluginsDir);
  const resolvedDataDir = resolveDataDir(dataDir);
  await mkdir(resolvedPluginsDir, { recursive: true });

  const parsed = parseSourceInput(source, sourceMode);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'agy-pm-'));

  try {
    if (parsed.sourceType === 'github') {
      const cloneUrl = applyGitMirrorUrl(parsed.repoUrl, githubMirror);
      const gitEnv = buildGitEnv(githubMirror);
      const stageRepo = path.join(tmpRoot, 'repo');
      const cloneArgs = ['clone', '--depth', '1'];
      if (parsed.branch) cloneArgs.push('--branch', parsed.branch);
      cloneArgs.push(cloneUrl, stageRepo);

      await runCmd('git', cloneArgs, { env: gitEnv, timeoutMs: 120_000 });

      const commitRes = await runCmd('git', ['rev-parse', 'HEAD'], { cwd: stageRepo });
      const commit = (commitRes.stdout || '').trim();
      const branchRes = await runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: stageRepo });
      const branch = (branchRes.stdout || '').trim();

      const resolved = await resolvePluginSubdir(
        stageRepo,
        parsed.subdir || '',
        parsed.rawRepoUrl,
        '仓库根目录及一级子目录中均未找到 plugin.json，无法作为 Antigravity 插件安装',
      );
      if (resolved.selectionRequired) return resolved.selectionRequired;
      const { chosenSubdir, pluginSrcDir } = resolved;

      const pj = await readJsonSafe(path.join(pluginSrcDir, 'plugin.json'), {});
      const dirName = sanitizeDirName(targetName || chosenSubdir || pj?.name || parsed.repoName);
      const destDir = path.join(resolvedPluginsDir, dirName);

      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true });
      }
      await cp(pluginSrcDir, destDir, {
        recursive: true,
        filter: (srcPath) => !srcPath.endsWith(`${path.sep}node_modules`) && (chosenSubdir ? !srcPath.endsWith(`${path.sep}.git`) : true),
      });

      const depsInstalled = await installNpmDepsIfNeeded(destDir, npmMirror);
      const meta = {
        sourceType: 'github',
        source: parsed.rawRepoUrl + (chosenSubdir ? `#${chosenSubdir}` : ''),
        repoUrl: parsed.repoUrl,
        subdir: chosenSubdir,
        branch: parsed.branch || branch,
        commit,
        version: pj?.version || '0.0.0',
        githubMirror,
        depsInstalled,
        installedAt: new Date().toISOString(),
      };
      await writeJsonPretty(path.join(destDir, '.agy-install.json'), meta);
      const reg = await readRegistry(resolvedDataDir);
      reg.plugins[dirName] = meta;
      await writeRegistry(resolvedDataDir, reg);

      return {
        ok: true,
        dirName,
        displayName: pj?.displayName || pj?.name || dirName,
        version: meta.version,
        commit: commit.slice(0, 7),
        depsInstalled,
        message: `已从 GitHub 安装「${pj?.displayName || dirName}」(${commit.slice(0, 7)})${depsInstalled ? '，并自动安装依赖' : ''}。新开对话或刷新 MCP Servers 后即可生效。`,
      };
    }

    if (parsed.sourceType === 'npm') {
      const registry = NPM_MIRRORS[npmMirror] || NPM_MIRRORS.npmmirror;
      const packRes = await runCmd('npm', ['pack', parsed.packageSpec, `--registry=${registry}`], {
        cwd: tmpRoot,
        timeoutMs: 120_000,
      });
      const tgzName = (packRes.stdout || '').trim().split(/\r?\n/).pop()?.trim();
      if (!tgzName || !existsSync(path.join(tmpRoot, tgzName))) {
        throw new Error(`npm pack 未能下载包: ${parsed.packageSpec}`);
      }
      const extractDir = path.join(tmpRoot, 'pkg');
      await mkdir(extractDir, { recursive: true });
      await runCmd('tar', ['-xzf', path.join(tmpRoot, tgzName), '-C', extractDir], { timeoutMs: 60_000 });

      const pkgDir = path.join(extractDir, 'package');
      if (!existsSync(path.join(pkgDir, 'plugin.json'))) {
        throw new Error(`npm 包 ${parsed.packageSpec} 根目录缺少 plugin.json，不是有效的 Antigravity 插件`);
      }
      const pj = await readJsonSafe(path.join(pkgDir, 'plugin.json'), {});
      const npmPkg = await readJsonSafe(path.join(pkgDir, 'package.json'), {});
      const dirName = sanitizeDirName(targetName || pj?.name || npmPkg?.name || parsed.packageSpec);
      const destDir = path.join(resolvedPluginsDir, dirName);

      if (existsSync(destDir)) {
        await rm(destDir, { recursive: true, force: true });
      }
      await cp(pkgDir, destDir, { recursive: true });
      const depsInstalled = await installNpmDepsIfNeeded(destDir, npmMirror);

      const meta = {
        sourceType: 'npm',
        source: parsed.packageSpec,
        packageName: npmPkg?.name || parsed.packageSpec.replace(/@[^@]+$/, ''),
        version: npmPkg?.version || pj?.version || '0.0.0',
        npmMirror,
        depsInstalled,
        installedAt: new Date().toISOString(),
      };
      await writeJsonPretty(path.join(destDir, '.agy-install.json'), meta);
      const reg = await readRegistry(resolvedDataDir);
      reg.plugins[dirName] = meta;
      await writeRegistry(resolvedDataDir, reg);

      return {
        ok: true,
        dirName,
        displayName: pj?.displayName || pj?.name || dirName,
        version: meta.version,
        depsInstalled,
        message: `已从 npm 安装「${pj?.displayName || dirName}」v${meta.version}。新开对话或刷新 MCP Servers 后即可生效。`,
      };
    }

    // Local directory install (copy or directory junction link)
    if (!existsSync(parsed.localPath)) {
      throw new Error(`本地目录不存在: ${parsed.localPath}`);
    }
    const localResolved = await resolvePluginSubdir(
      parsed.localPath,
      parsed.subdir || '',
      parsed.localPath,
      `本地目录及其一级子目录中均未找到 plugin.json: ${parsed.localPath}`,
    );
    if (localResolved.selectionRequired) return localResolved.selectionRequired;
    const localSrc = localResolved.pluginSrcDir;

    const pj = await readJsonSafe(path.join(localSrc, 'plugin.json'), {});
    const dirName = sanitizeDirName(targetName || pj?.name || path.basename(localSrc));
    const destDir = path.join(resolvedPluginsDir, dirName);

    if (existsSync(destDir)) {
      try {
        const st = await lstat(destDir);
        if (st.isSymbolicLink()) await unlink(destDir);
        else await rm(destDir, { recursive: true, force: true });
      } catch {
        await rm(destDir, { recursive: true, force: true });
      }
    }

    let depsInstalled = false;
    if (localMode === 'link') {
      if (process.platform === 'win32') {
        await runCmd('cmd', ['/c', 'mklink', '/J', destDir, localSrc]);
      } else {
        const { symlink } = await import('node:fs/promises');
        await symlink(localSrc, destDir, 'dir');
      }
    } else {
      await cp(localSrc, destDir, {
        recursive: true,
        filter: (p) => !p.endsWith(`${path.sep}node_modules`) && !p.endsWith(`${path.sep}.git`),
      });
      depsInstalled = await installNpmDepsIfNeeded(destDir, npmMirror);
    }

    const meta = {
      sourceType: 'local',
      localMode,
      source: localSrc,
      version: pj?.version || '0.0.0',
      depsInstalled,
      installedAt: new Date().toISOString(),
    };
    if (localMode !== 'link') {
      await writeJsonPretty(path.join(destDir, '.agy-install.json'), meta);
    }
    const reg = await readRegistry(resolvedDataDir);
    reg.plugins[dirName] = meta;
    await writeRegistry(resolvedDataDir, reg);

    return {
      ok: true,
      dirName,
      displayName: pj?.displayName || pj?.name || dirName,
      version: meta.version,
      localMode,
      message: `已通过${localMode === 'link' ? '目录联接' : '本地复制'}安装「${pj?.displayName || dirName}」v${meta.version}。`,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function checkPluginUpdates({ pluginsDir, dataDir, githubMirror = 'proxy', npmMirror = 'npmmirror' } = {}) {
  const { installed } = await listInstalledPlugins({ pluginsDir, dataDir });
  const results = {};

  for (const item of installed) {
    const meta = item.installMeta;
    if (!meta) continue;

    try {
      if (meta.sourceType === 'github' && meta.repoUrl) {
        const mirror = meta.githubMirror || githubMirror;
        const url = applyGitMirrorUrl(meta.repoUrl, mirror);
        const ref = meta.branch || 'HEAD';
        const lsRes = await runCmd('git', ['ls-remote', url, ref], {
          env: buildGitEnv(mirror),
          timeoutMs: 15_000,
        });
        const firstLine = (lsRes.stdout || '').trim().split(/\r?\n/)[0] || '';
        const remoteCommit = firstLine.split(/\s+/)[0] || '';
        if (remoteCommit && meta.commit && remoteCommit !== meta.commit) {
          results[item.dirName] = {
            hasUpdate: true,
            current: meta.commit.slice(0, 7),
            latest: remoteCommit.slice(0, 7),
            note: `发现新提交 (${meta.commit.slice(0, 7)} → ${remoteCommit.slice(0, 7)})`,
          };
        } else {
          results[item.dirName] = {
            hasUpdate: false,
            current: (meta.commit || '').slice(0, 7) || item.version,
            latest: remoteCommit ? remoteCommit.slice(0, 7) : item.version,
            note: '已是最新',
          };
        }
      } else if (meta.sourceType === 'npm' && meta.packageName) {
        const registry = NPM_MIRRORS[meta.npmMirror || npmMirror] || NPM_MIRRORS.npmmirror;
        const viewRes = await runCmd('npm', ['view', meta.packageName, 'version', `--registry=${registry}`], {
          timeoutMs: 15_000,
        });
        const latestVer = (viewRes.stdout || '').trim();
        const hasUpdate = Boolean(latestVer && latestVer !== meta.version);
        results[item.dirName] = {
          hasUpdate,
          current: meta.version,
          latest: latestVer || meta.version,
          note: hasUpdate ? `发现新版本 v${latestVer}` : '已是最新',
        };
      } else if (meta.sourceType === 'local' && meta.source) {
        if (meta.localMode === 'link') {
          results[item.dirName] = { hasUpdate: false, current: item.version, latest: item.version, note: '目录联接实时同步中' };
        } else if (existsSync(path.join(meta.source, 'plugin.json'))) {
          const srcPj = await readJsonSafe(path.join(meta.source, 'plugin.json'), {});
          const srcVer = srcPj?.version || '0.0.0';
          results[item.dirName] = {
            hasUpdate: srcVer !== item.version,
            current: item.version,
            latest: srcVer,
            note: srcVer !== item.version ? `本地源码已更新至 v${srcVer}` : '可点击重装同步最新本地代码',
          };
        }
      }
    } catch (err) {
      results[item.dirName] = {
        hasUpdate: false,
        error: err?.message || '检查失败',
        note: '检查更新失败（请检查网络/代理）',
      };
    }
  }

  return { checkedAt: new Date().toISOString(), results };
}

export async function updateInstalledPlugin({ dirName, githubMirror, npmMirror, pluginsDir, dataDir } = {}) {
  const resolvedPluginsDir = resolvePluginsDir(pluginsDir);
  const resolvedDataDir = resolveDataDir(dataDir);
  const { installed } = await listInstalledPlugins({ pluginsDir: resolvedPluginsDir, dataDir: resolvedDataDir });
  const target = installed.find((p) => p.dirName === dirName);
  if (!target) throw new Error(`未找到已安装的插件: ${dirName}`);
  const meta = target.installMeta;
  if (!meta || !meta.source) {
    throw new Error(`插件 "${dirName}" 为手动目录安装，缺少来源记录，请通过「+ 添加插件」重新安装`);
  }

  return installPlugin({
    source: meta.source,
    sourceMode: meta.sourceType,
    githubMirror: githubMirror || meta.githubMirror || 'proxy',
    npmMirror: npmMirror || meta.npmMirror || 'npmmirror',
    localMode: meta.localMode || 'copy',
    targetName: dirName,
    pluginsDir: resolvedPluginsDir,
    dataDir: resolvedDataDir,
  });
}

export async function uninstallInstalledPlugin({ dirName, pluginsDir, dataDir } = {}) {
  if (!dirName || dirName.includes('/') || dirName.includes('\\') || dirName === '..') {
    throw new Error('非法插件目录名');
  }
  const resolvedPluginsDir = resolvePluginsDir(pluginsDir);
  const resolvedDataDir = resolveDataDir(dataDir);
  const destDir = path.join(resolvedPluginsDir, dirName);
  if (!existsSync(destDir)) {
    throw new Error(`插件目录不存在: ${destDir}`);
  }

  const st = await lstat(destDir);
  if (st.isSymbolicLink()) {
    await unlink(destDir);
  } else {
    // On Windows, directory junctions appear as symbolic links in lstat; still guard cleanly:
    await rm(destDir, { recursive: true, force: true });
  }

  const reg = await readRegistry(resolvedDataDir);
  if (reg.plugins && reg.plugins[dirName]) {
    delete reg.plugins[dirName];
    await writeRegistry(resolvedDataDir, reg);
  }

  return {
    ok: true,
    dirName,
    message: `已卸载插件「${dirName}」。若该插件包含 MCP 服务，重启对话或刷新 MCP Servers 后完全生效。`,
  };
}
