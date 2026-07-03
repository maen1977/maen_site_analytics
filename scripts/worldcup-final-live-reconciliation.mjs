#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '20260703-final-live-reconciliation-v1';
const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TARGET_FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];
const STATUS_FILE = 'final-live-reconciliation-status.json';
const TIMEZONE = 'Asia/Amman';
const LIVE_WINDOW_MINUTES = Number(process.env.WORLD_CUP_2026_LIVE_WINDOW_MINUTES || 270);
const LIVE_WINDOW_MS = LIVE_WINDOW_MINUTES * 60 * 1000;
const ESPN_BASE_URL = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';
const NOW = new Date();

const AR_NUM = '٠١٢٣٤٥٦٧٨٩';
const FA_NUM = '۰۱۲۳۴۵۶۷۸۹';
const TEAM_ALIASES = new Map(Object.entries({
  'usa': 'united states',
  'u s a': 'united states',
  'united states of america': 'united states',
  'america': 'united states',
  'أمريكا': 'united states',
  'امريكا': 'united states',
  'الولايات المتحدة': 'united states',
  'usmnt': 'united states',
  'bosnia herzegovina': 'bosnia and herzegovina',
  'bosnia': 'bosnia and herzegovina',
  'البوسنة': 'bosnia and herzegovina',
  'البوسنة والهرسك': 'bosnia and herzegovina',
  'bosnia and herz': 'bosnia and herzegovina',
  'egypt': 'egypt',
  'مصر': 'egypt',
  'australia': 'australia',
  'أستراليا': 'australia',
  'استراليا': 'australia',
  'argentina': 'argentina', 'الأرجنتين': 'argentina', 'الارجنتين': 'argentina',
  'cape verde': 'cape verde', 'كاب فيردي': 'cape verde', 'الرأس الأخضر': 'cape verde',
  'colombia': 'colombia', 'كولومبيا': 'colombia',
  'ghana': 'ghana', 'غانا': 'ghana',
  'portugal': 'portugal', 'البرتغال': 'portugal',
  'croatia': 'croatia', 'كرواتيا': 'croatia',
  'switzerland': 'switzerland', 'سويسرا': 'switzerland',
  'algeria': 'algeria', 'الجزائر': 'algeria',
  'spain': 'spain', 'إسبانيا': 'spain', 'اسبانيا': 'spain',
  'austria': 'austria', 'النمسا': 'austria',
  'belgium': 'belgium', 'بلجيكا': 'belgium',
  'senegal': 'senegal', 'السنغال': 'senegal',
  'france': 'france', 'فرنسا': 'france',
  'sweden': 'sweden', 'السويد': 'sweden',
  'england': 'england', 'إنجلترا': 'england', 'انجلترا': 'england',
  'dr congo': 'dr congo', 'congo dr': 'dr congo', 'جمهورية الكونغو الديمقراطية': 'dr congo', 'الكونغو الديمقراطية': 'dr congo',
  'mexico': 'mexico', 'المكسيك': 'mexico',
  'ecuador': 'ecuador', 'الإكوادور': 'ecuador', 'الاكوادور': 'ecuador',
  'canada': 'canada', 'كندا': 'canada',
  'morocco': 'morocco', 'المغرب': 'morocco',
  'brazil': 'brazil', 'البرازيل': 'brazil',
  'japan': 'japan', 'اليابان': 'japan',
  'norway': 'norway', 'النرويج': 'norway',
  'ivory coast': 'ivory coast', 'cote divoire': 'ivory coast', 'côte divoire': 'ivory coast', 'ساحل العاج': 'ivory coast',
  'germany': 'germany', 'ألمانيا': 'germany', 'المانيا': 'germany',
  'paraguay': 'paraguay', 'باراغواي': 'paraguay',
  'netherlands': 'netherlands', 'هولندا': 'netherlands',
}));

function pad2(n) { return String(n).padStart(2, '0'); }
function ammanParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return parts;
}
function ammanIso(date) {
  const p = ammanParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}
