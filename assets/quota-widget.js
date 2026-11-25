// Antigravity Quota & Usage Widget
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.location && (window.location.protocol === 'data:' || window.location.protocol === 'about:')) return;
  if (window.__ANTIGRAVITY_QUOTA_WIDGET_LOADED__) return;
  window.__ANTIGRAVITY_QUOTA_WIDGET_LOADED__ = true;

  let ipcRenderer = null;
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (_) {}

  const STYLE_ID = 'agy-zh-quota-style';
  const POPOVER_ID = 'agy-zh-quota-popover';

  let state = {
    localUsage: null,
    loading: false,
    popoverOpen: false,
    anchorEl: null,
  };

  function fmtTokens(n) {
    const num = Number(n) || 0;
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
    return String(Math.round(num));
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .agy-q-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid rgba(128, 128, 128, 0.26);
        background: rgba(128, 128, 128, 0.08);
        color: inherit;
        font-size: 11px;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        align-self: center;
        transition: background 0.15s ease, border-color 0.15s ease;
        font-family: inherit;
      }
      .agy-q-pill:hover {
        background: rgba(128, 128, 128, 0.18);
        border-color: rgba(128, 128, 128, 0.45);
      }
      .agy-q-pill--composer {
        margin-left: 6px;
        margin-right: 4px;
        opacity: 0.92;
      }
      .agy-q-pill--settings {
        margin-left: auto;
        font-size: 11px;
        height: 22px;
        padding: 0 7px;
        opacity: 0.9;
      }
      .agy-q-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
        background: #3b82f6;
      }

      #${POPOVER_ID} {
        position: fixed;
        z-index: 2147483000;
        width: 316px;
        max-width: calc(100vw - 24px);
        background: #18181b;
        color: #f4f4f5;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 12px;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.45);
        padding: 12px 13px;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }
      @media (prefers-color-scheme: light) {
        #${POPOVER_ID} {
          background: #ffffff;
          color: #18181b;
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.14);
        }
      }
      .agy-q-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 9px;
      }
      .agy-q-title {
        font-size: 13px;
        font-weight: 600;
      }
      .agy-q-close {
        border: none;
        background: transparent;
        color: inherit;
        opacity: 0.65;
        cursor: pointer;
        font-size: 15px;
        padding: 0 4px;
      }
      .agy-q-close:hover { opacity: 1; }
      .agy-q-sec {
        border: 1px solid rgba(128, 128, 128, 0.2);
        background: rgba(128, 128, 128, 0.06);
        border-radius: 8px;
        padding: 9px 10px;
      }
      .agy-q-sec-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        opacity: 0.72;
        margin-bottom: 7px;
      }
      .agy-q-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin: 4px 0;
      }
      .agy-q-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin: 6px 0;
      }
      .agy-q-box {
        background: rgba(128, 128, 128, 0.08);
        border: 1px solid rgba(128, 128, 128, 0.14);
        border-radius: 6px;
        padding: 6px 8px;
      }
      .agy-q-box-label {
        font-size: 10px;
        opacity: 0.68;
      }
      .agy-q-box-val {
        font-size: 14px;
        font-weight: 600;
        margin-top: 1px;
      }
      .agy-q-sub {
        font-size: 11px;
        opacity: 0.7;
      }
      .agy-q-tip {
        margin-top: 8px;
        font-size: 11px;
        opacity: 0.68;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  async function fetchLocalUsageSummary() {
    if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return null;
    state.loading = true;
    try {
      const urlMatch = (window.location?.href || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const convId = urlMatch ? urlMatch[0] : '';
      const res = await ipcRenderer.invoke('agy-zh:get-usage-summary', convId);
      state.localUsage = res || null;
      updateAllBadges();
      return state.localUsage;
    } catch (_) {
      return null;
    } finally {
      state.loading = false;
    }
  }

  function buildBadgeContent(slot) {
    const lu = state.localUsage;
    let label = '用量';
    if (lu && typeof lu.sessionTotal === 'number' && lu.sessionTotal > 0) {
      label = slot === 'settings' ? `用量 ${fmtTokens(lu.fiveHourTotal || lu.sessionTotal)}` : `用量 ${fmtTokens(lu.sessionTotal)}`;
    }
    return `<span class="agy-q-dot"></span><span>${escapeHtml(label)}</span>`;
  }

  function updateAllBadges() {
    document.querySelectorAll('[data-agy-zh-quota-slot]').forEach((btn) => {
      const slot = btn.getAttribute('data-agy-zh-quota-slot') || 'composer';
      btn.innerHTML = buildBadgeContent(slot);
    });
  }

  function createPill(slot, className) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `agy-q-pill ${className}`;
    btn.setAttribute('data-agy-zh-quota-ui', '1');
    btn.setAttribute('data-agy-zh-quota-slot', slot);
    btn.title = '查看本地 Token 消耗（打开自动刷新）';
    btn.innerHTML = buildBadgeContent(slot);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      void togglePopover(btn);
    });
    return btn;
  }

  function resetPillInlinePos(pill) {
    pill.style.position = '';
    pill.style.left = '';
    pill.style.top = '';
    pill.style.zIndex = '';
    pill.style.marginLeft = '';
  }

  function findSettingsButton() {
    const btns = document.querySelectorAll('button, a, [role="button"]');
    const h = window.innerHeight || 800;
    for (let i = 0; i < btns.length; i++) {
      const el = btns[i];
      if (el.closest('[data-agy-zh-quota-ui="1"]')) continue;
      const txt = (el.textContent || '').trim();
      if (!/^(?:设置|Settings)$/i.test(txt)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left < 280 && r.top > h * 0.65) {
        return el;
      }
    }
    return null;
  }

  function findModelSelectorButton() {
    const btns = document.querySelectorAll('button, [role="button"]');
    const h = window.innerHeight || 800;
    let best = null;
    let bestTop = -1;
    for (let i = 0; i < btns.length; i++) {
      const el = btns[i];
      if (el.closest('[data-agy-zh-quota-ui="1"]')) continue;
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 65) continue;
      if (!/^(?:Gemini|Claude|GPT-OSS|Orchestrator)\b/i.test(txt)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.width < 320 && r.height > 16 && r.height < 50 && r.top > h * 0.45) {
        if (r.top > bestTop) {
          bestTop = r.top;
          best = el;
        }
      }
    }
    return best;
  }

  // Locate horizontal toolbar row by actual sibling geometry (not fragile CSS height assumptions)
  function findHorizontalInsertion(modelBtn) {
    const mr = modelBtn.getBoundingClientRect();
    let child = modelBtn;
    let cur = modelBtn.parentElement;

    for (let depth = 0; depth < 8 && cur && cur !== document.body; depth++) {
      const cr = child.getBoundingClientRect();
      const sibs = Array.from(cur.children).filter(
        (c) => c !== child && !c.hasAttribute('data-agy-zh-quota-slot'),
      );

      let hasHorizontalSibling = false;
      for (let i = 0; i < sibs.length; i++) {
        const sr = sibs[i].getBoundingClientRect();
        if (sr.width <= 0 || sr.height <= 0) continue;
        const sameRow = Math.abs((sr.top + sr.height / 2) - (mr.top + mr.height / 2)) < 28;
        const sideBySide = sr.left >= cr.right - 6 || sr.right <= cr.left + 6;
        if (sameRow && sideBySide) {
          hasHorizontalSibling = true;
          break;
        }
      }

      if (hasHorizontalSibling) {
        // If `child` stretches wide across the spacer, insert right beside modelBtn inside `child` when safe
        if (cr.width > mr.width + 48) {
          const childRawCount = Array.from(child.children).filter(
            (c) => !c.hasAttribute('data-agy-zh-quota-slot'),
          ).length;
          if (childRawCount <= 1 && child === modelBtn.parentElement) {
            child.style.display = 'inline-flex';
            child.style.flexDirection = 'row';
            child.style.alignItems = 'center';
            child.style.flexWrap = 'nowrap';
            child.style.gap = '6px';
            return { container: child, afterEl: modelBtn };
          }
        }
        return { container: cur, afterEl: child };
      }

      child = cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function mountComposerBadge() {
    const modelBtn = findModelSelectorButton();
    if (!modelBtn) return;

    const mr = modelBtn.getBoundingClientRect();
    if (mr.width <= 0 || mr.height <= 0) return;

    let pill = document.querySelector('[data-agy-zh-quota-slot="composer"]');
    if (!pill) {
      pill = createPill('composer', 'agy-q-pill--composer');
    }

    const target = findHorizontalInsertion(modelBtn);
    if (target && target.container) {
      resetPillInlinePos(pill);
      if (pill.parentElement !== target.container || pill.previousElementSibling !== target.afterEl) {
        target.container.insertBefore(pill, target.afterEl.nextSibling);
      }
      // Verify actual geometry: if CSS still wrapped or pushed it onto another row, pin right behind modelBtn
      const pr = pill.getBoundingClientRect();
      const sameRow = Math.abs((pr.top + pr.height / 2) - (mr.top + mr.height / 2)) <= 12;
      const rightNext = pr.left >= mr.right - 2 && pr.left <= mr.right + 160;
      if (pr.width > 0 && sameRow && rightNext) {
        return;
      }
    }

    // Guaranteed fallback: place directly behind modelBtn on the exact same horizontal line
    if (pill.parentElement !== document.body) {
      document.body.appendChild(pill);
    }
    pill.style.position = 'fixed';
    pill.style.zIndex = '2147482000';
    pill.style.marginLeft = '0';
    pill.style.left = Math.round(mr.right + 8) + 'px';
    pill.style.top = Math.round(mr.top + Math.max(0, (mr.height - 22) / 2)) + 'px';
  }

  function mountSettingsBadge() {
    const settingsBtn = findSettingsButton();
    if (!settingsBtn || !settingsBtn.parentElement) return;

    const sr = settingsBtn.getBoundingClientRect();
    if (sr.width <= 0 || sr.height <= 0) return;

    const parent = settingsBtn.parentElement;
    const cs = window.getComputedStyle(parent);
    const nonPillChildren = Array.from(parent.children).filter(
      (c) => !c.hasAttribute('data-agy-zh-quota-slot'),
    );

    let pill = document.querySelector('[data-agy-zh-quota-slot="settings"]');
    if (!pill) {
      pill = createPill('settings', 'agy-q-pill--settings');
    }

    if (nonPillChildren.length <= 1 || (cs.display.includes('flex') && cs.flexDirection !== 'column')) {
      resetPillInlinePos(pill);
      if (cs.display !== 'flex' || cs.flexDirection === 'column') {
        parent.style.display = 'flex';
        parent.style.flexDirection = 'row';
        parent.style.alignItems = 'center';
        parent.style.justifyContent = 'space-between';
        parent.style.gap = '6px';
      }
      settingsBtn.style.width = 'auto';
      settingsBtn.style.flex = '0 1 auto';
      settingsBtn.style.minWidth = '0';
      if (pill.parentElement !== parent || pill.previousElementSibling !== settingsBtn) {
        parent.insertBefore(pill, settingsBtn.nextSibling);
      }
      const pr = pill.getBoundingClientRect();
      const sra = settingsBtn.getBoundingClientRect();
      if (pr.width > 0 && Math.abs((pr.top + pr.height / 2) - (sra.top + sra.height / 2)) <= 12 && pr.left > sra.left + 20) {
        return;
      }
    }

    // Guaranteed horizontal fallback on the exact same row right beside 设置
    const pr = parent.getBoundingClientRect();
    if (pill.parentElement !== document.body) {
      document.body.appendChild(pill);
    }
    pill.style.position = 'fixed';
    pill.style.zIndex = '2147482000';
    pill.style.marginLeft = '0';
    pill.style.top = Math.round(sr.top + Math.max(0, (sr.height - 22) / 2)) + 'px';
    const rightBound = Math.max(sr.right, pr.right);
    const pillWidth = pill.offsetWidth || 72;
    pill.style.left = Math.round(Math.max(sr.left + 76, rightBound - pillWidth - 8)) + 'px';
  }

  function mountWidgets() {
    if (!document.body) return;
    ensureStyles();
    mountSettingsBadge();
    mountComposerBadge();
  }

  function closePopover() {
    state.popoverOpen = false;
    const pop = document.getElementById(POPOVER_ID);
    if (pop) pop.remove();
  }

  async function togglePopover(anchorEl) {
    if (state.popoverOpen && state.anchorEl === anchorEl) {
      closePopover();
      return;
    }
    state.anchorEl = anchorEl;
    state.popoverOpen = true;
    state.loading = true;
    renderPopover();
    await fetchLocalUsageSummary();
    if (state.popoverOpen) renderPopover();
  }

  function renderPopover() {
    let pop = document.getElementById(POPOVER_ID);
    if (!pop) {
      pop = document.createElement('div');
      pop.id = POPOVER_ID;
      pop.setAttribute('data-agy-zh-quota-ui', '1');
      document.body.appendChild(pop);
    }

    const lu = state.localUsage;
    const syncLabel = state.loading
      ? '自动刷新中...'
      : lu?.updatedAt
        ? `已刷新 ${fmtTime(lu.updatedAt)}`
        : '实时直读';

    const bodyHtml = lu
      ? `
        <div class="agy-q-grid">
          <div class="agy-q-box">
            <div class="agy-q-box-label">本会话累计</div>
            <div class="agy-q-box-val">${fmtTokens(lu.sessionTotal)}</div>
            <div class="agy-q-sub">${lu.sessionTurns || 0} 轮 · 缓存 ${lu.cacheHitRate || 0}%</div>
          </div>
          <div class="agy-q-box">
            <div class="agy-q-box-label">近 5 小时 / 今日</div>
            <div class="agy-q-box-val">${fmtTokens(lu.fiveHourTotal)}</div>
            <div class="agy-q-sub">今日累计 ${fmtTokens(lu.todayTotal)}</div>
          </div>
        </div>
        ${
          lu.lastTurn
            ? `
              <div class="agy-q-row">
                <span>最近一轮</span>
                <span>入 ${fmtTokens(lu.lastTurn.input)} · 出 ${fmtTokens(lu.lastTurn.output)}</span>
              </div>
              <div class="agy-q-sub">模型：${escapeHtml(lu.lastTurn.model)}</div>
            `
            : `<div class="agy-q-sub">当前会话暂无已记录轮次</div>`
        }
      `
      : `<div class="agy-q-sub">${state.loading ? '正在自动刷新本地日志...' : '暂无本地 Token 消耗记录'}</div>`;

    pop.innerHTML = `
      <div class="agy-q-head">
        <span class="agy-q-title">本地 Token 用量</span>
        <button class="agy-q-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="agy-q-sec">
        <div class="agy-q-sec-head">
          <span>本地日志实时统计</span>
          <span>${escapeHtml(syncLabel)}</span>
        </div>
        ${bodyHtml}
      </div>
      <div class="agy-q-tip">发送 <code>/usage</code> 可在对话内展开完整分模型图表与明细</div>
    `;

    if (state.anchorEl && typeof state.anchorEl.getBoundingClientRect === 'function') {
      const ar = state.anchorEl.getBoundingClientRect();
      const pw = 316;
      const ph = pop.offsetHeight || 200;
      const left = Math.max(12, Math.min(window.innerWidth - pw - 12, ar.left));
      let top = ar.top - ph - 8;
      if (top < 12) top = Math.min(window.innerHeight - ph - 12, ar.bottom + 8);
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(Math.max(12, top)) + 'px';
    }

    const closeBtn = pop.querySelector('.agy-q-close');
    if (closeBtn) closeBtn.addEventListener('click', closePopover);
  }

  let mountTimer = null;
  function scheduleTick() {
    if (mountTimer) return;
    mountTimer = setTimeout(() => {
      mountTimer = null;
      mountWidgets();
    }, 180);
  }

  function init() {
    if (!document.body) return;
    mountWidgets();
    void fetchLocalUsageSummary();

    const obs = new MutationObserver(() => {
      scheduleTick();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', (e) => {
      if (!state.popoverOpen) return;
      const target = e.target;
      if (target && target.closest && target.closest('[data-agy-zh-quota-ui="1"]')) return;
      closePopover();
    });

    window.addEventListener('resize', scheduleTick);
    window.addEventListener('focus', () => {
      scheduleTick();
      void fetchLocalUsageSummary();
    });

    [400, 1200, 3000].forEach((ms) => setTimeout(scheduleTick, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
