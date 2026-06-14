import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const MATCHES_FILE = path.join(WC_DIR, 'matches.json');

const TIMEZONE = 'Asia/Amman';
const AUTO_FINALIZE_AFTER_MINUTES = Number(process.env.WORLD_CUP_2026_AUTO_FINALIZE_AFTER_MINUTES || 130);

function nowDate() {
  const forced = process.env.WORLD_CUP_2026_NOW;
  const parsed = forced ? new Date(forced) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function jordanIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const pick = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}+03:00`;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    console.warn(`[worldcup-finalize] Could not read ${file}: ${error.message}`);
    return null;
  }
}

function kickoffMs(match = {}) {
  const raw = match.kickoff_utc || match.kickoff_jordan || match.date;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function isFinished(match = {}) {
  const status = String(match.status || '').toLowerCase();
  const detail = String(match.live_status_detail || match.score?.status_detail || '').toLowerCase();
  const score = match.score || {};
  return status.includes('finished') || status === 'ft' || detail === 'ft' || Boolean(score.ft || score.et || score.p);
}

function isLiveLike(match = {}) {
  const status = String(match.status || '').toLowerCase();
  const detail = String(match.live_status_detail || match.score?.status_detail || '').toLowerCase();
  return status === 'live' || status.includes('live') || detail === 'live' || detail.includes('live');
}

function scorePairFrom(match = {}) {
  const score = match.score || {};

  for (const candidate of [score.current, score.live, score.ft]) {
    if (Array.isArray(candidate) && Number.isFinite(Number(candidate[0])) && Number.isFinite(Number(candidate[1]))) {
      return [Number(candidate[0]), Number(candidate[1])];
    }
  }

  if (Number.isFinite(Number(match.home_score)) && Number.isFinite(Number(match.away_score))) {
    return [Number(match.home_score), Number(match.away_score)];
  }

  const sources = Array.isArray(match.score_sources) ? match.score_sources : [];
  for (const source of sources) {
    if (Number.isFinite(Number(source.home_score)) && Number.isFinite(Number(source.away_score))) {
      return [Number(source.home_score), Number(source.away_score)];
    }
  }

  return null;
}

function shouldAutoFinalize(match, nowMs) {
  if (!match || isFinished(match) || !isLiveLike(match)) return false;

  const startMs = kickoffMs(match);
  if (!Number.isFinite(startMs)) return false;

  const elapsedMinutes = (nowMs - startMs) / 60000;
  if (elapsedMinutes < AUTO_FINALIZE_AFTER_MINUTES) return false;

  return Boolean(scorePairFrom(match));
}

const bundle = await readJson(MATCHES_FILE);
if (!bundle || !Array.isArray(bundle.matches)) {
  console.log('[worldcup-finalize] No matches bundle found, nothing to finalize.');
  process.exit(0);
}

const now = nowDate();
const nowMs = now.getTime();
const nowIso = jordanIso(now);
const finalized = [];

for (const match of bundle.matches) {
  if (!shouldAutoFinalize(match, nowMs)) continue;

  const pair = scorePairFrom(match);
  if (!pair) continue;

  match.status = 'finished';
  match.home_score = pair[0];
  match.away_score = pair[1];

  match.score = {
    ...(match.score || {}),
    ft: pair,
    source: match.score?.source || match.score_source || 'auto-finalized stale live score',
    status_detail: 'FT',
    auto_finalized_stale_live: true,
    auto_finalized_after_minutes: AUTO_FINALIZE_AFTER_MINUTES,
    auto_finalized_at: nowIso
  };

  delete match.score.current;
  delete match.score.live;

  match.score_source = match.score_source || match.score.source;
  match.live_clock = null;
  match.live_status_detail = 'FT';
  match.auto_finalized_stale_live = true;
  match.auto_finalized_at = nowIso;

  finalized.push({
    id: match.id,
    team1: match.team1,
    team2: match.team2,
    score: pair
  });
}

bundle.metadata ||= {};
bundle.metadata.last_updated = nowIso;
bundle.metadata.last_checked_at = nowIso;
bundle.metadata.stale_live_auto_finalize = true;
bundle.metadata.stale_live_auto_finalize_after_minutes = AUTO_FINALIZE_AFTER_MINUTES;
bundle.metadata.stale_live_auto_finalize_count = finalized.length;
bundle.metadata.stale_live_auto_finalize_last_run = nowIso;
bundle.metadata.stale_live_auto_finalize_note_ar =
  'إذا بقي مصدر النتائج يرسل حالة LIVE بعد مرور وقت كافٍ على بداية المباراة، يتم تحويلها تلقائيًا إلى FT مع نفس النتيجة الحالية.';

if (finalized.length > 0) {
  await fs.writeFile(MATCHES_FILE, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  console.log(`[worldcup-finalize] Finalized ${finalized.length} stale live match(es):`);
  for (const item of finalized) {
    console.log(`- ${item.id || ''} ${item.team1} ${item.score[0]}-${item.score[1]} ${item.team2}`.trim());
  }
} else {
  console.log('[worldcup-finalize] No stale live matches needed finalizing.');
}
