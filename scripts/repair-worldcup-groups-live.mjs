import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const MATCHES_FILE = path.join(WC_DIR, 'matches.json');
const STANDINGS_FILE = path.join(WC_DIR, 'standings.json');
const GROUPS_FILE = path.join(WC_DIR, 'groups.json');
const HEARTBEAT_FILE = path.join(WC_DIR, 'heartbeat.json');
const UPDATE_CHECK_FILE = path.join(WC_DIR, 'update-check.json');
const UPDATE_ERRORS_FILE = path.join(WC_DIR, 'update-errors.json');
const VERSION_FILE = path.join(WC_DIR, 'version.json');

const TIMEZONE = 'Asia/Amman';
const TOURNAMENT_START = process.env.WORLD_CUP_REPAIR_START || '2026-06-11';
const TOURNAMENT_END = process.env.WORLD_CUP_REPAIR_END || '2026-07-19';
const ESPN_BASE = process.env.WORLD_CUP_REPAIR_ESPN_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const FORCE_FULL = process.env.WORLD_CUP_REPAIR_FULL_RANGE === '1' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const STALE_HOURS_FOR_FULL_SCAN = Number(process.env.WORLD_CUP_REPAIR_STALE_HOURS || 18);
const WINDOW_DAYS = Number(process.env.WORLD_CUP_REPAIR_WINDOW_DAYS || 3);
const MAX_FULL_DAYS = Number(process.env.WORLD_CUP_REPAIR_MAX_FULL_DAYS || 60);

const TEAM_AR = {
  'Mexico':'المكسيك','South Africa':'جنوب أفريقيا','South Korea':'كوريا الجنوبية','Czech Republic':'التشيك','Canada':'كندا','Bosnia & Herzegovina':'البوسنة والهرسك','Qatar':'قطر','Switzerland':'سويسرا','Brazil':'البرازيل','Morocco':'المغرب','Haiti':'هايتي','Scotland':'اسكتلندا','USA':'أمريكا','Paraguay':'باراغواي','Australia':'أستراليا','Turkey':'تركيا','Germany':'ألمانيا','Curaçao':'كوراساو','Ivory Coast':'كوت ديفوار','Ecuador':'الإكوادور','Netherlands':'هولندا','Japan':'اليابان','Sweden':'السويد','Tunisia':'تونس','Belgium':'بلجيكا','Egypt':'مصر','Iran':'إيران','New Zealand':'نيوزيلندا','Spain':'إسبانيا','Cape Verde':'الرأس الأخضر','Saudi Arabia':'السعودية','Uruguay':'الأوروغواي','France':'فرنسا','Senegal':'السنغال','Iraq':'العراق','Norway':'النرويج','Argentina':'الأرجنتين','Algeria':'الجزائر','Austria':'النمسا','Jordan':'الأردن','Portugal':'البرتغال','DR Congo':'الكونغو الديمقراطية','Uzbekistan':'أوزبكستان','Colombia':'كولومبيا','England':'إنجلترا','Croatia':'كرواتيا','Ghana':'غانا','Panama':'بنما'
};

const TEAM_ALIASES = {
  'USA': ['United States', 'U.S.', 'USMNT', 'أمريكا', 'الولايات المتحدة', 'الولايات المتحده'],
  'South Korea': ['Korea Republic', 'Korea Rep', 'Republic of Korea', 'كوريا الجنوبية', 'كوريا الجنوبيه'],
  'Czech Republic': ['Czechia', 'Czech Rep', 'التشيك', 'تشيكيا'],
  'Bosnia & Herzegovina': ['Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnia', 'البوسنة', 'البوسنة والهرسك'],
  'Ivory Coast': ['Côte d’Ivoire', 'Cote d Ivoire', 'Côte dIvoire', 'CIV', 'ساحل العاج', 'كوت ديفوار'],
  'DR Congo': ['Congo DR', 'Democratic Republic of Congo', 'Congo, DR', 'الكونغو الديمقراطية', 'الكونغو الديموقراطية'],
  'Cape Verde': ['Cabo Verde', 'الرأس الأخضر', 'الراس الاخضر'],
  'Curaçao': ['Curacao', 'كوراساو'],
  'Saudi Arabia': ['KSA', 'السعودية', 'السعوديه'],
  'New Zealand': ['NZ', 'نيوزيلندا'],
  'England': ['إنجلترا', 'انجلترا'],
  'Jordan': ['الأردن', 'الاردن', 'النشامى'],
  'Egypt': ['مصر', 'الفراعنة'],
  'Morocco': ['المغرب', 'أسود الأطلس', 'اسود الاطلس'],
  'Algeria': ['الجزائر', 'الخضر'],
  'Tunisia': ['تونس'],
  'Qatar': ['قطر'],
  'Iraq': ['العراق'],
  'Iran': ['إيران', 'ايران']
};

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/&/g, ' and ')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value = '') {
  return normalizeText(value).replace(/\s+/g, '');
}

