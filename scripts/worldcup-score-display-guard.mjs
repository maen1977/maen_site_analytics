#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '20260719-score-display-guard-v3-final-isolation';
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const WC_DIR = path.join(PUBLIC_DIR, 'worldcup-2026');
const TODAY_UI_FILE = path.join(PUBLIC_DIR, 'worldcup-2026-today-fix.js');
const DATA_FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function englishDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const found = englishDigits(value).match(/-?\d+/);
  if (!found) return null;
  const number = Number(found[0]);
  return Number.isFinite(number) ? number : null;
}

function normalize(value) {
  return String(value ?? '')
    .replace(/[إأآٱ]/g, 'ا')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function teamKey(value) {
  const text = normalize(value);
  if (/^(france|فرنسا)$/.test(text)) return 'france';
  if (/^(england|انجلترا)$/.test(text)) return 'england';
  if (/^(spain|اسبانيا)$/.test(text)) return 'spain';
  if (/^(argentina|الارجنتين)$/.test(text)) return 'argentina';
  return text;
}

function nameOf(team) {
  if (!team) return '';
  if (typeof team === 'string' || typeof team === 'number') return String(team);
  if (typeof team !== 'object') return '';
  return team.name_ar || team.arabic_name || team.nameAr || team.ar || team.name ||
    team.name_en || team.displayName || team.shortDisplayName || team.abbreviation ||
    team.code || team.slug || team.slot || '';
}

function teamObjects(match) {
  const first = match?.team1 ?? match?.home_team ?? match?.homeTeam ?? match?.home ??
    match?.team_a ?? match?.teamA ?? match?.teams?.[0] ?? match?.competitors?.[0];
  const second = match?.team2 ?? match?.away_team ?? match?.awayTeam ?? match?.away ??
    match?.team_b ?? match?.teamB ?? match?.teams?.[1] ?? match?.competitors?.[1];
  return [first, second];
}

function teamKeys(match) {
  const [first, second] = teamObjects(match);
  return [teamKey(nameOf(first)), teamKey(nameOf(second))];
}

function matchNumber(match) {
  return numberOrNull(match?.number ?? match?.num ?? match?.match_number ?? match?.matchNumber ??
    match?.match_no ?? match?.matchNo ?? match?.id);
}

function matchDateText(match) {
  return String(match?.date_jordan ?? match?.date ?? match?.kickoff_jordan ??
    match?.kickoff_utc ?? match?.kickoff ?? match?.datetime ?? '');
}

function roundText(match) {
  const plainStatus = typeof match?.status === 'object' ? '' : match?.status;
  return normalize([
    match?.round_ar,
    match?.round,
    match?.stage_ar,
    match?.stage,
    match?.phase,
    plainStatus,
  ].filter(Boolean).join(' '));
}

function statusText(match) {
  const status = match?.status;
  const score = match?.score;
  return normalize([
    status?.key,
    status?.state,
    status?.type,
    status?.label_ar,
    status?.label,
    typeof status === 'object' ? '' : status,
    score?.status,
    score?.phase,
    score?.phase_ar,
    score?.status_detail,
    match?.status_key,
    match?.status_ar,
    match?.state,
    match?.phase,
    match?.live_phase,
    match?.live_phase_ar,
    match?.live_status_detail,
  ].filter(Boolean).join(' '));
}

function isLive(match) {
  const text = statusText(match);
  return /(^| )(live|in progress|in_progress|halftime|half time|extra time|penalty|playing)( |$)|مباشر|الشوط|استراحه|ترجيح/.test(text) &&
    !/finished|completed|full time|full_time|post|انته/.test(text);
}

function isFinished(match) {
  const text = statusText(match);
  return /finished|completed|full time|full_time|post|انته/.test(text) || match?.finished === true;
}

function isScheduled(match) {
  const text = statusText(match);
  return /scheduled|fixture|upcoming|pre match|prematch|not started|قادمه|لم تبدا/.test(text) &&
    !isLive(match) && !isFinished(match);
}

function scoreFromText(value) {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const found = englishDigits(value).match(/(\d+)\s*[-–—:]\s*(\d+)/);
  return found ? [Number(found[1]), Number(found[2])] : null;
}

function pairFromObject(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value) && value.length >= 2) {
    const first = numberOrNull(value[0]);
    const second = numberOrNull(value[1]);
    return first !== null && second !== null ? [first, second] : null;
  }
  const first = numberOrNull(value.home ?? value.home_score ?? value.homeScore ??
    value.team1 ?? value.team1_score ?? value.team1Score ?? value.score1 ?? value.a);
  const second = numberOrNull(value.away ?? value.away_score ?? value.awayScore ??
    value.team2 ?? value.team2_score ?? value.team2Score ?? value.score2 ?? value.b);
  return first !== null && second !== null ? [first, second] : null;
}

