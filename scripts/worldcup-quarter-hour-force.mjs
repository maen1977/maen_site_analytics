import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const START_DATE = process.env.WORLD_CUP_2026_START_DATE || '2026-06-11';
const END_DATE = process.env.WORLD_CUP_2026_END_DATE || '2026-07-19';
const REFRESH_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

function ymd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function ymdCompact(date) {
  return ymd(date).replace(/-/g, '');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function parseDateOnly(value, endOfDay = false) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(Number.NaN);
  return new Date(`${text}T${endOfDay ? '23:59:59' : '00:00:00'}+03:00`);
}

function clampDate(date, min, max) {
  if (Number.isFinite(min?.getTime?.()) && date < min) return new Date(min);
  if (Number.isFinite(max?.getTime?.()) && date > max) return new Date(max);
  return date;
}

function stableString(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(WC_DIR, file), 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJson(file, value) {
  await fs.writeFile(path.join(WC_DIR, file), JSON.stringify(value, null, 2) + '\n');
}

function ensureMatchesContainer(value) {
  if (Array.isArray(value)) return { root: { matches: value }, matches: value, arrayRoot: true };
  if (!value || typeof value !== 'object') return { root: { matches: [] }, matches: [], arrayRoot: false };
  if (!Array.isArray(value.matches)) value.matches = [];
  return { root: value, matches: value.matches, arrayRoot: false };
}

function matchesArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.matches)) return value.matches;
  if (Array.isArray(value?.data?.matches)) return value.data.matches;
  return [];
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/\b(fc|cf|sc|nt|team|national|republic of|the)\b/g, '')
    .replace(/[^a-z0-9ء-ي]/g, '');
}

const ALIASES = new Map(Object.entries({
  usa: 'unitedstates',
  us: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  unitedstates: 'unitedstates',
  usmnt: 'unitedstates',
  korea: 'southkorea',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  southkorea: 'southkorea',
  czechia: 'czechrepublic',
  czechrepublic: 'czechrepublic',
  bosniaherzegovina: 'bosniaandherzegovina',
  bosniaandherzegovina: 'bosniaandherzegovina',
  bosnia: 'bosniaandherzegovina',
  drcongo: 'democraticrepublicofcongo',
  democraticrepubliccongo: 'democraticrepublicofcongo',
  democraticrepublicofcongo: 'democraticrepublicofcongo',
  congodr: 'democraticrepublicofcongo',
  ivorycoast: 'cotedivoire',
  coteivoire: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  curacao: 'curacao',
  curaçao: 'curacao',
  capeverde: 'capeverde',
  caboverde: 'capeverde',
  turkey: 'turkey',
  turkiye: 'turkey',
  uae: 'unitedarabemirates',
  unitedarabemirates: 'unitedarabemirates',
}));