function unique(values) {
  return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
}

function teamAliases(team, teamAr) {
  return unique([team, teamAr, TEAM_AR[team], ...(TEAM_ALIASES[team] || []), ...(TEAM_ALIASES[teamAr] || [])]);
}

function teamKeySet(team, teamAr) {
  const out = new Set();
  for (const alias of teamAliases(team, teamAr)) {
    const norm = normalizeText(alias);
    const compact = compactText(alias);
    if (norm) out.add(norm);
    if (compact) out.add(compact);
  }
  return out;
}

function espnTeamNames(competitor = {}) {
  const team = competitor.team || {};
  return unique([
    team.displayName, team.shortDisplayName, team.name, team.location, team.nickname,
    team.abbreviation, competitor.displayName, competitor.shortDisplayName, competitor.name
  ]);
}

function competitorMatchesTeam(competitor, team, teamAr) {
  const keys = teamKeySet(team, teamAr);
  const names = espnTeamNames(competitor);
  for (const name of names) {
    const norm = normalizeText(name);
    const compact = compactText(name);
    if (keys.has(norm) || keys.has(compact)) return true;
    for (const key of keys) {
      if (key.length >= 5 && (norm.includes(key) || compact.includes(key))) return true;
      if (compact.length >= 5 && key.includes(compact)) return true;
    }
  }
  return false;
}

