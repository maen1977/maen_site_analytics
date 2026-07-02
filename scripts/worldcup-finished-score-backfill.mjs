import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const VERSION = '2026-07-02-finished-score-backfill-v1';
const TARGET_FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];
const DEFAULT_ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || DEFAULT_ESPN_BASE;
const FINISHED_GRACE_MINUTES = Number(process.env.WORLD_CUP_2026_FINISHED_BACKFILL_GRACE_MINUTES || 135);
const MAX_DATE_DIFF_MS = Number(process.env.WORLD_CUP_2026_FINISHED_BACKFILL_DATE_DIFF_HOURS || 36) * 60 * 60 * 1000;
const MAX_FETCH_DATES = Number(process.env.WORLD_CUP_2026_FINISHED_BACKFILL_MAX_DATES || 30);

function ammanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function arabicDigitsToLatin(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function normalize(value) {
  return arabicDigitsToLatin(toText(value))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/&/g, 'and')
    .replace(/\+/g, 'and')
    .replace(/\b(the|team|national|republic|of|fc|cf|sc|nt)\b/g, '')
    .replace(/[^a-z0-9ء-ي]/g, '');
}

const ALIASES = new Map(Object.entries({
  usa: 'unitedstates', us: 'unitedstates', unitedstates: 'unitedstates', unitedstatesofamerica: 'unitedstates', america: 'unitedstates', امريكا: 'unitedstates', الولاياتالمتحده: 'unitedstates', الولاياتالمتحدهالامريكيه: 'unitedstates', الولاياتالمتحدة: 'unitedstates',
  bosnia: 'bosniaherzegovina', bosniaherzegovina: 'bosniaherzegovina', bosniaandherzegovina: 'bosniaherzegovina', bih: 'bosniaherzegovina', البوسنه: 'bosniaherzegovina', البوسنهوالهرسك: 'bosniaherzegovina', البوسنةوالهرسك: 'bosniaherzegovina', بوسنهوالهرسك: 'bosniaherzegovina', بوسنةوالهرسك: 'bosniaherzegovina',
  senegal: 'senegal', السنغال: 'senegal',
  belgium: 'belgium', بلجيكا: 'belgium', بلجيكه: 'belgium',
  croatia: 'croatia', كرواتيا: 'croatia',
  portugal: 'portugal', البرتغال: 'portugal',
  spain: 'spain', اسبانيا: 'spain', اسبانيه: 'spain',
  austria: 'austria', النمسا: 'austria',
  switzerland: 'switzerland', سويسرا: 'switzerland',
  algeria: 'algeria', الجزائر: 'algeria',
  australia: 'australia', استراليا: 'australia', استراليه: 'australia',
  egypt: 'egypt', مصر: 'egypt',
  france: 'france', فرنسا: 'france',
  sweden: 'sweden', السويد: 'sweden',
  germany: 'germany', deutschland: 'germany', المانيا: 'germany', المانيه: 'germany',
  paraguay: 'paraguay', باراغواي: 'paraguay', باراجواي: 'paraguay', الباراغواي: 'paraguay',
  netherlands: 'netherlands', holland: 'netherlands', هولندا: 'netherlands', هولنده: 'netherlands',
  morocco: 'morocco', maroc: 'morocco', المغرب: 'morocco',
  cotedivoire: 'cotedivoire', ivorycoast: 'cotedivoire', ساحلالعاج: 'cotedivoire', كوتديفوار: 'cotedivoire', كوتديفوار: 'cotedivoire',
  norway: 'norway', النرويج: 'norway',
  mexico: 'mexico', المكسيك: 'mexico',
  canada: 'canada', كندا: 'canada',
  brazil: 'brazil', البرازيل: 'brazil',
  argentina: 'argentina', الارجنتين: 'argentina', الأرجنتين: 'argentina',
  england: 'england', انجلترا: 'england', انكلترا: 'england',
  italy: 'italy', ايطاليا: 'italy', ايطاليه: 'italy',
  uruguay: 'uruguay', اوروغواي: 'uruguay', الاوروغواي: 'uruguay',
  colombia: 'colombia', كولومبيا: 'colombia',
  japan: 'japan', اليابان: 'japan',
  southkorea: 'southkorea', korearepublic: 'southkorea', korea: 'southkorea', كورياالجنوبيه: 'southkorea', كوريا: 'southkorea',
  iran: 'iran', ايران: 'iran',
  qatar: 'qatar', قطر: 'qatar',
  saudiarabia: 'saudiarabia', السعوديه: 'saudiarabia', السعودية: 'saudiarabia',
  jordan: 'jordan', الاردن: 'jordan', الأردن: 'jordan',
  tunisia: 'tunisia', تونس: 'tunisia',
  nigeria: 'nigeria', نيجيريا: 'nigeria',
  ghana: 'ghana', غانا: 'ghana',
  cameroon: 'cameroon', الكاميرون: 'cameroon',
  southafrica: 'southafrica', جنوبافريقيا: 'southafrica',
  turkey: 'turkey', turkiye: 'turkey', تركيا: 'turkey',
  denmark: 'denmark', الدنمارك: 'denmark',
  poland: 'poland', بولندا: 'poland',
  ukraine: 'ukraine', اوكرانيا: 'ukraine', أوكرانيا: 'ukraine',
  serbia: 'serbia', صربيا: 'serbia',
  scotland: 'scotland', اسكتلندا: 'scotland',
  wales: 'wales', ويلز: 'wales',
  chile: 'chile', تشيلي: 'chile',
  peru: 'peru', بيرو: 'peru',
  ecuador: 'ecuador', الاكوادور: 'ecuador', الإكوادور: 'ecuador',
  bolivia: 'bolivia', بوليفيا: 'bolivia',
  venezuela: 'venezuela', فنزويلا: 'venezuela',
  costarica: 'costarica', كوستاريكا: 'costarica',
  panama: 'panama', بنما: 'panama',
  jamaica: 'jamaica', جامايكا: 'jamaica',
  curacao: 'curacao', كوراساو: 'curacao',
  newzealand: 'newzealand', نيوزيلندا: 'newzealand',
  mali: 'mali', مالي: 'mali',
  guinea: 'guinea', غينيا: 'guinea',
  congo: 'congo', الكونغو: 'congo',
  drcongo: 'democraticrepublicofcongo', democraticrepublicofcongo: 'democraticrepublicofcongo', الكونغوالديمقراطيه: 'democraticrepublicofcongo', الكونغوالديمقراطية: 'democraticrepublicofcongo',
  capeverde: 'capeverde', caboverde: 'capeverde', الراسالاخضر: 'capeverde', كابفيردي: 'capeverde',
  uzbekistan: 'uzbekistan', اوزبكستان: 'uzbekistan', أوزبكستان: 'uzbekistan',
  iraq: 'iraq', العراق: 'iraq',
  uae: 'unitedarabemirates', unitedarabemirates: 'unitedarabemirates', الامارات: 'unitedarabemirates', الإمارات: 'unitedarabemirates', الاماراتالعربيهالمتحده: 'unitedarabemirates',
  china: 'china', الصين: 'china',
  thailand: 'thailand', تايلاند: 'thailand',
  vietnam: 'vietnam', فيتنام: 'vietnam',
  indonesia: 'indonesia', اندونيسيا: 'indonesia', إندونيسيا: 'indonesia',
  slovakia: 'slovakia', سلوفاكيا: 'slovakia',
  slovenia: 'slovenia', سلوفينيا: 'slovenia',
  czechia: 'czechia', czechrepublic: 'czechia', التشيك: 'czechia', تشيكيا: 'czechia',
  romania: 'romania', رومانيا: 'romania',
  hungary: 'hungary', المجر: 'hungary', هنغاريا: 'hungary',
  iceland: 'iceland', ايسلندا: 'iceland', آيسلندا: 'iceland',
  greece: 'greece', اليونان: 'greece',
  finland: 'finland', فنلندا: 'finland',
  bulgaria: 'bulgaria', بلغاريا: 'bulgaria',
}));

