import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

const RANGE_TABS = [
  { id: 'session', label: '当前会话' },
  { id: '5h', label: '近 5 小时' },
  { id: 'today', label: '今日' },
  { id: '7d', label: '近 7 天' },
  { id: 'all', label: '全部' },
];

const state = {
  data: null,
  loading: true,
  error: '',
  range: 'session',
  conversationId: '',
  showTurns: true,
};

const app = new App({ name: 'usage-tracker', version: '1.0.0' }, {});

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}k`;
  return String(Math.round(num));
}

function fmtExact(n) {
  return (Number(n) || 0).toLocaleString('zh-CN');
}

function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function escapeHtml(str) {
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

async function fetchRange(nextRange) {
  state.range = nextRange || state.range;
  state.loading = true;
  state.error = '';
  render();

  try {
    const res = await app.callServerTool({
      name: 'query_usage_data',
      arguments: {
        conversationId: state.conversationId || undefined,
        range: state.range,
      },
    });
    if (res?.isError) {
      throw new Error(res.content?.[0]?.text || '查询失败');
    }
    if (res?.structuredContent) {
      state.data = res.structuredContent;
      if (state.data.activeConversationId) {
        state.conversationId = state.data.activeConversationId;
      }
      state.range = state.data.range || state.range;
    }
  } catch (err) {
    state.error = err?.message || String(err);
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const data = state.data;
  const totals = data?.totals || { turns: 0, input: 0, output: 0, cacheRead: 0, total: 0, cacheHitRate: 0, conversations: 0 };
  const byModel = data?.byModel || [];
  const turns = data?.recentTurns || [];
  const windows = data?.windows || {};

  const tabsHtml = RANGE_TABS.map((tab) => {
    const active = tab.id === state.range ? 'is-active' : '';
    const winTotal = windows[tab.id]?.total;
    const badge = typeof winTotal === 'number' ? ` <span class="tab-count">${fmt(winTotal)}</span>` : '';
    return `<button class="tab-btn ${active}" data-range="${tab.id}" type="button">${tab.label}${badge}</button>`;
  }).join('');

  const maxModelTotal = byModel.length > 0 ? Math.max(...byModel.map((m) => m.total), 1) : 1;
  const modelsHtml =
    byModel.length === 0
      ? `<div class="empty">当前时间范围内暂无 Token 调用记录</div>`
      : byModel
          .map((m) => {
            const pct = Math.max(4, Math.round((m.total / maxModelTotal) * 100));
            return `
              <div class="model-row">
                <div class="model-meta">
                  <span class="model-name" title="${escapeHtml(m.model)}">${escapeHtml(m.model)}</span>
                  <span class="model-val">${fmt(m.total)} · ${m.turns} 轮（入 ${fmt(m.input)} / 出 ${fmt(m.output)}）</span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              </div>
            `;
          })
          .join('');

  const turnsHtml =
    turns.length === 0
      ? `<div class="empty">暂无逐轮明细</div>`
      : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>模型</th>
                <th class="num">输入</th>
                <th class="num">输出</th>
                <th class="num">缓存读取</th>
              </tr>
            </thead>
            <tbody>
              ${turns
                .slice(0, 20)
                .map(
                  (t) => `
                  <tr>
                    <td class="mono">${fmtTime(t.ts)}</td>
                    <td class="model-cell" title="${escapeHtml(t.model)}">${escapeHtml(t.model)}</td>
                    <td class="num mono">${fmtExact(t.input)}</td>
                    <td class="num mono">${fmtExact(t.output)}</td>
                    <td class="num mono">${fmtExact(t.cacheRead)}</td>
                  </tr>
                `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

  const convBadge = data?.activeConversationId
    ? `<span class="meta-pill" title="${escapeHtml(data.activeConversationId)}">会话 ${escapeHtml(data.activeConversationId.slice(0, 8))}</span>`
    : '';

  root.innerHTML = `
    <div class="card">
      <header class="card-header">
        <div class="title-row">
          <div class="title-group">
            <span class="title">本地 Token 用量统计</span>
            ${convBadge}
          </div>
          <button id="btn-refresh" class="refresh-btn" type="button" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '刷新中...' : '↻ 刷新'}
          </button>
        </div>
        <div class="tabs">${tabsHtml}</div>
      </header>

      ${state.error ? `<div class="error-banner">${escapeHtml(state.error)}</div>` : ''}

      <section class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">总 Token</div>
          <div class="kpi-value" title="${fmtExact(totals.total)}">${fmt(totals.total)}</div>
          <div class="kpi-sub">${totals.turns} 轮 · ${totals.conversations} 个会话</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">输入 Token</div>
          <div class="kpi-value" title="${fmtExact(totals.input)}">${fmt(totals.input)}</div>
          <div class="kpi-sub">精确 ${fmtExact(totals.input)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">输出 Token</div>
          <div class="kpi-value" title="${fmtExact(totals.output)}">${fmt(totals.output)}</div>
          <div class="kpi-sub">精确 ${fmtExact(totals.output)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">缓存命中率</div>
          <div class="kpi-value">${totals.cacheHitRate}%</div>
          <div class="kpi-sub">缓存读取 ${fmt(totals.cacheRead)}</div>
        </div>
      </section>

      <section class="section">
        <div class="section-title">按模型分布</div>
        <div class="models-list">${modelsHtml}</div>
      </section>

      <section class="section">
        <div class="section-header">
          <span class="section-title">最近调用明细（最多 20 条）</span>
          <button id="btn-toggle-turns" class="link-btn" type="button">${state.showTurns ? '收起' : '展开'}</button>
        </div>
        ${state.showTurns ? turnsHtml : ''}
      </section>
    </div>
  `;

  root.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-range');
      if (next) void fetchRange(next);
    });
  });

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => void fetchRange(state.range));
  }

  const toggleBtn = document.getElementById('btn-toggle-turns');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.showTurns = !state.showTurns;
      render();
    });
  }
}

app.ontoolinput = ({ arguments: args }) => {
  if (args?.range) state.range = args.range;
  if (args?.conversationId) state.conversationId = args.conversationId;
  state.loading = true;
  render();
};

app.ontoolresult = (result) => {
  state.loading = false;
  if (result?.isError) {
    state.error = result.content?.[0]?.text || '加载用量失败';
  } else if (result?.structuredContent) {
    state.error = '';
    state.data = result.structuredContent;
    state.range = state.data.range || state.range;
    if (state.data.activeConversationId) {
      state.conversationId = state.data.activeConversationId;
    }
  }
  render();
};

app.onhostcontextchanged = (ctx) => applyThemeContext(ctx);

render();

app.connect().then(() => {
  applyThemeContext(app.getHostContext());
}).catch((err) => {
  state.loading = false;
  state.error = err?.message || '连接宿主失败';
  render();
});