function dateKeyInJordan(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const pick = type => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function nowIsoJordan() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  }).formatToParts(now);
  const pick = type => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}+03:00`;
}

function parseDateSafe(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const out = [];
  let d = start;
  for (let i = 0; i <= MAX_FULL_DAYS && d <= end; i++) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

function matchDateKey(match = {}) {
  const raw = match.kickoff_utc || match.kickoff_jordan || match.date;
  const parsed = parseDateSafe(raw);
  if (parsed) return dateKeyInJordan(parsed);
  return String(match.date || '').slice(0, 10);
}

function hoursSince(value) {
  const d = parseDateSafe(value);
  if (!d) return Infinity;
  return Math.abs(Date.now() - d.getTime()) / 36e5;
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getMatches(bundle) {
  if (Array.isArray(bundle)) return bundle;
  if (Array.isArray(bundle?.matches)) return bundle.matches;
  if (Array.isArray(bundle?.fixtures)) return bundle.fixtures;
  return [];
}

function setMatches(bundle, matches) {
  if (Array.isArray(bundle)) return matches;
  return { ...(bundle || {}), matches };
}

function buildGroups(matches, existingGroupsBundle) {
  const fromFile = existingGroupsBundle?.groups && typeof existingGroupsBundle.groups === 'object' ? existingGroupsBundle.groups : null;
  if (fromFile && Object.keys(fromFile).length) return fromFile;
  const groups = {};
  for (const m of matches) {
    const group = String(m.group || '').replace(/^Group\s+/i, '').trim();
    if (!group) continue;
    groups[group] ||= [];
    for (const t of [m.team1, m.team2]) {
      if (t && !groups[group].includes(t)) groups[group].push(t);
    }
  }
  return groups;
}

function isFinalStatus(statusText = '') {
  return /final|full.?time|ft|post|complete|completed|STATUS_FINAL/i.test(statusText);
}

function isLiveStatus(statusText = '') {
  return /in|live|progress|halftime|half.?time|STATUS_IN_PROGRESS/i.test(statusText);
}

function espnEventStatus(event = {}) {
  const type = event.status?.type || event.competitions?.[0]?.status?.type || {};
  const blob = [type.name, type.state, type.description, type.detail, event.status?.displayClock].filter(Boolean).join(' ');
  if (type.completed || isFinalStatus(blob)) return 'finished';
  if (String(type.state || '').toLowerCase() === 'in' || isLiveStatus(blob)) return 'live';
  return 'scheduled';
}

function eventDateKey(event = {}) {
  const raw = event.date || event.competitions?.[0]?.date;
  const parsed = parseDateSafe(raw);
  return parsed ? dateKeyInJordan(parsed) : '';
}

function dateDistance(a, b) {
  if (!a || !b) return 9;
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(Math.round((da - db) / 86400000));
}

function eventCompetitors(event = {}) {
  return event.competitions?.[0]?.competitors || [];
}

function matchEventScore(match, event) {
  const comps = eventCompetitors(event);
  if (comps.length < 2) return null;
  const [c0, c1] = comps;
  const m1c0 = competitorMatchesTeam(c0, match.team1, match.team1_ar || TEAM_AR[match.team1]);
  const m2c1 = competitorMatchesTeam(c1, match.team2, match.team2_ar || TEAM_AR[match.team2]);
  const m1c1 = competitorMatchesTeam(c1, match.team1, match.team1_ar || TEAM_AR[match.team1]);
  const m2c0 = competitorMatchesTeam(c0, match.team2, match.team2_ar || TEAM_AR[match.team2]);
  let orientation = null;
  if (m1c0 && m2c1) orientation = [c0, c1];
  else if (m1c1 && m2c0) orientation = [c1, c0];
  if (!orientation) return null;
  const dd = dateDistance(matchDateKey(match), eventDateKey(event));
  if (dd > 2) return null;
  return { score: 200 - dd * 15, team1Comp: orientation[0], team2Comp: orientation[1], dateDistance: dd };
}

function toIntScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function updateMatchFromEvent(match, event, mapping, checkedAt) {
  const status = espnEventStatus(event);
  const s1 = toIntScore(mapping.team1Comp.score);
  const s2 = toIntScore(mapping.team2Comp.score);
  const updated = { ...match };
  const before = JSON.stringify({ status: match.status, home_score: match.home_score, away_score: match.away_score, score: match.score, espn_id: match.espn_id });
  updated.espn_id = event.id || updated.espn_id || null;
  updated.last_score_check_at = checkedAt;
  updated.score_source = 'espn';
  updated.home_score = s1;
  updated.away_score = s2;
  updated.live_status_detail = event.status?.type?.detail || event.status?.type?.description || event.competitions?.[0]?.status?.type?.description || null;
  updated.live_clock = event.status?.displayClock || event.competitions?.[0]?.status?.displayClock || null;

  if (status === 'finished') {
    updated.status = 'finished';
    updated.score = { ft: [s1, s2], source: 'espn', updated_at: checkedAt, espn_id: event.id || null };
  } else if (status === 'live') {
    updated.status = 'live';
    updated.score = { ...(updated.score || {}), live: [s1, s2], source: 'espn', updated_at: checkedAt, espn_id: event.id || null };
  } else if (!updated.status || updated.status === 'scheduled') {
    updated.status = 'scheduled';
  }
  const after = JSON.stringify({ status: updated.status, home_score: updated.home_score, away_score: updated.away_score, score: updated.score, espn_id: updated.espn_id });
  return { updated, changed: before !== after, status };
}

async function fetchEspnEventsForDate(dateKey) {
  const ymd = dateKey.replace(/-/g, '');
  const url = `${ESPN_BASE}?dates=${encodeURIComponent(ymd)}&limit=100`;
  const res = await fetch(url, { headers: { 'accept': 'application/json', 'user-agent': 'maensat-worldcup-groups-repair/1.0' } });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${dateKey}`);
  const json = await res.json();
  return Array.isArray(json.events) ? json.events : [];
}

