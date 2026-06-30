import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const VERSION = '2026-07-01-live-score-repair-v1';
const ESPN_BASE = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL
  || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=950';

const TARGET_FILES = [
  'matches.json',
  'bracket.json',
  'knockout-live.json',
];

function nowAmmanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

async function fileExists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function readJsonIfExists(name) {
  const file = path.join(WC_DIR, name);
  if (!await fileExists(file)) return null;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(name, value) {
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(path.join(WC_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function deepGet(obj, pathList) {
  let current = obj;
  for (const key of pathList) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

function arabicDigitsToLatin(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = arabicDigitsToLatin(value);
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

function firstScore(...values) {
  for (const value of values) {
    const n = scoreNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function scoreFromLineScores(linescores) {
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
    competitor?.score?.score,
    competitor?.result?.score,
    competitor?.statistics?.score,
    competitor?.statistics?.goals,
    competitor?.team?.score
  );
  if (direct !== null) return direct;
  return scoreFromLineScores(competitor?.linescores) ?? scoreFromLineScores(competitor?.lineScores) ?? null;
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
    competitor?.score?.penaltyScore
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
        const sideText = normalize(item?.homeAway || item?.side || item?.type || item?.name || item?.team?.displayName || item?.team?.name);
        return sideKeys.some((k) => sideText === normalize(k));
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

function normalize(value) {
  return text(value)
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
    .replace(/\b(fc|cf|sc|nt|team|national|republic of|the)\b/g, '')
    .replace(/[^a-z0-9ء-ي]/g, '');
}

const ALIASES = new Map(Object.entries({
  france: 'france', frenchrepublic: 'france', فرنسا: 'france',
  sweden: 'sweden', السويد: 'sweden',
  germany: 'germany', deutschland: 'germany', المانيا: 'germany', المانيه: 'germany',
  paraguay: 'paraguay', باراغواي: 'paraguay', الباراغواي: 'paraguay', باراجواي: 'paraguay',
  netherlands: 'netherlands', holland: 'netherlands', هولندا: 'netherlands', هولنده: 'netherlands',
  morocco: 'morocco', maroc: 'morocco', المغرب: 'morocco',
  cotedivoire: 'cotedivoire', ivorycoast: 'cotedivoire', ساحلالعاج: 'cotedivoire', كوتديفوار: 'cotedivoire',
  norway: 'norway', النرويج: 'norway',
  usa: 'unitedstates', us: 'unitedstates', unitedstates: 'unitedstates', unitedstatesofamerica: 'unitedstates', امريكا: 'unitedstates', الولاياتالمتحده: 'unitedstates', الولاياتالمتحدهالامريكيه: 'unitedstates',
  mexico: 'mexico', المكسيك: 'mexico',
  canada: 'canada', كندا: 'canada',
  brazil: 'brazil', البرازيل: 'brazil',
  argentina: 'argentina', الارجنتين: 'argentina',
  england: 'england', انجلترا: 'england', انكلترا: 'england',
  spain: 'spain', اسبانيا: 'spain',
  portugal: 'portugal', البرتغال: 'portugal',
  italy: 'italy', ايطاليا: 'italy',
  belgium: 'belgium', بلجيكا: 'belgium',
  croatia: 'croatia', كرواتيا: 'croatia',
  uruguay: 'uruguay', اوروغواي: 'uruguay', الاوروغواي: 'uruguay',
  colombia: 'colombia', كولومبيا: 'colombia',
  japan: 'japan', اليابان: 'japan',
  southkorea: 'southkorea', korearepublic: 'southkorea', korea: 'southkorea', كورياالجنوبيه: 'southkorea', كوريا: 'southkorea',
  australia: 'australia', استراليا: 'australia',
  iran: 'iran', ايران: 'iran',
  qatar: 'qatar', قطر: 'qatar',
  saudiarabia: 'saudiarabia', السعوديه: 'saudiarabia', المملكهالعربيهالسعوديه: 'saudiarabia',
  jordan: 'jordan', الاردن: 'jordan', النشامي: 'jordan',
  egypt: 'egypt', مصر: 'egypt',
  tunisia: 'tunisia', تونس: 'tunisia',
  algeria: 'algeria', الجزائر: 'algeria',
  senegal: 'senegal', السنغال: 'senegal',
  nigeria: 'nigeria', نيجيريا: 'nigeria',
  ghana: 'ghana', غانا: 'ghana',
  cameroon: 'cameroon', الكاميرون: 'cameroon',
  southafrica: 'southafrica', جنوبافريقيا: 'southafrica',
  turkey: 'turkey', turkiye: 'turkey', تركيا: 'turkey',
  denmark: 'denmark', الدنمارك: 'denmark',
  poland: 'poland', بولندا: 'poland',
  switzerland: 'switzerland', سويسرا: 'switzerland',
  austria: 'austria', النمسا: 'austria',
  ukraine: 'ukraine', اوكرانيا: 'ukraine',
  serbia: 'serbia', صربيا: 'serbia',
  scotland: 'scotland', اسكتلندا: 'scotland',
  wales: 'wales', ويلز: 'wales',
  ireland: 'ireland', ايرلندا: 'ireland',
  chile: 'chile', تشيلي: 'chile',
  peru: 'peru', بيرو: 'peru',
  ecuador: 'ecuador', الاكوادور: 'ecuador',
  bolivia: 'bolivia', بوليفيا: 'bolivia',
  venezuela: 'venezuela', فنزويلا: 'venezuela',
  costaRica: 'costarica', costarica: 'costarica', كوستاريكا: 'costarica',
  panama: 'panama', بنما: 'panama',
  jamaica: 'jamaica', جامايكا: 'jamaica',
  curacao: 'curacao', كوراساو: 'curacao',
  newzealand: 'newzealand', نيوزيلندا: 'newzealand',
  mali: 'mali', مالي: 'mali',
  guinea: 'guinea', غينيا: 'guinea',
  congo: 'congo', الكونغو: 'congo',
  democraticrepublicofcongo: 'democraticrepublicofcongo', drcongo: 'democraticrepublicofcongo', الكونغوالديمقراطيه: 'democraticrepublicofcongo',
  capeverde: 'capeverde', caboverde: 'capeverde', الراسالاخضر: 'capeverde', كابفيردي: 'capeverde',
  uzbekistan: 'uzbekistan', اوزبكستان: 'uzbekistan',
  iraq: 'iraq', العراق: 'iraq',
  uae: 'unitedarabemirates', unitedarabemirates: 'unitedarabemirates', الامارات: 'unitedarabemirates', الاماراتالعربيهالمتحده: 'unitedarabemirates',
  china: 'china', الصين: 'china',
  thailand: 'thailand', تايلاند: 'thailand',
  vietnam: 'vietnam', فيتنام: 'vietnam',
  indonesia: 'indonesia', اندونيسيا: 'indonesia',
}));

function teamKey(value) {
  const key = normalize(value);
  return ALIASES.get(key) || key;
}

function valuesFromObject(obj, keys) {
  const out = [];
  for (const key of keys) {
    const value = obj?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number') out.push(String(value));
    else if (typeof value === 'object') {
      for (const subKey of ['name_ar', 'name_en', 'name', 'team_ar', 'team_en', 'team', 'displayName', 'shortDisplayName', 'abbreviation', 'country']) {
        if (value[subKey]) out.push(String(value[subKey]));
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
    ? [match?.teams?.[0], match?.competitors?.[0], match?.homeTeam, match?.home_team]
    : [match?.teams?.[1], match?.competitors?.[1], match?.awayTeam, match?.away_team];
  for (const obj of nested) {
    if (!obj || typeof obj !== 'object') continue;
    tokens.push(...valuesFromObject(obj, ['name_ar', 'name_en', 'name', 'team_ar', 'team_en', 'team', 'displayName', 'shortDisplayName', 'country']));
    if (obj.team && typeof obj.team === 'object') {
      tokens.push(...valuesFromObject(obj.team, ['name_ar', 'name_en', 'name', 'displayName', 'shortDisplayName', 'abbreviation', 'country']));
    }
  }
  return [...new Set(tokens.map(teamKey).filter(Boolean))];
}

function matchNumber(match) {
  const candidates = [
    match?.number,
    match?.match_number,
    match?.matchNo,
    match?.match_no,
    match?.match,
    match?.id,
    match?.match_id,
    match?.code,
    match?.key,
  ];
  for (const value of candidates) {
    const m = text(value).match(/(?:^|\b)M?0*(\d{1,3})(?:\b|$)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function explicitEspnIds(match) {
  const values = [
    match?.espn_id,
    match?.espn_event_id,
    match?.event_id,
    match?.eventId,
    match?.score?.event_id,
    match?.score?.eventId,
    match?.live_event_id,
  ];
  return values.map((v) => text(v)).filter((v) => /^\d{3,}$/.test(v));
}

function kickoffMs(match) {
  const raw = text(
    match?.kickoff_utc
    || match?.kickoff_jordan
    || match?.datetime
    || match?.date_time
    || match?.kickoff_at
    || match?.start_time
    || match?.startTime
    || match?.kickoff
    || match?.date
  );
  if (!raw) return NaN;
  let dateText = raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const timeRaw = text(match?.time || match?.time_ar || match?.kickoff_time || match?.local_time);
    const hm = arabicDigitsToLatin(timeRaw).match(/(\d{1,2}):(\d{2})/);
    dateText = hm ? `${dateText}T${hm[1].padStart(2, '0')}:${hm[2]}:00+03:00` : `${dateText}T12:00:00+03:00`;
  }
  const t = Date.parse(dateText);
  return Number.isFinite(t) ? t : NaN;
}

function collectMatchObjects(root) {
  const results = [];
  const seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (!Array.isArray(value)) {
      const side1 = extractTeamTokens(value, 1);
      const side2 = extractTeamTokens(value, 2);
      const looksLikeMatch = side1.length && side2.length && (
        matchNumber(value) !== null
        || explicitEspnIds(value).length > 0
        || text(value.stage || value.round || value.stage_ar || value.status || value.kickoff || value.kickoff_jordan || value.date)
      );
      if (looksLikeMatch) results.push(value);
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else {
      for (const key of Object.keys(value)) {
        if (['score', 'penalties', 'channels', 'broadcasts', 'metadata'].includes(key)) continue;
        walk(value[key]);
      }
    }
  }
  walk(root);
  return results;
}

function parseEspnEvent(event) {
  const competition = event?.competitions?.[0] || event?.competition || {};
  const competitors = competition?.competitors || event?.competitors || [];
  const home = competitors.find((c) => c?.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((c) => c?.homeAway === 'away') || competitors[1] || {};
  const status = competition?.status || event?.status || {};
  const type = status?.type || {};
  const statusText = [type.name, type.state, type.description, type.detail, status.description, status.detail, event.status].map(text).join(' ').toLowerCase();
  const completed = type.completed === true || status.completed === true || /\b(final|full\s*time|ft|complete|completed|post)\b/.test(statusText);
  const live = !completed && (/\b(in|live|progress|halftime|half|extra|penalty)\b/.test(statusText) || type.state === 'in');
  const phase = completed ? 'finished' : (live ? 'live' : 'scheduled');
  const detail = text(status.detail || type.detail || status.description || type.description || event.shortName || event.name);
  const homeName = home?.team?.displayName || home?.team?.shortDisplayName || home?.team?.name || home?.displayName || home?.name || '';
  const awayName = away?.team?.displayName || away?.team?.shortDisplayName || away?.team?.name || away?.displayName || away?.name || '';
  const parsed = {
    id: text(event?.id || competition?.id),
    date: text(competition?.date || event?.date),
    status: completed ? 'finished' : (live ? 'live' : 'scheduled'),
    phase,
    detail,
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
    raw: event,
  };
  parsed.hasUsableScore = (parsed.status === 'live' || parsed.status === 'finished')
    && parsed.homeScore !== null
    && parsed.awayScore !== null;
  return parsed;
}

async function fetchEspnEvents() {
  const urls = [ESPN_BASE];
  const seen = new Set();
  const events = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const response = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!response.ok) throw new Error(`ESPN request failed ${response.status}: ${url}`);
    const json = await response.json();
    if (Array.isArray(json?.events)) events.push(...json.events.map(parseEspnEvent));
  }
  return events.filter((e) => e.id || (e.homeKey && e.awayKey));
}

function orientationFor(match, event) {
  const m1 = extractTeamTokens(match, 1);
  const m2 = extractTeamTokens(match, 2);
  if (!m1.length || !m2.length || !event.homeKey || !event.awayKey) return null;
  const same = m1.includes(event.homeKey) && m2.includes(event.awayKey);
  const reversed = m1.includes(event.awayKey) && m2.includes(event.homeKey);
  if (same) return 'same';
  if (reversed) return 'reversed';
  return null;
}

function findEventForMatch(match, events) {
  const ids = explicitEspnIds(match);
  if (ids.length) {
    const byId = events.find((event) => ids.includes(event.id) && event.hasUsableScore);
    if (byId) return { event: byId, orientation: orientationFor(match, byId) || 'same', reason: 'explicit-id' };
  }

  const matchKickoff = kickoffMs(match);
  const candidates = [];
  for (const event of events) {
    if (!event.hasUsableScore) continue;
    const orientation = orientationFor(match, event);
    if (!orientation) continue;
    const eventTime = Date.parse(event.date || '');
    const timeDiff = Number.isFinite(matchKickoff) && Number.isFinite(eventTime)
      ? Math.abs(matchKickoff - eventTime)
      : 0;
    // Same teams are enough for the knockout schedule, but prefer the closest kickoff.
    candidates.push({ event, orientation, timeDiff, reason: 'team-match' });
  }
  candidates.sort((a, b) => a.timeDiff - b.timeDiff);
  const best = candidates[0];
  if (!best) return null;
  const maxDiff = 3 * 24 * 60 * 60 * 1000;
  if (best.timeDiff && best.timeDiff > maxDiff) return null;
  return best;
}

function existingScorePair(match) {
  const sc = match?.score;
  const candidates = [
    Array.isArray(sc?.current) ? sc.current : null,
    Array.isArray(sc?.live) ? sc.live : null,
    Array.isArray(sc?.ft) ? sc.ft : null,
    [match?.score1, match?.score2],
    [match?.home_score, match?.away_score],
    [match?.team1_score, match?.team2_score],
  ];
  for (const pair of candidates) {
    if (!pair || pair.length < 2) continue;
    const a = scoreNumber(pair[0]);
    const b = scoreNumber(pair[1]);
    if (a !== null && b !== null) return [a, b];
  }
  return null;
}

function matchId(match) {
  const n = matchNumber(match);
  if (n !== null) return `M${String(n).padStart(3, '0')}`;
  return text(match?.id || match?.match_id || match?.code || match?.key || 'unknown');
}

function updateScoreFields(match, found, nowIso) {
  const { event, orientation } = found;
  const team1Score = orientation === 'reversed' ? event.awayScore : event.homeScore;
  const team2Score = orientation === 'reversed' ? event.homeScore : event.awayScore;
  const team1Penalty = orientation === 'reversed' ? event.awayPenalty : event.homePenalty;
  const team2Penalty = orientation === 'reversed' ? event.homePenalty : event.awayPenalty;
  if (team1Score === null || team2Score === null) return false;

  const before = JSON.stringify({
    status: match.status,
    score: match.score,
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    winner_side: match.winner_side,
    loser_side: match.loser_side,
  });

  const score = (match.score && typeof match.score === 'object' && !Array.isArray(match.score)) ? { ...match.score } : {};
  score.source = 'espn-live-score-repair';
  score.event_id = event.id || score.event_id || null;
  score.status = event.status;
  score.phase = event.phase;
  score.status_detail = event.detail || score.status_detail || null;
  score.checked_at = nowIso;
  score.current = [team1Score, team2Score];
  delete score.score_pending;
  delete score.placeholder_score;
  if (event.status === 'finished') score.ft = [team1Score, team2Score];
  if (event.status === 'live') score.live = [team1Score, team2Score];
  if (event.clock) score.clock = event.clock;
  if (event.period) score.period = event.period;
  if (team1Penalty !== null && team2Penalty !== null) {
    score.p = [team1Penalty, team2Penalty];
    score.penalties = { home: team1Penalty, away: team2Penalty, team1: team1Penalty, team2: team2Penalty };
    match.penalty_home_score = team1Penalty;
    match.penalty_away_score = team2Penalty;
    match.home_penalties = team1Penalty;
    match.away_penalties = team2Penalty;
  }
  match.score = score;

  // Different parts of the site read different score field names. Keep them in sync.
  match.score1 = team1Score;
  match.score2 = team2Score;
  match.team1_score = team1Score;
  match.team2_score = team2Score;
  match.home_score = team1Score;
  match.away_score = team2Score;
  match.score_source = 'espn-live-score-repair';
  match.live_score_source = 'espn-live-score-repair';
  match.espn_event_id = event.id || match.espn_event_id || null;
  match.live_checked_at = nowIso;
  match.live_status_detail = event.detail || match.live_status_detail || null;
  match.live_phase = event.phase;
  match.status = event.status;
  match.status_ar = event.status === 'finished' ? 'انتهت' : 'مباشر';

  if (event.status === 'finished') {
    let winnerSide = null;
    if (team1Penalty !== null && team2Penalty !== null && team1Penalty !== team2Penalty) {
      winnerSide = team1Penalty > team2Penalty ? 1 : 2;
    } else if (team1Score !== team2Score) {
      winnerSide = team1Score > team2Score ? 1 : 2;
    }
    if (winnerSide) {
      match.winner_side = winnerSide;
      match.loser_side = winnerSide === 1 ? 2 : 1;
      match.winner = winnerSide;
      match.loser = winnerSide === 1 ? 2 : 1;
      score.winner_side = winnerSide;
    }
  }

  const after = JSON.stringify({
    status: match.status,
    score: match.score,
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    winner_side: match.winner_side,
    loser_side: match.loser_side,
  });
  return before !== after;
}

async function main() {
  const nowIso = nowAmmanIso();
  const status = {
    name: 'World Cup 2026 live score repair',
    name_ar: 'إصلاح نتائج مباريات كأس العالم 2026 المباشرة',
    version: VERSION,
    checked_at: nowIso,
    source: ESPN_BASE,
    files_checked: [],
    updates: [],
    errors: [],
  };

  let events = [];
  try {
    events = await fetchEspnEvents();
    status.espn_events = events.length;
  } catch (error) {
    status.errors.push({ step: 'fetch-espn', message: error?.message || String(error) });
    await writeJson('live-score-repair-status.json', status);
    console.log('[worldcup-live-score-repair] ESPN fetch failed; wrote status file only.');
    return;
  }

  for (const file of TARGET_FILES) {
    const root = await readJsonIfExists(file);
    if (!root) continue;
    const matches = collectMatchObjects(root);
    const fileStatus = { file, matches_seen: matches.length, updated: 0 };
    status.files_checked.push(fileStatus);

    for (const match of matches) {
      const found = findEventForMatch(match, events);
      if (!found) continue;
      const beforeScore = existingScorePair(match);
      const changed = updateScoreFields(match, found, nowIso);
      if (!changed) continue;
      const afterScore = existingScorePair(match);
      fileStatus.updated += 1;
      status.updates.push({
        file,
        match: matchId(match),
        event_id: found.event.id,
        reason: found.reason,
        orientation: found.orientation,
        teams: [extractTeamTokens(match, 1)[0] || '', extractTeamTokens(match, 2)[0] || ''],
        before_score: beforeScore,
        after_score: afterScore,
        event_status: found.event.status,
        event_detail: found.event.detail || '',
      });
    }

    if (fileStatus.updated > 0) await writeJson(file, root);
  }

  status.updated_matches = status.updates.length;
  status.ok = status.errors.length === 0;
  await writeJson('live-score-repair-status.json', status);
  console.log(`[worldcup-live-score-repair] updated ${status.updated_matches} match object(s).`);
}

main().catch(async (error) => {
  const status = {
    name: 'World Cup 2026 live score repair',
    name_ar: 'إصلاح نتائج مباريات كأس العالم 2026 المباشرة',
    version: VERSION,
    checked_at: nowAmmanIso(),
    ok: false,
    errors: [{ step: 'main', message: error?.stack || error?.message || String(error) }],
  };
  try { await writeJson('live-score-repair-status.json', status); } catch {}
  console.error(error);
  process.exit(1);
});
