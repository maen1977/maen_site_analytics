import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const START_DATE = process.env.WORLD_CUP_2026_START_DATE || '2026-06-11';
const END_DATE = process.env.WORLD_CUP_2026_END_DATE || '2026-07-19';
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';
const SKIP_ESPN_FETCH = String(process.env.WORLD_CUP_2026_SKIP_ESPN_FETCH || '').trim() === '1';
const NOW = process.env.WORLD_CUP_2026_NOW ? new Date(process.env.WORLD_CUP_2026_NOW) : new Date();
const LIVE_WINDOW_MINUTES = Number(process.env.WORLD_CUP_2026_LIVE_WINDOW_MINUTES || 270);

const FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];
const STATUS_FILE = 'jordan-order-consistency-status.json';

const ESPN_NUMBER_BY_ID = new Map(Object.entries({
  '53452545': 73, // South Africa vs Canada
  '53452541': 74, // Germany vs Paraguay
  '53452547': 75, // Netherlands vs Morocco
  '53452557': 76, // Brazil vs Japan
  '53452543': 77, // France vs Sweden
  '53452561': 78, // Ivory Coast vs Norway
  '53452563': 79, // Mexico vs Ecuador
  '53452565': 80, // England vs DR Congo
  '53452553': 81, // United States vs Bosnia and Herzegovina
  '53452555': 82, // Belgium vs Senegal
  '53452549': 83, // Portugal vs Croatia
  '53452551': 84, // Spain vs Austria
  '53452505': 85, // Switzerland vs Algeria
  '53452503': 86, // Australia vs Egypt
  '53452569': 87, // Argentina vs Cape Verde
  '53452507': 88, // Colombia vs Ghana
  '53452509': 89,
  '53452511': 90,
  '53452517': 91,
  '53452519': 92,
  '53452513': 93,
  '53452515': 94,
  '53452521': 95,
  '53452523': 96,
  '53452525': 97,
  '53452527': 98,
  '53452529': 99,
  '53452531': 100,
  '53452533': 101,
  '53452535': 102,
  '53452539': 103,
  '53452537': 104,
}));

const PAIR_NUMBER_RULES = [
  [73, 'southafrica', 'canada'],
  [74, 'germany', 'paraguay'],
  [75, 'netherlands', 'morocco'],
  [76, 'brazil', 'japan'],
  [77, 'france', 'sweden'],
  [78, 'cotedivoire', 'norway'],
  [79, 'mexico', 'ecuador'],
  [80, 'england', 'democraticrepublicofcongo'],
  [81, 'unitedstates', 'bosniaandherzegovina'],
  [82, 'belgium', 'senegal'],
  [83, 'portugal', 'croatia'],
  [84, 'spain', 'austria'],
  [85, 'switzerland', 'algeria'],
  [86, 'australia', 'egypt'],
  [87, 'argentina', 'capeverde'],
  [88, 'colombia', 'ghana'],
];

const ARABIC_TEAM_ALIASES = {
  'امريكا': 'unitedstates',
  'الولاياتالمتحدة': 'unitedstates',
  'الولاياتالمتحدةالامريكية': 'unitedstates',
  'امريكاالولاياتالمتحدة': 'unitedstates',
  'البوسنةوالهرسك': 'bosniaandherzegovina',
  'البوسنة': 'bosniaandherzegovina',
  'بلجيكا': 'belgium',
  'السنغال': 'senegal',
  'فرنسا': 'france',
  'السويد': 'sweden',
  'المغرب': 'morocco',
  'هولندا': 'netherlands',
  'المانيا': 'germany',
  'ألمانيا': 'germany',
  'باراغواي': 'paraguay',
  'باراجواي': 'paraguay',
  'البرازيل': 'brazil',
  'اليابان': 'japan',
  'ساحلالعاج': 'cotedivoire',
  'كوتديفوار': 'cotedivoire',
  'النرويج': 'norway',
  'المكسيك': 'mexico',
  'الاكوادور': 'ecuador',
  'الإكوادور': 'ecuador',
  'انجلترا': 'england',
  'إنجلترا': 'england',
  'الكونغوالديمقراطية': 'democraticrepublicofcongo',
  'كونغوديمقراطية': 'democraticrepublicofcongo',
  'البرتغال': 'portugal',
  'كرواتيا': 'croatia',
  'اسبانيا': 'spain',
  'إسبانيا': 'spain',
  'النمسا': 'austria',
  'سويسرا': 'switzerland',
  'الجزائر': 'algeria',
  'استراليا': 'australia',
  'أستراليا': 'australia',
  'مصر': 'egypt',
  'الارجنتين': 'argentina',
  'الأرجنتين': 'argentina',
  'الراسالأخضر': 'capeverde',
  'الرأسالأخضر': 'capeverde',
  'كابفيردي': 'capeverde',
  'كولومبيا': 'colombia',
  'غانا': 'ghana',
  'كندا': 'canada',
  'جنوبافريقيا': 'southafrica',
  'جنوبأفريقيا': 'southafrica',
};

