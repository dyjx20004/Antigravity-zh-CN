import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

const state = {
  tab: 'installed',
  pluginsDir: '',
  installed: [],
  catalog: [],
  updates: {},
  checkingUpdates: false,
  busyKey: '',
  confirmUninstall: '',
  banner: null,
  modalOpen: false,
  modalSource: '',
  modalGithubMirror: 'proxy',
  modalNpmMirror: 'npmmirror',
  modalLocalMode: 'copy',
  modalShowGuide: false,
  modalBusy: false,
  modalError: '',
  modalCandidates: null,
};

const app = new App({ name: 'plugin-manager', version: '1.0.0' }, {});

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyThemeContext(ctx) {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
}

function sourceLabel(item) {
  if (item.isLink) return '本地联接';
  const t = item.installMeta?.sourceType;
  if (t === 'github') return `GitHub${item.installMeta?.commit ? ' · ' + item.installMeta.commit.slice(0, 7) : ''}`;
  if (t === 'npm') return 'npm';
  if (t === 'local') return '本地复制';
  return '手动目录';
}

async function callServer(name, args = {}) {
  const res = await app.callServerTool({ name, arguments: args });
  if (res?.isError) {
    throw new Error(res.structuredContent?.error || res.content?.[0]?.text || '操作失败');
  }
  return res?.structuredContent || {};
}

async function refreshList() {
  state.busyKey = '__refresh__';
  render();
  try {
    const res = await callServer('pm_list_plugins');
    state.pluginsDir = res.pluginsDir || state.pluginsDir;
    state.installed = res.installed || [];
    state.catalog = res.catalog || [];
  } catch (err) {
    state.banner = { type: 'error', text: err.message };
  } finally {
    state.busyKey = '';
    render();
  }
}

async function handleCheckUpdates() {
  state.checkingUpdates = true;
  state.banner = null;
  render();
  try {
    const res = await callServer('pm_check_updates', {
      githubMirror: state.modalGithubMirror,
      npmMirror: state.modalNpmMirror,
    });
    state.updates = res.results || {};
    const count = Object.values(state.updates).filter((u) => u.hasUpdate).length;
    state.banner = {
      type: count > 0 ? 'info' : 'ok',
      text: count > 0 ? `检测到 ${count} 个插件有新版本，点击卡片上的「更新」即可一键升级。` : '所有受管插件均为最新版本。',
    };
  } catch (err) {
    state.banner = { type: 'error', text: `检查更新失败：${err.message}` };
  } finally {
    state.checkingUpdates = false;
    render();
  }
}

async function handleUpdatePlugin(dirName) {
  state.busyKey = `upd:${dirName}`;
  state.banner = null;
  render();
  try {
    const res = await callServer('pm_update_plugin', {
      dirName,
      githubMirror: state.modalGithubMirror,
      npmMirror: state.modalNpmMirror,
    });
    state.installed = res.installed || state.installed;
    state.catalog = res.catalog || state.catalog;
    if (state.updates[dirName]) {
      state.updates[dirName] = { hasUpdate: false, note: '刚刚已更新至最新' };
    }
    state.banner = { type: 'ok', text: res.message || `已更新 ${dirName}` };
  } catch (err) {
    state.banner = { type: 'error', text: `更新 ${dirName} 失败：${err.message}` };
  } finally {
    state.busyKey = '';
    render();
  }
}

async function handleUninstallPlugin(dirName) {
  if (state.confirmUninstall !== dirName) {
    state.confirmUninstall = dirName;
    render();
    return;
  }
  state.confirmUninstall = '';
  state.busyKey = `del:${dirName}`;
  state.banner = null;
  render();
  try {
    const res = await callServer('pm_uninstall_plugin', { dirName });
    state.installed = res.installed || state.installed;
    state.catalog = res.catalog || state.catalog;
    delete state.updates[dirName];
    state.banner = { type: 'ok', text: res.message || `已卸载 ${dirName}` };
  } catch (err) {
    state.banner = { type: 'error', text: `卸载 ${dirName} 失败：${err.message}` };
  } finally {
    state.busyKey = '';
    render();
  }
}