function pickDateKeys(matches, metadata = {}) {
  const today = process.env.WORLD_CUP_REPAIR_TODAY || dateKeyInJordan(new Date());
  const last = metadata.last_checked_at || metadata.last_updated || metadata.generated_at;
  const full = FORCE_FULL || hoursSince(last) >= STALE_HOURS_FOR_FULL_SCAN;
  if (full) return { full: true, dates: daysBetween(TOURNAMENT_START, TOURNAMENT_END) };
  const dates = new Set();
  for (let i = -WINDOW_DAYS; i <= WINDOW_DAYS; i++) dates.add(addDays(today, i));
  for (const m of matches) {
    const d = matchDateKey(m);
    if (!d) continue;
    const status = String(m.status || '').toLowerCase();
    if (status !== 'finished' && dateDistance(d, today) <= WINDOW_DAYS + 1) dates.add(d);
  }
  return { full: false, dates: [...dates].filter(d => d >= TOURNAMENT_START && d <= TOURNAMENT_END).sort() };
}

function emptyRow(team, group) {
  return {
    team,
    team_ar: TEAM_AR[team] || team,
    group,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_diff: 0,
    points: 0,
    rank: null,
    qualified: false,
    current_qualifying: false
  };
}

function isFinishedMatch(match = {}) {
  const status = String(match.status || '').toLowerCase();
  const score = match.score || {};
  return status === 'finished' || status === 'ft' || Boolean(score.ft || score.et || score.p);
}

function getFinalScore(match = {}) {
  const score = match.score || {};
  const final = Array.isArray(score.ft) ? score.ft : (Array.isArray(score.et) ? score.et : null);
  if (final && Number.isFinite(Number(final[0])) && Number.isFinite(Number(final[1]))) return [Number(final[0]), Number(final[1])];
  return [Number(match.home_score || 0), Number(match.away_score || 0)];
}

function computeStandings(matches, groups) {
  const standings = [];
  for (const group of Object.keys(groups).sort()) {
    const teams = groups[group] || [];
    const groupMatches = matches.filter(m => String(m.group || '').replace(/^Group\s+/i, '') === group);
    const map = new Map(teams.map(team => [team, emptyRow(team, group)]));
    for (const match of groupMatches.filter(isFinishedMatch)) {
      const a = map.get(match.team1);
      const b = map.get(match.team2);
      if (!a || !b) continue;
      const [s1, s2] = getFinalScore(match);
      a.played += 1;
      b.played += 1;
      a.goals_for += s1;
      a.goals_against += s2;
      b.goals_for += s2;
      b.goals_against += s1;
      if (s1 > s2) { a.wins += 1; b.losses += 1; a.points += 3; }
      else if (s2 > s1) { b.wins += 1; a.losses += 1; b.points += 3; }
      else { a.draws += 1; b.draws += 1; a.points += 1; b.points += 1; }
    }
    for (const row of map.values()) row.goal_diff = row.goals_for - row.goals_against;
    const rows = [...map.values()].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || normalizeText(a.team).localeCompare(normalizeText(b.team)));
    const complete = groupMatches.length >= 6 && groupMatches.every(isFinishedMatch);
    rows.forEach((row, index) => {
      row.rank = index + 1;
      row.current_qualifying = index < 2;
      row.qualified = complete && index < 2;
    });
    standings.push({ group, complete, rows });
  }

  const allGroupsComplete = standings.length >= 12 && standings.every(g => g.complete);
  const bestThirds = standings.map(g => g.rows[2]).filter(Boolean).sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || normalizeText(a.team).localeCompare(normalizeText(b.team)));
  bestThirds.forEach((row, index) => {
    row.best_third_rank = index + 1;
    row.current_best_third_qualifying = index < 8;
    if (allGroupsComplete && index < 8) row.qualified = true;
  });

  // Copy the best-third flags back into the group rows explicitly.
  const thirdStatusByTeam = new Map(bestThirds.map(row => [`${row.group}|${row.team}`, row]));
  for (const group of standings) {
    for (const row of group.rows) {
      const third = thirdStatusByTeam.get(`${row.group}|${row.team}`);
      if (third) {
        row.best_third_rank = third.best_third_rank;
        row.current_best_third_qualifying = third.current_best_third_qualifying;
        row.qualified = Boolean(row.qualified || third.qualified);
      }
    }
  }
  return { standings, best_thirds: bestThirds, all_groups_complete: allGroupsComplete };
}

