import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';
const START_DATE = process.env.WORLD_CUP_2026_START_DATE || '2026-06-11';
const END_DATE = process.env.WORLD_CUP_2026_END_DATE || '2026-07-19';
const REFRESH_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);
const CLEAR_STALE_UNVERIFIED = process.env.WORLD_CUP_2026_KEEP_UNVERIFIED_SCORES !== '1';

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(date).replace(' ', 'T') + '+03:00';
}

function ymd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
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
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return date;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/\b(fc|cf|sc|nt|team|national|republic of)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
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
  netherlands: 'netherlands',
  holland: 'netherlands',
  turkey: 'turkey',
  turkiye: 'turkey',
  uae: 'unitedarabemirates',
  unitedarabemirates: 'unitedarabemirates'
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

function matchNumber(match) {
  const raw = match?.num ?? match?.match_number ?? match?.matchNo ?? String(match?.id || '').replace(/^M/i, '');
  const n = Number(String(raw || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 999999;
}

function eventUrlWithDates(baseUrl, start, end) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', url.searchParams.get('limit') || '950');
    const range = `${ymdCompact(start)}-${ymdCompact(end)}`;
    url.searchParams.set('dates', range);
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

  // Scan the whole played part of the tournament, not only today's ESPN board.
  let cursor = new Date(tournamentStart);
  while (cursor <= scanEnd) {
    const end = new Date(Math.min(addDays(cursor, 6).getTime(), scanEnd.getTime()));
    urls.add(eventUrlWithDates(ESPN_BASE, cursor, end));
    cursor = addDays(end, 1);
  }

  // Extra daily checks around today improve live/near-live matching if ESPN ignores ranges.
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
        'User-Agent': 'Maensat-WorldCup-2026-Updater/3.0',
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
    const name = status.name || status.description || status.detail || status.shortDetail || '';

    const homeName = home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '';
    const awayName = away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '';

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
      status: completed ? 'finished' : (state === 'in' || state === 'live') ? 'live' : 'scheduled',
      status_detail: name,
      clock: comp.status?.displayClock || e.status?.displayClock || '',
      rawState: state
    };
  }).filter((event) => event.homeKey && event.awayKey && event.date);
}

function matchTeamKeys(match) {
  const team1 = teamKey(match.team1 || match.home_team || match.homeTeam || match.team1_en || '');
  const team2 = teamKey(match.team2 || match.away_team || match.awayTeam || match.team2_en || '');
  return { team1, team2 };
}

function sameTeams(match, event) {
  const { team1, team2 } = matchTeamKeys(match);
  if (!team1 || !team2) return false;
  return (team1 === event.homeKey && team2 === event.awayKey) || (team1 === event.awayKey && team2 === event.homeKey);
}

