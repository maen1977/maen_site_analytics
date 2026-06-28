(() => {
  'use strict';

  const VERSION = '20260628-worldcup-2026-ui-only-v1';
  const REFRESH_MS = 60 * 1000;
  const DATA_BASE = '/worldcup-2026/';
  const KNOCKOUT_NUMBERS = new Set(Array.from({ length: 32 }, (_, i) => i + 73));
  const TAB_LABEL = 'الأدوار';
  let currentData = null;
  let lastFetchBucket = '';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const text = (v) => (v === undefined || v === null) ? '' : String(v).replace(/\s+/g, ' ').trim();
  const westernDigits = (v) => text(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const nowBucket = () => String(Date.now() - (Date.now() % 30000));

  function get(obj, paths) {
    for (const p of paths) {
      let cur = obj;
      for (const part of p.split('.')) {
        if (cur == null || typeof cur !== 'object') { cur = undefined; break; }
        cur = cur[part];
      }
      if (cur !== undefined && cur !== null && text(cur) !== '') return cur;
    }
    return undefined;
  }

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function findWorldCupRoot() {
    const candidates = Array.from(document.querySelectorAll('section, article, main, div[id], div[class]'));
    const scored = candidates.map(el => {
      const t = text(el.textContent);
      let score = 0;
      if (t.includes('كأس العالم 2026') || t.includes('مونديال 2026')) score += 4;
      if (t.includes('اليوم') && t.includes('المجموعات') && t.includes('الأدوار')) score += 5;
      if (t.includes('يتحدث تلقائياً كل 15 دقيقة')) score += 2;
      if (!visible(el)) score -= 4;
      return { el, score, len: t.length };
    }).filter(x => x.score >= 6);
    scored.sort((a, b) => b.score - a.score || a.len - b.len);
    return scored[0]?.el || null;
  }

  function findTab(root, label = TAB_LABEL) {
    if (!root) return null;
    const nodes = Array.from(root.querySelectorAll('button, a, [role="tab"], [data-tab], [class*="tab"], span, div'));
    return nodes.find(el => text(el.textContent) === label || text(el.textContent).endsWith(` ${label}`)) ||
      nodes.find(el => text(el.textContent).includes(label));
  }

  function findTabBar(root) {
    if (!root) return null;
    const labels = ['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث', 'الأدوار'];
    const nodes = Array.from(root.querySelectorAll('nav, [role="tablist"], .tabs, .tabbar, .worldcup-tabs, div, section'));
    const hits = nodes.map(el => ({ el, count: labels.filter(x => text(el.textContent).includes(x)).length, len: text(el.textContent).length }))
      .filter(x => x.count >= 5);
    hits.sort((a, b) => a.len - b.len);
    return hits[0]?.el || findTab(root)?.parentElement || null;
  }

  function ensurePanel(root) {
    let panel = root.querySelector('#maen-wc-2026-knockout-ui-only');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'maen-wc-2026-knockout-ui-only';
    panel.setAttribute('dir', 'rtl');
    panel.className = 'maen-wc-2026-knockout-ui-only';
    const tabbar = findTabBar(root);
    if (tabbar?.parentNode) tabbar.insertAdjacentElement('afterend', panel);
    else root.appendChild(panel);
    return panel;
  }

  function setOriginalVisible(root, shouldShow) {
    const panel = root?.querySelector('#maen-wc-2026-knockout-ui-only');
    const tabbar = findTabBar(root);
    if (!root || !panel || !tabbar) return;
    const candidates = [];
    let node = panel.nextElementSibling;
    let guard = 0;
    while (node && guard++ < 6) {
      const t = text(node.textContent);
      if (node.id !== panel.id && (
        t.includes('جاري تحميل بيانات كأس العالم') ||
        t.includes('دور 32') || t.includes('دور الـ32') || t.includes('دور 16') ||
        /\b[WL]\d{2,3}\b/.test(t) || /\b[123][A-L](?:\/[A-L])*\b/.test(t) ||
        (t.includes('×') && (t.includes('دور') || t.includes('نهائي') || t.includes('حزيران') || t.includes('تموز')))
      )) candidates.push(node);
      node = node.nextElementSibling;
    }
    for (const el of candidates) {
      if (shouldShow) {
        el.style.display = el.dataset.maenWcOldDisplay || '';
        delete el.dataset.maenWcOldDisplay;
      } else {
        if (!('maenWcOldDisplay' in el.dataset)) el.dataset.maenWcOldDisplay = el.style.display || '';
        el.style.display = 'none';
      }
    }
  }

  async function fetchJson(name) {
    try {
      const res = await fetch(`${DATA_BASE}${name}?v=${encodeURIComponent(nowBucket())}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function looksLikeMatch(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const n = matchNumber(o);
    const stage = text(get(o, ['stage', 'round', 'phase', 'stage_ar', 'round_ar', '__hintRound']));
    const hasTeams = get(o, ['team1', 'home', 'home_team', 'teamA', 'teams.home']) || get(o, ['team2', 'away', 'away_team', 'teamB', 'teams.away']);
    return KNOCKOUT_NUMBERS.has(n) || /دور|نهائي|Round|Final|Semi|Quarter/i.test(stage) || Boolean(hasTeams && n >= 73);
  }

  function collectMatches(json) {
    const out = [];
    const seen = new Set();
    function visit(value, hint = '') {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach(v => visit(v, hint)); return; }
      if (typeof value !== 'object') return;
      if (looksLikeMatch(value)) {
        const m = { ...value, __hintRound: hint || value.__hintRound || '' };
        const n = matchNumber(m);
        const key = n ? `M${n}` : JSON.stringify([m.id, m.match_id, m.code, m.team1, m.team2]).slice(0, 200);
        if (!seen.has(key)) { seen.add(key); out.push(m); }
        return;
      }
      for (const [k, v] of Object.entries(value)) {
        const h = /round|stage|دور|final|quarter|semi|bracket|knockout/i.test(k) ? k : hint;
        visit(v, h);
      }
    }
    visit(json);
    return out.filter(m => KNOCKOUT_NUMBERS.has(matchNumber(m))).sort((a, b) => matchNumber(a) - matchNumber(b));
  }

  function matchNumber(m) {
    const direct = Number(westernDigits(get(m, ['number', 'match_number', 'matchNumber', 'matchNo']) || '').match(/\d+/)?.[0] || '');
    if (direct) return direct;
    const id = westernDigits(text(get(m, ['id', 'match_id', 'matchId', 'code', 'key', 'name'])));
    const found = id.match(/(?:^|\D)(\d{2,3})(?:\D|$)/);
    return found ? Number(found[1]) : 0;
  }

  function stageInfo(n, fallback = '') {
    const f = text(fallback);
    if (/32|٣٢|دور\s*الـ?32/i.test(f) || (n >= 73 && n <= 88)) return { key: 'r32', title: 'دور الـ32', order: 1 };
    if (/16|١٦|ثمن|دور\s*الـ?16/i.test(f) || (n >= 89 && n <= 96)) return { key: 'r16', title: 'دور الـ16', order: 2 };
    if (/ربع|quarter/i.test(f) || (n >= 97 && n <= 100)) return { key: 'qf', title: 'ربع النهائي', order: 3 };
    if (/نصف|semi/i.test(f) || (n >= 101 && n <= 102)) return { key: 'sf', title: 'نصف النهائي', order: 4 };
    if (/ثالث|third/i.test(f) || n === 103) return { key: 'third', title: 'مباراة المركز الثالث', order: 5 };
    if (/نهائي|final/i.test(f) || n === 104) return { key: 'final', title: 'النهائي', order: 6 };
    return { key: 'ko', title: 'الأدوار الإقصائية', order: 9 };
  }

  function normalizeSlot(v) {
    let s = westernDigits(v);
    if (!s) return '';
    s = s.replace(/^نادي\s+المجموعة\s*/i, '').replace(/^المجموعة\s*/i, '').trim();
    s = s.replace(/^متصدر\s+المجموعة\s+([A-L])$/i, '1$1');
    s = s.replace(/^وصيف\s+المجموعة\s+([A-L])$/i, '2$1');
    s = s.replace(/^أفضل\s+ثالث\s+(?:من\s+)?/i, '3');
    s = s.replace(/^الفائز\s+من\s+مباراة\s+(\d{2,3})$/i, 'W$1');
    s = s.replace(/^الخاسر\s+من\s+مباراة\s+(\d{2,3})$/i, 'L$1');
    const w = s.match(/^(?:W|Winner\s*)(\d{2,3})$/i); if (w) return `W${w[1]}`;
    const l = s.match(/^(?:L|Loser\s*)(\d{2,3})$/i); if (l) return `L${l[1]}`;
    const d = s.match(/^([12])\s*([A-L])$/i); if (d) return `${d[1]}${d[2].toUpperCase()}`;
    const t = s.match(/^3\s*([A-L](?:\s*[\/،,]\s*[A-L])*)$/i); if (t) return `3${t[1].replace(/[\s،,]+/g, '/').replace(/\/+/g, '/').toUpperCase()}`;
    return s;
  }

  function isSlotLike(s) {
    const x = normalizeSlot(s);
    return /^[12][A-L]$/.test(x) || /^3[A-L](?:\/[A-L])*$/.test(x) || /^[WL]\d{2,3}$/.test(x);
  }

  function rawTeam(raw, side) {
    const team = { name_ar: '', name_en: '', slot: '', group: '', unresolved: false };
    if (raw == null) return team;
    if (typeof raw === 'string' || typeof raw === 'number') {
      const s = text(raw);
      if (isSlotLike(s)) team.slot = normalizeSlot(s);
      else { team.name_ar = s; team.name_en = s; }
      return team;
    }
    if (typeof raw !== 'object') return team;
    team.name_ar = text(get(raw, ['name_ar', 'team_ar', 'arabic', 'ar', 'display_ar', 'country_ar', 'label_ar', 'short_ar']));
    team.name_en = text(get(raw, ['name_en', 'team_en', 'english', 'en', 'name', 'team', 'country', 'label', 'short_name', 'code']));
    team.group = text(get(raw, ['group', 'group_letter', 'groupLetter'])).replace(/^Group\s*/i, '').toUpperCase();
    team.slot = normalizeSlot(get(raw, ['slot', 'seed', 'placeholder', 'qualification_slot', 'qualifier', 'source_slot', 'code']) || '');
    if (!team.slot && isSlotLike(team.name_ar || team.name_en)) {
      team.slot = normalizeSlot(team.name_ar || team.name_en); team.name_ar = ''; team.name_en = '';
    }
    return team;
  }

  function extractTeam(m, side) {
    const paths = side === 1
      ? ['team1', 'team_1', 'home', 'home_team', 'homeTeam', 'teamA', 'team_a', 'teams.home', 'competitors.0', 'participants.0']
      : ['team2', 'team_2', 'away', 'away_team', 'awayTeam', 'teamB', 'team_b', 'teams.away', 'competitors.1', 'participants.1'];
    const slotPaths = side === 1
      ? ['team1_slot', 'team_1_slot', 'home_slot', 'home_seed', 'slot1', 'seed1', 'team1Seed', 'team1_placeholder']
      : ['team2_slot', 'team_2_slot', 'away_slot', 'away_seed', 'slot2', 'seed2', 'team2Seed', 'team2_placeholder'];
    const team = rawTeam(get(m, paths), side);
    const slot = normalizeSlot(get(m, slotPaths) || '');
    if (slot) team.slot = slot;
    return team;
  }

  function teamName(t) {
    return text(t?.name_ar || t?.team_ar || t?.arabic || t?.country_ar || t?.name || t?.name_en || t?.team || t?.country || '');
  }

  function extractStandings(data) {
    const out = [];
    function add(raw, groupHint = '', index = 0) {
      if (!raw || typeof raw !== 'object') return;
      const t = rawTeam(raw, 'standing');
      t.name_ar = t.name_ar || text(get(raw, ['team.name_ar', 'team.name', 'country_ar', 'country']));
      t.name_en = t.name_en || text(get(raw, ['team.name_en', 'team.english', 'team.code', 'country']));
      t.group = (t.group || text(raw.group || raw.group_letter || raw.groupLetter || groupHint)).replace(/^Group\s*/i, '').toUpperCase();
      t.position = Number(raw.position || raw.rank || raw.place || raw.pos || raw.order || index + 1 || 0);
      t.points = Number(raw.points ?? raw.pts ?? 0);
      t.gd = Number(raw.goal_difference ?? raw.gd ?? raw.diff ?? 0);
      t.gf = Number(raw.goals_for ?? raw.gf ?? 0);
      if (/^[A-L]$/.test(t.group) && teamName(t)) out.push(t);
    }
    function visit(value, groupHint = '') {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach((v, i) => (v && typeof v === 'object' && (teamName(v) || v.team) ? add(v, groupHint, i) : visit(v, groupHint))); return; }
      if (typeof value !== 'object') return;
      const groupHere = text(value.group || value.group_letter || value.groupLetter || groupHint).replace(/^Group\s*/i, '').toUpperCase();
      const arr = get(value, ['teams', 'standings', 'table', 'rows', 'ranking']);
      if (Array.isArray(arr)) { arr.forEach((v, i) => add(v, groupHere, i)); return; }
      for (const [k, v] of Object.entries(value)) {
        let g = groupHere;
        if (/^[A-L]$/i.test(k)) g = k.toUpperCase();
        if (/^group\s*[A-L]$/i.test(k)) g = k.replace(/^group\s*/i, '').toUpperCase();
        visit(v, g);
      }
    }
    visit(data);
    const map = new Map();
    for (const t of out) {
      const key = `${t.group}:${teamName(t)}`;
      if (!map.has(key) || (t.position && !map.get(key).position)) map.set(key, t);
    }
    return [...map.values()].sort((a, b) => a.group.localeCompare(b.group) || a.position - b.position);
  }

  function thirdRank(standings) {
    return standings.filter(t => Number(t.position) === 3)
      .sort((a, b) => (Number(b.points) - Number(a.points)) || (Number(b.gd) - Number(a.gd)) || (Number(b.gf) - Number(a.gf)) || a.group.localeCompare(b.group));
  }

  function resolveSlot(slot, ctx) {
    const s = normalizeSlot(slot);
    if (!s) return null;
    const direct = s.match(/^([12])([A-L])$/);
    if (direct) {
      const team = ctx.standings.find(t => t.group === direct[2] && Number(t.position) === Number(direct[1]));
      return team ? { ...team, slot: s } : { slot: s, unresolved: true, label: slotLabel(s) };
    }
    const third = s.match(/^3([A-L](?:\/[A-L])*)$/);
    if (third) {
      const groups = third[1].split('/');
      const candidates = ctx.thirds.filter(t => groups.includes(t.group) && !ctx.usedThirds.has(t.group));
      const pick = candidates[0] || ctx.thirds.find(t => groups.includes(t.group));
      if (pick) { ctx.usedThirds.add(pick.group); return { ...pick, slot: s }; }
      return { slot: s, unresolved: true, label: slotLabel(s) };
    }
    return { slot: s, unresolved: true, label: slotLabel(s) };
  }

  function slotLabel(slot) {
    const s = normalizeSlot(slot);
    const w = s.match(/^W(\d+)$/); if (w) return `الفائز من مباراة ${w[1]}`;
    const l = s.match(/^L(\d+)$/); if (l) return `الخاسر من مباراة ${l[1]}`;
    const d = s.match(/^([12])([A-L])$/); if (d) return `${d[1] === '1' ? 'متصدر' : 'وصيف'} المجموعة ${d[2]}`;
    const t = s.match(/^3(.+)$/); if (t) return `أفضل ثالث من ${t[1].replace(/\//g, ' أو ')}`;
    return s || 'لم يتحدد بعد';
  }

  function enrichMatch(m, ctx) {
    const n = matchNumber(m);
    const stage = stageInfo(n, get(m, ['stage_ar', 'round_ar', 'stage', 'round', '__hintRound']) || '');
    let t1 = extractTeam(m, 1);
    let t2 = extractTeam(m, 2);
    if (!teamName(t1) && t1.slot) t1 = resolveSlot(t1.slot, ctx) || t1;
    if (!teamName(t2) && t2.slot) t2 = resolveSlot(t2.slot, ctx) || t2;
    const scores = getScores(m);
    const status = statusInfo(m, scores);
    return {
      number: n,
      stage,
      team1: normalizeTeamForDisplay(t1),
      team2: normalizeTeamForDisplay(t2),
      scores,
      status,
      date: text(get(m, ['date_ar', 'date', 'local_date', 'kickoff_date', 'day_ar'])),
      time: text(get(m, ['time_ar', 'time', 'local_time', 'kickoff_time'])),
      venue: text(get(m, ['venue_ar', 'stadium_ar', 'venue', 'stadium', 'location'])),
      channels: extractChannels(m)
    };
  }

  function normalizeTeamForDisplay(t) {
    const name = teamName(t);
    if (name) return { name, group: t.group || '', slot: t.slot || '', pending: false };
    return { name: t?.label || slotLabel(t?.slot), group: '', slot: t?.slot || '', pending: true };
  }

  function scoreNumber(v) {
    const raw = westernDigits(v);
    if (raw === '') return null;
    const m = raw.match(/-?\d+/);
    return m ? Number(m[0]) : null;
  }

  function getScores(m) {
    const s1 = scoreNumber(get(m, ['score1', 'team1_score', 'home_score', 'homeScore', 'score.home', 'score.ft.home', 'result.home', 'goals_home', 'goals.team1']));
    const s2 = scoreNumber(get(m, ['score2', 'team2_score', 'away_score', 'awayScore', 'score.away', 'score.ft.away', 'result.away', 'goals_away', 'goals.team2']));
    const p1 = scoreNumber(get(m, ['penalty1', 'penalties1', 'home_penalties', 'penalties.home', 'score.penalties.home']));
    const p2 = scoreNumber(get(m, ['penalty2', 'penalties2', 'away_penalties', 'penalties.away', 'score.penalties.away']));
    return { s1, s2, p1, p2 };
  }

  function statusInfo(m, scores) {
    const raw = text(get(m, ['status_ar', 'status', 'state', 'match_status', 'period']));
    const low = raw.toLowerCase();
    if (/live|playing|in[_\s-]?play|مباشر|الشوط|استراحة/.test(low)) return { key: 'live', label: 'مباشر' };
    if (/finished|ended|complete|full[_\s-]?time|ft|انته/.test(low)) return { key: 'finished', label: 'انتهت' };
    if (scores.s1 !== null && scores.s2 !== null && /final|انته|ft/i.test(raw)) return { key: 'finished', label: 'انتهت' };
    return { key: 'scheduled', label: text(raw) && raw.length < 20 ? raw : 'لم تبدأ' };
  }

  function extractChannels(m) {
    const raw = get(m, ['channels', 'tv_channels', 'broadcast', 'broadcasters']);
    if (Array.isArray(raw)) return raw.map(x => text(x.name_ar || x.name || x)).filter(Boolean).slice(0, 4);
    if (text(raw)) return [text(raw)];
    return [];
  }

  async function loadAll(force = false) {
    const bucket = nowBucket();
    if (!force && currentData && lastFetchBucket === bucket) return currentData;
    lastFetchBucket = bucket;
    const [matchesJson, bracketJson, standingsJson, groupsJson, knockoutJson] = await Promise.all([
      fetchJson('matches.json'), fetchJson('bracket.json'), fetchJson('standings.json'), fetchJson('groups.json'), fetchJson('knockout-live.json')
    ]);
    const standings = extractStandings(standingsJson || groupsJson || {});
    const ctx = { standings, thirds: thirdRank(standings), usedThirds: new Set() };
    const rawMatches = collectMatches(knockoutJson).length ? collectMatches(knockoutJson) : (collectMatches(matchesJson).length ? collectMatches(matchesJson) : collectMatches(bracketJson));
    const matches = rawMatches.map(m => enrichMatch(m, ctx)).sort((a, b) => a.number - b.number);
    currentData = { matches, updated: getUpdated(matchesJson, bracketJson, knockoutJson, standingsJson) };
    return currentData;
  }

  function getUpdated(...items) {
    for (const item of items) {
      const v = text(get(item || {}, ['last_updated_at', 'last_updated', 'updated_at', 'generated_at', 'timestamp']));
      if (v) return v;
    }
    return 'يتحدث تلقائياً كل 15 دقيقة';
  }

  function scoreHtml(match) {
    const { s1, s2, p1, p2 } = match.scores;
    if (s1 === null || s2 === null) return `<div class="maen-wc-score empty">${esc(match.status.label || 'لم تبدأ')}</div>`;
    const pens = (p1 !== null && p2 !== null) ? `<small>ركلات ${esc(p1)} - ${esc(p2)}</small>` : '';
    return `<div class="maen-wc-score"><b>${esc(s1)}</b><span>-</span><b>${esc(s2)}</b>${pens}</div>`;
  }

  function teamHtml(team, side) {
    return `<div class="maen-wc-team ${team.pending ? 'pending' : ''} side-${side}"><strong>${esc(team.name || 'لم يتحدد بعد')}</strong>${team.group ? `<small>المجموعة ${esc(team.group)}</small>` : ''}</div>`;
  }

  function cardHtml(match) {
    const meta = [match.date, match.time].filter(Boolean).join('، ') || 'الموعد حسب الجدول';
    const channels = match.channels.length ? `<div class="maen-wc-channels">${match.channels.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : '';
    return `<article class="maen-wc-match-card status-${esc(match.status.key)}">
      <div class="maen-wc-card-top"><span>${esc(match.stage.title)}</span><b>مباراة ${esc(match.number)}</b><em>${esc(match.status.label)}</em></div>
      <div class="maen-wc-card-main">${teamHtml(match.team1, 'one')}${scoreHtml(match)}${teamHtml(match.team2, 'two')}</div>
      <div class="maen-wc-card-meta"><span>${esc(meta)}</span>${match.venue ? `<span>${esc(match.venue)}</span>` : ''}</div>
      ${channels}
    </article>`;
  }

  function render(data) {
    const root = findWorldCupRoot();
    if (!root) return;
    const panel = ensurePanel(root);
    const byRound = new Map();
    for (const m of data.matches) {
      const key = `${m.stage.order}:${m.stage.key}:${m.stage.title}`;
      if (!byRound.has(key)) byRound.set(key, []);
      byRound.get(key).push(m);
    }
    const rounds = [...byRound.entries()].sort((a, b) => Number(a[0].split(':')[0]) - Number(b[0].split(':')[0]));
    panel.innerHTML = `<style>${css()}</style>
      <div class="maen-wc-head"><div><strong>الأدوار الإقصائية</strong><span>بنفس نظام كروت مباريات كأس العالم</span></div><small>آخر تحديث: ${esc(data.updated)}</small></div>
      ${rounds.length ? rounds.map(([key, matches]) => `<section class="maen-wc-round"><h3>${esc(key.split(':').slice(2).join(':'))}</h3><div class="maen-wc-grid">${matches.map(cardHtml).join('')}</div></section>`).join('') : '<div class="maen-wc-empty">لا توجد بيانات أدوار الآن.</div>'}`;
    panel.style.display = 'block';
    setOriginalVisible(root, false);
  }

  async function activate(clickTab = false) {
    const root = findWorldCupRoot();
    if (!root) return;
    if (clickTab) {
      const tab = findTab(root, TAB_LABEL);
      if (tab && !tab.dataset.maenWcClicking) {
        tab.dataset.maenWcClicking = '1';
        try { tab.click(); } catch {}
        setTimeout(() => delete tab.dataset.maenWcClicking, 700);
      }
    }
    const panel = ensurePanel(root);
    panel.style.display = 'block';
    panel.innerHTML = `<style>${css()}</style><div class="maen-wc-empty">جاري تحميل الأدوار...</div>`;
    try {
      const data = await loadAll(true);
      render(data);
    } catch (e) {
      panel.innerHTML = `<style>${css()}</style><div class="maen-wc-empty error">تعذر تحميل الأدوار الآن، وسيعاد التحديث تلقائياً.</div>`;
      console.warn('[MaenSat WorldCup 2026 UI only]', e);
    }
  }

  function deactivate() {
    const root = findWorldCupRoot();
    const panel = root?.querySelector('#maen-wc-2026-knockout-ui-only');
    if (panel) panel.style.display = 'none';
    if (root) setOriginalVisible(root, true);
  }

  function wire() {
    document.addEventListener('click', ev => {
      const t = text(ev.target?.textContent || '');
      if (t.includes(TAB_LABEL)) setTimeout(() => activate(false), 80);
      else if (['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث'].some(x => t === x || t.endsWith(` ${x}`))) deactivate();
      else if (t.includes('كأس العالم 2026') || t.includes('مونديال 2026')) setTimeout(() => activate(true), 350);
    }, true);

    const maybeOpen = () => {
      const root = findWorldCupRoot();
      if (!root || root.dataset.maenWcKoDefaultDone) return;
      const h = decodeURIComponent(location.hash || '');
      if (h.includes('worldcup') || text(root.textContent).includes('الأدوار')) {
        root.dataset.maenWcKoDefaultDone = '1';
        setTimeout(() => activate(true), 250);
      }
    };
    const observer = new MutationObserver(maybeOpen);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    setTimeout(maybeOpen, 700);
    setInterval(() => {
      const root = findWorldCupRoot();
      const panel = root?.querySelector('#maen-wc-2026-knockout-ui-only');
      if (panel && panel.style.display !== 'none') activate(false);
    }, REFRESH_MS);
    window.MaenSatWorldCup2026KnockoutUiOnly = { version: VERSION, refresh: () => activate(false) };
  }

  function css() {
    return `
      #maen-wc-2026-knockout-ui-only{direction:rtl;margin:18px 0 24px;font-family:inherit}
      #maen-wc-2026-knockout-ui-only .maen-wc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 14px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.86);box-shadow:0 8px 22px rgba(0,0,0,.07);border:1px solid rgba(0,0,0,.08)}
      #maen-wc-2026-knockout-ui-only .maen-wc-head strong{display:block;font-size:1.08rem}#maen-wc-2026-knockout-ui-only .maen-wc-head span{display:block;opacity:.72;margin-top:4px;font-size:.9rem}#maen-wc-2026-knockout-ui-only .maen-wc-head small{opacity:.72;white-space:nowrap}
      #maen-wc-2026-knockout-ui-only .maen-wc-round{margin:16px 0 22px}#maen-wc-2026-knockout-ui-only .maen-wc-round h3{margin:0 0 10px;font-size:1.12rem}
      #maen-wc-2026-knockout-ui-only .maen-wc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}
      #maen-wc-2026-knockout-ui-only .maen-wc-match-card{background:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(0,0,0,.09);box-shadow:0 10px 24px rgba(0,0,0,.07)}
      #maen-wc-2026-knockout-ui-only .maen-wc-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:linear-gradient(90deg,rgba(14,27,67,.08),rgba(217,173,48,.08));font-size:.85rem}#maen-wc-2026-knockout-ui-only .maen-wc-card-top span{font-weight:800}#maen-wc-2026-knockout-ui-only .maen-wc-card-top em{font-style:normal;border-radius:99px;padding:4px 9px;background:rgba(0,0,0,.06)}#maen-wc-2026-knockout-ui-only .status-live .maen-wc-card-top em{background:#fff0f0;color:#b00020;font-weight:800}
      #maen-wc-2026-knockout-ui-only .maen-wc-card-main{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:16px 12px}#maen-wc-2026-knockout-ui-only .maen-wc-team{text-align:center;min-width:0}#maen-wc-2026-knockout-ui-only .maen-wc-team strong{display:block;font-size:1rem;line-height:1.35;word-break:break-word}#maen-wc-2026-knockout-ui-only .maen-wc-team small{display:inline-block;margin-top:5px;opacity:.65;font-size:.75rem}#maen-wc-2026-knockout-ui-only .maen-wc-team.pending strong{opacity:.72;font-weight:600}
      #maen-wc-2026-knockout-ui-only .maen-wc-score{min-width:66px;text-align:center;font-size:1.04rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}#maen-wc-2026-knockout-ui-only .maen-wc-score small{flex-basis:100%;font-size:.68rem;font-weight:500;opacity:.72}#maen-wc-2026-knockout-ui-only .maen-wc-score.empty{font-size:.82rem;opacity:.72;font-weight:800}
      #maen-wc-2026-knockout-ui-only .maen-wc-card-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid rgba(0,0,0,.07);font-size:.82rem;opacity:.76}#maen-wc-2026-knockout-ui-only .maen-wc-channels{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 12px}#maen-wc-2026-knockout-ui-only .maen-wc-channels span{font-size:.75rem;border-radius:999px;background:rgba(0,0,0,.05);padding:4px 8px}
      #maen-wc-2026-knockout-ui-only .maen-wc-empty{background:#fff;border:1px dashed rgba(0,0,0,.18);border-radius:16px;padding:18px;text-align:center}.maen-wc-empty.error{color:#a10000}
      @media(max-width:620px){#maen-wc-2026-knockout-ui-only .maen-wc-head{display:block}#maen-wc-2026-knockout-ui-only .maen-wc-head small{display:block;margin-top:8px;white-space:normal}#maen-wc-2026-knockout-ui-only .maen-wc-card-main{grid-template-columns:1fr;gap:8px}#maen-wc-2026-knockout-ui-only .maen-wc-score{order:2}.maen-wc-team.side-one{order:1}.maen-wc-team.side-two{order:3}}
    `;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