function ammanDate(date) { return ammanIso(date).slice(0, 10); }
function espnDateParam(date) {
  const p = ammanParts(date);
  return `${p.year}${p.month}${p.day}`;
}
function jordanDateRangeAroundNow() {
  const out = [];
  for (let d = -1; d <= 1; d += 1) {
    const copy = new Date(NOW.getTime() + d * 86400000);
    out.push(espnDateParam(copy));
  }
  return [...new Set(out)];
}
function withDateParam(url, yyyymmdd) {
  const u = new URL(url);
  u.searchParams.set('dates', yyyymmdd);
  if (!u.searchParams.has('limit')) u.searchParams.set('limit', '950');
  return u.toString();
}
function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String(AR_NUM.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(FA_NUM.indexOf(d)));
}
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = toEnglishDigits(value).match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
function simplify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/&/g, ' and ')
    .replace(/\b(and|the|fc|cf|national|team)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function teamKey(value) {
  const s = simplify(value);
  if (!s) return '';
  if (TEAM_ALIASES.has(s)) return TEAM_ALIASES.get(s);
  for (const [alias, canonical] of TEAM_ALIASES) {
    const a = simplify(alias);
    if (s === a || s.includes(a) || a.includes(s)) return canonical;
  }
  return s;
}
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d;
  const fixed = toEnglishDigits(s).replace(' ', 'T');
  const d2 = new Date(fixed);
  return Number.isFinite(d2.getTime()) ? d2 : null;
}
function kickoffDate(match) {
  const direct = parseDate(match?.kickoff_utc || match?.kickoffUtc || match?.kickoff_jordan || match?.kickoffJordan || match?.kickoff || match?.start_time || match?.startTime || match?.datetime);
  if (direct) return direct;
  const d = match?.date_jordan || match?.date;
  const t = match?.time_jordan || match?.time || match?.time_ar;
  if (d && t) return parseDate(`${toEnglishDigits(d)}T${toEnglishDigits(t)}:00+03:00`);
  return null;
}
function statusText(match) {
  const s = match?.status;
  return [
    s?.key, s?.state, s?.type, s?.name, s?.label, s?.label_ar,
    match?.status_key, match?.status_ar, match?.state, match?.phase, match?.status,
  ].map(v => typeof v === 'object' ? '' : String(v || '').toLowerCase()).join(' ');
}
function isFinished(match) {
  return /\b(final|finished|complete|completed|post)\b|انته|نهائي/.test(statusText(match));
}
function isLive(match) {
  return /\b(live|in|progress|halftime|extra|penalty)\b|مباشر|الشوط|استراحة|ركلات|ترجيح/.test(statusText(match)) && !isFinished(match);
}
function setStatus(match, key, labelAr, labelEn) {
  const before = JSON.stringify(match.status || null);
  const old = match.status && typeof match.status === 'object' && !Array.isArray(match.status) ? match.status : {};
  match.status = { ...old, key, state: key, label_ar: labelAr, label: labelEn };
  match.status_key = key;
  match.status_ar = labelAr;
  match.phase = key;
  return before !== JSON.stringify(match.status || null);
}
function readScore(match) {
  const s1 = numberOrNull(match?.score1 ?? match?.team1_score ?? match?.team1Score ?? match?.home_score ?? match?.homeScore);
  const s2 = numberOrNull(match?.score2 ?? match?.team2_score ?? match?.team2Score ?? match?.away_score ?? match?.awayScore);
  if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];
  const text = toEnglishDigits(match?.score_text || match?.scoreText || match?.display_score || match?.displayScore || match?.result || match?.score || '');
  const pair = text.match(/(\d+)\s*[-–—:]\s*(\d+)/);
  return pair ? [Number(pair[1]), Number(pair[2])] : null;
}
function writeScore(match, a, b, source = 'final-live-reconciliation') {
  const before = JSON.stringify({ score1: match.score1, score2: match.score2, home_score: match.home_score, away_score: match.away_score, team1_score: match.team1_score, team2_score: match.team2_score, score_text: match.score_text });
  match.score1 = a;
  match.score2 = b;
  match.team1_score = a;
  match.team2_score = b;
  match.team1Score = a;
  match.team2Score = b;
  match.home_score = a;
  match.away_score = b;
  match.homeScore = a;
  match.awayScore = b;
  match.score_text = `${a} - ${b}`;
  match.score_source = source;
  return before !== JSON.stringify({ score1: match.score1, score2: match.score2, home_score: match.home_score, away_score: match.away_score, team1_score: match.team1_score, team2_score: match.team2_score, score_text: match.score_text });
}
function maybeTeamName(team) {
  if (!team) return '';
  if (typeof team === 'string') return team;
  return team.name_ar || team.ar || team.name || team.name_en || team.displayName || team.shortDisplayName || team.abbreviation || team.code || team.slug || team.slot || '';
}
function matchTeamKeys(match) {
  const a = maybeTeamName(match?.team1 || match?.home || match?.homeTeam || match?.teams?.[0] || match?.competitors?.[0]);
  const b = maybeTeamName(match?.team2 || match?.away || match?.awayTeam || match?.teams?.[1] || match?.competitors?.[1]);
  return [teamKey(a), teamKey(b)];
}
function matchPairKey(match) {
  const [a, b] = matchTeamKeys(match);
  if (!a || !b || a.includes('winner') || b.includes('winner') || a.includes('tbd') || b.includes('tbd')) return '';
  return [a, b].sort().join('|');
}
function matchNumber(match) {
  return numberOrNull(match?.number ?? match?.match_number ?? match?.matchNumber ?? match?.match_no ?? match?.matchNo ?? match?.id);
}
function eventIdFromMatch(match) {
  return String(match?.espn_event_id || match?.espnEventId || match?.event_id || match?.eventId || '').trim();
}
function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hasTeams = Boolean(value.team1 || value.team2 || value.home || value.away || value.homeTeam || value.awayTeam || value.teams || value.competitors);
  const hasTime = Boolean(value.kickoff_utc || value.kickoff_jordan || value.kickoff || value.start_time || value.date || value.time);
  const hasId = Boolean(value.number || value.match_number || value.id || value.match_id || value.espn_event_id || value.espnEventId);
  const hasStatus = Boolean(value.status || value.status_ar || value.state || value.phase);
  return hasTeams && (hasTime || hasId || hasStatus);
}
function visitMatches(root, visitor) {
  const seen = new Set();
  function walk(value, pathLabel = '$') {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (looksLikeMatch(value)) visitor(value, pathLabel);
    if (Array.isArray(value)) {
      value.forEach((child, i) => walk(child, `${pathLabel}[${i}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['raw', 'metadata'].includes(key)) continue;
      walk(child, `${pathLabel}.${key}`);
    }
  }
  walk(root);
}
async function readJson(name) {
  try { return JSON.parse(await fs.readFile(path.join(WC_DIR, name), 'utf8')); }
  catch (err) { if (err?.code === 'ENOENT') return null; throw err; }
}
async function writeJson(name, value) {
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(path.join(WC_DIR, name), JSON.stringify(value, null, 2) + '\n');
}
function espnCompetitors(event) {
  const comp = event?.competitions?.[0] || event?.competition || {};
  const competitors = comp?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
  return { comp, home, away };
}
function espnTeamName(c) {
  return c?.team?.displayName || c?.team?.name || c?.team?.shortDisplayName || c?.team?.abbreviation || c?.displayName || c?.name || '';
}
function espnScore(c) { return numberOrNull(c?.score || c?.curatedRank?.current); }
function espnStatus(event) {
  const type = event?.status?.type || event?.competitions?.[0]?.status?.type || {};
  const state = String(type.state || '').toLowerCase();
  const name = String(type.name || type.description || type.detail || event?.status?.displayClock || '').toLowerCase();
  const completed = Boolean(type.completed || event?.competitions?.[0]?.status?.type?.completed);
  if (completed || state === 'post' || /final|full time|complete|completed/.test(name)) return { key: 'finished', label_ar: 'انتهت', label: 'Final' };
  if (state === 'in' || /in_progress|live|halftime|half|extra|penalty/.test(name)) return { key: 'live', label_ar: 'مباشر', label: 'Live' };
  return { key: 'scheduled', label_ar: 'لم تبدأ', label: 'Scheduled' };
}
function buildEventRecord(event) {
  const { comp, home, away } = espnCompetitors(event);
  if (!home || !away) return null;
  const id = String(event?.id || comp?.id || '').trim();
  if (!id) return null;
  const homeKey = teamKey(espnTeamName(home));
  const awayKey = teamKey(espnTeamName(away));
  if (!homeKey || !awayKey) return null;
  const kickoff = parseDate(event?.date || comp?.date);
  return {
    id,
    homeKey,
    awayKey,
    pairKey: [homeKey, awayKey].sort().join('|'),
    jordanDate: kickoff ? ammanDate(kickoff) : '',
    kickoff,
    status: espnStatus(event),
    homeScore: espnScore(home),
    awayScore: espnScore(away),
    rawName: `${espnTeamName(home)} vs ${espnTeamName(away)}`,
  };
}
async function fetchEspnEvents() {
  const errors = [];
  const map = new Map();
  for (const dateParam of jordanDateRangeAroundNow()) {
    const url = withDateParam(ESPN_BASE_URL, dateParam);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      for (const event of Array.isArray(json?.events) ? json.events : []) {
        const record = buildEventRecord(event);
        if (record) map.set(record.id, record);
      }
    } catch (err) {
      errors.push({ date: dateParam, message: String(err?.message || err) });
    }
  }
  return { records: [...map.values()], errors };
}
function buildIndexes(records) {
  const byId = new Map();
  const byPairDate = new Map();
  const byPair = new Map();
  for (const r of records) {
    byId.set(r.id, r);
    if (r.jordanDate) byPairDate.set(`${r.pairKey}|${r.jordanDate}`, r);
    byPair.set(r.pairKey, r);
  }
  return { byId, byPairDate, byPair };
}
function chooseRecord(match, indexes) {
  const id = eventIdFromMatch(match);
  if (id && indexes.byId.has(id)) return indexes.byId.get(id);
  const pair = matchPairKey(match);
  if (!pair) return null;
  const kd = kickoffDate(match);
  const date = kd ? ammanDate(kd) : '';
  if (date && indexes.byPairDate.has(`${pair}|${date}`)) return indexes.byPairDate.get(`${pair}|${date}`);
  return indexes.byPair.get(pair) || null;
}
function applyEspnRecord(match, record) {
  let changed = 0;
  if (!record) return { changed: 0, status: 0, score: 0, id: 0 };
  let status = 0, score = 0, id = 0;
  if (match.espn_event_id !== record.id || match.espnEventId !== record.id) {
    match.espn_event_id = record.id;
    match.espnEventId = record.id;
    changed += 1;
    id += 1;
  }
  if (record.kickoff) {
    const utc = record.kickoff.toISOString();
    const j = ammanIso(record.kickoff);
    const before = JSON.stringify([match.kickoff_utc, match.kickoff_jordan, match.date_jordan, match.time_jordan]);
    match.kickoff_utc = utc;
    match.kickoff_jordan = j;
    match.date_jordan = j.slice(0, 10);
    match.time_jordan = j.slice(11, 16);
    match.timezone = TIMEZONE;
    if (before !== JSON.stringify([match.kickoff_utc, match.kickoff_jordan, match.date_jordan, match.time_jordan])) changed += 1;
  }
  if (record.status.key === 'live' || record.status.key === 'finished') {
    if (setStatus(match, record.status.key, record.status.label_ar, record.status.label)) { changed += 1; status += 1; }
    let a = record.homeScore;
    let b = record.awayScore;
    if (a === null || b === null) {
      if (record.status.key === 'live') [a, b] = readScore(match) || [0, 0];
    }
    if (a !== null && b !== null) {
      const [team1, team2] = matchTeamKeys(match);
      let s1 = a, s2 = b;
      if (team1 === record.awayKey && team2 === record.homeKey) [s1, s2] = [b, a];
      if (writeScore(match, s1, s2, `espn-${record.status.key}`)) { changed += 1; score += 1; }
    }
  }
  return { changed, status, score, id };
}
function applyTimeLiveFallback(match) {
  if (isFinished(match)) return { changed: 0, status: 0, score: 0 };
  const k = kickoffDate(match);
  if (!k) return { changed: 0, status: 0, score: 0 };
  const diff = NOW.getTime() - k.getTime();
  let changed = 0, status = 0, score = 0;
  if (diff >= 0 && diff <= LIVE_WINDOW_MS) {
    if (!isLive(match) && setStatus(match, 'live', 'مباشر', 'Live')) { changed += 1; status += 1; }
    if (!readScore(match)) {
      if (writeScore(match, 0, 0, 'time-live-zero')) { changed += 1; score += 1; }
    }
    return { changed, status, score };
  }
  if (diff < 0 && isLive(match)) {
    if (setStatus(match, 'scheduled', 'لم تبدأ', 'Scheduled')) { changed += 1; status += 1; }
  }
  return { changed, status, score };
}
async function main() {
  const status = {
    script: 'worldcup-final-live-reconciliation.mjs',
    version: VERSION,
    checked_at_jordan: ammanIso(NOW),
    timezone: TIMEZONE,
    live_window_minutes: LIVE_WINDOW_MINUTES,
    espn: { fetched_events: 0, errors: [] },
    files: {},
    totals: { scanned: 0, espn_matched: 0, status_updates: 0, score_updates: 0, id_updates: 0, time_live_fallbacks: 0, changed_files: 0 },
    rule_ar: 'هذه آخر خطوة في تحديث كأس العالم: إذا ESPN أو وقت الأردن يقول إن المباراة مباشرة، لا تترك الكرت على لم تبدأ، وتعرض 0-0 إذا لم تصل نتيجة بعد.',
  };
  const { records, errors } = await fetchEspnEvents();
  status.espn = { fetched_events: records.length, errors };
  const indexes = buildIndexes(records);
  for (const file of TARGET_FILES) {
    const doc = await readJson(file);
    if (!doc) { status.files[file] = { exists: false }; continue; }
    const before = JSON.stringify(doc);
    const fileStatus = { exists: true, scanned: 0, espn_matched: 0, status_updates: 0, score_updates: 0, id_updates: 0, time_live_fallbacks: 0, changed: false };
    visitMatches(doc, (match) => {
      fileStatus.scanned += 1;
      status.totals.scanned += 1;
      const record = chooseRecord(match, indexes);
      if (record) {
        const r = applyEspnRecord(match, record);
        if (r.changed) fileStatus.espn_matched += 1;
        fileStatus.status_updates += r.status;
        fileStatus.score_updates += r.score;
        fileStatus.id_updates += r.id;
      }
      const t = applyTimeLiveFallback(match);
      if (t.changed) fileStatus.time_live_fallbacks += 1;
      fileStatus.status_updates += t.status;
      fileStatus.score_updates += t.score;
    });
    const after = JSON.stringify(doc);
    if (before !== after) {
      fileStatus.changed = true;
      status.totals.changed_files += 1;
      await writeJson(file, doc);
    }
    status.totals.espn_matched += fileStatus.espn_matched;
    status.totals.status_updates += fileStatus.status_updates;
    status.totals.score_updates += fileStatus.score_updates;
    status.totals.id_updates += fileStatus.id_updates;
    status.totals.time_live_fallbacks += fileStatus.time_live_fallbacks;
    status.files[file] = fileStatus;
  }
  await writeJson(STATUS_FILE, status);
  console.log(`[${VERSION}] ${JSON.stringify(status.totals)}`);
}

main().catch((error) => {
  console.error(`[${VERSION}] failed`, error);
  process.exitCode = 1;
});