function teamKey(value) {
  const key = normalize(value);
  return ALIASES.get(key) || key;
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = arabicDigitsToLatin(value).trim();
    if (/^(live|مباشر|scheduled|finished|final|pending|بانتظار|لم\s*تبدأ|لم\s*تبدا)$/i.test(cleaned)) return null;
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object') {
    for (const key of ['value', 'displayValue', 'score', 'goals', 'current', 'total']) {
      const n = scoreNumber(value[key]);
      if (n !== null) return n;
    }
  }
  return null;
}

function pairFromText(value) {
  const cleaned = arabicDigitsToLatin(toText(value));
  const m = cleaned.match(/(\d+)\s*[-–—:]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

function firstScore(...values) {
  for (const value of values) {
    const n = scoreNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function scoreFromLinescores(linescores) {
  if (!Array.isArray(linescores)) return null;
  let total = 0;
  let seen = false;
  for (const row of linescores) {
    const n = firstScore(row?.score, row?.value, row?.displayValue, row?.points, row?.goals);
    if (n !== null) { total += n; seen = true; }
  }
  return seen ? total : null;
}

function espnCompetitorScore(competitor) {
  const direct = firstScore(
    competitor?.score,
    competitor?.displayScore,
    competitor?.scoreDisplay,
    competitor?.scoreValue,
    competitor?.score?.value,
    competitor?.score?.displayValue,
    competitor?.result?.score,
    competitor?.statistics?.score,
    competitor?.statistics?.goals,
    competitor?.team?.score,
  );
  if (direct !== null) return direct;
  return scoreFromLinescores(competitor?.linescores) ?? scoreFromLinescores(competitor?.lineScores) ?? null;
}

function scoreFromObject(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const n = scoreNumber(obj[key]);
    if (n !== null) return n;
  }
  return null;
}

function espnPenaltyScore(competitor, competition, side) {
  const sideKeys = side === 'home' ? ['home', 'team1', 'h'] : ['away', 'team2', 'a'];
  const direct = firstScore(
    competitor?.shootoutScore,
    competitor?.penaltyScore,
    competitor?.penalties,
    competitor?.penalty,
    competitor?.scorePenalty,
    competitor?.score?.shootoutScore,
    competitor?.score?.penaltyScore,
  );
  if (direct !== null) return direct;

  const containers = [
    competitor?.penalties,
    competitor?.penalty,
    competitor?.shootout,
    competitor?.shootoutScore,
    competitor?.penaltyScore,
    competitor?.scorePenalty,
    competitor?.score?.penalties,
    competitor?.score?.shootout,
    competition?.penalties,
    competition?.penalty,
    competition?.shootout,
    competition?.shootoutScore,
    competition?.score?.penalties,
    competition?.score?.shootout,
  ];

  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    if (Array.isArray(container)) {
      const entry = container.find((item) => {
        const sideText = teamKey(item?.homeAway || item?.side || item?.type || item?.name || item?.team?.displayName || item?.team?.name);
        return sideKeys.map(teamKey).includes(sideText);
      });
      const n = scoreFromObject(entry, ['score', 'value', 'displayValue', 'penalties', 'shootoutScore', 'penaltyScore']);
      if (n !== null) return n;
      continue;
    }
    const n = scoreFromObject(container, [...sideKeys, `${side}Score`, `${side}_score`, `${side}Penalty`, `${side}_penalty`, `${side}Penalties`, `${side}_penalties`, 'score', 'value', 'displayValue']);
    if (n !== null) return n;
  }
  return null;
}

function valuesFromObject(obj, keys) {
  const out = [];
  for (const key of keys) {
    const value = obj?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number') out.push(String(value));
    else if (typeof value === 'object') {
      for (const subKey of ['name_ar', 'name_en', 'name', 'team_ar', 'team_en', 'team', 'displayName', 'shortDisplayName', 'abbreviation', 'country', 'countryName', 'label']) {
        if (value[subKey]) out.push(String(value[subKey]));
      }
      if (value.team && typeof value.team === 'object') {
        for (const subKey of ['name_ar', 'name_en', 'name', 'displayName', 'shortDisplayName', 'abbreviation', 'country', 'countryName']) {
          if (value.team[subKey]) out.push(String(value.team[subKey]));
        }
      }
    }
  }
  return out.filter(Boolean);
}

function extractTeamTokens(match, side) {
  const directKeys = side === 1
    ? ['team1', 'team1_ar', 'team1_en', 'home', 'home_ar', 'home_en', 'home_team', 'homeTeam', 'home_name', 'homeName', 'home_team_ar', 'home_team_en', 'country1', 'homeCountry']
    : ['team2', 'team2_ar', 'team2_en', 'away', 'away_ar', 'away_en', 'away_team', 'awayTeam', 'away_name', 'awayName', 'away_team_ar', 'away_team_en', 'country2', 'awayCountry'];
  const tokens = valuesFromObject(match, directKeys);

  const nested = side === 1
    ? [match?.teams?.[0], match?.competitors?.[0], match?.homeTeam, match?.home_team, match?.home]
    : [match?.teams?.[1], match?.competitors?.[1], match?.awayTeam, match?.away_team, match?.away];
  for (const obj of nested) {
    if (!obj || typeof obj !== 'object') continue;
    tokens.push(...valuesFromObject(obj, ['name_ar', 'name_en', 'name', 'team_ar', 'team_en', 'team', 'displayName', 'shortDisplayName', 'country', 'countryName']));
  }
  return [...new Set(tokens.map(teamKey).filter(Boolean))];
}

function matchNumber(match) {
  const candidates = [match?.number, match?.match_number, match?.matchNo, match?.match_no, match?.match, match?.id, match?.match_id, match?.code, match?.key];
  for (const value of candidates) {
    const m = toText(value).match(/(?:^|\b)M?0*(\d{1,3})(?:\b|$)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function matchId(match) {
  const n = matchNumber(match);
  if (n !== null) return `M${String(n).padStart(3, '0')}`;
  return toText(match?.id || match?.match_id || match?.code || match?.key || 'unknown');
}

function scorePairFromMatch(match) {
  const textPair = pairFromText(match?.score_text || match?.scoreText || match?.display_score || match?.displayScore || match?.result);
  if (textPair) return textPair;

  const scoreObj = match?.score;
  const candidates = [
    Array.isArray(scoreObj?.ft) ? scoreObj.ft : null,
    Array.isArray(scoreObj?.current) ? scoreObj.current : null,
    Array.isArray(scoreObj?.live) ? scoreObj.live : null,
    [match?.score1, match?.score2],
    [match?.team1_score, match?.team2_score],
    [match?.home_score, match?.away_score],
    [match?.homeScore, match?.awayScore],
    [match?.home?.score, match?.away?.score],
    [match?.teams?.[0]?.score, match?.teams?.[1]?.score],
    [match?.competitors?.[0]?.score, match?.competitors?.[1]?.score],
  ];
  for (const pair of candidates) {
    if (!pair || pair.length < 2) continue;
    const a = scoreNumber(pair[0]);
    const b = scoreNumber(pair[1]);
    if (a !== null && b !== null) return [a, b];
  }
  return null;
}

function hasReliableScore(match) {
  const pair = scorePairFromMatch(match);
  if (!pair) return false;
  const sourceText = toText(match?.score_source || match?.live_score_source || match?.score?.source || match?.score?.status_detail || match?.live_status_detail).toLowerCase();
  const s = statusText(match);
  // A synthetic 0-0 is correct only while live. After the match is past, it must be replaced by a real source.
  const isSyntheticZero = pair[0] === 0 && pair[1] === 0 && /zero|placeholder|guard|artificial|مؤقت/.test(sourceText) && !/live|مباشر/.test(s);
  return !isSyntheticZero;
}

function statusText(match) {
  return [
    match?.status,
    match?.status?.key,
    match?.status?.state,
    match?.status?.name,
    match?.status?.type,
    match?.status?.label,
    match?.status?.label_ar,
    match?.status_ar,
    match?.state,
    match?.phase,
    match?.score?.status,
    match?.score?.phase,
  ].map(toText).filter(Boolean).join(' ').toLowerCase();
}

function looksPending(match) {
  const s = statusText(match);
  return /pending|verification|await|waiting|بانتظار|ينتظر|تحديث/.test(s);
}

function isFinishedStatus(match) {
  const s = statusText(match);
  return /\b(final|finished|complete|completed|post|closed|ft)\b|انته|نهائي|مكتمل|بعد\s*التمديد|ركلات\s*الترجيح/.test(s);
}

function parseTimeOnDate(dateText, timeText) {
  const date = toText(dateText).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;

  const rawTime = arabicDigitsToLatin(toText(timeText));
  const hm = rawTime.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!hm) return Date.parse(`${date}T12:00:00+03:00`);

  let hour = Number(hm[1]);
  const minute = Number(hm[2]);
  const hasPm = /\bpm\b|م|مساء/i.test(rawTime);
  const hasAm = /\bam\b|ص|صباح/i.test(rawTime);
  if (hasPm && hour < 12) hour += 12;
  if (hasAm && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+03:00`);
}

function kickoffMs(match) {
  const direct = toText(match?.kickoff_utc || match?.kickoff_jordan || match?.datetime || match?.date_time || match?.kickoff_at || match?.start_time || match?.startTime || match?.kickoff);
  if (direct) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return parseTimeOnDate(direct, match?.time || match?.time_ar || match?.kickoff_time || match?.local_time);
    const t = Date.parse(direct);
    if (Number.isFinite(t)) return t;
  }
  return parseTimeOnDate(match?.date, match?.time || match?.time_ar || match?.kickoff_time || match?.local_time);
}

function dateKeysAroundKickoff(match) {
  const ko = kickoffMs(match);
  if (!Number.isFinite(ko)) return [];
  const keys = new Set();
  for (const offsetDays of [-1, 0, 1]) {
    const d = new Date(ko + offsetDays * 24 * 60 * 60 * 1000);
    // ESPN dates are safest in UTC because event.date is UTC.
    keys.add(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }
  return [...keys];
}

function shouldBackfill(match, nowMs) {
  if (hasReliableScore(match)) return false;
  const ko = kickoffMs(match);
  if (Number.isFinite(ko) && nowMs >= ko + FINISHED_GRACE_MINUTES * 60 * 1000) return true;
  if (isFinishedStatus(match) || looksPending(match)) return true;
  return false;
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hasTeams = Boolean(value.team1 || value.team2 || value.home || value.away || value.homeTeam || value.awayTeam || value.teams || value.competitors || value.home_team || value.away_team);
  const hasKickoff = Boolean(value.kickoff_utc || value.kickoff_jordan || value.kickoff || value.start_time || value.startTime || value.date || value.time);
  const hasStatus = Boolean(value.status || value.status_ar || value.state || value.phase || value.score?.status || value.score?.phase);
  const hasMatchNo = Boolean(value.number || value.match_number || value.matchNo || value.id || value.match_id || value.code || value.key);
  return hasTeams && (hasKickoff || hasStatus || hasMatchNo);
}

function visitMatches(root, visitor) {
  const seen = new Set();
  function walk(value, pathLabel = '$') {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (looksLikeMatch(value)) visitor(value, pathLabel);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${pathLabel}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['raw', 'metadata', 'broadcasts', 'channels'].includes(key)) continue;
      walk(child, `${pathLabel}.${key}`);
    }
  }
  walk(root);
}

async function readJson(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(WC_DIR, name), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(name, value) {
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(path.join(WC_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

function parseEspnEvent(event) {
  const competition = event?.competitions?.[0] || event?.competition || {};
  const competitors = competition?.competitors || event?.competitors || [];
  const home = competitors.find((c) => c?.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((c) => c?.homeAway === 'away') || competitors[1] || {};
  const status = competition?.status || event?.status || {};
  const type = status?.type || {};
  const combinedStatus = [type.name, type.state, type.description, type.detail, status.description, status.detail, event.status].map(toText).join(' ').toLowerCase();
  const completed = type.completed === true || status.completed === true || /\b(final|full\s*time|ft|complete|completed|post)\b/.test(combinedStatus);
  const live = !completed && (/\b(in|live|progress|halftime|half|extra|penalty)\b/.test(combinedStatus) || type.state === 'in');
  const homeName = home?.team?.displayName || home?.team?.shortDisplayName || home?.team?.name || home?.displayName || home?.name || '';
  const awayName = away?.team?.displayName || away?.team?.shortDisplayName || away?.team?.name || away?.displayName || away?.name || '';
  const parsed = {
    id: toText(event?.id || competition?.id),
    date: toText(competition?.date || event?.date),
    status: completed ? 'finished' : (live ? 'live' : 'scheduled'),
    phase: completed ? 'finished' : (live ? 'live' : 'scheduled'),
    detail: toText(status.detail || type.detail || status.description || type.description || event.shortName || event.name),
    clock: status.displayClock || status.clock || event?.clock || null,
    period: status.period || event?.period || null,
    homeName,
    awayName,
    homeKey: teamKey(homeName),
    awayKey: teamKey(awayName),
    homeScore: espnCompetitorScore(home),
    awayScore: espnCompetitorScore(away),
    homePenalty: espnPenaltyScore(home, competition, 'home'),
    awayPenalty: espnPenaltyScore(away, competition, 'away'),
    rawName: toText(event.shortName || event.name),
  };
  parsed.hasUsableScore = (parsed.status === 'live' || parsed.status === 'finished') && parsed.homeScore !== null && parsed.awayScore !== null;
  return parsed;
}

function addParam(urlText, key, value) {
  try {
    const url = new URL(urlText);
    url.searchParams.set(key, value);
    if (!url.searchParams.has('limit')) url.searchParams.set('limit', '950');
    return url.toString();
  } catch {
    const sep = urlText.includes('?') ? '&' : '?';
    return `${urlText}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchEspnEvents(dateKeys) {
  const urls = new Set([ESPN_BASE]);
  for (const dateKey of dateKeys.slice(0, MAX_FETCH_DATES)) urls.add(addParam(ESPN_BASE, 'dates', dateKey));

  const eventsById = new Map();
  const errors = [];
  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      for (const rawEvent of Array.isArray(json?.events) ? json.events : []) {
        const event = parseEspnEvent(rawEvent);
        const key = event.id || `${event.date}-${event.homeKey}-${event.awayKey}`;
        if (!eventsById.has(key)) eventsById.set(key, event);
      }
    } catch (error) {
      errors.push({ url, message: error?.message || String(error) });
    }
  }
  return { events: [...eventsById.values()], errors, urls: [...urls] };
}

function orientationFor(match, event) {
  const m1 = extractTeamTokens(match, 1);
  const m2 = extractTeamTokens(match, 2);
  if (!m1.length || !m2.length || !event.homeKey || !event.awayKey) return null;
  if (m1.includes(event.homeKey) && m2.includes(event.awayKey)) return 'same';
  if (m1.includes(event.awayKey) && m2.includes(event.homeKey)) return 'reversed';
  return null;
}

function findEspnEventForMatch(match, events) {
  const candidates = [];
  const matchKo = kickoffMs(match);
  for (const event of events) {
    if (!event.hasUsableScore) continue;
    const orientation = orientationFor(match, event);
    if (!orientation) continue;
    const eventTime = Date.parse(event.date || '');
    const timeDiff = Number.isFinite(matchKo) && Number.isFinite(eventTime) ? Math.abs(matchKo - eventTime) : 0;
    if (timeDiff && timeDiff > MAX_DATE_DIFF_MS) continue;
    candidates.push({ event, orientation, timeDiff, reason: 'espn-date-team-match' });
  }
  candidates.sort((a, b) => a.timeDiff - b.timeDiff);
  return candidates[0] || null;
}

function localKeyFor(match) {
  const n = matchNumber(match);
  const t1 = extractTeamTokens(match, 1)[0] || '';
  const t2 = extractTeamTokens(match, 2)[0] || '';
  if (n !== null) return `match:${n}`;
  if (t1 && t2) return `teams:${t1}:${t2}`;
  return '';
}

function buildLocalScoreIndex(loadedFiles) {
  const index = new Map();
  for (const file of loadedFiles) {
    visitMatches(file.data, (match, pathLabel) => {
      const pair = scorePairFromMatch(match);
      if (!pair || !hasReliableScore(match)) return;
      const base = {
        pair,
        penaltyPair: penaltyPairFromMatch(match),
        match,
        file: file.name,
        path: pathLabel,
        source: toText(match?.score_source || match?.live_score_source || match?.score?.source) || 'local-file-score',
      };
      const key = localKeyFor(match);
      if (key && !index.has(key)) index.set(key, base);
      const t1 = extractTeamTokens(match, 1)[0] || '';
      const t2 = extractTeamTokens(match, 2)[0] || '';
      if (t1 && t2) {
        const teamKeySame = `teams:${t1}:${t2}`;
        const teamKeyReverse = `teams:${t2}:${t1}`;
        if (!index.has(teamKeySame)) index.set(teamKeySame, { ...base, orientation: 'same' });
        if (!index.has(teamKeyReverse)) index.set(teamKeyReverse, { ...base, orientation: 'reversed' });
      }
    });
  }
  return index;
}

function penaltyPairFromMatch(match) {
  const score = match?.score;
  const candidates = [
    Array.isArray(score?.p) ? score.p : null,
    Array.isArray(score?.penalties) ? score.penalties : null,
    [match?.penalty_home_score, match?.penalty_away_score],
    [match?.home_penalties, match?.away_penalties],
    [match?.team1_penalties, match?.team2_penalties],
  ];
  for (const pair of candidates) {
    if (!pair || pair.length < 2) continue;
    const a = scoreNumber(pair[0]);
    const b = scoreNumber(pair[1]);
    if (a !== null && b !== null) return [a, b];
  }
  return null;
}

function localScoreForMatch(match, localIndex) {
  const key = localKeyFor(match);
  if (key && localIndex.has(key)) return { ...localIndex.get(key), reason: 'local-same-match' };
  const t1 = extractTeamTokens(match, 1)[0] || '';
  const t2 = extractTeamTokens(match, 2)[0] || '';
  if (t1 && t2) {
    const same = localIndex.get(`teams:${t1}:${t2}`);
    if (same) return { ...same, reason: 'local-team-match', orientation: 'same' };
    const rev = localIndex.get(`teams:${t2}:${t1}`);
    if (rev) return { ...rev, reason: 'local-team-match', orientation: 'reversed' };
  }
  return null;
}

function setStatusFinished(match, label = 'انتهت') {
  if (typeof match.status === 'object' && match.status !== null && !Array.isArray(match.status)) {
    match.status.key = 'finished';
    match.status.state = match.status.state || 'post';
    match.status.label_ar = label;
    match.status.label = match.status.label || 'Finished';
  } else {
    match.status = { key: 'finished', state: 'post', label_ar: label, label: 'Finished' };
  }
  match.status_ar = label;
  match.live_phase = 'finished';
}

function writeScoreFields(match, score1, score2, options = {}) {
  const before = JSON.stringify({
    status: match.status,
    status_ar: match.status_ar,
    score: match.score,
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    score_text: match.score_text,
    winner_side: match.winner_side,
    loser_side: match.loser_side,
  });

  const score = (match.score && typeof match.score === 'object' && !Array.isArray(match.score)) ? { ...match.score } : {};
  score.source = options.source || 'finished-score-backfill';
  score.status = 'finished';
  score.phase = 'finished';
  score.current = [score1, score2];
  score.ft = [score1, score2];
  score.checked_at = options.nowIso;
  score.verified_at = options.nowIso;
  if (options.eventId) score.event_id = options.eventId;
  if (options.detail) score.status_detail = options.detail;
  delete score.score_pending;
  delete score.placeholder_score;

  const penaltyPair = options.penaltyPair || null;
  if (penaltyPair) {
    score.p = penaltyPair;
    score.penalties = { home: penaltyPair[0], away: penaltyPair[1], team1: penaltyPair[0], team2: penaltyPair[1] };
    match.penalty_home_score = penaltyPair[0];
    match.penalty_away_score = penaltyPair[1];
    match.home_penalties = penaltyPair[0];
    match.away_penalties = penaltyPair[1];
  }

  match.score = score;
  match.score1 = score1;
  match.score2 = score2;
  match.team1_score = score1;
  match.team2_score = score2;
  match.home_score = score1;
  match.away_score = score2;
  match.homeScore = score1;
  match.awayScore = score2;
  match.score_text = `${score1} - ${score2}`;
  match.score_source = options.source || 'finished-score-backfill';
  match.live_score_source = options.source || 'finished-score-backfill';
  match.live_checked_at = options.nowIso;
  match.finished_score_verified_at = options.nowIso;
  if (options.eventId) match.espn_event_id = options.eventId;
  if (options.detail) match.live_status_detail = options.detail;
  setStatusFinished(match, options.labelAr || 'انتهت');

  let winnerSide = null;
  if (penaltyPair && penaltyPair[0] !== penaltyPair[1]) winnerSide = penaltyPair[0] > penaltyPair[1] ? 1 : 2;
  else if (score1 !== score2) winnerSide = score1 > score2 ? 1 : 2;
  if (winnerSide) {
    match.winner_side = winnerSide;
    match.loser_side = winnerSide === 1 ? 2 : 1;
    match.winner = winnerSide;
    match.loser = winnerSide === 1 ? 2 : 1;
    score.winner_side = winnerSide;
  }

  const after = JSON.stringify({
    status: match.status,
    status_ar: match.status_ar,
    score: match.score,
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    score_text: match.score_text,
    winner_side: match.winner_side,
    loser_side: match.loser_side,
  });
  return before !== after;
}

async function main() {
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = ammanIso(now);
  const loadedFiles = [];

  for (const name of TARGET_FILES) {
    const data = await readJson(name);
    if (data) loadedFiles.push({ name, data, changed: false, scanned: 0, stale: 0, localUpdates: 0, espnUpdates: 0, unresolved: [] });
  }

  const allStaleDateKeys = new Set();
  for (const file of loadedFiles) {
    visitMatches(file.data, (match) => {
      if (shouldBackfill(match, nowMs)) {
        for (const key of dateKeysAroundKickoff(match)) allStaleDateKeys.add(key);
      }
    });
  }

  const localIndex = buildLocalScoreIndex(loadedFiles);
  let espnFetch = { events: [], errors: [], urls: [] };
  if (allStaleDateKeys.size) {
    espnFetch = await fetchEspnEvents([...allStaleDateKeys]);
  }

  const updates = [];
  for (const file of loadedFiles) {
    const before = JSON.stringify(file.data);
    visitMatches(file.data, (match, pathLabel) => {
      file.scanned += 1;
      if (!shouldBackfill(match, nowMs)) return;
      file.stale += 1;

      const beforeScore = scorePairFromMatch(match);
      const local = localScoreForMatch(match, localIndex);
      if (local?.pair) {
        let pair = local.pair;
        let penaltyPair = local.penaltyPair;
        if (local.orientation === 'reversed') {
          pair = [pair[1], pair[0]];
          if (penaltyPair) penaltyPair = [penaltyPair[1], penaltyPair[0]];
        }
        const changed = writeScoreFields(match, pair[0], pair[1], {
          nowIso,
          source: `finished-score-backfill:${local.source}`,
          penaltyPair,
          detail: 'Copied verified score from another World Cup data file',
          labelAr: 'انتهت',
        });
        if (changed) {
          file.localUpdates += 1;
          updates.push({ file: file.name, path: pathLabel, match: matchId(match), reason: local.reason, from_file: local.file, before_score: beforeScore, after_score: pair });
        }
        return;
      }

      const found = findEspnEventForMatch(match, espnFetch.events);
      if (found?.event) {
        const pair = found.orientation === 'reversed'
          ? [found.event.awayScore, found.event.homeScore]
          : [found.event.homeScore, found.event.awayScore];
        const penaltyPair = found.event.homePenalty !== null && found.event.awayPenalty !== null
          ? (found.orientation === 'reversed' ? [found.event.awayPenalty, found.event.homePenalty] : [found.event.homePenalty, found.event.awayPenalty])
          : null;
        const labelAr = penaltyPair ? 'انتهت بركلات الترجيح' : (found.event.detail && /extra|aet|تمديد/i.test(found.event.detail) ? 'انتهت بعد التمديد' : 'انتهت');
        const changed = writeScoreFields(match, pair[0], pair[1], {
          nowIso,
          source: 'espn-finished-score-backfill',
          eventId: found.event.id,
          detail: found.event.detail,
          penaltyPair,
          labelAr,
        });
        if (changed) {
          file.espnUpdates += 1;
          updates.push({ file: file.name, path: pathLabel, match: matchId(match), reason: found.reason, event_id: found.event.id, event: `${found.event.homeName} vs ${found.event.awayName}`, before_score: beforeScore, after_score: pair, time_diff_minutes: found.timeDiff ? Math.round(found.timeDiff / 60000) : 0 });
        }
        return;
      }

      file.unresolved.push({
        match: matchId(match),
        path: pathLabel,
        teams: [extractTeamTokens(match, 1)[0] || '', extractTeamTokens(match, 2)[0] || ''],
        kickoff: Number.isFinite(kickoffMs(match)) ? new Date(kickoffMs(match)).toISOString() : null,
        status: statusText(match),
        before_score: beforeScore,
      });
    });

    if (JSON.stringify(file.data) !== before) {
      file.changed = true;
      if (file.data && typeof file.data === 'object' && !Array.isArray(file.data)) {
        file.data.finished_score_backfill = {
          version: VERSION,
          checked_at: nowIso,
          note_ar: 'يعالج المباريات التي انتهى وقتها وبقيت بانتظار التحديث عبر نسخ النتيجة من ملفات الموقع أو جلبها من ESPN حسب تاريخ المباراة.',
        };
      }
      await writeJson(file.name, file.data);
    }
  }

  const status = {
    name: 'World Cup 2026 finished score backfill',
    name_ar: 'إصلاح نتائج المباريات المنتهية العالقة بانتظار التحديث',
    version: VERSION,
    checked_at: nowIso,
    timezone: TIMEZONE,
    finished_grace_minutes: FINISHED_GRACE_MINUTES,
    source: ESPN_BASE,
    date_keys_fetched: [...allStaleDateKeys].slice(0, MAX_FETCH_DATES),
    espn_urls_requested: espnFetch.urls,
    espn_events_seen: espnFetch.events.length,
    errors: espnFetch.errors,
    files: loadedFiles.map((file) => ({
      file: file.name,
      scanned: file.scanned,
      stale_missing_scores: file.stale,
      local_updates: file.localUpdates,
      espn_updates: file.espnUpdates,
      changed: file.changed,
      unresolved: file.unresolved.slice(0, 50),
      unresolved_count: file.unresolved.length,
    })),
    totals: loadedFiles.reduce((acc, file) => {
      acc.scanned += file.scanned;
      acc.stale_missing_scores += file.stale;
      acc.local_updates += file.localUpdates;
      acc.espn_updates += file.espnUpdates;
      acc.changed_files += file.changed ? 1 : 0;
      acc.unresolved += file.unresolved.length;
      return acc;
    }, { scanned: 0, stale_missing_scores: 0, local_updates: 0, espn_updates: 0, changed_files: 0, unresolved: 0 }),
    updates,
    ok: espnFetch.errors.length === 0 || updates.length > 0,
  };
  await writeJson('finished-score-backfill-status.json', status);
  console.log(`[${VERSION}]`, JSON.stringify(status.totals));
}

main().catch(async (error) => {
  const status = {
    name: 'World Cup 2026 finished score backfill',
    name_ar: 'إصلاح نتائج المباريات المنتهية العالقة بانتظار التحديث',
    version: VERSION,
    checked_at: ammanIso(),
    ok: false,
    errors: [{ step: 'main', message: error?.stack || error?.message || String(error) }],
  };
  try { await writeJson('finished-score-backfill-status.json', status); } catch {}
  console.error(error);
  process.exit(1);
});
