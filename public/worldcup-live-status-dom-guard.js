(() => {
  'use strict';

  const VERSION = '20260703-real-dom-live-status-guard-v1';
  const DATA_URL = '/worldcup-2026/knockout-live.json';
  const REFRESH_MS = 30 * 1000;
  const LIVE_EARLY_MS = 5 * 60 * 1000;
  const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
  const LIVE_LABEL = 'مباشر';
  const SCHEDULED_LABELS = new Set(['لم تبدأ', 'بانتظار التحديث', 'قريباً', 'قريبا']);

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

  function parseKickoffMs(match) {
    const candidates = [
      ['kickoff_utc', match?.kickoff_utc],
      ['kickoffUtc', match?.kickoffUtc],
      ['kickoff_jordan', match?.kickoff_jordan],
      ['kickoffJordan', match?.kickoffJordan],
      ['kickoff_iso', match?.kickoff_iso],
      ['kickoffIso', match?.kickoffIso],
      ['kickoff', match?.kickoff],
      ['datetime', match?.datetime],
      ['dateTime', match?.dateTime],
      ['start_time', match?.start_time],
      ['startTime', match?.startTime],
    ];

    for (const [name, raw] of candidates) {
      if (!raw) continue;
      let value = String(raw).trim();
      if (!value) continue;
      const looksIsoDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value);
      const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
      if (looksIsoDateTime && !hasZone) {
        value = value.replace(' ', 'T') + (/utc/i.test(name) ? 'Z' : '+03:00');
      }
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function statusText(match) {
    return [
      match?.status?.key,
      match?.status?.state,
      match?.status?.label_ar,
      match?.status?.label,
      match?.status,
      match?.phase,
    ].map((v) => String(v || '').toLowerCase()).join(' ');
  }

  function readScorePair(match) {
    let s1 = numberOrNull(match.score1 ?? match.team1_score ?? match.team1Score ?? match.home_score ?? match.homeScore);
    let s2 = numberOrNull(match.score2 ?? match.team2_score ?? match.team2Score ?? match.away_score ?? match.awayScore);
    if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];

    const textScore = String(match.score_text || match.scoreText || match.display_score || match.displayScore || match.result || match.score || '');
    const cleaned = textScore
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const pair = cleaned.match(/(\d+)\s*[-–—:]\s*(\d+)/);
    if (pair) return [Number(pair[1]), Number(pair[2])];
    return null;
  }

  function isFinished(match) {
    const text = statusText(match);
    return /\b(final|finished|complete|completed|full\s*time|post|closed)\b|انته|نهائي|بعد التمديد|ركلات الترجيح/.test(text);
  }

  function isExplicitLive(match) {
    const text = statusText(match);
    return !isFinished(match) && (/\b(live|in[-\s]?progress|progress|halftime|half[-\s]?time|extra|penalty|period)\b|مباشر|الشوط|استراحه|استراحة|ركلات|ترجيح/.test(text));
  }

  function inKickoffWindow(match) {
    if (isFinished(match)) return false;
    const kickoffMs = parseKickoffMs(match);
    if (!Number.isFinite(kickoffMs)) return false;
    const now = Date.now();
    return now >= kickoffMs - LIVE_EARLY_MS && now <= kickoffMs + LIVE_WINDOW_MS;
  }

  function isLive(match) {
    return isExplicitLive(match) || inKickoffWindow(match) || (!!readScorePair(match) && !isFinished(match));
  }

  function namesForTeam(team) {
    return [team?.name_ar, team?.name, team?.name_en, team?.short_name, team?.shortName, team?.code]
      .filter(Boolean)
      .map(norm)
      .filter((value) => value.length >= 2);
  }

  function flattenMatches(data) {
    const out = [];
    const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
    for (const round of rounds) {
      for (const match of (round.matches || [])) out.push(match);
    }
    if (Array.isArray(data?.matches)) out.push(...data.matches);

    return out
      .filter(isLive)
      .map((match) => {
        const score = readScorePair(match);
        return {
          raw: match,
          number: String(match.number || match.match_number || match.id || '').trim(),
          team1Names: namesForTeam(match.team1 || match.home || match.homeTeam),
          team2Names: namesForTeam(match.team2 || match.away || match.awayTeam),
          score,
        };
      })
      .filter((match) => match.team1Names.length && match.team2Names.length);
  }

  async function loadLiveMatches() {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`World Cup JSON ${res.status}`);
    const data = await res.json();
    liveMatches = flattenMatches(data);
    window.MaenSatWorldCupLiveStatusGuard = {
      version: VERSION,
      liveMatches: liveMatches.map((m) => ({ number: m.number, score: m.score })),
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
    if (match.number && text.includes(`مباراه ${match.number}`)) return true;
    if (match.number && text.includes(`مباراة ${match.number}`)) return true;
    return false;
  }

  function findSmallestCards(root, match) {
    const nodes = Array.from(root.querySelectorAll('article, section, li, div, tr'));
    const candidates = nodes.filter((el) => elementLooksLikeCard(el, match));
    return candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other))).slice(0, 3);
  }

  function replaceScheduledLabels(card) {
    let changed = 0;
    const nodes = Array.from(card.querySelectorAll('*'));
    for (const node of nodes) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (SCHEDULED_LABELS.has(text)) {
        node.textContent = LIVE_LABEL;
        node.dataset.maenWcStatusFixed = VERSION;
        changed += 1;
      }
    }
    return changed;
  }

  function patchScoreDash(card, score) {
    if (!score) return 0;
    const nodes = Array.from(card.querySelectorAll('*'));
    for (const node of nodes) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text === '—' || text === '-' || text === '–') {
        node.textContent = `${score[0]}-${score[1]}`;
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
        fixed += replaceScheduledLabels(card);
        if (match.score) fixed += patchScoreDash(card, match.score);
        card.dataset.maenWcLiveGuard = VERSION;
      }
    }

    if (fixed) {
      console.info(`[MaenSat] World Cup live status guard fixed ${fixed} visible label(s).`);
    }
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