function teamKey(value) {
  const key = normalize(value);
  return ALIASES.get(key) || key;
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstScore(...values) {
  for (const value of values) {
    const n = scoreNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function scorePair(home, away) {
  const a = scoreNumber(home);
  const b = scoreNumber(away);
  return a !== null && b !== null ? [a, b] : null;
}

function scoreFromObject(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return null;
}

function espnPenaltyScore(competitor, competition, side) {
  const sideKeys = side === 'home' ? ['home', 'team1', 'h'] : ['away', 'team2', 'a'];
  const penaltyContainers = [
    competitor?.penalties,
    competitor?.penalty,
    competitor?.shootout,
    competitor?.shootoutScore,
    competitor?.penaltyScore,
    competitor?.scorePenalty,
    competitor?.score?.penalties,
    competitor?.score?.shootout,
    competition?.penalties,
    competition?.shootout,
    competition?.shootoutScore,
  ];
  const direct = firstScore(
    competitor?.shootoutScore,
    competitor?.penaltyScore,
    competitor?.penalties,
    competitor?.penalty,
    competitor?.scorePenalty,
    competitor?.score?.shootoutScore,
    competitor?.score?.penaltyScore
  );
  if (direct !== null) return direct;
  for (const container of penaltyContainers) {
    if (!container || typeof container !== 'object') continue;
    const value = scoreFromObject(container, [...sideKeys, `${side}Score`, `${side}_score`, `${side}Penalty`, `${side}_penalty`, `${side}Penalties`, `${side}_penalties`, 'score', 'value', 'displayValue']);
    const n = scoreNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function espnPhase(status, comp, event) {
  const statusText = [
    status?.name,
    status?.description,
    status?.detail,
    status?.shortDetail,
    comp?.status?.displayClock,
    event?.status?.type?.name,
    event?.status?.type?.description,
    event?.status?.type?.detail,
    event?.status?.type?.shortDetail,
  ].filter(Boolean).join(' ').toLowerCase();
  const state = String(status?.state || event?.status?.type?.state || '').toLowerCase();
  const completed = Boolean(status?.completed || event?.status?.type?.completed);
  const period = Number(comp?.status?.period ?? event?.status?.period ?? status?.period);

  if (/penalt|shootout|ركلات|ترجيح/.test(statusText)) return completed ? 'finished_on_penalties' : 'penalties';
  if (/aet|after\s+extra|extra\s+time|وقت\s*إضاف|وقت\s*اضاف|تمديد/.test(statusText)) return completed ? 'finished_after_extra_time' : (period >= 4 ? 'extra_time_second' : 'extra_time_first');
  if (completed) return 'finished';
  if (/half\s*time|halftime|استراحة/.test(statusText)) return 'half_time';
  if (state === 'in' || state === 'live') {
    if (period === 1) return 'first_half';
    if (period === 2) return 'second_half';
    if (period === 3) return 'extra_time_first';
    if (period === 4) return 'extra_time_second';
    if (period >= 5) return 'penalties';
    return 'live';
  }
  return 'scheduled';
}

function statusFromPhase(phase) {
  if (String(phase || '').startsWith('finished')) return 'finished';
  if (phase === 'scheduled') return 'scheduled';
  return 'live';
}

function phaseLabelAr(phase) {
  return ({
    first_half: 'الشوط الأول',
    half_time: 'استراحة بين الشوطين',
    second_half: 'الشوط الثاني',
    extra_time_first: 'الشوط الإضافي الأول',
    extra_time_second: 'الشوط الإضافي الثاني',
    penalties: 'ركلات الترجيح',
    finished_after_extra_time: 'انتهت بعد التمديد',
    finished_on_penalties: 'انتهت بركلات الترجيح',
    finished: 'انتهت',
    scheduled: 'لم تبدأ',
    live: 'مباشر',
  })[phase] || '';
}

function matchNumber(match) {
  const raw = match?.num ?? match?.match_number ?? match?.matchNo ?? match?.match ?? match?.id;
  const n = Number(String(raw || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 999999;
}

function matchId(match) {
  const num = matchNumber(match);
  if (Number.isFinite(num) && num !== 999999) return `M${String(num).padStart(3, '0')}`;
  return String(match?.id || '');
}

function matchDateMs(match) {
  const raw = match?.kickoff_utc || match?.kickoff_jordan || match?.datetime || match?.date_time || match?.date;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

function eventDateMs(event) {
  const t = event?.date ? Date.parse(event.date) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

function slotText(value) {
  return String(value || '').trim();
}

function isPlaceholder(value) {
  const s = slotText(value);
  return /^(?:[12][A-L]|3[A-L](?:\/[A-L])*|W\d{1,3}|L\d{1,3})$/i.test(s);
}

function stageIsGroup(match) {
  const text = `${match?.stage || ''} ${match?.round || ''} ${match?.stage_ar || ''}`.toLowerCase();
  return Boolean(match?.group) || text.includes('group') || text.includes('مجموع');
}

function stageIsKnockout(match) {
  return !stageIsGroup(match) && matchNumber(match) >= 73;
}

function teamFields(side) {
  if (side === 1) return ['team1', 'home_team', 'homeTeam'];
  return ['team2', 'away_team', 'awayTeam'];
}

function getTeamName(match, side) {
  for (const field of teamFields(side)) {
    if (match?.[field]) return match[field];
  }
  return '';
}

function setTeamName(match, side, team, teamAr, sourceSlot = '') {
  if (!team) return false;
  const before = `${getTeamName(match, side)}|${match[`team${side}_ar`] || ''}`;
  match[`team${side}`] = team;
  match[`team${side}_ar`] = teamAr || team;
  if (sourceSlot) match[`team${side}_source_slot`] = sourceSlot;
  if (side === 1) {
    if ('home_team' in match) match.home_team = team;
    if ('homeTeam' in match) match.homeTeam = team;
    if ('home_team_ar' in match) match.home_team_ar = teamAr || team;
  } else {
    if ('away_team' in match) match.away_team = team;
    if ('awayTeam' in match) match.awayTeam = team;
    if ('away_team_ar' in match) match.away_team_ar = teamAr || team;
  }
  return before !== `${getTeamName(match, side)}|${match[`team${side}_ar`] || ''}`;
}

function originalSlot(match, side) {
  const saved = match?.[`team${side}_source_slot`] || match?.[`team${side}_slot`] || match?.[`slot${side}`] || '';
  if (isPlaceholder(saved)) return slotText(saved).toUpperCase();
  const current = getTeamName(match, side);
  if (isPlaceholder(current)) return slotText(current).toUpperCase();
  const ar = match?.[`team${side}_ar`];
  if (isPlaceholder(ar)) return slotText(ar).toUpperCase();
  return '';
}

function refreshSearchText(match) {
  match.search_text = [
    match.team1 || match.home_team || match.homeTeam,
    match.team2 || match.away_team || match.awayTeam,
    match.team1_ar || match.home_team_ar,
    match.team2_ar || match.away_team_ar,
    match.stadium,
    match.ground,
    match.round,
    match.stage,
    match.stage_ar,
    match.group ? `Group ${match.group}` : '',
    match.num ? `Match ${match.num}` : '',
  ].filter(Boolean).join(' ');
}

function hasScore(match) {
  return scoreNumber(match?.home_score) !== null && scoreNumber(match?.away_score) !== null;
}

function isFinished(match) {
  const status = String(match?.status || '').toLowerCase();
  return status.includes('finish') || status.includes('full') || status === 'ft' || Boolean(match?.score?.ft) || Boolean(match?.score?.full_time);
}

function isVerifiedResult(match) {
  if (!hasScore(match) || !isFinished(match)) return false;
  const source = String(match?.score_source || match?.live_score_source || match?.score?.source || '').toLowerCase();
  return ['espn', 'manual-override', 'manual', 'verified'].some((key) => source.includes(key));
}

function teamResult(match) {
  if (!isVerifiedResult(match)) return null;
  let a = scoreNumber(match.home_score);
  let b = scoreNumber(match.away_score);
  if (a === null || b === null) return null;
  if (a === b) {
    const pa = firstScore(match.penalty_home_score, match.home_penalties, match.team1_penalties, match.score?.penalties?.home, match.score?.penalties?.team1, Array.isArray(match.score?.p) ? match.score.p[0] : null, match.score?.penalty_home_score);
    const pb = firstScore(match.penalty_away_score, match.away_penalties, match.team2_penalties, match.score?.penalties?.away, match.score?.penalties?.team2, Array.isArray(match.score?.p) ? match.score.p[1] : null, match.score?.penalty_away_score);
    if (pa !== null && pb !== null && pa !== pb) {
      a = pa;
      b = pb;
    } else {
      const explicitWinner = scoreNumber(match.winner_side ?? match.score?.winner_side);
      if (explicitWinner === 1 || explicitWinner === 2) {
        return { winner: explicitWinner, loser: explicitWinner === 1 ? 2 : 1 };
      }
    }
  }
  if (a === b) return null;
  return {
    winner: a > b ? 1 : 2,
    loser: a > b ? 2 : 1,
  };
}

function eventUrlWithDates(baseUrl, start, end) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', url.searchParams.get('limit') || '950');
    url.searchParams.set('dates', `${ymdCompact(start)}-${ymdCompact(end)}`);
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}limit=950&dates=${ymdCompact(start)}-${ymdCompact(end)}`;
  }
}

function buildEspnUrls(now) {
  const tournamentStart = parseDateOnly(START_DATE);
  const tournamentEnd = parseDateOnly(END_DATE, true);
  const scanEnd = clampDate(addDays(now, 2), tournamentStart, tournamentEnd);
  const urls = new Set([ESPN_BASE]);
  let cursor = new Date(tournamentStart);
  while (cursor <= scanEnd) {
    const end = new Date(Math.min(addDays(cursor, 6).getTime(), scanEnd.getTime()));
    urls.add(eventUrlWithDates(ESPN_BASE, cursor, end));
    cursor = addDays(end, 1);
  }
  [-2, -1, 0, 1, 2].forEach((offset) => {
    const d = clampDate(addDays(now, offset), tournamentStart, tournamentEnd);
    urls.add(eventUrlWithDates(ESPN_BASE, d, d));
  });
  return [...urls];
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Maensat-WorldCup-2026-Updater/4.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

function extractEspnEvents(scoreboard) {
  const events = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  return events.map((e) => {
    const comp = e.competitions?.[0] || {};
    const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const status = comp.status?.type || e.status?.type || {};
    const phase = espnPhase(status, comp, e);
    const homeName = home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '';
    const awayName = away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '';
    const homeScore = scoreNumber(home.score);
    const awayScore = scoreNumber(away.score);
    const homePenalties = espnPenaltyScore(home, comp, 'home');
    const awayPenalties = espnPenaltyScore(away, comp, 'away');
    const detail = status.description || status.detail || status.shortDetail || status.name || '';
    return {
      source: 'espn',
      id: String(e.id || comp.id || ''),
      date: e.date || comp.date || '',
      home: homeName,
      away: awayName,
      homeKey: teamKey(homeName),
      awayKey: teamKey(awayName),
      home_score: homeScore,
      away_score: awayScore,
      home_penalties: homePenalties,
      away_penalties: awayPenalties,
      home_winner: Boolean(home.winner),
      away_winner: Boolean(away.winner),
      status: statusFromPhase(phase),
      phase,
      phase_label_ar: phaseLabelAr(phase),
      status_detail: detail,
      clock: comp.status?.displayClock || e.status?.displayClock || '',
      period: Number(comp.status?.period ?? e.status?.period ?? status.period) || null,
    };
  }).filter((event) => event.homeKey && event.awayKey && event.date);
}

function matchTeamKeys(match) {
  return {
    team1: teamKey(getTeamName(match, 1)),
    team2: teamKey(getTeamName(match, 2)),
  };
}

function sameTeams(match, event) {
  const { team1, team2 } = matchTeamKeys(match);
  if (!team1 || !team2 || isPlaceholder(getTeamName(match, 1)) || isPlaceholder(getTeamName(match, 2))) return false;
  return (team1 === event.homeKey && team2 === event.awayKey) || (team1 === event.awayKey && team2 === event.homeKey);
}

function timeDiffMs(match, event) {
  const mt = matchDateMs(match);
  const et = eventDateMs(event);
  if (!Number.isFinite(mt) || !Number.isFinite(et)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(mt - et);
}

function findEspnMatch(match, events) {
  const explicitIds = [match?.espn_id, match?.espn_event_id, match?.event_id, match?.score?.event_id].filter(Boolean).map(String);
  if (explicitIds.length) {
    const byId = events.find((event) => explicitIds.includes(String(event.id)));
    if (byId) return byId;
  }
  return events
    .filter((event) => sameTeams(match, event))
    .map((event) => ({ event, diff: timeDiffMs(match, event) }))
    .filter((row) => row.diff <= 54 * 60 * 60 * 1000 || row.diff === Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.diff - b.diff)[0]?.event || null;
}

function applyScore(match, event, nowIso) {
  const { team1 } = matchTeamKeys(match);
  const sameOrder = team1 && team1 === event.homeKey;
  const team1Score = sameOrder ? event.home_score : event.away_score;
  const team2Score = sameOrder ? event.away_score : event.home_score;
  const team1Penalties = sameOrder ? event.home_penalties : event.away_penalties;
  const team2Penalties = sameOrder ? event.away_penalties : event.home_penalties;
  const winnerSide = event.home_winner ? (sameOrder ? 1 : 2) : event.away_winner ? (sameOrder ? 2 : 1) : null;
  const before = JSON.stringify({
    s: match.status,
    a: match.home_score,
    b: match.away_score,
    p1: match.penalty_home_score ?? match.home_penalties,
    p2: match.penalty_away_score ?? match.away_penalties,
    phase: match.live_phase || match.score?.phase,
    winner: match.winner_side ?? match.score?.winner_side,
    src: match.score_source,
    id: match.espn_event_id,
  });
  match.espn_event_id = event.id || match.espn_event_id;
  match.status = event.status;
  match.live_phase = event.phase || event.status;
  match.live_phase_ar = event.phase_label_ar || '';
  match.live_score_source = 'espn';
  match.score_source = 'espn';
  match.live_status_detail = event.status_detail || event.phase_label_ar || event.status;
  match.live_clock = event.clock || null;
  match.live_period = event.period || null;
  match.live_checked_at = nowIso;
  match.last_live_update = nowIso;
  if (team1Score !== null) match.home_score = team1Score;
  if (team2Score !== null) match.away_score = team2Score;
  if (team1Penalties !== null) {
    match.penalty_home_score = team1Penalties;
    match.home_penalties = team1Penalties;
    match.team1_penalties = team1Penalties;
  }
  if (team2Penalties !== null) {
    match.penalty_away_score = team2Penalties;
    match.away_penalties = team2Penalties;
    match.team2_penalties = team2Penalties;
  }
  if (winnerSide === 1 || winnerSide === 2) {
    match.winner_side = winnerSide;
    match.loser_side = winnerSide === 1 ? 2 : 1;
  }
  const current = [match.home_score ?? null, match.away_score ?? null];
  const penalties = scorePair(team1Penalties, team2Penalties);
  match.score = {
    source: 'espn',
    event_id: event.id,
    status: event.status,
    phase: event.phase,
    phase_ar: event.phase_label_ar || '',
    status_detail: event.status_detail,
    clock: event.clock || null,
    period: event.period || null,
    checked_at: nowIso,
    current,
  };
  if (event.status === 'finished') match.score.ft = current;
  if (event.status === 'live') match.score.live = current;
  if (['extra_time_first', 'extra_time_second', 'finished_after_extra_time', 'finished_on_penalties', 'penalties'].includes(event.phase)) match.score.et = current;
  if (penalties) {
    match.score.p = penalties;
    match.score.penalties = { home: penalties[0], away: penalties[1], team1: penalties[0], team2: penalties[1] };
  }
  if (winnerSide === 1 || winnerSide === 2) match.score.winner_side = winnerSide;
  return before !== JSON.stringify({
    s: match.status,
    a: match.home_score,
    b: match.away_score,
    p1: match.penalty_home_score ?? match.home_penalties,
    p2: match.penalty_away_score ?? match.away_penalties,
    phase: match.live_phase || match.score?.phase,
    winner: match.winner_side ?? match.score?.winner_side,
    src: match.score_source,
    id: match.espn_event_id,
  });
}

function clearFutureOpenfootballZeros(match, now) {
  const kickoff = matchDateMs(match);
  const source = String(match.score_source || match.live_score_source || match.score?.source || '').toLowerCase();
  const status = String(match.status || '').toLowerCase();
  const futureOrNotStarted = !Number.isFinite(kickoff) || kickoff > now.getTime() - 30 * 60 * 1000 || status === 'scheduled';
  const falseZero = Number(match.home_score) === 0 && Number(match.away_score) === 0 && source.includes('openfootball') && futureOrNotStarted;
  if (!falseZero) return false;
  match.home_score = null;
  match.away_score = null;
  match.score = null;
  match.score_source = 'scheduled';
  return true;
}

function collectTeamArMap(matchesData, standingsData, groupsData) {
  const map = new Map();
  const sources = [matchesData?.team_ar, groupsData?.team_ar, standingsData?.team_ar];
  for (const src of sources) {
    if (src && typeof src === 'object') {
      for (const [en, ar] of Object.entries(src)) if (en && ar) map.set(en, ar);
    }
  }
  for (const m of [...matchesArray(matchesData), ...matchesArray(groupsData)]) {
    if (m?.team1 && m?.team1_ar) map.set(m.team1, m.team1_ar);
    if (m?.team2 && m?.team2_ar) map.set(m.team2, m.team2_ar);
  }
  for (const group of standingsData?.standings || groupsData?.standings || []) {
    for (const row of group.rows || []) if (row.team && row.team_ar) map.set(row.team, row.team_ar);
  }
  return map;
}

function buildStandings(matchesData, nowIso, teamArMap) {
  const groups = matchesData.groups || {};
  const standings = [];
  for (const group of Object.keys(groups).sort()) {
    const rows = new Map();
    for (const team of groups[group] || []) {
      rows.set(team, {
        team,
        team_ar: teamArMap.get(team) || team,
        group,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,
        points: 0,
        rank: 0,
        qualified: false,
      });
    }
    const groupMatches = matchesArray(matchesData).filter((m) => String(m.group || '').toUpperCase() === group.toUpperCase() && stageIsGroup(m) && isVerifiedResult(m));
    for (const m of groupMatches) {
      const t1 = getTeamName(m, 1);
      const t2 = getTeamName(m, 2);
      if (!t1 || !t2) continue;
      if (!rows.has(t1)) rows.set(t1, { team: t1, team_ar: teamArMap.get(t1) || m.team1_ar || t1, group, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0, rank: 0, qualified: false });
      if (!rows.has(t2)) rows.set(t2, { team: t2, team_ar: teamArMap.get(t2) || m.team2_ar || t2, group, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0, rank: 0, qualified: false });
      const a = rows.get(t1);
      const b = rows.get(t2);
      const hs = scoreNumber(m.home_score) ?? 0;
      const as = scoreNumber(m.away_score) ?? 0;
      a.played++; b.played++;
      a.goals_for += hs; a.goals_against += as;
      b.goals_for += as; b.goals_against += hs;
      if (hs > as) { a.wins++; b.losses++; a.points += 3; }
      else if (hs < as) { b.wins++; a.losses++; b.points += 3; }
      else { a.draws++; b.draws++; a.points++; b.points++; }
    }
    const sorted = [...rows.values()].map((r) => ({ ...r, goal_diff: r.goals_for - r.goals_against }))
      .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || a.team.localeCompare(b.team));
    sorted.forEach((row, index) => {
      row.rank = index + 1;
      row.qualified = index < 2;
    });
    standings.push({ group, rows: sorted });
  }
  const bestThirds = standings
    .map((g) => g.rows[2])
    .filter(Boolean)
    .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, qualified: index < 8 }));
  return {
    metadata: {
      name: matchesData.metadata?.name || 'كأس العالم 2026',
      english_name: matchesData.metadata?.english_name || 'World Cup 2026',
      source: 'ESPN verified results + local schedule',
      last_checked_at: nowIso,
      last_updated: nowIso,
      timezone: TIMEZONE,
      total_matches: matchesArray(matchesData).length,
      teams_count: Object.values(groups).flat().length,
      groups_count: Object.keys(groups).length,
      verified_results_only: true,
      note_ar: 'تم احتساب ترتيب المجموعات من النتائج الموثقة فقط، ويعمل هذا ضمن التحديث الأصلي كل 15 دقيقة.',
    },
    standings,
    best_thirds: bestThirds,
  };
}

function standingLookups(standings) {
  const groupMap = new Map();
  for (const group of standings.standings || []) {
    groupMap.set(String(group.group || '').toUpperCase(), group.rows || []);
  }
  const bestThirds = (standings.best_thirds || [])
    .filter((row) => row?.team)
    .slice(0, 8)
    .map((row, index) => ({ ...row, priority: index }));
  return { groupMap, bestThirds };
}

function findMatchByNum(allMatches, num) {
  return allMatches.find((m) => matchNumber(m) === Number(num));
}

function teamFromMatchSide(match, side) {
  const team = getTeamName(match, side);
  return { team, team_ar: match?.[`team${side}_ar`] || team };
}

function resolveDirectSlot(slot, groupMap) {
  const m = String(slot || '').toUpperCase().match(/^([12])([A-L])$/);
  if (!m) return null;
  const rank = Number(m[1]);
  const group = m[2];
  const row = groupMap.get(group)?.[rank - 1];
  return row?.team ? { team: row.team, team_ar: row.team_ar || row.team, group, rank } : null;
}

function resolveWinnerSlot(slot, allMatches) {
  const m = String(slot || '').toUpperCase().match(/^([WL])(\d{1,3})$/);
  if (!m) return null;
  const kind = m[1];
  const source = findMatchByNum(allMatches, Number(m[2]));
  const result = teamResult(source);
  if (!source || !result) return null;
  const side = kind === 'W' ? result.winner : result.loser;
  const team = teamFromMatchSide(source, side);
  return team.team ? { ...team, from_match: matchId(source), slot } : null;
}

function parseThirdSlot(slot) {
  const s = String(slot || '').toUpperCase();
  const m = s.match(/^3([A-L](?:\/[A-L])*)$/);
  if (!m) return null;
  return m[1].split('/').filter(Boolean);
}

function collectThirdSlotEntries(containers) {
  const entries = [];
  for (const { name, matches } of containers) {
    for (const match of matches) {
      for (const side of [1, 2]) {
        const slot = originalSlot(match, side);
        const allowed = parseThirdSlot(slot);
        if (allowed) entries.push({ container: name, match, side, slot, allowed, key: `${matchId(match)}:${side}` });
      }
    }
  }
  // same match/side can appear in matches.json and bracket.json; keep both but use a common assignment key.
  return entries;
}

function solveThirdAssignments(entries, bestThirds) {
  const uniqueKeys = new Map();
  for (const entry of entries) {
    if (!uniqueKeys.has(entry.key)) uniqueKeys.set(entry.key, entry);
  }
  const unique = [...uniqueKeys.values()];
  const teamsByGroup = new Map(bestThirds.map((row) => [String(row.group || '').toUpperCase(), row]));
  const groups = [...teamsByGroup.keys()];
  const sorted = [...unique].sort((a, b) => {
    const ca = a.allowed.filter((g) => groups.includes(g)).length;
    const cb = b.allowed.filter((g) => groups.includes(g)).length;
    return ca - cb || a.allowed.length - b.allowed.length || matchNumber(a.match) - matchNumber(b.match);
  });
  const best = { score: -1, assign: new Map() };
  function backtrack(index, used, assign, score) {
    if (index >= sorted.length) {
      if (score > best.score) {
        best.score = score;
        best.assign = new Map(assign);
      }
      return;
    }
    const entry = sorted[index];
    const candidates = entry.allowed
      .filter((g) => teamsByGroup.has(g) && !used.has(g))
      .sort((a, b) => (teamsByGroup.get(a).priority ?? 99) - (teamsByGroup.get(b).priority ?? 99));
    for (const group of candidates) {
      used.add(group);
      assign.set(entry.key, { ...teamsByGroup.get(group), assignment_group: group, official_slot_match: true });
      backtrack(index + 1, used, assign, score + 10 - (teamsByGroup.get(group).priority || 0) / 100);
      assign.delete(entry.key);
      used.delete(group);
    }
    // Allow unresolved branch so we can later fill with fallback and still avoid symbols.
    backtrack(index + 1, used, assign, score);
  }
  backtrack(0, new Set(), new Map(), 0);

  const assignedGroups = new Set([...best.assign.values()].map((row) => String(row.group || row.assignment_group || '').toUpperCase()));
  const fallbackRows = bestThirds.filter((row) => !assignedGroups.has(String(row.group || '').toUpperCase()));
  let fallbackIndex = 0;
  for (const entry of unique) {
    if (best.assign.has(entry.key)) continue;
    const fallback = fallbackRows[fallbackIndex++];
    if (fallback) {
      best.assign.set(entry.key, { ...fallback, assignment_group: fallback.group, official_slot_match: false, fallback_assignment: true });
    }
  }
  return best.assign;
}

function resolveSlot(slot, lookups, allMatches, thirdAssignments, assignmentKey) {
  if (!slot) return null;
  const direct = resolveDirectSlot(slot, lookups.groupMap);
  if (direct) return direct;
  const win = resolveWinnerSlot(slot, allMatches);
  if (win) return win;
  const thirdAllowed = parseThirdSlot(slot);
  if (thirdAllowed && thirdAssignments?.has(assignmentKey)) {
    const row = thirdAssignments.get(assignmentKey);
    return row?.team ? { team: row.team, team_ar: row.team_ar || row.team, group: row.group, third_place: true, fallback_assignment: row.fallback_assignment } : null;
  }
  return null;
}

function resolveKnockout(containers, standings, nowIso) {
  const allMatches = containers.flatMap((c) => c.matches);
  const lookups = standingLookups(standings);
  const thirdEntries = collectThirdSlotEntries(containers);
  const thirdAssignments = solveThirdAssignments(thirdEntries, lookups.bestThirds);
  let changed = 0;
  let directResolved = 0;
  let thirdResolved = 0;
  let winnerResolved = 0;
  const unresolved = [];
  for (const { name, matches } of containers) {
    for (const match of matches) {
      if (!stageIsKnockout(match)) continue;
      for (const side of [1, 2]) {
        const slot = originalSlot(match, side);
        if (!slot) continue;
        const assignmentKey = `${matchId(match)}:${side}`;
        const resolved = resolveSlot(slot, lookups, allMatches, thirdAssignments, assignmentKey);
        if (resolved?.team) {
          if (setTeamName(match, side, resolved.team, resolved.team_ar, slot)) changed++;
          if (/^[12][A-L]$/i.test(slot)) directResolved++;
          else if (/^3/i.test(slot)) thirdResolved++;
          else if (/^[WL]/i.test(slot)) winnerResolved++;
          if (resolved.fallback_assignment) match[`team${side}_resolution_note_ar`] = 'تم ربط أفضل ثالث متأهل تلقائياً حتى لا يظهر رمز في الموقع.';
        } else {
          const reason = /^W/i.test(slot) ? 'winner-not-ready' : /^L/i.test(slot) ? 'loser-not-ready' : /^3/i.test(slot) ? 'best-third-not-ready' : 'slot-not-ready';
          unresolved.push({ file: name, match: matchId(match), side: `team${side}`, slot, reason });
        }
      }
      match.knockout_linked_at = nowIso;
      refreshSearchText(match);
    }
  }
  return {
    changed,
    directResolved,
    thirdResolved,
    winnerResolved,
    unresolved: unresolved.slice(0, 80),
    third_assignment_count: thirdAssignments.size,
    third_assignments: [...thirdAssignments.entries()].map(([key, row]) => ({ key, group: row.group, team: row.team, team_ar: row.team_ar, fallback: Boolean(row.fallback_assignment) })),
  };
}

function applyManualOverrides(matchesData, nowIso) {
  // Optional locked manual corrections. This preserves your current manual override mechanism if the file exists.
  return readJson('manual-results-overrides.json', { results: [] }).then((overrides) => {
    const list = Array.isArray(overrides?.results) ? overrides.results : [];
    let applied = 0;
    for (const override of list) {
      if (!override || !(override.locked || override.force || override.verified)) continue;
      const target = matchesData.matches.find((m) => (override.id && String(m.id) === String(override.id)) || (override.num != null && matchNumber(m) === Number(override.num)));
      if (!target) continue;
      Object.assign(target, override, {
        last_live_update: override.last_live_update || nowIso,
        score_source: override.score_source || 'manual-override',
        manual_override_locked: true,
      });
      refreshSearchText(target);
      applied++;
    }
    return applied;
  }).catch(() => 0);
}

function sortMatchesList(matches) {
  matches.sort((a, b) => {
    const ta = matchDateMs(a);
    const tb = matchDateMs(b);
    return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER) || matchNumber(a) - matchNumber(b);
  });
}

async function writeStatusFiles(nowIso, details) {
  const next = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
  const nextIso = jordanIso(next);
  const version = crypto.createHash('sha1').update(`${nowIso}:${JSON.stringify(details)}`).digest('hex').slice(0, 12);
  const status = {
    name: 'MaenSat World Cup 2026 original 15-minute updater',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: REFRESH_MINUTES,
    source: 'github-actions-original-workflow',
    github: {
      run_id: process.env.GITHUB_RUN_ID || '',
      run_number: process.env.GITHUB_RUN_NUMBER || '',
      workflow: process.env.GITHUB_WORKFLOW || '',
      event_name: process.env.GITHUB_EVENT_NAME || '',
      repository: process.env.GITHUB_REPOSITORY || '',
      ref: process.env.GITHUB_REF || '',
      sha: process.env.GITHUB_SHA || '',
      trigger_source: process.env.WORLD_CUP_2026_TRIGGER_SOURCE || '',
      forced_at: process.env.WORLD_CUP_2026_FORCED_AT || '',
    },
    checks: details,
    cache_buster: version,
    note_ar: 'هذا الملف يتغير كل تشغيل ضمن التحديث الأصلي كل 15 دقيقة؛ لا يوجد Action جديد ولا تعديل على واجهة الموقع.',
  };
  await writeJson('heartbeat.json', status);
  await writeJson('update-check.json', { ...status, errors: details.errors || [] });
  await writeJson('version.json', {
    version,
    generated_at: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: REFRESH_MINUTES,
    checks: details,
  });
  await fs.writeFile(path.join(WC_DIR, 'deploy-marker.txt'), `worldcup-check=${nowIso}\ncache=${version}\nmatched=${details?.espn_scoreboard?.matched || 0}\nknockout=${details?.knockout?.changed || 0}\n`);
  await writeJson('update-errors.json', details.errors || []);
}

async function main() {
  const now = new Date();
  const nowIso = jordanIso(now);
  await fs.mkdir(WC_DIR, { recursive: true });

  const matchesRaw = await readJson('matches.json', { matches: [] });
  const bracketRaw = await readJson('bracket.json', { matches: [] });
  const oldStandings = await readJson('standings.json', { standings: [], best_thirds: [] });
  const oldGroups = await readJson('groups.json', { groups: {}, standings: [] });
  const matchesBox = ensureMatchesContainer(matchesRaw);
  const bracketBox = ensureMatchesContainer(bracketRaw);

  const teamArMap = collectTeamArMap(matchesBox.root, oldStandings, oldGroups);
  const initialStandings = buildStandings(matchesBox.root, nowIso, teamArMap);
  resolveKnockout([
    { name: 'matches.json', matches: matchesBox.matches },
    { name: 'bracket.json', matches: bracketBox.matches },
  ], initialStandings, nowIso);

  const urls = buildEspnUrls(now);
  const fetchResults = await Promise.all(urls.map(async (url) => ({ url, ...(await fetchJson(url)) })));
  const rawEvents = [];
  for (const result of fetchResults) if (result.ok) rawEvents.push(...extractEspnEvents(result.data));
  const seen = new Set();
  const events = rawEvents.filter((event) => {
    const key = event.id || `${event.date}:${event.homeKey}:${event.awayKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let matched = 0;
  let scoreChanged = 0;
  let clearedZeros = 0;
  for (const match of matchesBox.matches) {
    const event = findEspnMatch(match, events);
    if (event) {
      matched++;
      if (applyScore(match, event, nowIso)) scoreChanged++;
    } else if (clearFutureOpenfootballZeros(match, now)) {
      clearedZeros++;
    }
    refreshSearchText(match);
  }
  // Apply same score pass to bracket so the tab can update even if the UI reads bracket.json directly.
  let bracketMatched = 0;
  for (const match of bracketBox.matches) {
    const event = findEspnMatch(match, events);
    if (event) {
      bracketMatched++;
      applyScore(match, event, nowIso);
    } else {
      clearFutureOpenfootballZeros(match, now);
    }
    refreshSearchText(match);
  }

  const manualApplied = await applyManualOverrides(matchesBox.root, nowIso);
  const standings = buildStandings(matchesBox.root, nowIso, teamArMap);
  const knockout = resolveKnockout([
    { name: 'matches.json', matches: matchesBox.matches },
    { name: 'bracket.json', matches: bracketBox.matches },
  ], standings, nowIso);

  sortMatchesList(matchesBox.matches);
  sortMatchesList(bracketBox.matches);

  matchesBox.root.metadata = {
    ...(matchesBox.root.metadata && typeof matchesBox.root.metadata === 'object' ? matchesBox.root.metadata : {}),
    source: 'local schedule + ESPN verified live/results updater',
    live_score_source: 'espn',
    live_score_url: ESPN_BASE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    last_data_change_at: scoreChanged || knockout.changed || manualApplied ? nowIso : (matchesBox.root.metadata?.last_data_change_at || matchesBox.root.metadata?.last_updated || nowIso),
    timezone: TIMEZONE,
    refresh_interval_minutes: REFRESH_MINUTES,
    espn_urls_checked: urls.length,
    espn_events_seen: events.length,
    espn_matches_applied: matched,
    bracket_matches_applied: bracketMatched,
    future_openfootball_zero_scores_cleared: clearedZeros,
    manual_overrides_applied: manualApplied,
    original_15_minute_workflow: true,
    knockout_integrated_patch: true,
    note_ar: 'التحديث يعمل من ملف التحديث الأصلي كل 15 دقيقة. تم دمج تحديث النتائج والأدوار داخل نفس السكربت بدون تغيير واجهة الموقع.',
  };

  if (!bracketBox.root.metadata || typeof bracketBox.root.metadata !== 'object') bracketBox.root.metadata = {};
  bracketBox.root.metadata = {
    ...bracketBox.root.metadata,
    last_checked_at: nowIso,
    last_updated: nowIso,
    timezone: TIMEZONE,
    live_score_source: 'espn',
    refresh_interval_minutes: REFRESH_MINUTES,
    knockout_integrated_patch: true,
    knockout_summary: knockout,
    note_ar: 'أسماء الأدوار والفائزين يتم تحديثها من داخل التحديث الأصلي كل 15 دقيقة.',
  };

  await writeJson('matches.json', matchesBox.arrayRoot ? matchesBox.matches : matchesBox.root);
  await writeJson('standings.json', standings);
  await writeJson('groups.json', {
    metadata: standings.metadata,
    groups: matchesBox.root.groups || oldGroups.groups || {},
    standings: standings.standings,
    best_thirds: standings.best_thirds,
  });
  await writeJson('bracket.json', bracketBox.arrayRoot ? bracketBox.matches : bracketBox.root);

  const errors = fetchResults.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error || `HTTP ${r.status}` })).slice(0, 15);
  const details = {
    espn_scoreboard: {
      ok: fetchResults.some((r) => r.ok),
      urls_checked: urls.length,
      events_seen: events.length,
      matched,
      bracket_matched: bracketMatched,
      score_changed: scoreChanged,
      future_openfootball_zero_scores_cleared: clearedZeros,
    },
    knockout,
    manual_overrides_applied: manualApplied,
    files_written: ['matches.json', 'standings.json', 'groups.json', 'bracket.json', 'heartbeat.json', 'update-check.json', 'version.json', 'deploy-marker.txt', 'update-errors.json'],
    errors,
  };
  await writeStatusFiles(nowIso, details);
  console.log(`[worldcup] original-15min urls=${urls.length} events=${events.length} matched=${matched} bracket=${bracketMatched} knockoutChanged=${knockout.changed} ${nowIso}`);
}

main().catch(async (error) => {
  console.error('[worldcup] updater failed:', error);
  try {
    const nowIso = jordanIso(new Date());
    await writeStatusFiles(nowIso, {
      espn_scoreboard: { ok: false, error: error.message },
      knockout: { changed: 0, error: error.message },
      files_written: ['heartbeat.json', 'update-check.json', 'version.json', 'deploy-marker.txt', 'update-errors.json'],
      errors: [{ error: error.stack || error.message }],
    });
  } catch {}
  process.exitCode = 1;
});
