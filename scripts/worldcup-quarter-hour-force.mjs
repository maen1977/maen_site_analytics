import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200';

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(date).replace(' ', 'T') + '+03:00';
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date).replace(/-/g, '');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/republic of/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const ALIASES = new Map(Object.entries({
  usa: 'unitedstates',
  usmnt: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  korea: 'southkorea',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  southkorea: 'southkorea',
  czechia: 'czechrepublic',
  czechrepublic: 'czechrepublic',
  bosniaherzegovina: 'bosniaandherzegovina',
  bosniaandherzegovina: 'bosniaandherzegovina',
  drcongo: 'democraticrepublicofcongo',
  democraticrepubliccongo: 'democraticrepublicofcongo',
  congodr: 'democraticrepublicofcongo',
  ivorycoast: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  curacao: 'curacao',
  curaçao: 'curacao'
}));

function teamKey(value) {
  const key = normalize(value);
  return ALIASES.get(key) || key;
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function eventUrlWithDate(baseUrl, yyyymmdd) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', url.searchParams.get('limit') || '200');
    url.searchParams.set('dates', yyyymmdd);
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}limit=200&dates=${yyyymmdd}`;
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Maensat-WorldCup-2026-Updater/2.0',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json(), status: res.status };
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
    const homeScore = scoreNumber(home.score);
    const awayScore = scoreNumber(away.score);
    const completed = Boolean(status.completed);
    const state = String(status.state || '').toLowerCase();
    const statusName = status.name || status.description || status.detail || '';

    return {
      source: 'espn',
      id: String(e.id || ''),
      date: e.date || comp.date || '',
      home: home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '',
      away: away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '',
      homeKey: teamKey(home.team?.displayName || home.team?.shortDisplayName || home.team?.name || ''),
      awayKey: teamKey(away.team?.displayName || away.team?.shortDisplayName || away.team?.name || ''),
      home_score: homeScore,
      away_score: awayScore,
      status: completed ? 'finished' : (state === 'in' || state === 'live') ? 'live' : 'scheduled',
      status_detail: statusName,
      clock: comp.status?.displayClock || e.status?.displayClock || ''
    };
  }).filter((event) => event.homeKey && event.awayKey);
}

function sameTeams(match, event) {
  const a = teamKey(match.team1 || match.home_team || match.homeTeam || match.team1_en || '');
  const b = teamKey(match.team2 || match.away_team || match.awayTeam || match.team2_en || '');
  if (!a || !b) return false;
  return (a === event.homeKey && b === event.awayKey) || (a === event.awayKey && b === event.homeKey);
}

function sameTimeWindow(match, event) {
  const mt = matchDateMs(match);
  const et = eventDateMs(event);
  if (!Number.isFinite(mt) || !Number.isFinite(et)) return true;
  return Math.abs(mt - et) <= 36 * 60 * 60 * 1000;
}

function findEspnMatch(match, events) {
  const explicitIds = [
    match?.espn_id,
    match?.espn_event_id,
    match?.event_id,
    match?.score?.event_id
  ].filter(Boolean).map(String);

  if (explicitIds.length) {
    const byId = events.find((event) => explicitIds.includes(String(event.id)));
    if (byId) return byId;
  }

  return events.find((event) => sameTeams(match, event) && sameTimeWindow(match, event)) || null;
}

function applyScore(match, event, nowIso) {
  const matchA = teamKey(match.team1 || match.home_team || match.homeTeam || '');
  const sameOrder = matchA && matchA === event.homeKey;
  const homeScore = sameOrder ? event.home_score : event.away_score;
  const awayScore = sameOrder ? event.away_score : event.home_score;

  match.status = event.status;
  if (homeScore !== null) match.home_score = homeScore;
  if (awayScore !== null) match.away_score = awayScore;
  match.score_source = 'espn';
  match.live_status_detail = event.status_detail || event.status;
  match.last_live_update = nowIso;
  match.score = {
    ...(match.score && typeof match.score === 'object' ? match.score : {}),
    source: 'espn',
    event_id: event.id,
    status_detail: event.status_detail,
    clock: event.clock,
    checked_at: nowIso,
    current: [match.home_score ?? 0, match.away_score ?? 0]
  };

  if (event.status === 'finished') {
    match.score.ft = [match.home_score ?? 0, match.away_score ?? 0];
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(WC_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

function applyManualOverrides(data, overrides, nowIso) {
  let count = 0;
  const results = Array.isArray(overrides?.results) ? overrides.results : [];
  for (const override of results) {
    const target = data.matches.find((m) =>
      (override.id && m.id === override.id) ||
      (override.num != null && Number(m.num) === Number(override.num))
    );
    if (!target) continue;
    Object.assign(target, override, {
      last_live_update: override.last_live_update || nowIso,
      score_source: override.score_source || 'manual-override'
    });
    count++;
  }
  return count;
}

function refreshSearchText(match) {
  match.search_text = [
    match.team1 || match.home_team,
    match.team2 || match.away_team,
    match.team1_ar,
    match.team2_ar,
    match.stadium,
    match.ground,
    match.round,
    match.stage,
    match.stage_ar,
    match.group ? `Group ${match.group}` : '',
    match.num ? `Match ${match.num}` : ''
  ].filter(Boolean).join(' ');
}

function sortMatches(data) {
  data.matches.sort((a, b) => {
    const numA = Number(a.num || String(a.id || '').replace(/^M/i, '') || 9999);
    const numB = Number(b.num || String(b.id || '').replace(/^M/i, '') || 9999);
    return numA - numB;
  });
}

async function writeStatusFiles(nowIso, details) {
  const next = new Date(Date.now() + 15 * 60 * 1000);
  const nextIso = jordanIso(next);
  const version = crypto.createHash('sha1').update(`${nowIso}:${JSON.stringify(details)}`).digest('hex').slice(0, 12);

  const heartbeat = {
    name: 'Maensat World Cup 2026 quarter-hour forced check',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: 15,
    source: 'github-actions',
    checks: details,
    cache_buster: version,
    note_ar: 'يتغير هذا الملف في كل تشغيل حتى يعرف الموقع أن هناك فحصاً جديداً للنتائج.'
  };

  await fs.writeFile(path.join(WC_DIR, 'heartbeat.json'), JSON.stringify(heartbeat, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'version.json'), JSON.stringify({
    version,
    generated_at: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: 15,
    checks: details
  }, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'deploy-marker.txt'), `worldcup-check=${nowIso}\ncache=${version}\n`);
}

async function main() {
  const now = new Date();
  const nowIso = jordanIso(now);

  const dateOffsets = [-2, -1, 0, 1, 2];
  const urls = [ESPN_BASE, ...dateOffsets.map((offset) => eventUrlWithDate(ESPN_BASE, dateKey(addDays(now, offset))))];
  const uniqueUrls = [...new Set(urls)];

  const fetchResults = await Promise.all(uniqueUrls.map(async (url) => ({ url, ...(await fetchJson(url)) })));
  const espnEvents = [];
  for (const result of fetchResults) {
    if (result.ok) espnEvents.push(...extractEspnEvents(result.data));
  }

  const seen = new Set();
  const events = espnEvents.filter((event) => {
    const key = event.id || `${event.date}:${event.homeKey}:${event.awayKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const matchesPath = path.join(WC_DIR, 'matches.json');
  const data = await readJson('matches.json', { matches: [] });
  if (!Array.isArray(data.matches)) data.matches = [];

  let updated = 0;
  let matched = 0;
  for (const match of data.matches) {
    const event = findEspnMatch(match, events);
    if (event) {
      applyScore(match, event, nowIso);
      matched++;
      updated++;
    }
    refreshSearchText(match);
  }

  const manualOverrides = await readJson('manual-results-overrides.json', { results: [] });
  const manualApplied = applyManualOverrides(data, manualOverrides, nowIso);

  data.metadata = {
    ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
    last_checked_at: nowIso,
    last_updated: updated || manualApplied ? nowIso : (data.metadata?.last_updated || nowIso),
    score_sources: ['espn', 'manual-overrides'],
    espn_events_seen: events.length,
    espn_matches_applied: matched,
    manual_overrides_applied: manualApplied
  };

  sortMatches(data);
  await fs.writeFile(matchesPath, JSON.stringify(data, null, 2));

  await writeStatusFiles(nowIso, {
    espn_scoreboard: {
      ok: fetchResults.some((r) => r.ok),
      urls_checked: uniqueUrls.length,
      events_seen: events.length,
      matched,
      errors: fetchResults.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error || `HTTP ${r.status}` })).slice(0, 5)
    },
    files_written: ['matches.json', 'heartbeat.json', 'version.json', 'deploy-marker.txt'],
    manual_overrides_applied: manualApplied
  });

  console.log(`[worldcup] ESPN events=${events.length} matched=${matched} updated=${updated} manual=${manualApplied} ${nowIso}`);
}

main().catch((error) => {
  console.error('[worldcup] updater failed:', error);
  process.exitCode = 1;
});
