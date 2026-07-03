#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '20260704-stale-live-final-penalty-v1';
const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TARGET_FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];
const STATUS_FILE = 'stale-live-finalizer-status.json';
const TIMEZONE = 'Asia/Amman';
const PENALTY_FINAL_AFTER_MINUTES = Number(process.env.WORLD_CUP_2026_PENALTY_FINAL_AFTER_MINUTES || 175);
const SCORE_FINAL_AFTER_MINUTES = Number(process.env.WORLD_CUP_2026_SCORE_FINAL_AFTER_MINUTES || 230);
const NOW = new Date();
const AR_NUM = '٠١٢٣٤٥٦٧٨٩';
const FA_NUM = '۰۱۲۳۴۵۶۷۸۹';

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
function ammanParts(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
}
function ammanIso(date) {
  const p = ammanParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}
function parseDate(value) {
  if (!value) return null;
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
function elapsedMinutes(match) {
  const k = kickoffDate(match);
  if (!k) return null;
  const mins = (NOW.getTime() - k.getTime()) / 60000;
  return Number.isFinite(mins) ? mins : null;
}
function part(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return ['key', 'state', 'status', 'name', 'label', 'label_ar', 'label_en', 'phase', 'phase_ar', 'detail', 'status_detail', 'short_detail', 'clock']
      .map((k) => part(value?.[k])).filter(Boolean).join(' ');
  }
  return String(value || '');
}
function statusTexts(match) {
  const sc = match?.score || {};
  const st = match?.status;
  let core = '';
  let labels = '';
  if (st && typeof st === 'object' && !Array.isArray(st)) {
    core = [st.key, st.state, st.status, st.name, st.phase].map(part).join(' ');
    labels = [st.label, st.label_ar, st.label_en].map(part).join(' ');
  } else {
    core = part(st);
  }
  const runtime = [core, match?.live_phase, match?.phase, match?.live_status, match?.live_status_detail, sc.status, sc.phase, sc.phase_ar, sc.status_detail, sc.clock, sc.period].map(part).join(' ');
  const all = [core, labels, runtime, part(match?.result_status), part(match?.match_status)].join(' ');
  return { core: core.toLowerCase(), labels: labels.toLowerCase(), runtime: runtime.toLowerCase(), all: all.toLowerCase() };
}
function hasExplicitFinalSignal(match) {
  const sc = match?.score || {};
  const t = statusTexts(match);
  const scoreText = [sc.status, sc.phase, sc.phase_ar, sc.status_detail, sc.detail, sc.result_status, sc.match_status].map(part).join(' ').toLowerCase();
  const hard = [t.core, part(match?.result_status), part(match?.match_status), scoreText].join(' ').toLowerCase();
  const finalRe = /\b(finished|completed|complete|full[_\s-]?time|fulltime|final|ended|closed|post|ft|aet)\b|انته|نهائي|بعد\s*التمديد|بركلات\s*الترجيح|ركلات\s*الترجيح/;
  const liveRe = /\b(live|in[_\s-]?play|playing|started|first[_\s-]?half|second[_\s-]?half|half[_\s-]?time|halftime|extra[_\s-]?time|penalties|penalty[_\s-]?shootout|shootout)\b|مباشر|الشوط|استراحه|استراحة/;
  if (finalRe.test(hard)) return true;
  if (finalRe.test(t.labels) && !liveRe.test(t.runtime)) return true;
  return false;
}
function hasWinnerSignal(match) {
  return Boolean(match && (
    match.winner_side !== null && match.winner_side !== undefined ||
    match.winnerSide !== null && match.winnerSide !== undefined ||
    match.winner_team || match.winnerTeam || match.winner_team_id || match.winnerTeamId ||
    match.advancing_team || match.advancingTeam || match.qualified_team || match.qualifiedTeam
  ));
}
function pairFromArray(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const a = numberOrNull(value[0]);
  const b = numberOrNull(value[1]);
  return a !== null && b !== null ? [a, b] : null;
}
function scorePair(match) {
  const sc = match?.score || {};
  const candidates = [sc.ft, sc.et, sc.current, sc.live, sc.full_time, sc.regular_time];
  for (const candidate of candidates) {
    const pair = pairFromArray(candidate);
    if (pair) return pair;
  }
  const s1 = numberOrNull(match?.score1 ?? match?.team1_score ?? match?.team1Score ?? match?.home_score ?? match?.homeScore);
  const s2 = numberOrNull(match?.score2 ?? match?.team2_score ?? match?.team2Score ?? match?.away_score ?? match?.awayScore);
  if (s1 !== null || s2 !== null) return [s1 ?? 0, s2 ?? 0];
  return null;
}
function penaltyPair(match) {
  const sc = match?.score || {};
  let pair = pairFromArray(sc.p) || pairFromArray(sc.penalties);
  if (!pair && sc.penalties && typeof sc.penalties === 'object') pair = pairFromArray([sc.penalties.home ?? sc.penalties.team1, sc.penalties.away ?? sc.penalties.team2]);
  if (!pair) pair = pairFromArray([
    match?.penalty_home_score ?? match?.home_penalties ?? match?.team1_penalties ?? match?.penalty1,
    match?.penalty_away_score ?? match?.away_penalties ?? match?.team2_penalties ?? match?.penalty2,
  ]);
  return pair;
}
function isLiveLabel(match) {
  const t = statusTexts(match);
  return /\b(live|in[_\s-]?play|playing|started|extra[_\s-]?time|penalties|penalty[_\s-]?shootout|shootout)\b|مباشر|الشوط|ركلات\s*الترجيح|ترجيح/.test(t.all);
}
function setStatus(match, labelAr, labelEn = labelAr, key = 'finished') {
  const old = match.status && typeof match.status === 'object' && !Array.isArray(match.status) ? match.status : {};
  match.status = { ...old, key, state: 'finished', label_ar: labelAr, label: labelEn };
  match.status_key = key;
  match.status_ar = labelAr;
  match.phase = 'finished';
}
function setPenaltyFields(match, p1, p2) {
  match.penalty1 = p1; match.penalty2 = p2;
  match.score_penalties = [p1, p2];
  match.penalty_home_score = p1; match.penalty_away_score = p2;
  if (!match.score || typeof match.score !== 'object' || Array.isArray(match.score)) match.score = {};
  match.score.p = [p1, p2];
  match.score.penalties = [p1, p2];
  match.score.status = 'finished';
  match.score.phase = 'finished_penalties';
}
function setWinnerFromPenalties(match, p1, p2) {
  if (p1 === p2) return;
  const side = p1 > p2 ? 1 : 2;
  match.winner_side = side;
  match.winnerSide = side;
}
function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hasTeams = Boolean(value.team1 || value.team2 || value.home || value.away || value.homeTeam || value.awayTeam || value.teams || value.competitors);
  const hasTime = Boolean(value.kickoff_utc || value.kickoff_jordan || value.kickoff || value.start_time || value.date || value.time);
  const hasId = Boolean(value.number || value.match_number || value.num || value.id || value.match_id || value.espn_event_id || value.espnEventId);
  return hasTeams && (hasTime || hasId || value.status || value.score);
}
function visitMatches(root, visitor) {
  const seen = new Set();
  function walk(value, label = '$') {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (looksLikeMatch(value)) visitor(value, label);
    if (Array.isArray(value)) return value.forEach((child, i) => walk(child, `${label}[${i}]`));
    for (const [key, child] of Object.entries(value)) {
      if (['raw', 'metadata'].includes(key)) continue;
      walk(child, `${label}.${key}`);
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
function matchIdentifier(match, label) {
  return match?.id || match?.num || match?.number || match?.match_number || label;
}
function finalizeIfNeeded(match) {
  const elapsed = elapsedMinutes(match);
  const pen = penaltyPair(match);
  const pair = scorePair(match);
  const updates = [];

  if (pen && (hasExplicitFinalSignal(match) || hasWinnerSignal(match) || (elapsed !== null && elapsed >= PENALTY_FINAL_AFTER_MINUTES))) {
    setStatus(match, 'انتهت بركلات الترجيح', 'Finished on penalties', 'finished');
    setPenaltyFields(match, pen[0], pen[1]);
    setWinnerFromPenalties(match, pen[0], pen[1]);
    match.score_source = match.score_source || 'stale-live-finalizer';
    updates.push('finished_penalties');
  } else if (pair && isLiveLabel(match) && elapsed !== null && elapsed >= SCORE_FINAL_AFTER_MINUTES) {
    setStatus(match, 'انتهت', 'Finished', 'finished');
    match.score_source = match.score_source || 'stale-live-finalizer';
    updates.push('finished_by_elapsed_score');
  }

  if (updates.length) {
    match.stale_live_finalized_at = ammanIso(NOW);
    match.stale_live_finalizer_version = VERSION;
  }
  return updates;
}

async function main() {
  const status = {
    script: 'worldcup-stale-live-finalizer.mjs',
    version: VERSION,
    checked_at_jordan: ammanIso(NOW),
    timezone: TIMEZONE,
    rules: {
      penalty_final_after_minutes: PENALTY_FINAL_AFTER_MINUTES,
      score_final_after_minutes: SCORE_FINAL_AFTER_MINUTES,
    },
    files: {},
    totals: { scanned: 0, finalized: 0, changed_files: 0 },
    finalized: [],
    rule_ar: 'إذا بقيت مباراة إقصائية live بعد ظهور نتيجة الترجيح ومرّ وقت كافٍ من بداية المباراة، يحولها إلى انتهت بركلات الترجيح حتى لا تبقى مباشر بعد النهاية.',
  };
  for (const file of TARGET_FILES) {
    const doc = await readJson(file);
    if (!doc) { status.files[file] = { exists: false }; continue; }
    const before = JSON.stringify(doc);
    const fileStatus = { exists: true, scanned: 0, finalized: 0, changed: false };
    visitMatches(doc, (match, label) => {
      fileStatus.scanned += 1;
      status.totals.scanned += 1;
      const updates = finalizeIfNeeded(match);
      if (updates.length) {
        fileStatus.finalized += 1;
        status.totals.finalized += 1;
        status.finalized.push({ file, path: label, match: matchIdentifier(match, label), updates, elapsed_minutes: elapsedMinutes(match) });
      }
    });
    if (before !== JSON.stringify(doc)) {
      fileStatus.changed = true;
      status.totals.changed_files += 1;
      await writeJson(file, doc);
    }
    status.files[file] = fileStatus;
  }
  await writeJson(STATUS_FILE, status);
  console.log(`[${VERSION}] ${JSON.stringify(status.totals)}`);
}

main().catch((error) => {
  console.error(`[${VERSION}] failed`, error);
  process.exitCode = 1;
});