const ENGLISH_ALIASES = {
  usa: 'unitedstates',
  us: 'unitedstates',
  usmnt: 'unitedstates',
  unitedstatesofamerica: 'unitedstates',
  unitedstates: 'unitedstates',
  america: 'unitedstates',
  bosnia: 'bosniaandherzegovina',
  bosniaherzegovina: 'bosniaandherzegovina',
  bosniaandherzegovina: 'bosniaandherzegovina',
  bih: 'bosniaandherzegovina',
  drcongo: 'democraticrepublicofcongo',
  democraticrepubliccongo: 'democraticrepublicofcongo',
  democraticrepublicofcongo: 'democraticrepublicofcongo',
  congodr: 'democraticrepublicofcongo',
  cod: 'democraticrepublicofcongo',
  ivorycoast: 'cotedivoire',
  coteivoire: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  civ: 'cotedivoire',
  capeverde: 'capeverde',
  caboverde: 'capeverde',
  czechia: 'czechrepublic',
  czechrepublic: 'czechrepublic',
  curacao: 'curacao',
  curaçao: 'curacao',
  turkiye: 'turkey',
  türkiye: 'turkey',
  korea: 'southkorea',
  korearepublic: 'southkorea',
  republicofkorea: 'southkorea',
  southkorea: 'southkorea',
};

function toAsciiDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function stripArabic(text) {
  return String(text || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

function normalizeRaw(value) {
  return stripArabic(toAsciiDigits(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/\b(fc|cf|sc|nt|team|national|republic of|the)\b/g, '')
    .replace(/[^a-z0-9ء-ي]/g, '');
}

function aliasIndexKey(value) {
  return stripArabic(toAsciiDigits(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/\b(fc|cf|sc|nt|team|national|republic of|the)\b/g, '')
    .replace(/[^a-z0-9ء-ي]/g, '');
}

const ARABIC_ALIAS_INDEX = new Map(Object.entries(ARABIC_TEAM_ALIASES).map(([k, v]) => [aliasIndexKey(k), v]));
const ENGLISH_ALIAS_INDEX = new Map(Object.entries(ENGLISH_ALIASES).map(([k, v]) => [aliasIndexKey(k), v]));

function teamKey(value) {
  const key = normalizeRaw(value);
  return ARABIC_ALIAS_INDEX.get(key) || ENGLISH_ALIAS_INDEX.get(key) || key;
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = toAsciiDigits(value).match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function numberOrNull(value) {
  const n = scoreNumber(value);
  return n === null ? null : Math.trunc(n);
}

function setStatus(match, key, labelAr, labelEn = '') {
  const previous = match.status && typeof match.status === 'object' ? match.status : {};
  match.status = {
    ...previous,
    key,
    state: key,
    label_ar: labelAr,
    label: labelEn || previous.label || labelAr,
  };
}

function statusKey(match) {
  return String(match?.status?.key || match?.status?.state || match?.status || match?.phase || '').toLowerCase();
}

function isFinished(match) {
  const text = [match?.status?.key, match?.status?.state, match?.status?.label_ar, match?.status?.label, match?.status, match?.phase]
    .map((x) => String(x || '').toLowerCase()).join(' ');
  return /finished|final|complete|completed|post|full|ft|انته/.test(text);
}

function isLive(match) {
  const text = [match?.status?.key, match?.status?.state, match?.status?.label_ar, match?.status?.label, match?.status, match?.phase]
    .map((x) => String(x || '').toLowerCase()).join(' ');
  return /live|in[ _-]?progress|halftime|extra|penalt|مباشر|الشوط|استراحة|ركلات|ترجيح/.test(text) && !isFinished(match);
}

function currentScorePair(match) {
  const s1 = numberOrNull(match?.score1 ?? match?.team1_score ?? match?.team1Score ?? match?.home_score ?? match?.homeScore);
  const s2 = numberOrNull(match?.score2 ?? match?.team2_score ?? match?.team2Score ?? match?.away_score ?? match?.awayScore);
  if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];
  const raw = String(match?.score_text || match?.scoreText || match?.display_score || match?.displayScore || match?.result || match?.score || '');
  const found = toAsciiDigits(raw).match(/(\d+)\s*[-–—:]\s*(\d+)/);
  if (found) return [Number(found[1]), Number(found[2])];
  return null;
}

function writeScore(match, score1, score2, source = 'jordan-order-consistency') {
  if (score1 === null || score2 === null) return false;
  const before = JSON.stringify([match.score1, match.score2, match.team1_score, match.team2_score, match.home_score, match.away_score]);
  match.score1 = score1;
  match.score2 = score2;
  match.team1_score = score1;
  match.team2_score = score2;
  match.home_score = score1;
  match.away_score = score2;
  match.score_text = `${score1}-${score2}`;
  match.score_updated_by = source;
  return before !== JSON.stringify([match.score1, match.score2, match.team1_score, match.team2_score, match.home_score, match.away_score]);
}

function extractTeamName(team) {
  if (!team) return '';
  if (typeof team === 'string') return team;
  return team.name_ar || team.name || team.name_en || team.displayName || team.shortDisplayName || team.abbreviation || team.slot || '';
}

function matchTeamKeys(match) {
  const t1 = extractTeamName(match?.team1 || match?.home || match?.home_team || match?.homeTeam);
  const t2 = extractTeamName(match?.team2 || match?.away || match?.away_team || match?.awayTeam);
  return [teamKey(t1), teamKey(t2)];
}

function samePair(a1, a2, b1, b2) {
  return !!a1 && !!a2 && !!b1 && !!b2 && ((a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1));
}

function extractEspnEventId(match) {
  const candidates = [match?.espn_event_id, match?.espnEventId, match?.espn_id, match?.event_id, match?.eventId, match?.source_event_id, match?.id];
  for (const value of candidates) {
    const text = String(value ?? '').trim();
    if (/^\d{7,}$/.test(text)) return text;
  }
  return null;
}

function currentNumber(match) {
  const candidates = [match?.number, match?.match_number, match?.matchNumber, match?.match_no, match?.matchNo, match?.game_number, match?.gameNumber, match?.id];
  for (const value of candidates) {
    const n = numberOrNull(value);
    if (n !== null && n >= 1 && n <= 200) return n;
  }
  return null;
}

function setMatchNumber(match, n) {
  if (!Number.isInteger(n)) return false;
  const before = JSON.stringify([match.number, match.match_number, match.matchNumber, match.match_no]);
  match.number = n;
  match.match_number = n;
  match.matchNumber = n;
  match.display_number = n;
  return before !== JSON.stringify([match.number, match.match_number, match.matchNumber, match.match_no]);
}

function inferNumberFromTeams(match) {
  const [a, b] = matchTeamKeys(match);
  for (const [n, x, y] of PAIR_NUMBER_RULES) {
    if (samePair(a, b, x, y)) return n;
  }
  return null;
}

function parseDateOnly(text) {
  const raw = toAsciiDigits(text);
  const iso = raw.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const slash = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})/);
  if (slash) return { y: Number(slash[3]), m: Number(slash[2]), d: Number(slash[1]) };
  const ar = stripArabic(raw);
  const months = {
    'كانونالثاني': 1, 'يناير': 1,
    'شباط': 2, 'فبراير': 2,
    'اذار': 3, 'مارس': 3,
    'نيسان': 4, 'ابريل': 4,
    'ايار': 5, 'مايو': 5,
    'حزيران': 6, 'يونيو': 6,
    'تموز': 7, 'يوليو': 7,
    'اب': 8, 'اغسطس': 8,
    'ايلول': 9, 'سبتمبر': 9,
    'تشرينالاول': 10, 'اكتوبر': 10,
    'تشرينالثاني': 11, 'نوفمبر': 11,
    'كانونالاول': 12, 'ديسمبر': 12,
  };
  for (const [name, month] of Object.entries(months)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name}`);
    const m = ar.replace(/\s+/g, '').match(re);
    if (m) return { y: 2026, m: month, d: Number(m[1]) };
  }
  return null;
}

function parseTimeText(text) {
  if (text === null || text === undefined || text === '') return null;
  const raw = toAsciiDigits(text).trim();
  const isPm = /\bpm\b|م|مساء/i.test(raw);
  const isAm = /\bam\b|ص|صباح/i.test(raw);
  const m = raw.match(/(\d{1,2})(?::|٫|\.)(\d{2})/i) || raw.match(/\b(\d{1,2})\b/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (isPm && h < 12) h += 12;
  if (isAm && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

function dateFromJordanParts(datePart, timePart) {
  if (!datePart || !timePart) return null;
  const offset = '+03:00';
  const iso = `${datePart.y}-${String(datePart.m).padStart(2, '0')}-${String(datePart.d).padStart(2, '0')}T${String(timePart.h).padStart(2, '0')}:${String(timePart.min).padStart(2, '0')}:00${offset}`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseIsoLike(value, jordanWhenNoOffset = false) {
  if (!value) return null;
  const raw = toAsciiDigits(value).trim();
  if (!raw || /^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(raw);
    const d = new Date(hasOffset ? raw : `${raw}${jordanWhenNoOffset ? '+03:00' : 'Z'}`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function kickoffDate(match) {
  const fieldsUtc = [match?.kickoff_utc, match?.utc, match?.date_utc, match?.dateTimeUTC, match?.date_time_utc];
  for (const value of fieldsUtc) {
    const d = parseIsoLike(value, false);
    if (d) return d;
  }
  const fieldsJordan = [match?.kickoff_jordan, match?.jordan_kickoff, match?.kickoff, match?.start_time, match?.startTime, match?.datetime, match?.dateTime, match?.date_time];
  for (const value of fieldsJordan) {
    const d = parseIsoLike(value, true);
    if (d) return d;
  }
  const datePart = parseDateOnly(match?.date_jordan || match?.date || match?.display_date || match?.date_ar);
  const timePart = parseTimeText(match?.time_jordan || match?.time || match?.display_time || match?.time_ar);
  return dateFromJordanParts(datePart, timePart);
}

function jordanIso(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

function dateAr(date) {
  return new Intl.DateTimeFormat('ar-JO-u-ca-gregory', {
    timeZone: TIMEZONE,
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(date);
}

function timeAr(date) {
  return new Intl.DateTimeFormat('ar-JO-u-ca-gregory', {
    timeZone: TIMEZONE,
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date).replace(/\s+/g, ' ').trim();
}

function dateCompact(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date).replace(/-/g, '');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function rangeJordanDates(start, end) {
  const startDate = new Date(`${START_DATE}T00:00:00+03:00`);
  const endDate = new Date(`${END_DATE}T00:00:00+03:00`);
  const result = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) result.push(dateCompact(d));
  return result;
}

function applyJordanDisplayFields(match, { visible = false } = {}) {
  const d = kickoffDate(match);
  if (!d) return false;
  const before = JSON.stringify([match.kickoff_jordan, match.kickoff_utc, match.date_ar, match.time_ar, match.sort_key_jordan, visible ? match.date : null, visible ? match.time : null]);
  const isoJordan = jordanIso(d);
  match.kickoff_jordan = isoJordan;
  match.kickoff_utc = d.toISOString();
  match.date_ar = dateAr(d);
  match.time_ar = timeAr(d);
  match.date_jordan = isoJordan.slice(0, 10);
  match.time_jordan = isoJordan.slice(11, 16);
  match.sort_key_jordan = isoJordan;
  match.timezone = TIMEZONE;
  if (visible) {
    match.date = match.date_ar;
    match.time = match.time_ar;
  }
  return before !== JSON.stringify([match.kickoff_jordan, match.kickoff_utc, match.date_ar, match.time_ar, match.sort_key_jordan, visible ? match.date : null, visible ? match.time : null]);
}

function sortValue(match) {
  const d = kickoffDate(match);
  const n = currentNumber(match) ?? 9999;
  return [d ? d.getTime() : Number.MAX_SAFE_INTEGER, n];
}

function compareMatches(a, b) {
  const [ta, na] = sortValue(a);
  const [tb, nb] = sortValue(b);
  return ta - tb || na - nb;
}

function isMatchLike(x) {
  return x && typeof x === 'object' && (
    x.team1 || x.team2 || x.home || x.away || x.home_team || x.away_team ||
    x.match_number || x.matchNumber || x.number || x.espn_event_id || x.kickoff_jordan || x.kickoff_utc
  );
}

function walkMatches(value, visitor, context = {}) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) walkMatches(item, visitor, context);
    return;
  }
  if (isMatchLike(value)) visitor(value, context);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'team1' || key === 'team2' || key === 'home' || key === 'away' || key === 'home_team' || key === 'away_team') continue;
    if (child && typeof child === 'object') walkMatches(child, visitor, { ...context, parentKey: key });
  }
}

function sortArrays(value, { visible = false } = {}) {
  if (!value || typeof value !== 'object') return 0;
  let sorted = 0;
  if (Array.isArray(value)) {
    for (const item of value) sorted += sortArrays(item, { visible });
    if (value.length >= 2 && value.every(isMatchLike)) {
      const before = value.map((x) => currentNumber(x) ?? kickoffDate(x)?.toISOString() ?? '').join('|');
      value.sort(compareMatches);
      const after = value.map((x) => currentNumber(x) ?? kickoffDate(x)?.toISOString() ?? '').join('|');
      if (before !== after) sorted += 1;
    }
    return sorted;
  }
  if (Array.isArray(value.matches) && value.matches.every(isMatchLike)) {
    const before = value.matches.map((x) => currentNumber(x) ?? kickoffDate(x)?.toISOString() ?? '').join('|');
    value.matches.sort(compareMatches);
    const after = value.matches.map((x) => currentNumber(x) ?? kickoffDate(x)?.toISOString() ?? '').join('|');
    if (before !== after) sorted += 1;
  }
  if (Array.isArray(value.rounds)) {
    for (const round of value.rounds) sorted += sortArrays(round, { visible });
    const before = value.rounds.map((round) => {
      const arr = Array.isArray(round?.matches) ? round.matches : [];
      return arr.length ? sortValue(arr[0]).join(':') : String(round?.id || round?.title || '');
    }).join('|');
    value.rounds.sort((a, b) => {
      const am = Array.isArray(a?.matches) && a.matches.length ? a.matches[0] : null;
      const bm = Array.isArray(b?.matches) && b.matches.length ? b.matches[0] : null;
      if (am && bm) return compareMatches(am, bm);
      if (am) return -1;
      if (bm) return 1;
      return String(a?.title_ar || a?.title || '').localeCompare(String(b?.title_ar || b?.title || ''), 'ar');
    });
    const after = value.rounds.map((round) => {
      const arr = Array.isArray(round?.matches) ? round.matches : [];
      return arr.length ? sortValue(arr[0]).join(':') : String(round?.id || round?.title || '');
    }).join('|');
    if (before !== after) sorted += 1;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'matches' || key === 'rounds') continue;
    if (child && typeof child === 'object') sorted += sortArrays(child, { visible });
  }
  return sorted;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(path.join(WC_DIR, file), 'utf8'));
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(path.join(WC_DIR, file), JSON.stringify(value, null, 2) + '\n');
}

function espnUrlForDate(dateYYYYMMDD) {
  const url = new URL(ESPN_BASE);
  url.searchParams.set('dates', dateYYYYMMDD);
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', '950');
  return url.toString();
}

function espnCompetitors(event) {
  const competition = Array.isArray(event?.competitions) ? event.competitions[0] : null;
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const home = competitors.find((c) => String(c.homeAway || '').toLowerCase() === 'home') || competitors[0] || null;
  const away = competitors.find((c) => String(c.homeAway || '').toLowerCase() === 'away') || competitors.find((c) => c !== home) || competitors[1] || null;
  return { competition, competitors, home, away };
}

function espnTeamName(competitor) {
  const t = competitor?.team || {};
  return t.displayName || t.name || t.shortDisplayName || t.abbreviation || competitor?.displayName || competitor?.name || '';
}

function espnScore(competitor) {
  const values = [
    competitor?.score,
    competitor?.displayScore,
    competitor?.scoreDisplay,
    competitor?.curatedRank?.current,
    competitor?.statistics?.score,
    competitor?.statistics?.goals,
  ];
  for (const value of values) {
    const n = numberOrNull(value);
    if (n !== null) return n;
  }
  if (Array.isArray(competitor?.linescores)) {
    let total = 0;
    let seen = false;
    for (const line of competitor.linescores) {
      const n = numberOrNull(line?.score ?? line?.value ?? line?.displayValue);
      if (n !== null) { total += n; seen = true; }
    }
    if (seen) return total;
  }
  return null;
}

function espnStatus(event) {
  const t = event?.status?.type || {};
  const raw = [t.name, t.state, t.description, t.shortDetail, event?.status?.displayClock].map((x) => String(x || '').toLowerCase()).join(' ');
  const completed = Boolean(t.completed) || /final|full|complete|completed|post/.test(raw);
  const live = /in|progress|live|halftime|extra|penalt/.test(raw) && !completed;
  const scheduled = /pre|scheduled|not started/.test(raw) && !completed && !live;
  if (completed) return { key: 'finished', label_ar: 'انتهت', label: t.description || 'Finished' };
  if (live) return { key: 'live', label_ar: 'مباشر', label: t.description || 'Live' };
  if (scheduled) return { key: 'scheduled', label_ar: 'لم تبدأ', label: t.description || 'Scheduled' };
  return { key: 'scheduled', label_ar: 'لم تبدأ', label: t.description || 'Scheduled' };
}

function penaltyFromEvent(event, home, away) {
  const detail = String(event?.competitions?.[0]?.details?.[0]?.text || event?.competitions?.[0]?.note || event?.status?.type?.detail || event?.status?.type?.shortDetail || '');
  if (!/penalt|shootout|ركلات|ترجيح/i.test(detail)) return null;
  const m = toAsciiDigits(detail).match(/(\d+)\s*[-–—:]\s*(\d+)/);
  if (!m) return null;
  // If ESPN writes "Team advances 4-3 on penalties", the first number belongs to the named winner.
  const first = Number(m[1]);
  const second = Number(m[2]);
  const before = teamKey(detail.slice(0, m.index || 0));
  const homeKey = teamKey(espnTeamName(home));
  const awayKey = teamKey(espnTeamName(away));
  if (before && homeKey && before.includes(homeKey)) return { home: first, away: second };
  if (before && awayKey && before.includes(awayKey)) return { home: second, away: first };
  return { home: first, away: second };
}

function buildEspnRecord(event) {
  const { competition, home, away } = espnCompetitors(event);
  if (!home || !away) return null;
  const id = String(event?.id || competition?.id || '').trim();
  if (!id) return null;
  const homeName = espnTeamName(home);
  const awayName = espnTeamName(away);
  const homeKey = teamKey(homeName);
  const awayKey = teamKey(awayName);
  const kickoff = parseIsoLike(event?.date || competition?.date, false);
  const status = espnStatus(event);
  const homeScore = espnScore(home);
  const awayScore = espnScore(away);
  const pen = penaltyFromEvent(event, home, away);
  return {
    id,
    officialNumber: ESPN_NUMBER_BY_ID.get(id) || null,
    homeName,
    awayName,
    homeKey,
    awayKey,
    kickoff,
    status,
    homeScore,
    awayScore,
    penaltyHome: pen?.home ?? null,
    penaltyAway: pen?.away ?? null,
    raw: event,
  };
}

async function fetchEspnEvents() {
  const out = [];
  const seen = new Set();
  if (SKIP_ESPN_FETCH) return { events: out, errors: [], skipped: true };
  const errors = [];
  for (const date of rangeJordanDates(START_DATE, END_DATE)) {
    const url = espnUrlForDate(date);
    try {
      const res = await fetch(url, { headers: { 'accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const events = Array.isArray(json?.events) ? json.events : [];
      for (const event of events) {
        const record = buildEspnRecord(event);
        if (!record || seen.has(record.id)) continue;
        seen.add(record.id);
        out.push(record);
      }
    } catch (err) {
      errors.push({ date, message: String(err?.message || err) });
    }
  }
  return { events: out, errors, skipped: false };
}

function buildSourceIndexes(records) {
  const byId = new Map();
  const byNumber = new Map();
  const byPair = new Map();
  for (const r of records) {
    byId.set(r.id, r);
    if (r.officialNumber) byNumber.set(r.officialNumber, r);
    const pair = [r.homeKey, r.awayKey].sort().join('|');
    const date = r.kickoff ? jordanIso(r.kickoff).slice(0, 10) : '';
    byPair.set(`${pair}|${date}`, r);
    byPair.set(pair, r);
  }
  return { byId, byNumber, byPair };
}

function matchPairKey(match) {
  const [a, b] = matchTeamKeys(match);
  if (!a || !b) return '';
  return [a, b].sort().join('|');
}

function chooseEspnRecord(match, indexes) {
  const id = extractEspnEventId(match);
  if (id && indexes.byId.has(id)) return indexes.byId.get(id);
  const n = currentNumber(match);
  if (n && indexes.byNumber.has(n)) return indexes.byNumber.get(n);
  const pair = matchPairKey(match);
  if (pair) {
    const d = kickoffDate(match);
    if (d) {
      const date = jordanIso(d).slice(0, 10);
      if (indexes.byPair.has(`${pair}|${date}`)) return indexes.byPair.get(`${pair}|${date}`);
    }
    if (indexes.byPair.has(pair)) return indexes.byPair.get(pair);
  }
  return null;
}

function applyEspnToMatch(match, record) {
  if (!record) return { changed: 0, score: 0, status: 0, number: 0 };
  let changed = 0, score = 0, status = 0, number = 0;
  const beforeId = match.espn_event_id;
  match.espn_event_id = record.id;
  match.espnEventId = record.id;
  if (beforeId !== match.espn_event_id) changed += 1;
  if (record.officialNumber && setMatchNumber(match, record.officialNumber)) { changed += 1; number += 1; }
  if (record.kickoff) {
    const before = JSON.stringify([match.kickoff_utc, match.kickoff_jordan, match.date_ar, match.time_ar]);
    match.kickoff_utc = record.kickoff.toISOString();
    match.kickoff_jordan = jordanIso(record.kickoff);
    match.date_ar = dateAr(record.kickoff);
    match.time_ar = timeAr(record.kickoff);
    match.date_jordan = match.kickoff_jordan.slice(0, 10);
    match.time_jordan = match.kickoff_jordan.slice(11, 16);
    if (before !== JSON.stringify([match.kickoff_utc, match.kickoff_jordan, match.date_ar, match.time_ar])) changed += 1;
  }
  const [team1, team2] = matchTeamKeys(match);
  const homeScore = record.homeScore;
  const awayScore = record.awayScore;
  if (homeScore !== null && awayScore !== null && (record.status.key === 'live' || record.status.key === 'finished')) {
    let s1 = homeScore;
    let s2 = awayScore;
    if (team1 && team2) {
      if (team1 === record.awayKey && team2 === record.homeKey) {
        s1 = awayScore;
        s2 = homeScore;
      } else if (team1 === record.homeKey && team2 === record.awayKey) {
        s1 = homeScore;
        s2 = awayScore;
      }
    }
    if (writeScore(match, s1, s2, 'espn-jordan-order-consistency')) { changed += 1; score += 1; }
    if (record.penaltyHome !== null && record.penaltyAway !== null) {
      const p1 = team1 === record.awayKey ? record.penaltyAway : record.penaltyHome;
      const p2 = team1 === record.awayKey ? record.penaltyHome : record.penaltyAway;
      const beforePen = JSON.stringify([match.penalty1, match.penalty2]);
      match.penalty1 = p1;
      match.penalty2 = p2;
      if (beforePen !== JSON.stringify([match.penalty1, match.penalty2])) changed += 1;
    }
  }
  const beforeStatus = JSON.stringify(match.status || null);
  setStatus(match, record.status.key, record.status.label_ar, record.status.label);
  if (beforeStatus !== JSON.stringify(match.status || null)) { changed += 1; status += 1; }
  return { changed, score, status, number };
}

function applyTimeState(match) {
  const d = kickoffDate(match);
  if (!d) return { changed: 0, score: 0, status: 0 };
  let changed = 0, score = 0, status = 0;
  const diffMinutes = (NOW.getTime() - d.getTime()) / 60000;
  const pair = currentScorePair(match);
  if (diffMinutes < 0) {
    if (!pair && statusKey(match) !== 'scheduled') {
      const before = JSON.stringify(match.status || null);
      setStatus(match, 'scheduled', 'لم تبدأ', 'Scheduled');
      if (before !== JSON.stringify(match.status || null)) { changed += 1; status += 1; }
    }
    return { changed, score, status };
  }
  if (diffMinutes >= 0 && diffMinutes <= LIVE_WINDOW_MINUTES && !isFinished(match)) {
    const beforeStatus = JSON.stringify(match.status || null);
    setStatus(match, 'live', 'مباشر', 'Live');
    if (beforeStatus !== JSON.stringify(match.status || null)) { changed += 1; status += 1; }
    if (!pair) {
      if (writeScore(match, 0, 0, 'live-zero-at-kickoff')) { changed += 1; score += 1; }
    }
    return { changed, score, status };
  }
  if (diffMinutes > LIVE_WINDOW_MINUTES && !pair && !isFinished(match)) {
    const beforeStatus = JSON.stringify(match.status || null);
    setStatus(match, 'pending_verification', 'بانتظار التحديث', 'Pending verification');
    if (beforeStatus !== JSON.stringify(match.status || null)) { changed += 1; status += 1; }
    return { changed, score, status };
  }
  return { changed, score, status };
}

function statusPriority(match) {
  if (isFinished(match)) return 3;
  if (isLive(match)) return 2;
  if (statusKey(match).includes('pending')) return 1;
  return 0;
}

function buildCanonicalFromDocuments(documents) {
  const byNumber = new Map();
  const byEspnId = new Map();
  const byPair = new Map();
  function consider(match) {
    const n = currentNumber(match);
    const id = extractEspnEventId(match);
    const pair = matchPairKey(match);
    const rank = statusPriority(match) * 10 + (currentScorePair(match) ? 5 : 0) + (kickoffDate(match) ? 1 : 0);
    const entry = { match, rank };
    if (n && (!byNumber.has(n) || byNumber.get(n).rank < rank)) byNumber.set(n, entry);
    if (id && (!byEspnId.has(id) || byEspnId.get(id).rank < rank)) byEspnId.set(id, entry);
    if (pair && (!byPair.has(pair) || byPair.get(pair).rank < rank)) byPair.set(pair, entry);
  }
  for (const doc of Object.values(documents)) walkMatches(doc, consider);
  return { byNumber, byEspnId, byPair };
}

function copyCanonicalFields(target, source) {
  if (!source || source === target) return 0;
  let changed = 0;
  const fields = ['espn_event_id', 'espnEventId', 'kickoff_utc', 'kickoff_jordan', 'date_ar', 'time_ar', 'date_jordan', 'time_jordan', 'timezone'];
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null && target[field] !== source[field]) {
      target[field] = source[field];
      changed += 1;
    }
  }
  const n = currentNumber(source);
  if (n && setMatchNumber(target, n)) changed += 1;
  const pair = currentScorePair(source);
  if (pair && !currentScorePair(target)) {
    if (writeScore(target, pair[0], pair[1], 'canonical-sync')) changed += 1;
  } else if (pair && isFinished(source) && !isFinished(target)) {
    if (writeScore(target, pair[0], pair[1], 'canonical-sync-final')) changed += 1;
  }
  if (statusPriority(source) >= statusPriority(target)) {
    const before = JSON.stringify(target.status || null);
    target.status = typeof source.status === 'object' ? { ...source.status } : source.status;
    if (before !== JSON.stringify(target.status || null)) changed += 1;
  }
  return changed;
}

function syncDocuments(documents) {
  let changed = 0;
  const canonical = buildCanonicalFromDocuments(documents);
  function sync(match) {
    const n = currentNumber(match);
    const id = extractEspnEventId(match);
    const pair = matchPairKey(match);
    const source = (id && canonical.byEspnId.get(id)?.match) || (n && canonical.byNumber.get(n)?.match) || (pair && canonical.byPair.get(pair)?.match) || null;
    changed += copyCanonicalFields(match, source);
  }
  for (const [file, doc] of Object.entries(documents)) {
    walkMatches(doc, sync);
  }
  return changed;
}

function normalizeNumbersAndTime(documents) {
  let changed = 0, visibleTime = 0, numbers = 0, time = 0, timeStates = 0, zeroScores = 0;
  for (const [file, doc] of Object.entries(documents)) {
    const visible = file === 'knockout-live.json';
    walkMatches(doc, (match) => {
      const espnId = extractEspnEventId(match);
      const known = espnId ? ESPN_NUMBER_BY_ID.get(espnId) : null;
      const inferred = known || inferNumberFromTeams(match);
      if (inferred && setMatchNumber(match, inferred)) { changed += 1; numbers += 1; }
      if (applyJordanDisplayFields(match, { visible })) { changed += 1; time += 1; if (visible) visibleTime += 1; }
      const t = applyTimeState(match);
      changed += t.changed; timeStates += t.status; zeroScores += t.score;
    });
  }
  return { changed, visibleTime, numbers, time, timeStates, zeroScores };
}

async function main() {
  const status = {
    script: 'worldcup-jordan-order-consistency.mjs',
    ran_at_jordan: jordanIso(NOW),
    timezone: TIMEZONE,
    files: {},
    espn: { fetched_events: 0, errors: [], skipped: SKIP_ESPN_FETCH },
    counters: {
      espn_matched: 0,
      score_updates: 0,
      status_updates: 0,
      number_updates: 0,
      time_updates: 0,
      visible_time_updates: 0,
      time_state_updates: 0,
      zero_score_fills: 0,
      canonical_sync_changes: 0,
      sorted_arrays: 0,
    },
  };

  const documents = {};
  for (const file of FILES) {
    const doc = await readJson(file);
    if (doc) documents[file] = doc;
  }

  const { events, errors, skipped } = await fetchEspnEvents();
  status.espn = { fetched_events: events.length, errors, skipped };
  const indexes = buildSourceIndexes(events);

  if (events.length) {
    for (const [file, doc] of Object.entries(documents)) {
      let fileMatched = 0;
      walkMatches(doc, (match) => {
        const record = chooseEspnRecord(match, indexes);
        if (!record) return;
        const r = applyEspnToMatch(match, record);
        if (r.changed) fileMatched += 1;
        status.counters.espn_matched += r.changed ? 1 : 0;
        status.counters.score_updates += r.score;
        status.counters.status_updates += r.status;
        status.counters.number_updates += r.number;
      });
      status.files[file] = { ...(status.files[file] || {}), espn_matched: fileMatched };
    }
  }

  const norm = normalizeNumbersAndTime(documents);
  status.counters.number_updates += norm.numbers;
  status.counters.time_updates += norm.time;
  status.counters.visible_time_updates += norm.visibleTime;
  status.counters.time_state_updates += norm.timeStates;
  status.counters.zero_score_fills += norm.zeroScores;

  const syncChanges = syncDocuments(documents);
  status.counters.canonical_sync_changes = syncChanges;

  for (const [file, doc] of Object.entries(documents)) {
    const sorted = sortArrays(doc, { visible: file === 'knockout-live.json' });
    status.counters.sorted_arrays += sorted;
    status.files[file] = { ...(status.files[file] || {}), sorted_arrays: sorted };
  }

  for (const [file, doc] of Object.entries(documents)) {
    await writeJson(file, doc);
  }
  await writeJson(STATUS_FILE, status);

  console.log(`[worldcup-jordan-order-consistency] ESPN events=${events.length}, sorted arrays=${status.counters.sorted_arrays}, score updates=${status.counters.score_updates}, number updates=${status.counters.number_updates}`);
}

main().catch((err) => {
  console.error('[worldcup-jordan-order-consistency] failed:', err);
  process.exitCode = 1;
});
