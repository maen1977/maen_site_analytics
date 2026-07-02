import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const VERSION = '2026-07-02-live-zero-score-guard-v1';
const TARGET_FILES = [
  'matches.json',
  'bracket.json',
  'knockout-live.json',
];

const LIVE_WINDOW_MS = Number(process.env.WORLD_CUP_2026_LIVE_WINDOW_MINUTES || 270) * 60 * 1000;

function ammanIso(date = new Date()) {
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

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = arabicDigitsToLatin(value).trim();
    if (/^(live|مباشر|لم تبدأ|لم تبدا|scheduled|finished|انتهت)$/i.test(cleaned)) return null;
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

function scorePairFromMatch(match) {
  const textPair = pairFromText(match?.score_text || match?.scoreText || match?.result || match?.display_score || match?.displayScore || match?.score);
  if (textPair) return textPair;

  const one = firstScore(
    match?.score1,
    match?.team1_score,
    match?.team1Score,
    match?.home_score,
    match?.homeScore,
    match?.home?.score,
    match?.homeTeam?.score,
    match?.teams?.[0]?.score,
    match?.competitors?.[0]?.score
  );
  const two = firstScore(
    match?.score2,
    match?.team2_score,
    match?.team2Score,
    match?.away_score,
    match?.awayScore,
    match?.away?.score,
    match?.awayTeam?.score,
    match?.teams?.[1]?.score,
    match?.competitors?.[1]?.score
  );

  if (one !== null || two !== null) return [one ?? 0, two ?? 0];
  return null;
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
  ].map(toText).filter(Boolean).join(' ').toLowerCase();
}

function isFinished(match) {
  const s = statusText(match);
  return /\b(final|finished|complete|completed|post|closed|ft)\b|انته|نهائي|مكتمل/.test(s);
}

function isLiveStatus(match) {
  if (isFinished(match)) return false;
  const s = statusText(match);
  return /\b(live|in|progress|halftime|half|extra|penalty)\b|مباشر|الشوط|استراحة|ركلات|ترجيح/.test(s);
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
  const direct = toText(
    match?.kickoff_utc ||
    match?.kickoff_jordan ||
    match?.datetime ||
    match?.date_time ||
    match?.kickoff_at ||
    match?.start_time ||
    match?.startTime ||
    match?.kickoff
  );

  if (direct) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) {
      return parseTimeOnDate(direct, match?.time || match?.time_ar || match?.kickoff_time || match?.local_time);
    }
    const t = Date.parse(direct);
    if (Number.isFinite(t)) return t;
  }

  return parseTimeOnDate(match?.date, match?.time || match?.time_ar || match?.kickoff_time || match?.local_time);
}

function shouldBeLiveNow(match, nowMs) {
  if (isFinished(match)) return false;
  const ko = kickoffMs(match);
  if (!Number.isFinite(ko)) return isLiveStatus(match);

  if (nowMs < ko) return false;
  if (nowMs > ko + LIVE_WINDOW_MS) return isLiveStatus(match);
  return true;
}

function ensureLiveStatus(match) {
  if (typeof match.status === 'object' && match.status !== null && !Array.isArray(match.status)) {
    match.status.key = 'live';
    match.status.label_ar = match.status.label_ar || 'مباشر';
    match.status.label = match.status.label || 'Live';
    return;
  }
  if (!match.status || typeof match.status === 'string') {
    match.status = { key: 'live', label_ar: 'مباشر', label: 'Live' };
  }
}

function clearFalseFutureLive(match, nowMs) {
  const ko = kickoffMs(match);
  if (!Number.isFinite(ko) || nowMs >= ko || !isLiveStatus(match)) return false;

  if (typeof match.status === 'object' && match.status !== null && !Array.isArray(match.status)) {
    match.status.key = 'scheduled';
    match.status.label_ar = 'لم تبدأ';
    match.status.label = 'Scheduled';
  } else {
    match.status = { key: 'scheduled', label_ar: 'لم تبدأ', label: 'Scheduled' };
  }

  // Do not show 0-0 before kickoff. Remove only artificial zero pairs that this guard could add.
  if (scoreNumber(match.score1) === 0 && scoreNumber(match.score2) === 0) {
    delete match.score1;
    delete match.score2;
  }
  return true;
}