async function handleInstallSubmit(overrideSource) {
  const src = (overrideSource ?? state.modalSource).trim();
  if (!src) {
    state.modalError = '请输入插件的包名、GitHub 仓库地址或本地目录路径';
    render();
    return;
  }
  state.modalBusy = true;
  state.modalError = '';
  state.modalCandidates = null;
  render();
  try {
    const res = await callServer('pm_install_plugin', {
      source: src,
      sourceMode: 'auto',
      githubMirror: state.modalGithubMirror,
      npmMirror: state.modalNpmMirror,
      localMode: state.modalLocalMode,
    });
    if (res.requiresSubdirSelection && Array.isArray(res.candidates)) {
      state.modalCandidates = res;
      state.modalBusy = false;
      render();
      return;
    }
    state.installed = res.installed || state.installed;
    state.catalog = res.catalog || state.catalog;
    state.modalOpen = false;
    state.modalSource = '';
    state.tab = 'installed';
    state.banner = { type: 'ok', text: res.message || '插件安装成功！' };
  } catch (err) {
    state.modalError = err.message;
  } finally {
    state.modalBusy = false;
    render();
  }
}

async function handleQuickCatalogInstall(item) {
  state.busyKey = `cat:${item.id}`;
  state.banner = null;
  render();
  try {
    const res = await callServer('pm_install_plugin', {
      source: item.source,
      sourceMode: item.sourceType || 'github',
      githubMirror: state.modalGithubMirror,
      npmMirror: state.modalNpmMirror,
      targetName: item.id,
    });
    state.installed = res.installed || state.installed;
    state.catalog = res.catalog || state.catalog;
    state.banner = { type: 'ok', text: res.message || `已安装 ${item.displayName}` };
  } catch (err) {
    state.banner = { type: 'error', text: `安装 ${item.displayName} 失败：${err.message}` };
  } finally {
    state.busyKey = '';
    render();
  }
}

function renderCaps(caps) {
  if (!caps) return '';
  const list = [];
  if (caps.hasMcp) list.push('MCP');
  if (caps.skillsCount > 0) list.push(`技能 ×${caps.skillsCount}`);
  if (caps.hasRules) list.push('规则');
  if (caps.hasHooks) list.push('钩子');
  return list.map((x) => `<span class="chip">${x}</span>`).join('');
}