function timeDiffMs(match, event) {
  const mt = matchDateMs(match);
  const et = eventDateMs(event);
  if (!Number.isFinite(mt) || !Number.isFinite(et)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(mt - et);
}

function findEspnMatch(match, events) {
  const explicitIds = [match?.espn_id, match?.espn_event_id, match?.event_id, match?.score?.event_id]
    .filter(Boolean).map(String);
  if (explicitIds.length) {
    const byId = events.find((event) => explicitIds.includes(String(event.id)));
    if (byId) return byId;
  }

  const candidates = events
    .filter((event) => sameTeams(match, event))
    .map((event) => ({ event, diff: timeDiffMs(match, event) }))
    .filter((row) => row.diff <= 54 * 60 * 60 * 1000 || row.diff === Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a.diff - b.diff);

  return candidates[0]?.event || null;
}

function applyScore(match, event, nowIso) {
  const { team1 } = matchTeamKeys(match);
  const sameOrder = team1 && team1 === event.homeKey;
  const team1Score = sameOrder ? event.home_score : event.away_score;
  const team2Score = sameOrder ? event.away_score : event.home_score;

  match.espn_event_id = event.id || match.espn_event_id;
  match.status = event.status;
  if (team1Score !== null) match.home_score = team1Score;
  if (team2Score !== null) match.away_score = team2Score;
  match.score_source = 'espn';
  match.live_score_source = 'espn';
  match.live_status_detail = event.status_detail || event.status;
  match.live_clock = event.clock || null;
  match.live_checked_at = nowIso;
  match.last_live_update = nowIso;

  const currentPair = [match.home_score ?? 0, match.away_score ?? 0];
  match.score = {
    source: 'espn',
    event_id: event.id,
    status_detail: event.status_detail,
    clock: event.clock || null,
    checked_at: nowIso,
    current: currentPair
  };

  if (event.status === 'finished') {
    match.score.ft = currentPair;
  } else if (event.status === 'live') {
    match.score.live = currentPair;
  }
}

function clearUnverifiedPastScore(match, now, reason = 'unverified_score_removed') {
  const kickoff = matchDateMs(match);
  if (!Number.isFinite(kickoff)) return false;
  const endedLongAgo = now.getTime() - kickoff > 3.5 * 60 * 60 * 1000;
  if (!endedLongAgo) return false;

  const source = String(match.score_source || match.live_score_source || match.score?.source || '').toLowerCase();
  if (source === 'espn') return false;

  match.status = 'pending_verification';
  match.home_score = null;
  match.away_score = null;
  match.score = null;
  match.score_source = 'pending-verification';
  match.live_score_source = '';
  match.live_status_detail = 'بانتظار نتيجة موثوقة من ESPN';
  match.unverified_result_note = reason;
  return true;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(WC_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

function lockedManualOverrides(overrides) {
  const results = Array.isArray(overrides?.results) ? overrides.results : [];
  return results.filter((override) => override && (override.locked === true || override.force === true || override.verified === true));
}

function applyManualOverrides(data, overrides, nowIso, matchedIds) {
  let count = 0;
  for (const override of lockedManualOverrides(overrides)) {
    const target = data.matches.find((m) =>
      (override.id && m.id === override.id) ||
      (override.num != null && Number(m.num) === Number(override.num))
    );
    if (!target) continue;
    const alreadyUpdatedByEspn = matchedIds.has(target.id) || (target.espn_event_id && matchedIds.has(String(target.espn_event_id)));
    if (alreadyUpdatedByEspn && override.prefer_espn !== false) continue;

    Object.assign(target, override, {
      last_live_update: override.last_live_update || nowIso,
      score_source: override.score_source || 'manual-override',
      manual_override_locked: true
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

function hasVerifiedResult(match) {
  const source = String(match.score_source || match.live_score_source || match.score?.source || '').toLowerCase();
  const hasScore = match.home_score !== null && match.home_score !== undefined && match.away_score !== null && match.away_score !== undefined;
  const finished = String(match.status || '').toLowerCase().includes('finished') || Boolean(match.score?.ft);
  return hasScore && finished && (source === 'espn' || source === 'manual-override');
}

function buildStandings(data, nowIso) {
  const groups = data.groups || {};
  const standings = [];

  for (const group of Object.keys(groups).sort()) {
    const rows = new Map();
    for (const team of groups[group] || []) {
      rows.set(team, {
        team,
        team_ar: data.team_ar?.[team] || '',
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
        qualified: false
      });
    }

    const groupMatches = (data.matches || []).filter((m) => m.group === group && String(m.stage || '').toLowerCase().includes('group') && hasVerifiedResult(m));
    for (const m of groupMatches) {
      if (!rows.has(m.team1)) rows.set(m.team1, { team: m.team1, team_ar: data.team_ar?.[m.team1] || '', group, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0, rank: 0, qualified: false });
      if (!rows.has(m.team2)) rows.set(m.team2, { team: m.team2, team_ar: data.team_ar?.[m.team2] || '', group, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0, rank: 0, qualified: false });
      const a = rows.get(m.team1);
      const b = rows.get(m.team2);
      const hs = Number(m.home_score || 0);
      const as = Number(m.away_score || 0);
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
    .map((g) => g.rows[2]).filter(Boolean)
    .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, qualified: index < 8 }));

  return {
    metadata: {
      name: data.metadata?.name || 'كأس العالم 2026',
      english_name: data.metadata?.english_name || 'World Cup 2026',
      source: 'ESPN verified results + local schedule',
      last_checked_at: nowIso,
      last_updated: nowIso,
      timezone: TIMEZONE,
      total_matches: data.matches?.length || 0,
      teams_count: Object.values(groups).flat().length,
      groups_count: Object.keys(groups).length,
      verified_results_only: true,
      note_ar: 'تم احتساب الترتيب من النتائج الموثقة فقط. النتائج غير المطابقة مع ESPN لا تدخل في ترتيب المجموعات.'
    },
    standings,
    best_thirds: bestThirds
  };
}

function sortMatches(data) {
  data.matches.sort((a, b) => {
    const ta = matchDateMs(a);
    const tb = matchDateMs(b);
    return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER) || matchNumber(a) - matchNumber(b);
  });
}

function shallowScoreSnapshot(match) {
  return JSON.stringify({
    id: match.id,
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    score: match.score,
    score_source: match.score_source,
    espn_event_id: match.espn_event_id
  });
}

async function writeStatusFiles(nowIso, details) {
  const next = new Date(Date.now() + REFRESH_MINUTES * 60 * 1000);
  const nextIso = jordanIso(next);
  const version = crypto.createHash('sha1').update(`${nowIso}:${JSON.stringify(details)}`).digest('hex').slice(0, 12);

  const status = {
    name: 'Maensat World Cup 2026 quarter-hour forced check',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: REFRESH_MINUTES,
    source: 'github-actions',
    github: {
      run_id: process.env.GITHUB_RUN_ID || '',
      run_number: process.env.GITHUB_RUN_NUMBER || '',
      workflow: process.env.GITHUB_WORKFLOW || '',
      event_name: process.env.GITHUB_EVENT_NAME || '',
      repository: process.env.GITHUB_REPOSITORY || '',
      ref: process.env.GITHUB_REF || '',
      sha: process.env.GITHUB_SHA || '',
      trigger_source: process.env.WORLD_CUP_2026_TRIGGER_SOURCE || ''
    },
    checks: details,
    cache_buster: version,
    note_ar: 'يتغير هذا الملف في كل تشغيل حتى يعرف الموقع أن هناك فحصاً جديداً للنتائج.'
  };

  await fs.writeFile(path.join(WC_DIR, 'heartbeat.json'), JSON.stringify(status, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'update-check.json'), JSON.stringify({ ...status, errors: details.errors || [] }, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'version.json'), JSON.stringify({
    version,
    generated_at: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: REFRESH_MINUTES,
    checks: details
  }, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'deploy-marker.txt'), `worldcup-check=${nowIso}\ncache=${version}\nmatched=${details?.espn_scoreboard?.matched || 0}\n`);
  await fs.writeFile(path.join(WC_DIR, 'update-errors.json'), JSON.stringify(details.errors || [], null, 2));
}

async function main() {
  const now = new Date();
  const nowIso = jordanIso(now);
  await fs.mkdir(WC_DIR, { recursive: true });

  const urls = buildEspnUrls(now);
  const fetchResults = await Promise.all(urls.map(async (url) => ({ url, ...(await fetchJson(url)) })));
  const rawEvents = [];
  for (const result of fetchResults) {
    if (result.ok) rawEvents.push(...extractEspnEvents(result.data));
  }

  const seen = new Set();
  const events = rawEvents.filter((event) => {
    const key = event.id || `${event.date}:${event.homeKey}:${event.awayKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const data = await readJson('matches.json', { matches: [] });
  if (!Array.isArray(data.matches)) data.matches = [];

  const before = new Map(data.matches.map((m) => [m.id || String(matchNumber(m)), shallowScoreSnapshot(m)]));
  let matched = 0;
  let changed = 0;
  let cleared = 0;
  const matchedIds = new Set();
  const unmatchedPast = [];

  for (const match of data.matches) {
    const event = findEspnMatch(match, events);
    if (event) {
      applyScore(match, event, nowIso);
      matched++;
      if (match.id) matchedIds.add(match.id);
      if (event.id) matchedIds.add(String(event.id));
    } else if (CLEAR_STALE_UNVERIFIED && clearUnverifiedPastScore(match, now)) {
      cleared++;
      unmatchedPast.push({ id: match.id, num: match.num, team1: match.team1, team2: match.team2, kickoff_utc: match.kickoff_utc });
    }
    refreshSearchText(match);

    const key = match.id || String(matchNumber(match));
    if (before.get(key) !== shallowScoreSnapshot(match)) changed++;
  }

  const manualOverrides = await readJson('manual-results-overrides.json', { results: [] });
  const manualApplied = applyManualOverrides(data, manualOverrides, nowIso, matchedIds);

  data.metadata = {
    ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
    source: 'local schedule + ESPN verified live/results updater',
    live_score_source: 'espn',
    live_score_url: ESPN_BASE,
    last_checked_at: nowIso,
    last_updated: changed || manualApplied ? nowIso : (data.metadata?.last_updated || nowIso),
    last_data_change_at: changed || manualApplied ? nowIso : (data.metadata?.last_data_change_at || data.metadata?.last_updated || nowIso),
    timezone: TIMEZONE,
    refresh_interval_minutes: REFRESH_MINUTES,
    espn_urls_checked: urls.length,
    espn_events_seen: events.length,
    espn_matches_applied: matched,
    stale_unverified_scores_cleared: cleared,
    manual_overrides_applied: manualApplied,
    verified_results_only: true,
    note_ar: 'تم إيقاف الاعتماد على نتائج openfootball القديمة داخل النتائج. يتم عرض النتيجة فقط إذا طابقت ESPN أو كانت تصحيحاً يدوياً موثقاً locked/force/verified.'
  };

  sortMatches(data);
  const standings = buildStandings(data, nowIso);

  await fs.writeFile(path.join(WC_DIR, 'matches.json'), JSON.stringify(data, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'standings.json'), JSON.stringify(standings, null, 2));
  await fs.writeFile(path.join(WC_DIR, 'groups.json'), JSON.stringify({
    metadata: standings.metadata,
    groups: data.groups || {},
    standings: standings.standings
  }, null, 2));

  const errors = fetchResults.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error || `HTTP ${r.status}` })).slice(0, 10);
  await writeStatusFiles(nowIso, {
    espn_scoreboard: {
      ok: fetchResults.some((r) => r.ok),
      urls_checked: urls.length,
      events_seen: events.length,
      matched,
      changed,
      stale_unverified_scores_cleared: cleared,
      unmatched_past_count: unmatchedPast.length,
      unmatched_past_sample: unmatchedPast.slice(0, 10)
    },
    manual_overrides_applied: manualApplied,
    files_written: ['matches.json', 'standings.json', 'groups.json', 'heartbeat.json', 'update-check.json', 'version.json', 'deploy-marker.txt', 'update-errors.json'],
    errors
  });

  console.log(`[worldcup] urls=${urls.length} espnEvents=${events.length} matched=${matched} changed=${changed} cleared=${cleared} manual=${manualApplied} ${nowIso}`);
}

main().catch(async (error) => {
  console.error('[worldcup] updater failed:', error);
  try {
    const nowIso = jordanIso(new Date());
    await writeStatusFiles(nowIso, {
      espn_scoreboard: { ok: false, error: error.message },
      files_written: ['heartbeat.json', 'update-check.json', 'version.json', 'deploy-marker.txt', 'update-errors.json'],
      errors: [{ error: error.stack || error.message }]
    });
  } catch {}
  process.exitCode = 1;
});
