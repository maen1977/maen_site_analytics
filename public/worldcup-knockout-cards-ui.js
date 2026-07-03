(() => {
  'use strict';

  const VERSION = '20260703-live-status-label-guard-v1';
  const DATA_URL = '/worldcup-2026/knockout-live.json';
  const REFRESH_MS = 60 * 1000;
  const TAB_TEXT = 'الأدوار';
  const LIVE_EARLY_MS = 5 * 60 * 1000;
  const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

  let cache = null;
  let lastRenderKey = '';

  const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[c]));

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  function findWorldCupRoot() {
    const candidates = Array.from(document.querySelectorAll('section, article, main, div[id], div[class]'));
    const filtered = candidates.filter(el => {
      const t = norm(el.textContent || '');
      return t.includes('كأس العالم 2026') && t.includes('الأدوار') && t.includes('المجموعات');
    });
    filtered.sort((a, b) => (norm(a.textContent).length - norm(b.textContent).length));
    return filtered[0] || null;
  }

  function findTabButton(root, label = TAB_TEXT) {
    if (!root) return null;
    const nodes = Array.from(root.querySelectorAll('button, a, [role="tab"], [data-tab], [class*="tab"], span, div'));
    return nodes.find(el => norm(el.textContent) === label || norm(el.textContent).endsWith(` ${label}`) || norm(el.textContent).includes(label)) || null;
  }

  function findTabBar(root) {
    const labels = ['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث', 'الأدوار'];
    const nodes = Array.from(root.querySelectorAll('nav, .tabs, .tabbar, .worldcup-tabs, div, section'));
    const withLabels = nodes.filter(el => labels.filter(x => norm(el.textContent).includes(x)).length >= 4);
    withLabels.sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);
    return withLabels[0] || findTabButton(root)?.parentElement || root;
  }

  function isVisible(el) {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function isWorldCupActive(root) {
    if (!root) return false;
    if (isVisible(root)) return true;
    const h = decodeURIComponent(location.hash || '').toLowerCase();
    return h.includes('world') || h.includes('cup') || h.includes('كأس');
  }

  function ensurePanel(root) {
    if (!root) return null;
    let panel = root.querySelector('#wc-knockout-live-cards-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'wc-knockout-live-cards-panel';
    panel.className = 'wc-knockout-live-cards-panel';
    panel.setAttribute('dir', 'rtl');
    const tabbar = findTabBar(root);
    if (tabbar && tabbar.parentNode) tabbar.insertAdjacentElement('afterend', panel);
    else root.appendChild(panel);
    return panel;
  }

  function maybeHideOriginal(root, show) {
    const panel = root?.querySelector('#wc-knockout-live-cards-panel');
    if (!root || !panel) return;
    const tabbar = findTabBar(root);
    let sib = tabbar?.nextElementSibling || null;
    let guard = 0;
    while (sib && guard++ < 5) {
      if (sib === panel) {
        sib = sib.nextElementSibling;
        continue;
      }
      const t = norm(sib.textContent || '');
      if (t.includes('جاري تحميل بيانات كأس العالم') || t.includes('1A') || t.includes('2B') || t.includes('3B/E') || t.includes('W73') || t.includes('الفائز من مباراة')) {
        if (!sib.dataset.wcOldDisplay) sib.dataset.wcOldDisplay = sib.style.display || '';
        sib.style.display = show ? 'none' : sib.dataset.wcOldDisplay;
        break;
      }
      sib = sib.nextElementSibling;
    }
  }

  function slotLabel(slot) {
    const s = String(slot || '').trim();
    const w = s.match(/^W(\d+)$/);
    if (w) return `الفائز من مباراة ${w[1]}`;
    const l = s.match(/^L(\d+)$/);
    if (l) return `الخاسر من مباراة ${l[1]}`;
    const d = s.match(/^([12])([A-L])$/);
    if (d) return `${d[1] === '1' ? 'متصدر' : 'وصيف'} المجموعة ${d[2]}`;
    const t = s.match(/^3(.+)$/);
    if (t) return `أفضل ثالث من ${t[1].replace(/\//g, ' أو ')}`;
    return s || 'لم يتحدد بعد';
  }

  function cardTeam(team) {
    const name = team?.name_ar || team?.name || team?.name_en || (team?.slot ? slotLabel(team.slot) : 'لم يتحدد بعد');
    const cls = team?.unresolved ? ' wc-team-pending' : '';
    const group = team?.group ? `<span class="wc-team-group">المجموعة ${esc(team.group)}</span>` : '';
    return `<div class="wc-team${cls}"><strong>${esc(name)}</strong>${group}</div>`;
  }

  function statusText(m) {
    return [m?.status?.key, m?.status?.state, m?.status?.label_ar, m?.status?.label, m?.status, m?.phase]
      .map(v => String(v || '').toLowerCase()).join(' ');
  }

  function matchStatusKey(m) {
    return String(m?.status?.key || m?.status?.state || m?.status || '').toLowerCase();
  }

  function parseKickoffMs(m) {
    const candidates = [
      ['kickoff_utc', m?.kickoff_utc],
      ['kickoffUtc', m?.kickoffUtc],
      ['kickoff_jordan', m?.kickoff_jordan],
      ['kickoffJordan', m?.kickoffJordan],
      ['kickoff_iso', m?.kickoff_iso],
      ['kickoffIso', m?.kickoffIso],
      ['kickoff', m?.kickoff],
      ['datetime', m?.datetime],
      ['dateTime', m?.dateTime],
      ['start_time', m?.start_time],
      ['startTime', m?.startTime]
    ];

    for (const [name, raw] of candidates) {
      if (!raw) continue;
      let value = String(raw).trim();
      if (!value) continue;

      const looksIsoDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);
      const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);

      if (looksIsoDateTime && !hasZone) {
        if (/utc/i.test(name)) value = value.replace(' ', 'T') + 'Z';
        else value = value.replace(' ', 'T') + '+03:00';
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  function readScorePair(m) {
    let s1 = numberOrNull(m.score1 ?? m.team1_score ?? m.team1Score ?? m.home_score ?? m.homeScore);
    let s2 = numberOrNull(m.score2 ?? m.team2_score ?? m.team2Score ?? m.away_score ?? m.awayScore);
    if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];

    const textScore = String(m.score_text || m.scoreText || m.display_score || m.displayScore || m.result || m.score || '');
    const cleaned = textScore
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const pair = cleaned.match(/(\d+)\s*[-–—:]\s*(\d+)/);
    if (pair) return [Number(pair[1]), Number(pair[2])];
    return null;
  }

  function isFinishedMatch(m) {
    const text = statusText(m);
    return /\b(final|finished|complete|completed|full\s*time|post|closed)\b|انته|نهائي|بعد التمديد|ركلات الترجيح/.test(text);
  }

  function isExplicitLiveMatch(m) {
    const text = statusText(m);
    return /\b(live|in[-\s]?progress|progress|halftime|half[-\s]?time|extra|penalty|period)\b|مباشر|الشوط|استراحة|ركلات|ترجيح/.test(text) && !isFinishedMatch(m);
  }

  function isKickoffLiveWindow(m) {
    if (isFinishedMatch(m)) return false;
    const kickoffMs = parseKickoffMs(m);
    if (!Number.isFinite(kickoffMs)) return false;
    const now = Date.now();
    return now >= kickoffMs - LIVE_EARLY_MS && now <= kickoffMs + LIVE_WINDOW_MS;
  }

  function hasStartedScore(m) {
    return !!readScorePair(m) && !isFinishedMatch(m);
  }

  function isLiveMatch(m) {
    return isExplicitLiveMatch(m) || isKickoffLiveWindow(m) || hasStartedScore(m);
  }

  function displayStatusLabel(m) {
    if (isFinishedMatch(m)) return m?.status?.label_ar || m?.status?.label || 'انتهت';
    if (isLiveMatch(m)) return 'مباشر';
    return m?.status?.label_ar || m?.status?.label || 'لم تبدأ';
  }

  function scoreHtml(m) {
    const pair = readScorePair(m);
    const live = isLiveMatch(m);
    const score = pair || (live ? [0, 0] : null);
    const p1 = numberOrNull(m.penalty1 ?? m.penalties1 ?? m.team1_penalty ?? m.home_penalty);
    const p2 = numberOrNull(m.penalty2 ?? m.penalties2 ?? m.team2_penalty ?? m.away_penalty);
    const pen = Number.isFinite(p1) && Number.isFinite(p2) ? `<small>ركلات ${esc(p1)} - ${esc(p2)}</small>` : '';

    if (!score) {
      return `<div class="wc-score wc-score-empty" aria-label="لم تبدأ">—</div>`;
    }

    return `<div class="wc-score"><span>${esc(score[0])}-${esc(score[1])}</span>${pen}</div>`;
  }

  function statusClass(m) {
    if (isFinishedMatch(m)) return 'is-finished';
    if (isLiveMatch(m)) return 'is-live';
    const key = matchStatusKey(m) || 'scheduled';
    return key === 'finished' || key === 'final' || key === 'complete' ? 'is-finished' : 'is-scheduled';
  }

  function matchCard(m) {
    const when = [m.date, m.time].filter(Boolean).join(' • ') || (m.kickoff ? m.kickoff : 'الموعد حسب الجدول');
    const venue = [m.venue_ar, m.city_ar].filter(Boolean).join(' • ');
    const label = displayStatusLabel(m);

    return `<article class="wc-knockout-card ${statusClass(m)}" data-match-id="${esc(m.id || m.number || '')}" data-match-number="${esc(m.number || '')}">
      <div class="wc-card-top">
        <span class="wc-stage-pill">${esc(m.stage_ar || 'الأدوار')}</span>
        <span class="wc-match-no">مباراة ${esc(m.number || m.id || '')}</span>
        <span class="wc-status">${esc(label)}</span>
      </div>
      <div class="wc-card-body">
        <div class="wc-team-one">${cardTeam(m.team1)}</div>
        ${scoreHtml(m)}
        <div class="wc-team-two">${cardTeam(m.team2)}</div>
      </div>
      <div class="wc-card-meta">
        <span>${esc(when)}</span>
        ${venue ? `<span>${esc(venue)}</span>` : ''}
      </div>
    </article>`;
  }

  function renderData(data) {
    const root = findWorldCupRoot();
    if (!root) return;
    const panel = ensurePanel(root);
    if (!panel) return;

    const rounds = Array.isArray(data?.rounds) && data.rounds.length ? data.rounds : [];
    const body = rounds.map(round => `<section class="wc-round-block">
      <h3>${esc(round.title_ar || 'الأدوار')}</h3>
      <div class="wc-round-grid">${(round.matches || []).map(matchCard).join('')}</div>
    </section>`).join('');
    const updated = data?.last_updated_at || data?.updated_at || '—';

    panel.innerHTML = `<div class="wc-live-head">
      <div><strong>الأدوار الإقصائية</strong><span>عرض مباشر بنفس نظام كروت مباريات كأس العالم</span></div>
      <div class="wc-live-updated">آخر تحديث: ${esc(updated)}</div>
    </div>${body || '<div class="wc-empty">لا توجد بيانات أدوار متاحة حالياً.</div>'}`;
    panel.style.display = 'block';
    maybeHideOriginal(root, true);
  }

  async function loadData(force = false) {
    const key = `${Date.now() - (Date.now() % 30000)}`;
    if (!force && lastRenderKey === key && cache) return cache;
    const res = await fetch(`${DATA_URL}?v=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
    lastRenderKey = key;
    return cache;
  }

  async function activateKnockout({ clickTab = false } = {}) {
    const root = findWorldCupRoot();
    if (!root || !isWorldCupActive(root)) return;

    const tab = findTabButton(root, TAB_TEXT);
    if (clickTab && tab && !tab.dataset.wcAutoClicked) {
      tab.dataset.wcAutoClicked = '1';
      try { tab.click(); } catch {}
      setTimeout(() => { if (tab) delete tab.dataset.wcAutoClicked; }, 1000);
    }

    const panel = ensurePanel(root);
    if (panel) panel.innerHTML = '<div class="wc-empty">جاري تحميل الأدوار...</div>';

    try {
      const data = await loadData(true);
      renderData(data);
    } catch (err) {
      if (panel) panel.innerHTML = '<div class="wc-empty wc-error">تعذر تحميل بيانات الأدوار الآن. سيتم إعادة المحاولة تلقائياً.</div>';
      console.warn('[MaenSat] knockout live cards failed:', err);
    }
  }

  function deactivateIfOtherTab(e) {
    const root = findWorldCupRoot();
    const panel = root?.querySelector('#wc-knockout-live-cards-panel');
    if (!root || !panel) return;
    const targetText = norm(e?.target?.textContent || '');
    if (['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث'].some(x => targetText.includes(x))) {
      panel.style.display = 'none';
      maybeHideOriginal(root, false);
    }
    if (targetText.includes(TAB_TEXT)) setTimeout(() => activateKnockout({ clickTab: false }), 60);
  }

  function css() {
    return `#wc-knockout-live-cards-panel{margin:18px 0;direction:rtl;font-family:inherit}#wc-knockout-live-cards-panel .wc-live-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 14px;padding:12px 14px;border:1px solid rgba(0,0,0,.1);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 8px 20px rgba(0,0,0,.06)}#wc-knockout-live-cards-panel .wc-live-head strong{display:block;font-size:1.1rem}#wc-knockout-live-cards-panel .wc-live-head span{display:block;opacity:.75;font-size:.9rem;margin-top:3px}#wc-knockout-live-cards-panel .wc-live-updated{font-size:.88rem;opacity:.82;white-space:nowrap}#wc-knockout-live-cards-panel .wc-round-block{margin:16px 0 22px}#wc-knockout-live-cards-panel .wc-round-block h3{margin:0 0 10px;font-size:1.15rem}#wc-knockout-live-cards-panel .wc-round-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}#wc-knockout-live-cards-panel .wc-knockout-card{border:1px solid rgba(0,0,0,.10);border-radius:18px;background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.07);overflow:hidden}#wc-knockout-live-cards-panel .wc-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:linear-gradient(90deg,rgba(0,0,0,.04),rgba(0,0,0,.01));font-size:.86rem}#wc-knockout-live-cards-panel .wc-stage-pill{font-weight:700}#wc-knockout-live-cards-panel .wc-match-no{opacity:.72}#wc-knockout-live-cards-panel .wc-status{border-radius:99px;padding:3px 8px;background:rgba(0,0,0,.06);font-size:.78rem}#wc-knockout-live-cards-panel .is-live .wc-status{background:#fff0f0;color:#b00020;font-weight:700}#wc-knockout-live-cards-panel .wc-card-body{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:16px 12px}#wc-knockout-live-cards-panel .wc-team{min-width:0;text-align:center}#wc-knockout-live-cards-panel .wc-team strong{display:block;font-size:1rem;line-height:1.35;word-break:break-word}#wc-knockout-live-cards-panel .wc-team-pending strong{opacity:.72;font-weight:600}#wc-knockout-live-cards-panel .wc-team-group{display:inline-block;margin-top:5px;font-size:.76rem;opacity:.7}#wc-knockout-live-cards-panel .wc-score{min-width:62px;text-align:center;font-size:1.05rem;font-weight:800;display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}#wc-knockout-live-cards-panel .wc-score small{display:block;flex-basis:100%;font-size:.68rem;opacity:.72;font-weight:500}#wc-knockout-live-cards-panel .wc-score-empty{font-size:.82rem;font-weight:700;opacity:.75}#wc-knockout-live-cards-panel .wc-card-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid rgba(0,0,0,.08);font-size:.82rem;opacity:.78}#wc-knockout-live-cards-panel .wc-empty{padding:18px;border:1px dashed rgba(0,0,0,.18);border-radius:16px;background:#fff;text-align:center}#wc-knockout-live-cards-panel .wc-error{color:#a10000}@media(max-width:620px){#wc-knockout-live-cards-panel .wc-live-head{display:block}#wc-knockout-live-cards-panel .wc-live-updated{margin-top:8px;white-space:normal}#wc-knockout-live-cards-panel .wc-card-body{grid-template-columns:1fr;gap:8px}#wc-knockout-live-cards-panel .wc-score{order:2}.wc-team-one{order:1}.wc-team-two{order:3}}`;
  }

  function injectCss() {
    if (document.getElementById('wc-knockout-live-cards-style')) return;
    const style = document.createElement('style');
    style.id = 'wc-knockout-live-cards-style';
    style.textContent = css();
    document.head.appendChild(style);
  }

  function boot() {
    injectCss();
    document.addEventListener('click', deactivateIfOtherTab, true);
    document.addEventListener('click', (e) => {
      const t = norm(e.target?.textContent || '');
      if (t.includes('كأس العالم 2026') || t.includes('دخول القسم')) setTimeout(() => activateKnockout({ clickTab: true }), 350);
    }, true);

    const observer = new MutationObserver(() => {
      const root = findWorldCupRoot();
      if (root && isWorldCupActive(root) && !root.dataset.wcKnockoutDefaultOpened) {
        root.dataset.wcKnockoutDefaultOpened = '1';
        setTimeout(() => activateKnockout({ clickTab: true }), 200);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

    setTimeout(() => activateKnockout({ clickTab: true }), 700);
    setInterval(() => {
      const root = findWorldCupRoot();
      const panel = root?.querySelector('#wc-knockout-live-cards-panel');
      if (panel && panel.style.display !== 'none') activateKnockout({ clickTab: false });
    }, REFRESH_MS);

    window.MaenSatWorldCupKnockoutCards = { version: VERSION, refresh: () => activateKnockout({ clickTab: false }) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