function readScore(match) {
  const directPairs = [
    [match?.score1, match?.score2],
    [match?.team1_score, match?.team2_score],
    [match?.team1Score, match?.team2Score],
    [match?.home_score, match?.away_score],
    [match?.homeScore, match?.awayScore],
    [match?.score_home, match?.score_away],
  ];
  for (const [left, right] of directPairs) {
    const first = numberOrNull(left);
    const second = numberOrNull(right);
    if (first !== null && second !== null) return [first, second];
  }

  const score = match?.score;
  for (const candidate of [
    score?.current,
    score?.ft,
    score?.fulltime,
    score?.fullTime,
    score?.regular,
    score,
  ]) {
    const pair = pairFromObject(candidate) || scoreFromText(candidate);
    if (pair) return pair;
  }

  for (const value of [
    match?.score_text,
    match?.scoreText,
    match?.display_score,
    match?.displayScore,
    match?.result,
    match?.fulltime_score,
    match?.fullTimeScore,
    typeof score === 'string' ? score : null,
  ]) {
    const pair = scoreFromText(value);
    if (pair) return pair;
  }
  return null;
}

function scoreSourceText(match) {
  const score = match?.score;
  const sources = Array.isArray(match?.score_sources)
    ? match.score_sources.map((item) => [item?.source_name, item?.source, item?.source_url].filter(Boolean).join(' '))
    : [];
  return normalize([
    match?.score_source,
    match?.live_score_source,
    match?.result_source,
    score?.source,
    score?.provider,
    ...sources,
  ].filter(Boolean).join(' '));
}

function hasTrustedScoreSource(match) {
  return /espn|fifa|official|api football|sofascore|flashscore/.test(scoreSourceText(match));
}

