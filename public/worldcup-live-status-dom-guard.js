(() => {
  'use strict';

  const VERSION = '20260704-final-status-priority-v1';
  const DATA_URL = '/worldcup-2026/knockout-live.json';
  const REFRESH_MS = 30 * 1000;
  const LIVE_EARLY_MS = 5 * 60 * 1000;
  const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
  const LIVE_LABEL_AR = 'مباشر';
  const LIVE_LABEL_EN = 'Live';
  const STATUS_LABELS = new Set(['لم تبدأ', 'بانتظار التحديث', 'قريباً', 'قريبا', 'مباشر', 'Live', 'انتهت', 'انتهت بعد التمديد', 'انتهت بركلات الترجيح', 'Finished', 'Finished after extra time', 'Finished on penalties']);

  let liveMatches = [];
  let lastRunAt = 0;

  const norm = (value) => String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  };

  function part(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      const keys = ['key', 'state', 'status', 'name', 'label', 'label_ar', 'label_en', 'phase', 'phase_ar', 'detail', 'status_detail', 'short_detail', 'clock'];
      return keys.map((key) => part(value[key])).filter(Boolean).join(' ');
    }
    return String(value || '');
  }

  function statusTexts(match) {
    const score = match?.score || {};
    const status = match?.status;
    let core = '';
    let labels = '';
    if (status && typeof status === 'object') {
      core = [status.key, status.state, status.status, status.name, status.phase].map(part).join(' ');
      labels = [status.label, status.label_ar, status.label_en].map(part).join(' ');
    } else {
      core = part(status);
    }
    const runtime = [core, match?.live_phase, match?.phase, match?.live_status, match?.live_status_detail, score.status, score.phase, score.phase_ar, score.status_detail, score.clock, score.period].map(part).join(' ');
    const all = [core, labels, runtime, part(match?.result_status), part(match?.match_status)].join(' ');
    return { core: core.toLowerCase(), labels: labels.toLowerCase(), runtime: runtime.toLowerCase(), all: all.toLowerCase() };
  }

  function hasExplicitFinalStatus(match) {
    if (!match) return false;
    const text = statusTexts(match);
    const finalText = [text.core, text.runtime, part(match?.result_status), part(match?.match_status)].join(' ').toLowerCase();
    return /\b(finished|finished[_\s-]?on[_\s-]?penalties|finished[_\s-]?after[_\s-]?extra[_\s-]?time|completed|complete|full[_\s-]?time|final|ended|closed|ft|aet)\b|انته|نهائي/.test(finalText);
  }

  function isActuallyLive(match) {
    if (!match) return false;
    if (hasExplicitFinalStatus(match)) return false;
    if (match.is_live === true || match.live === true || match.in_play === true || match.started === true) return true;
    const text = statusTexts(match);
    const liveText = [text.core, text.runtime].join(' ');
    if (/\b(live|in[_\s-]?play|playing|started|first[_\s-]?half|second[_\s-]?half|half[_\s-]?time|halftime|extra[_\s-]?time|penalties|penalty[_\s-]?shootout|shootout|period)\b|مباشر|الشوط|استراحه|استراحة|وقت\s*إضاف|وقت\s*اضاف|ركلات\s*الترجيح|ترجيح/.test(liveText)) return true;
    if (/\b(live|in[_\s-]?play)\b|مباشر/.test(text.core)) return true;
    if (/\blive\b|مباشر/.test(text.labels) && !/finished|completed|complete|full[_\s-]?time|final|ended|انته|بركلات|بعد\s*التمديد/.test(text.labels)) return true;
    return false;
  }

  function isActuallyFinal(match) {
    return hasExplicitFinalStatus(match);
  }

  function parseKickoffMs(match) {
    const candidates = [
      ['kickoff_utc', match?.kickoff_utc], ['kickoffUtc', match?.kickoffUtc],
      ['kickoff_jordan', match?.kickoff_jordan], ['kickoffJordan', match?.kickoffJordan],
      ['kickoff_iso', match?.kickoff_iso], ['kickoffIso', match?.kickoffIso],
      ['kickoff', match?.kickoff], ['datetime', match?.datetime], ['dateTime', match?.dateTime],
      ['start_time', match?.start_time], ['startTime', match?.startTime],
    ];
    for (const [name, raw] of candidates) {
      if (!raw) continue;
      let value = String(raw).trim();
      if (!value) continue;
      const looksIsoDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);
      const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
      if (looksIsoDateTime && !hasZone) value = value.replace(' ', 'T') + (/utc/i.test(name) ? 'Z' : '+03:00');
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function inKickoffWindow(match) {
    if (isActuallyFinal(match)) return false;
    const kickoffMs = parseKickoffMs(match);
    if (!Number.isFinite(kickoffMs)) return false;
    const now = Date.now();
    return now >= kickoffMs - LIVE_EARLY_MS && now <= kickoffMs + LIVE_WINDOW_MS;
  }

  function pairFromArray(value) {
    if (!Array.isArray(value) || value.length < 2) return null;
    const a = numberOrNull(value[0]);
    const b = numberOrNull(value[1]);
    return a !== null && b !== null ? [a, b] : null;
  }

  function readScorePair(match) {
    const score = match?.score || {};
    const preferred = isActuallyLive(match)
      ? [score.current, score.live, score.et, score.ft, score.full_time, score.regular_time]
      : [score.ft, score.et, score.current, score.live, score.full_time, score.regular_time];
    for (const candidate of preferred) {
      const pair = pairFromArray(candidate);
      if (pair) return pair;
    }
    const s1 = numberOrNull(match.score1 ?? match.team1_score ?? match.team1Score ?? match.home_score ?? match.homeScore);
    const s2 = numberOrNull(match.score2 ?? match.team2_score ?? match.team2Score ?? match.away_score ?? match.awayScore);
    if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];
    const textScore = String(match.score_text || match.scoreText || match.display_score || match.displayScore || match.result || '');
    const cleaned = textScore
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const pair = cleaned.match(/(\d+)\s*[-–—:]\s*(\d+)/);
    if (pair) return [Number(pair[1]), Number(pair[2])];
    return null;
  }

  function readPenaltyPair(match) {
    const score = match?.score || {};
    const candidates = [score.p, score.penalties];
    for (const candidate of candidates) {
      const pair = pairFromArray(candidate);
      if (pair) return pair;
    }
    if (score.penalties && typeof score.penalties === 'object') {
      const pair = pairFromArray([score.penalties.home ?? score.penalties.team1, score.penalties.away ?? score.penalties.team2]);
      if (pair) return pair;
    }
    return pairFromArray([
      match.penalty_home_score ?? match.home_penalties ?? match.team1_penalties,
      match.penalty_away_score ?? match.away_penalties ?? match.team2_penalties,
    ]);
  }

  function isFinalOnPenalties(match) {
    if (!isActuallyFinal(match)) return false;
    const text = statusTexts(match).all;
    return !!readPenaltyPair(match) || /\b(penalties|penalty|shootout|pens)\b|بركلات\s*الترجيح|ركلات\s*الترجيح|ترجيح/.test(text);
  }

  function isFinalAfterExtra(match) {
    if (!isActuallyFinal(match) || isFinalOnPenalties(match)) return false;
    const score = match?.score || {};
    const text = statusTexts(match).all;
    return !!score.et || /\b(aet|after[_\s-]?extra|finished[_\s-]?after[_\s-]?extra[_\s-]?time)\b|بعد\s*التمديد/.test(text);
  }

  function displayStatusLabel(match) {
    const english = document.documentElement.lang === 'en';
    if (isFinalOnPenalties(match)) return english ? 'Finished on penalties' : 'انتهت بركلات الترجيح';
    if (isFinalAfterExtra(match)) return english ? 'Finished after extra time' : 'انتهت بعد التمديد';
    if (isActuallyFinal(match)) return english ? 'Finished' : 'انتهت';
    if (isActuallyLive(match) || inKickoffWindow(match)) return english ? LIVE_LABEL_EN : LIVE_LABEL_AR;
    return null;
  }

  function isLive(match) {
    return isActuallyLive(match) || inKickoffWindow(match) || (!!readScorePair(match) && !isActuallyFinal(match));
  }

  function namesForTeam(team) {
    return [team?.name_ar, team?.name, team?.name_en, team?.short_name, team?.shortName, team?.code]
      .filter(Boolean).map(norm).filter((value) => value.length >= 2);
  }

  function flattenMatches(data) {
    const out = [];
    const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
    for (const round of rounds) for (const match of (round.matches || [])) out.push(match);
    if (Array.isArray(data?.matches)) out.push(...data.matches);
    return out.map((match) => ({
      raw: match,
      number: String(match.number || match.match_number || match.num || match.id || '').replace(/\D+/g, '').trim(),
      team1Names: namesForTeam(match.team1 || match.home || match.homeTeam),
      team2Names: namesForTeam(match.team2 || match.away || match.awayTeam),
      score: readScorePair(match),
      penalties: readPenaltyPair(match),
      statusLabel: displayStatusLabel(match),
      isLive: isLive(match),
    })).filter((match) => match.statusLabel && match.team1Names.length && match.team2Names.length);
  }

  async function loadLiveMatches() {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`World Cup JSON ${res.status}`);
    const data = await res.json();
    liveMatches = flattenMatches(data);
    window.MaenSatWorldCupLiveStatusGuard = {
      version: VERSION,
      liveMatches: liveMatches.map((m) => ({ number: m.number, score: m.score, penalties: m.penalties, statusLabel: m.statusLabel })),
      refresh: () => runGuard(true),
    };
  }

  function findWorldCupRoot() {
    const candidates = Array.from(document.querySelectorAll('section, article, main, div[id], div[class]'));
    const filtered = candidates.filter((el) => {
      const text = norm(el.textContent || '');
      return text.includes('كاس العالم 2026') && (text.includes('المجموعات') || text.includes('الادوار') || text.includes('كل المباريات'));
    });
    filtered.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return filtered[0] || document.body;
  }

  function elementLooksLikeCard(element, match) {
    if (!element || element === document.body || element === document.documentElement) return false;
    const text = norm(element.textContent || '');
    if (text.length < 8 || text.length > 2500) return false;
    const hasTeam1 = match.team1Names.some((name) => text.includes(name));
    const hasTeam2 = match.team2Names.some((name) => text.includes(name));
    if (hasTeam1 && hasTeam2) return true;
    if (match.number && (text.includes(`مباراه ${match.number}`) || text.includes(`مباراة ${match.number}`))) return true;
    return false;
  }

  function findSmallestCards(root, match) {
    const nodes = Array.from(root.querySelectorAll('article, section, li, div, tr'));
    const candidates = nodes.filter((el) => elementLooksLikeCard(el, match));
    return candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other))).slice(0, 3);
  }

  function replaceStatusLabels(card, desiredLabel) {
    let changed = 0;
    if (!desiredLabel) return changed;
    for (const node of Array.from(card.querySelectorAll('*'))) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (STATUS_LABELS.has(text) && text !== desiredLabel) {
        node.textContent = desiredLabel;
        node.dataset.maenWcStatusFixed = VERSION;
        changed += 1;
      }
    }
    return changed;
  }

  function patchScoreDash(card, score, penalties) {
    const display = score ? `${score[0]}-${score[1]}${penalties ? ` (${penalties[0]}-${penalties[1]} ترجيح)` : ''}` : null;
    if (!display) return 0;
    for (const node of Array.from(card.querySelectorAll('*'))) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text === '—' || text === '-' || text === '–' || text === 'مباشر' || text === 'Live') {
        node.textContent = display;
        node.dataset.maenWcScoreFixed = VERSION;
        return 1;
      }
    }
    return 0;
  }

  function applyDomGuard() {
    if (!liveMatches.length) return;
    const root = findWorldCupRoot();
    let fixed = 0;
    for (const match of liveMatches) {
      for (const card of findSmallestCards(root, match)) {
        fixed += replaceStatusLabels(card, match.statusLabel);
        fixed += patchScoreDash(card, match.score, match.penalties);
        card.dataset.maenWcLiveGuard = VERSION;
      }
    }
    if (fixed) console.info(`[MaenSat] World Cup live status guard fixed ${fixed} visible item(s).`);
  }

  async function runGuard(force = false) {
    const now = Date.now();
    if (!force && now - lastRunAt < 1500) return;
    lastRunAt = now;
    try {
      await loadLiveMatches();
      applyDomGuard();
    } catch (err) {
      console.warn('[MaenSat] World Cup live status DOM guard failed:', err);
    }
  }

  function boot() {
    runGuard(true);
    setInterval(() => runGuard(true), REFRESH_MS);
    const observer = new MutationObserver(() => applyDomGuard());
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', () => setTimeout(() => runGuard(true), 250), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