function nextMatches(matches, limit = 6) {
  const now = Date.now();
  return matches
    .filter(m => !isFinishedMatch(m))
    .map(m => ({ ...m, _ms: new Date(m.kickoff_utc || m.kickoff_jordan || m.date || 0).getTime() }))
    .filter(m => Number.isFinite(m._ms) && m._ms >= now - 3 * 3600000)
    .sort((a, b) => a._ms - b._ms)
    .slice(0, limit)
    .map(({ _ms, ...m }) => m);
}

async function main() {
  await fs.mkdir(WC_DIR, { recursive: true });
  const checkedAt = nowIsoJordan();
  const matchesBundleOriginal = await readJson(MATCHES_FILE, { metadata: {}, matches: [] });
  let matchesBundle = matchesBundleOriginal;
  let matches = getMatches(matchesBundle).map(m => ({ ...m, group: String(m.group || '').replace(/^Group\s+/i, '') }));
  const groupsBundle = await readJson(GROUPS_FILE, {});
  const groups = buildGroups(matches, groupsBundle);
  const selection = pickDateKeys(matches, matchesBundle.metadata || {});

  const errors = [];
  const events = [];
  for (const dateKey of selection.dates) {
    try {
      const dayEvents = await fetchEspnEventsForDate(dateKey);
      events.push(...dayEvents);
    } catch (error) {
      errors.push({ date: dateKey, message: error.message });
    }
  }

  let changedMatches = 0;
  let matchedEvents = 0;
  const usedMatchIndexes = new Set();
  for (const event of events) {
    let best = null;
    for (let i = 0; i < matches.length; i++) {
      if (usedMatchIndexes.has(i)) continue;
      const mapping = matchEventScore(matches[i], event);
      if (!mapping) continue;
      if (!best || mapping.score > best.mapping.score) best = { index: i, mapping };
    }
    if (!best || best.mapping.score < 160) continue;
    const result = updateMatchFromEvent(matches[best.index], event, best.mapping, checkedAt);
    matches[best.index] = result.updated;
    usedMatchIndexes.add(best.index);
    matchedEvents += 1;
    if (result.changed) changedMatches += 1;
  }

  const computed = computeStandings(matches, groups);

  matchesBundle = setMatches(matchesBundle, matches);
  matchesBundle.metadata = {
    ...(matchesBundle.metadata || {}),
    name: matchesBundle.metadata?.name || 'كأس العالم 2026',
    english_name: matchesBundle.metadata?.english_name || 'World Cup 2026',
    source: 'openfootball/worldcup.json + ESPN live scoreboard + MaenSat groups repair',
    live_score_source: 'espn',
    live_score_url: ESPN_BASE,
    timezone: TIMEZONE,
    last_checked_at: checkedAt,
    last_updated: changedMatches ? checkedAt : (matchesBundle.metadata?.last_updated || checkedAt),
    total_matches: matches.length,
    groups_count: Object.keys(groups).length,
    teams_count: unique(Object.values(groups).flat()).length,
    groups_live_repair: {
      enabled: true,
      checked_at: checkedAt,
      full_range_scan: selection.full,
      checked_dates: selection.dates,
      espn_events_seen: events.length,
      espn_events_matched: matchedEvents,
      changed_matches: changedMatches,
      errors_count: errors.length,
      note_ar: 'إصلاح خاص لقسم كأس العالم: تحديث النتائج والترتيب للمجموعات من ESPN، مع إعادة بناء standings.json وكسر الكاش.'
    }
  };

  const standingsBundle = {
    metadata: {
      name: 'كأس العالم 2026',
      english_name: 'World Cup 2026',
      source: 'ESPN live scoreboard + MaenSat group standings repair',
      last_checked_at: checkedAt,
      last_updated: checkedAt,
      timezone: TIMEZONE,
      total_matches: matches.length,
      teams_count: unique(Object.values(groups).flat()).length,
      groups_count: Object.keys(groups).length,
      all_groups_complete: computed.all_groups_complete,
      repair_version: 'maensat-worldcup-groups-repair-2026-06-28',
      note_ar: 'تم احتساب ترتيب المجموعات تلقائياً من نتائج المباريات الموثقة، مع تصحيح تأهل أفضل الثوالث داخل جدول المجموعات نفسه.'
    },
    standings: computed.standings,
    best_thirds: computed.best_thirds
  };

  const groupTeamAr = Object.fromEntries(unique(Object.values(groups).flat()).map(team => [team, TEAM_AR[team] || team]));
  const newGroupsBundle = {
    ...(groupsBundle || {}),
    metadata: {
      ...(groupsBundle?.metadata || {}),
      name: groupsBundle?.metadata?.name || 'كأس العالم 2026',
      english_name: groupsBundle?.metadata?.english_name || 'FIFA World Cup 2026',
      last_checked_at: checkedAt,
      last_updated: checkedAt,
      timezone: TIMEZONE,
      groups_count: Object.keys(groups).length,
      teams_count: unique(Object.values(groups).flat()).length,
      update_note_ar: 'تحديث إصلاحي لقسم المجموعات داخل كأس العالم؛ ملفات JSON لا تستخدم كاش قديم.'
    },
    groups,
    team_ar: { ...(groupsBundle?.team_ar || {}), ...groupTeamAr }
  };

  const heartbeat = {
    ok: errors.length === 0 || events.length > 0,
    checked_at: checkedAt,
    source: 'maensat-worldcup-groups-repair',
    full_range_scan: selection.full,
    checked_dates: selection.dates,
    events_seen: events.length,
    events_matched: matchedEvents,
    changed_matches: changedMatches,
    next_matches: nextMatches(matches),
    errors
  };

  const updateCheck = {
    ok: heartbeat.ok,
    checked_at: checkedAt,
    last_updated: checkedAt,
    source: 'maensat-worldcup-groups-repair',
    message_ar: changedMatches
      ? `تم تحديث ${changedMatches} مباراة وإعادة بناء ترتيب المجموعات.`
      : 'تم الفحص وإعادة بناء ترتيب المجموعات بدون تغييرات جديدة.',
    groups_count: Object.keys(groups).length,
    standings_groups_count: computed.standings.length,
    best_thirds_count: computed.best_thirds.length,
    errors_count: errors.length
  };

  const version = {
    version: 'maensat-worldcup-groups-repair-2026-06-28',
    checked_at: checkedAt,
    cache_buster: Date.now(),
    files: ['matches.json', 'standings.json', 'groups.json', 'heartbeat.json', 'update-check.json']
  };

  await writeJson(MATCHES_FILE, matchesBundle);
  await writeJson(STANDINGS_FILE, standingsBundle);
  await writeJson(GROUPS_FILE, newGroupsBundle);
  await writeJson(HEARTBEAT_FILE, heartbeat);
  await writeJson(UPDATE_CHECK_FILE, updateCheck);
  await writeJson(VERSION_FILE, version);
  if (errors.length) await writeJson(UPDATE_ERRORS_FILE, { checked_at: checkedAt, errors });

  console.log(JSON.stringify(updateCheck, null, 2));
}

main().catch(async error => {
  const checkedAt = nowIsoJordan();
  await writeJson(UPDATE_ERRORS_FILE, {
    checked_at: checkedAt,
    source: 'maensat-worldcup-groups-repair',
    fatal: true,
    message: error.message,
    stack: error.stack
  });
  console.error(error);
  process.exit(1);
});