function preferredScoreSource(match, fallback) {
  for (const value of [
    match?.score_source,
    match?.live_score_source,
    match?.result_source,
    match?.score?.source,
    match?.score?.provider,
  ]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function writeScore(match, first, second, source) {
  const before = JSON.stringify(match);

  match.score1 = first;
  match.score2 = second;
  match.team1_score = first;
  match.team2_score = second;
  match.team1Score = first;
  match.team2Score = second;
  match.home_score = first;
  match.away_score = second;
  match.homeScore = first;
  match.awayScore = second;
  match.score_text = `${first} - ${second}`;
  match.score_source = source;

  if (match.score && typeof match.score === 'object' && !Array.isArray(match.score)) {
    match.score.current = [first, second];
    if (isFinished(match)) match.score.ft = [first, second];
  }

  return before !== JSON.stringify(match);
}

const SCORE_FIELDS = [
  'score1', 'score2', 'team1_score', 'team2_score', 'team1Score', 'team2Score',
  'home_score', 'away_score', 'homeScore', 'awayScore', 'score_home', 'score_away',
  'score_text', 'scoreText', 'display_score', 'displayScore', 'result',
  'fulltime_score', 'fullTimeScore', 'score_source', 'winner_side', 'loser_side',
  'live_clock', 'live_period', 'live_status_detail',
];

function clearScore(match) {
  const before = JSON.stringify(match);
  for (const key of SCORE_FIELDS) delete match[key];
  match.score = null;
  if (Array.isArray(match.score_sources)) delete match.score_sources;
  return before !== JSON.stringify(match);
}

function setScheduled(match) {
  const before = JSON.stringify(match);
  if (match.status && typeof match.status === 'object' && !Array.isArray(match.status)) {
    match.status = {
      ...match.status,
      key: 'scheduled',
      state: 'scheduled',
      label_ar: 'قادمة',
      label: 'Scheduled',
    };
  } else {
    match.status = 'scheduled';
  }
  match.status_key = 'scheduled';
  match.status_ar = 'قادمة';
  match.phase = 'scheduled';
  match.finished = false;
  match.is_live = false;
  delete match.live_phase;
  delete match.live_phase_ar;
  return before !== JSON.stringify(match);
}

function setFinished(match) {
  const before = JSON.stringify(match);
  if (match.status && typeof match.status === 'object' && !Array.isArray(match.status)) {
    match.status = {
      ...match.status,
      key: 'finished',
      state: 'finished',
      label_ar: 'انتهت',
      label: 'Final',
    };
  } else {
    match.status = 'finished';
  }
  match.status_key = 'finished';
  match.status_ar = 'انتهت';
  match.phase = 'finished';
  match.finished = true;
  match.is_live = false;
  return before !== JSON.stringify(match);
}

function parseKickoff(match) {
  for (const value of [
    match?.kickoff_jordan,
    match?.kickoff_utc,
    match?.kickoff_at,
    match?.kickoffAt,
    match?.kickoff,
    match?.datetime,
    match?.date_time,
    match?.dateTime,
    match?.start_at,
    match?.startAt,
  ]) {
    if (!value) continue;
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const date = String(match?.date_jordan ?? match?.date ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const timeValue = String(match?.time_jordan ?? match?.jordan_time ?? match?.local_time ?? match?.localTime ?? '');
  const time = englishDigits(timeValue).match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);
  if (date && time) {
    const parsed = new Date(`${date}T${String(time[1]).padStart(2, '0')}:${time[2]}:00+03:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function nowInstant() {
  const override = process.env.MAENSAT_NOW;
  if (override) {
    const parsed = new Date(override);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const [first, second] = teamObjects(value);
  return Boolean(first && second) && Boolean(
    value.number || value.num || value.match_number || value.id || value.date || value.date_jordan ||
    value.kickoff || value.kickoff_utc || value.kickoff_jordan || value.status || value.phase
  );
}

function visitMatches(root, visitor) {
  const seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (looksLikeMatch(value)) visitor(value);
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'metadata' || key === 'raw') continue;
      walk(child);
    }
  }
  walk(root);
}

function isThirdPlaceFranceEngland(match) {
  const [first, second] = teamKeys(match);
  const pair = new Set([first, second]);
  if (!(pair.has('france') && pair.has('england'))) return false;
  const number = matchNumber(match);
  const date = matchDateText(match);
  const round = roundText(match);
  return number === 103 || date.includes('2026-07-18') || /third place|المركز الثالث|تحديد الثالث/.test(round);
}

function isSpainArgentinaFinal(match) {
  const [first, second] = teamKeys(match);
  const pair = new Set([first, second]);
  if (!(pair.has('spain') && pair.has('argentina'))) return false;
  const number = matchNumber(match);
  const date = matchDateText(match);
  const round = roundText(match);
  return number === 104 || date.includes('2026-07-19') || /(^| )final( |$)|النهائي/.test(round);
}

function isThirdPlaceScore(score) {
  return Boolean(score) && ((score[0] === 4 && score[1] === 6) || (score[0] === 6 && score[1] === 4));
}

function applyDataGuard(document, now = nowInstant()) {
  let mutations = 0;
  let thirdPlaceMatches = 0;
  let finalMatches = 0;
  let clearedPrematchFinals = 0;

  visitMatches(document, (match) => {
    if (isThirdPlaceFranceEngland(match)) {
      thirdPlaceMatches += 1;
      const [firstTeam] = teamKeys(match);
      const firstScore = firstTeam === 'france' ? 4 : 6;
      const secondScore = firstTeam === 'france' ? 6 : 4;
      if (writeScore(match, firstScore, secondScore, 'verified-third-place-2026-07-18')) mutations += 1;
      if (setFinished(match)) mutations += 1;
      return;
    }

    if (!isSpainArgentinaFinal(match)) return;
    finalMatches += 1;

    const kickoff = parseKickoff(match);
    const beforeKickoff = Boolean(kickoff && now.getTime() < kickoff.getTime());
    const live = isLive(match);
    const finished = isFinished(match);
    const scheduled = isScheduled(match);
    const score = readScore(match);
    const trusted = hasTrustedScoreSource(match);
    const pollutedThirdPlaceScore = isThirdPlaceScore(score) && !trusted;

    // قبل انطلاق النهائي: لا توجد نتيجة نهائياً، حتى لو تسربت 4-6 أو 6-4 من مباراة المركز الثالث.
    if (beforeKickoff || scheduled || (!live && !finished) || pollutedThirdPlaceScore) {
      if (clearScore(match)) mutations += 1;
      if (beforeKickoff || pollutedThirdPlaceScore) {
        if (setScheduled(match)) mutations += 1;
      }
      clearedPrematchFinals += 1;
      return;
    }

    // أثناء النهائي: نعرض نتيجة المصدر الحي الموثوق فقط. قبل أول هدف تكون 0-0.
    if (live) {
      const liveScore = trusted ? score : null;
      const pair = liveScore || [0, 0];
      if (writeScore(match, pair[0], pair[1], trusted ? preferredScoreSource(match, 'trusted-live-source') : 'live-zero-before-first-goal')) {
        mutations += 1;
      }
      return;
    }

    // بعد النهاية: نحفظ النتيجة الموثوقة، ولا نخترع نتيجة.
    if (finished && score) {
      if (writeScore(match, score[0], score[1], trusted ? preferredScoreSource(match, 'trusted-final-source') : 'existing-final-result')) {
        mutations += 1;
      }
    }
  });

  return { mutations, thirdPlaceMatches, finalMatches, clearedPrematchFinals };
}

function findNamedFunctionRange(source, functionName) {
  const pattern = new RegExp(`function\\s+${functionName}\\s*\\(\\s*match\\s*\\)\\s*\\{`, 'g');
  const match = pattern.exec(source);
  if (!match) return null;

  const start = match.index;
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  return null;
}

async function patchTodayUi() {
  let source;
  try {
    source = await fs.readFile(TODAY_UI_FILE, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, changed: false };
    throw error;
  }

  const replacement = `/* MAENSAT_SCORE_READER_V6_FINAL_ISOLATION */ function getScore(match) {
    function scoreNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      var text = String(value)
        .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
        .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
      var found = text.match(/-?\\d+/);
      return found ? Number(found[0]) : null;
    }
    function scorePair(left, right) {
      var first = scoreNumber(left);
      var second = scoreNumber(right);
      return first !== null && second !== null ? [first, second] : null;
    }
    function pairFromObject(value) {
      if (!value || typeof value !== 'object') return null;
      if (Array.isArray(value) && value.length >= 2) return scorePair(value[0], value[1]);
      return scorePair(
        firstValue(value, ['home', 'home_score', 'homeScore', 'team1', 'team1_score', 'team1Score', 'score1', 'a']),
        firstValue(value, ['away', 'away_score', 'awayScore', 'team2', 'team2_score', 'team2Score', 'score2', 'b'])
      );
    }
    function pairFromText(value) {
      if (value === null || value === undefined || typeof value === 'object') return null;
      var text = String(value)
        .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
        .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
      var found = text.match(/(\\d+)\\s*[-–—:]\\s*(\\d+)/);
      return found ? [Number(found[1]), Number(found[2])] : null;
    }
    function scoreStatusText(value) {
      var status = value && value.status;
      var nested = value && value.score;
      return [
        status && status.key,
        status && status.state,
        status && status.label_ar,
        status && status.label,
        status && typeof status !== 'object' ? status : '',
        nested && nested.status,
        nested && nested.phase,
        nested && nested.phase_ar,
        value && value.status_key,
        value && value.status_ar,
        value && value.state,
        value && value.phase,
        value && value.live_phase,
        value && value.live_phase_ar
      ].filter(Boolean).join(' ').toLowerCase();
    }

    var kickoff = parseMatchDate(match);
    if (kickoff && kickoff.getTime() > Date.now()) return '';

    var statusText = scoreStatusText(match);
    var active = /live|in progress|in_progress|halftime|extra time|penalty|finished|completed|full time|post|مباشر|الشوط|ترجيح|انته/.test(statusText);
    var waiting = /scheduled|fixture|upcoming|pre match|prematch|not started|قادمة|لم تبدأ/.test(statusText);
    if (waiting && !active) return '';

    var pair = scorePair(
      firstValue(match, ['home_score', 'homeScore', 'score_home']),
      firstValue(match, ['away_score', 'awayScore', 'score_away'])
    );
    if (!pair) pair = scorePair(
      firstValue(match, ['score1', 'team1_score', 'team1Score']),
      firstValue(match, ['score2', 'team2_score', 'team2Score'])
    );

    var nestedScore = match && match.score;
    if (!pair && nestedScore && typeof nestedScore === 'object') {
      pair = pairFromObject(nestedScore.current) || pairFromObject(nestedScore.ft) ||
        pairFromObject(nestedScore.fulltime) || pairFromObject(nestedScore.fullTime) ||
        pairFromObject(nestedScore.regular) || pairFromObject(nestedScore);
      if (!pair) pair = pairFromText(nestedScore.current) || pairFromText(nestedScore.ft) ||
        pairFromText(nestedScore.fulltime) || pairFromText(nestedScore.fullTime);
    }

    if (!pair) {
      pair = pairFromText(firstValue(match, [
        'score_text', 'scoreText', 'display_score', 'displayScore',
        'result', 'fulltime_score', 'fullTimeScore'
      ]));
    }
    if (!pair && typeof nestedScore === 'string') pair = pairFromText(nestedScore);
    return pair ? pair[0] + ' - ' + pair[1] : '';
  }`;

  const marker = 'MAENSAT_SCORE_READER_V6_FINAL_ISOLATION';
  const range = source.includes(marker) ? null : findNamedFunctionRange(source, 'getScore');
  let updated = source;
  let warning = null;

  if (source.includes(marker)) {
    updated = source;
  } else if (range) {
    updated = source.slice(0, range.start) + replacement + source.slice(range.end);
  } else {
    warning = 'getScore(match) was not found; data repair continued without failing the workflow.';
  }

  updated = updated.replace(
    /var SCRIPT_VERSION = '[^']+';/,
    "var SCRIPT_VERSION = '2026-07-19-final-isolation-v6';"
  );

  if (updated === source) return { exists: true, changed: false, warning };
  await fs.writeFile(TODAY_UI_FILE, updated, 'utf8');
  return { exists: true, changed: true, warning };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJsonIfChanged(filePath, document, before) {
  const after = JSON.stringify(document);
  if (after === before) return false;
  await fs.writeFile(filePath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  return true;
}

async function main() {
  const report = {
    version: VERSION,
    now: nowInstant().toISOString(),
    ui: await patchTodayUi(),
    files: {},
    totals: {
      changedFiles: 0,
      thirdPlaceMatches: 0,
      finalMatches: 0,
      clearedPrematchFinals: 0,
    },
  };

  for (const name of DATA_FILES) {
    const filePath = path.join(WC_DIR, name);
    const document = await readJson(filePath);
    if (!document) {
      report.files[name] = { exists: false };
      continue;
    }
    const before = JSON.stringify(document);
    const result = applyDataGuard(document);
    const changed = await writeJsonIfChanged(filePath, document, before);
    if (changed) report.totals.changedFiles += 1;
    report.totals.thirdPlaceMatches += result.thirdPlaceMatches;
    report.totals.finalMatches += result.finalMatches;
    report.totals.clearedPrematchFinals += result.clearedPrematchFinals;
    report.files[name] = { exists: true, changed, ...result };
  }

  if (report.ui.changed) report.totals.changedFiles += 1;
  console.log(`[${VERSION}] ${JSON.stringify(report)}`);
}

main().catch((error) => {
  console.error(`[${VERSION}] failed`, error);
  process.exitCode = 1;
});