function writeScoreFields(match, score1, score2) {
  let changed = false;
  const before = JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
  });

  match.score1 = score1;
  match.score2 = score2;
  match.home_score = score1;
  match.away_score = score2;
  match.homeScore = score1;
  match.awayScore = score2;
  match.team1_score = score1;
  match.team2_score = score2;
  match.score_text = `${score1} - ${score2}`;

  const after = JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
  });
  changed = before !== after;
  return changed;
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hasStatus = Boolean(value.status || value.status_ar || value.state || value.phase);
  const hasKickoff = Boolean(value.kickoff_utc || value.kickoff_jordan || value.kickoff || value.start_time || value.startTime || value.date || value.time);
  const hasTeams = Boolean(value.team1 || value.team2 || value.home || value.away || value.homeTeam || value.awayTeam || value.teams || value.competitors);
  const hasMatchNo = Boolean(value.number || value.match_number || value.matchNo || value.id || value.match_id);
  return (hasStatus && (hasKickoff || hasTeams || hasMatchNo)) || (hasTeams && hasKickoff);
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
      if (key === 'raw' || key === 'metadata') continue;
      walk(child, `${pathLabel}.${key}`);
    }
  }
  walk(root);
}

async function readJson(name) {
  try {
    const file = path.join(WC_DIR, name);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(name, value) {
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(path.join(WC_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

async function processFile(name, nowMs) {
  const data = await readJson(name);
  if (!data) return { file: name, exists: false, changed: false, liveZeroFilled: 0, preservedScore: 0, futureLiveCleared: 0, scanned: 0 };

  const before = JSON.stringify(data);
  const result = { file: name, exists: true, changed: false, liveZeroFilled: 0, preservedScore: 0, futureLiveCleared: 0, scanned: 0 };

  visitMatches(data, (match) => {
    result.scanned += 1;

    if (clearFalseFutureLive(match, nowMs)) {
      result.futureLiveCleared += 1;
      return;
    }

    if (!shouldBeLiveNow(match, nowMs)) return;

    const existing = scorePairFromMatch(match);
    if (existing) {
      if (writeScoreFields(match, existing[0], existing[1])) result.preservedScore += 1;
      ensureLiveStatus(match);
      return;
    }

    if (writeScoreFields(match, 0, 0)) result.liveZeroFilled += 1;
    ensureLiveStatus(match);
  });

  const after = JSON.stringify(data);
  if (after !== before) {
    result.changed = true;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      data.live_zero_score_guard = {
        version: VERSION,
        checked_at: ammanIso(new Date(nowMs)),
        note_ar: 'أثناء المباريات المباشرة تعرض النتيجة 0 - 0 إذا لم تصل النتيجة بعد، ولا يتم وضع 0 - 0 قبل بداية المباراة.',
      };
    }
    await writeJson(name, data);
  }

  return result;
}

async function main() {
  const nowMs = Date.now();
  const files = [];
  for (const name of TARGET_FILES) files.push(await processFile(name, nowMs));

  const summary = {
    version: VERSION,
    checked_at: ammanIso(new Date(nowMs)),
    timezone: TIMEZONE,
    live_window_minutes: Math.round(LIVE_WINDOW_MS / 60000),
    rule_ar: 'وقت المباراة المباشرة: إذا لا توجد نتيجة موثوقة، تظهر 0 - 0 مكان النتيجة، وتبقى كلمة مباشر كحالة فقط.',
    files,
    totals: files.reduce((acc, file) => {
      acc.scanned += file.scanned || 0;
      acc.live_zero_filled += file.liveZeroFilled || 0;
      acc.preserved_score += file.preservedScore || 0;
      acc.future_live_cleared += file.futureLiveCleared || 0;
      acc.changed_files += file.changed ? 1 : 0;
      return acc;
    }, { scanned: 0, live_zero_filled: 0, preserved_score: 0, future_live_cleared: 0, changed_files: 0 }),
  };

  await writeJson('live-zero-score-guard-status.json', summary);
  console.log(`[${VERSION}]`, JSON.stringify(summary.totals));
}

main().catch((error) => {
  console.error(`[${VERSION}] failed`, error);
  process.exitCode = 1;
});