function renderInstalledTab() {
  if (state.installed.length === 0) {
    return `<div class="empty">当前目录暂无插件，点击右上角 <strong>+ 添加插件</strong> 开始安装。</div>`;
  }
  return state.installed
    .map((p) => {
      const upd = state.updates[p.dirName];
      const isUpdBusy = state.busyKey === `upd:${p.dirName}`;
      const isDelBusy = state.busyKey === `del:${p.dirName}`;
      const isConfirming = state.confirmUninstall === p.dirName;

      const updateBadge = upd
        ? `<span class="badge ${upd.hasUpdate ? 'badge--warn' : 'badge--ok'}">${esc(upd.note)}</span>`
        : '';

      const updateBtn = p.managed
        ? `<button class="btn ${upd?.hasUpdate ? 'btn--primary' : 'btn--ghost'}" data-action="update" data-dir="${esc(p.dirName)}" ${isUpdBusy ? 'disabled' : ''}>${
            isUpdBusy ? '更新中...' : upd?.hasUpdate ? `↑ 更新到 ${esc(upd.latest)}` : '↻ 更新'
          }</button>`
        : '';

      const uninstallBtn = `<button class="btn ${isConfirming ? 'btn--danger' : 'btn--ghost'}" data-action="uninstall" data-dir="${esc(p.dirName)}" ${isDelBusy ? 'disabled' : ''}>${
        isDelBusy ? '卸载中...' : isConfirming ? '确认卸载？' : '卸载'
      }</button>`;

      return `
        <div class="plugin-card">
          <div class="plugin-main">
            <div class="plugin-title-row">
              <span class="plugin-name">${esc(p.displayName)}</span>
              <span class="badge">v${esc(p.version)}</span>
              <span class="badge badge--source">${esc(sourceLabel(p))}</span>
              ${updateBadge}
            </div>
            <div class="plugin-desc">${esc(p.description || '无描述')}</div>
            <div class="plugin-meta">
              <span class="mono-id">${esc(p.dirName)}</span>
              ${renderCaps(p.capabilities)}
            </div>
          </div>
          <div class="plugin-actions">
            ${updateBtn}
            ${uninstallBtn}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderDiscoverTab() {
  return state.catalog
    .map((item) => {
      const busy = state.busyKey === `cat:${item.id}`;
      return `
        <div class="plugin-card">
          <div class="plugin-main">
            <div class="plugin-title-row">
              <span class="plugin-name">${esc(item.displayName)}</span>
              <span class="badge badge--source">${esc(item.id)}</span>
              ${item.installed ? `<span class="badge badge--ok">已安装</span>` : ''}
            </div>
            <div class="plugin-desc">${esc(item.description)}</div>
            <div class="plugin-meta">
              <span class="mono-id">${esc(item.source)}</span>
              ${(item.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="plugin-actions">
            <button class="btn ${item.installed ? 'btn--ghost' : 'btn--primary'}" data-action="catalog-install" data-id="${esc(item.id)}" ${busy ? 'disabled' : ''}>
              ${busy ? '处理中...' : item.installed ? '↻ 重装 / 更新' : '安装'}
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderModal() {
  if (!state.modalOpen) return '';
  const candidatesHtml = state.modalCandidates
    ? `
      <div class="candidates-box">
        <div class="candidates-title">${esc(state.modalCandidates.message)}</div>
        <div class="candidates-list">
          ${state.modalCandidates.candidates
            .map(
              (c) => `
              <button class="cand-btn" type="button" data-action="pick-subdir" data-source="${esc(state.modalCandidates.rawSource + (c.subdir ? '#' + c.subdir : ''))}">
                <strong>${esc(c.displayName)}</strong>
                <span>${esc(c.subdir || '根目录')} · v${esc(c.version || '1.0.0')}</span>
              </button>
            `,
            )
            .join('')}
        </div>
      </div>
    `
    : '';

  const guideHtml = state.modalShowGuide
    ? `
      <div class="guide-box">
        <div><strong>GitHub 仓库</strong>：<code>owner/repo</code> 或 <code>https://github.com/owner/repo#子目录</code></div>
        <div><strong>npm 包名</strong>：<code>pkg-name</code> 或 <code>@scope/pkg-name@1.0.0</code></div>
        <div><strong>本地目录</strong>：<code>D:\\path\\to\\my-plugin</code></div>
      </div>
    `
    : '';

  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>添加插件</h3>
          <button class="icon-close" id="btn-modal-close" type="button" aria-label="关闭">×</button>
        </div>
        <p class="modal-sub">输入插件的包名、GitHub 仓库地址或本地目录路径。</p>

        <input
          id="input-plugin-source"
          class="modal-input"
          type="text"
          value="${esc(state.modalSource)}"
          placeholder="例如 dyjx20004/Antigravity-zh-CN#usage-tracker 或 my-plugin"
          ${state.modalBusy ? 'disabled' : ''}
        />

        <div class="modal-controls-row">
          <button id="btn-toggle-guide" class="guide-toggle" type="button">
            ${state.modalShowGuide ? '▾' : '▸'} 插件安装引导与示例
          </button>
        </div>
        ${guideHtml}

        <div class="mirrors-grid">
          <label class="field">
            <span>GitHub 源</span>
            <select id="sel-gh-mirror">
              <option value="proxy" ${state.modalGithubMirror === 'proxy' ? 'selected' : ''}>本地代理 (7897)</option>
              <option value="direct" ${state.modalGithubMirror === 'direct' ? 'selected' : ''}>直连 GitHub</option>
              <option value="ghfast" ${state.modalGithubMirror === 'ghfast' ? 'selected' : ''}>ghfast 镜像</option>
              <option value="ghproxy" ${state.modalGithubMirror === 'ghproxy' ? 'selected' : ''}>ghproxy 镜像</option>
            </select>
          </label>
          <label class="field">
            <span>npm 安装源</span>
            <select id="sel-npm-mirror">
              <option value="npmmirror" ${state.modalNpmMirror === 'npmmirror' ? 'selected' : ''}>中国大陆镜像源</option>
              <option value="official" ${state.modalNpmMirror === 'official' ? 'selected' : ''}>npm 官方源</option>
            </select>
          </label>
          <label class="field">
            <span>本地目录模式</span>
            <select id="sel-local-mode">
              <option value="copy" ${state.modalLocalMode === 'copy' ? 'selected' : ''}>复制安装</option>
              <option value="link" ${state.modalLocalMode === 'link' ? 'selected' : ''}>目录联接 (实时同步)</option>
            </select>
          </label>
        </div>

        <div class="notice-box">
          <div class="notice-title">⚠ 请确认插件来源可信</div>
          <div>插件在本机以您的权限运行，来源不明的插件可能损害系统或读取数据。来自 GitHub / npm 的插件支持在已安装列表一键检查并更新版本。</div>
        </div>

        ${state.modalError ? `<div class="banner banner--error">${esc(state.modalError)}</div>` : ''}
        ${candidatesHtml}

        <button id="btn-install-submit" class="btn btn--primary btn--full" type="button" ${state.modalBusy ? 'disabled' : ''}>
          ${state.modalBusy ? '正在拉取并安装...' : '安装'}
        </button>
      </div>
    </div>
  `;
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const listHtml = state.tab === 'installed' ? renderInstalledTab() : renderDiscoverTab();

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="tabs">
          <button class="tab ${state.tab === 'installed' ? 'is-active' : ''}" data-tab="installed" type="button">
            已安装 <span class="tab-badge">${state.installed.length}</span>
          </button>
          <button class="tab ${state.tab === 'discover' ? 'is-active' : ''}" data-tab="discover" type="button">
            发现 <span class="tab-badge">${state.catalog.length}</span>
          </button>
        </div>
        <div class="top-actions">
          <button id="btn-refresh" class="btn btn--ghost" type="button" ${state.busyKey === '__refresh__' ? 'disabled' : ''}>↻ 刷新</button>
          <button id="btn-check-updates" class="btn btn--ghost" type="button" ${state.checkingUpdates ? 'disabled' : ''}>
            ${state.checkingUpdates ? '检查中...' : '↑ 检查更新'}
          </button>
          <button id="btn-open-add" class="btn btn--primary" type="button">+ 添加插件</button>
        </div>
      </header>

      <div class="subbar">
        <span>插件目录：<code class="mono-id">${esc(state.pluginsDir || '~/.gemini/config/plugins')}</code></span>
      </div>

      ${state.banner ? `<div class="banner banner--${state.banner.type}">${esc(state.banner.text)}</div>` : ''}

      <main class="list-wrap">
        ${listHtml}
      </main>
    </div>
    ${renderModal()}
  `;

  root.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.getAttribute('data-tab') || 'installed';
      state.confirmUninstall = '';
      render();
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => void refreshList());
  document.getElementById('btn-check-updates')?.addEventListener('click', () => void handleCheckUpdates());
  document.getElementById('btn-open-add')?.addEventListener('click', () => {
    state.modalOpen = true;
    state.modalError = '';
    state.modalCandidates = null;
    render();
    setTimeout(() => document.getElementById('input-plugin-source')?.focus(), 20);
  });

  root.querySelectorAll('[data-action="update"]').forEach((btn) => {
    btn.addEventListener('click', () => void handleUpdatePlugin(btn.getAttribute('data-dir')));
  });
  root.querySelectorAll('[data-action="uninstall"]').forEach((btn) => {
    btn.addEventListener('click', () => void handleUninstallPlugin(btn.getAttribute('data-dir')));
  });
  root.querySelectorAll('[data-action="catalog-install"]').forEach((btn) => {
    const id = btn.getAttribute('data-id');
    const item = state.catalog.find((c) => c.id === id);
    if (item) btn.addEventListener('click', () => void handleQuickCatalogInstall(item));
  });

  if (state.modalOpen) {
    document.getElementById('btn-modal-close')?.addEventListener('click', () => {
      state.modalOpen = false;
      render();
    });
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target?.id === 'modal-backdrop' && !state.modalBusy) {
        state.modalOpen = false;
        render();
      }
    });
    const srcInput = document.getElementById('input-plugin-source');
    srcInput?.addEventListener('input', (e) => {
      state.modalSource = e.target.value;
    });
    srcInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !state.modalBusy) void handleInstallSubmit();
    });
    document.getElementById('btn-toggle-guide')?.addEventListener('click', () => {
      state.modalShowGuide = !state.modalShowGuide;
      render();
    });
    document.getElementById('sel-gh-mirror')?.addEventListener('change', (e) => {
      state.modalGithubMirror = e.target.value;
    });
    document.getElementById('sel-npm-mirror')?.addEventListener('change', (e) => {
      state.modalNpmMirror = e.target.value;
    });
    document.getElementById('sel-local-mode')?.addEventListener('change', (e) => {
      state.modalLocalMode = e.target.value;
    });
    document.getElementById('btn-install-submit')?.addEventListener('click', () => void handleInstallSubmit());
    root.querySelectorAll('[data-action="pick-subdir"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = btn.getAttribute('data-source') || '';
        state.modalSource = picked;
        void handleInstallSubmit(picked);
      });
    });
  }
}

app.ontoolinput = ({ arguments: args }) => {
  if (args?.initialTab) state.tab = args.initialTab;
  if (args?.openAddModal) state.modalOpen = true;
  if (args?.prefillSource) state.modalSource = args.prefillSource;
  render();
};

app.ontoolresult = (result) => {
  const sc = result?.structuredContent;
  if (sc) {
    if (sc.pluginsDir) state.pluginsDir = sc.pluginsDir;
    if (Array.isArray(sc.installed)) state.installed = sc.installed;
    if (Array.isArray(sc.catalog)) state.catalog = sc.catalog;
    if (sc.initialTab) state.tab = sc.initialTab;
    if (sc.openAddModal) state.modalOpen = true;
    if (sc.prefillSource) state.modalSource = sc.prefillSource;
  }
  render();
};

app.onhostcontextchanged = (ctx) => applyThemeContext(ctx);

render();

app.connect().then(() => {
  applyThemeContext(app.getHostContext());
}).catch(() => {
  render();
});
