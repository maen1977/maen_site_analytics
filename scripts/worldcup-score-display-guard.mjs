#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '20260719-score-display-guard-v2';
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
  const match = englishDigits(value).match(/-?\d+/);
  if (!match) return null;
  const number = Number(match[0]);
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
  return numberOrNull(match?.number ?? match?.match_number ?? match?.matchNumber ??
    match?.match_no ?? match?.matchNo ?? match?.id);
}

function matchDateText(match) {
  return String(match?.date_jordan ?? match?.date ?? match?.kickoff_jordan ??
    match?.kickoff_utc ?? match?.kickoff ?? match?.datetime ?? '');
}

function roundText(match) {
  const status = typeof match?.status === 'object' ? '' : match?.status;
  return normalize([
    match?.round_ar,
    match?.round,
    match?.stage_ar,
    match?.stage,
    match?.phase,
    status,
  ].filter(Boolean).join(' '));
}

function statusText(match) {
  const status = match?.status;
  return normalize([
    status?.key,
    status?.state,
    status?.label_ar,
    status?.label,
    typeof status === 'object' ? '' : status,
    match?.status_key,
    match?.status_ar,
    match?.state,
    match?.phase,
  ].filter(Boolean).join(' '));
}

function isLive(match) {
  const text = statusText(match);
  return /(^| )(live|in progress|halftime|extra time|penalty)( |$)|مباشر|الشوط|استراحه|ترجيح/.test(text) &&
    !/finished|final|completed|post|انته/.test(text);
}

function scoreFromText(value) {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const match = englishDigits(value).match(/(\d+)\s*[-–—:]\s*(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
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
  const nestedCandidates = [
    score?.current,
    score?.ft,
    score?.fulltime,
    score?.fullTime,
    score?.regular,
    score,
  ];
  for (const candidate of nestedCandidates) {
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

function writeScore(match, first, second, source) {
  const before = JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    team1Score: match.team1Score,
    team2Score: match.team2Score,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    score_text: match.score_text,
    score_source: match.score_source,
  });

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

  return before !== JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    team1_score: match.team1_score,
    team2_score: match.team2_score,
    team1Score: match.team1Score,
    team2Score: match.team2Score,
    home_score: match.home_score,
    away_score: match.away_score,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    score_text: match.score_text,
    score_source: match.score_source,
  });
}

function setFinished(match) {
  const before = JSON.stringify({
    status: match.status,
    status_key: match.status_key,
    status_ar: match.status_ar,
    phase: match.phase,
    finished: match.finished,
    is_live: match.is_live,
  });

  const oldStatus = match.status && typeof match.status === 'object' && !Array.isArray(match.status)
    ? match.status
    : {};
  match.status = {
    ...oldStatus,
    key: 'finished',
    state: 'finished',
    label_ar: 'انتهت',
    label: 'Final',
  };
  match.status_key = 'finished';
  match.status_ar = 'انتهت';
  match.phase = 'finished';
  match.finished = true;
  match.is_live = false;

  return before !== JSON.stringify({
    status: match.status,
    status_key: match.status_key,
    status_ar: match.status_ar,
    phase: match.phase,
    finished: match.finished,
    is_live: match.is_live,
  });
}

function looksLikeMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const [first, second] = teamObjects(value);
  return Boolean(first && second) && Boolean(
    value.number || value.match_number || value.id || value.date || value.date_jordan ||
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

function applyDataGuard(document) {
  let changed = 0;
  let thirdPlaceMatches = 0;
  let finalMatches = 0;

  visitMatches(document, (match) => {
    if (isThirdPlaceFranceEngland(match)) {
      thirdPlaceMatches += 1;
      const [firstTeam] = teamKeys(match);
      const firstScore = firstTeam === 'france' ? 4 : 6;
      const secondScore = firstTeam === 'france' ? 6 : 4;
      if (writeScore(match, firstScore, secondScore, 'verified-third-place-2026-07-18')) changed += 1;
      if (setFinished(match)) changed += 1;
      return;
    }

    if (isSpainArgentinaFinal(match)) {
      finalMatches += 1;
      const score = readScore(match) || (isLive(match) ? [0, 0] : null);
      if (score && writeScore(match, score[0], score[1], 'final-score-display-guard')) changed += 1;
    }
  });

  return { mutations: changed, thirdPlaceMatches, finalMatches };
}

async function patchTodayUi() {
  let source;
  try {
    source = await fs.readFile(TODAY_UI_FILE, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, changed: false };
    throw error;
  }

  const replacement = `function getScore(match) {
    function scoreNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      var text = String(value)
        .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
        .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
      var m = text.match(/-?\\d+/);
      return m ? Number(m[0]) : null;
    }
    function scorePair(left, right) {
      var a = scoreNumber(left);
      var b = scoreNumber(right);
      return a !== null && b !== null ? [a, b] : null;
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
      var m = text.match(/(\\d+)\\s*[-–—:]\\s*(\\d+)/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    }

    var pair = scorePair(
      firstValue(match, ['home_score', 'homeScore', 'score_home']),
      firstValue(match, ['away_score', 'awayScore', 'score_away'])
    );
    if (!pair) pair = scorePair(
      firstValue(match, ['score1', 'team1_score', 'team1Score']),
      firstValue(match, ['score2', 'team2_score', 'team2Score'])
    );

    var nested = match && match.score;
    if (!pair && nested && typeof nested === 'object') {
      pair = pairFromObject(nested.current) || pairFromObject(nested.ft) ||
        pairFromObject(nested.fulltime) || pairFromObject(nested.fullTime) ||
        pairFromObject(nested.regular) || pairFromObject(nested);
      if (!pair) pair = pairFromText(nested.current) || pairFromText(nested.ft) ||
        pairFromText(nested.fulltime) || pairFromText(nested.fullTime);
    }

    if (!pair) {
      var direct = firstValue(match, [
        'score_text', 'scoreText', 'display_score', 'displayScore',
        'result', 'fulltime_score', 'fullTimeScore'
      ]);
      pair = pairFromText(direct);
    }
    if (!pair && typeof nested === 'string') pair = pairFromText(nested);
    return pair ? pair[0] + ' - ' + pair[1] : '';
  }`;

  function matchingBraceEnd(text, openBraceIndex) {
    let depth = 0;
    let mode = 'code';
    let quote = '';

    for (let i = openBraceIndex; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];

      if (mode === 'string') {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === quote) {
          mode = 'code';
          quote = '';
        }
        continue;
      }

      if (mode === 'line-comment') {
        if (ch === '\n' || ch === '\r') mode = 'code';
        continue;
      }

      if (mode === 'block-comment') {
        if (ch === '*' && next === '/') {
          mode = 'code';
          i += 1;
        }
        continue;
      }

      if (ch === '/' && next === '/') {
        mode = 'line-comment';
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block-comment';
        i += 1;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        mode = 'string';
        quote = ch;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }

    return -1;
  }

  function replaceGetScoreFunction(text) {
    // يدعم النسخة المصغّرة، النسخة المنسّقة، أو تحويل الدالة إلى function expression.
    const signatures = [
      /function\s+getScore\s*\(\s*match\s*\)\s*\{/g,
      /(?:var|let|const)\s+getScore\s*=\s*function\s*\(\s*match\s*\)\s*\{/g,
      /(?:var|let|const)\s+getScore\s*=\s*\(?\s*match\s*\)?\s*=>\s*\{/g,
    ];

    for (const signature of signatures) {
      const match = signature.exec(text);
      if (!match) continue;
      const openBraceIndex = match.index + match[0].lastIndexOf('{');
      const endIndex = matchingBraceEnd(text, openBraceIndex);
      if (endIndex < 0) {
        throw new Error('Located getScore(match), but could not find its closing brace');
      }
      return text.slice(0, match.index) + replacement + text.slice(endIndex);
    }

    return null;
  }

  let updated = source;
  const alreadyPatched = updated.includes('function scoreNumber(value)') &&
    updated.includes('pairFromObject(value)') &&
    updated.includes("pair[0] + ' - ' + pair[1]");

  if (!alreadyPatched) {
    const replaced = replaceGetScoreFunction(updated);
    if (replaced === null) {
      const getScoreOffset = updated.indexOf('getScore');
      throw new Error(
        'Could not locate getScore(match) in public/worldcup-2026-today-fix.js' +
        `; first getScore offset=${getScoreOffset}; fileLength=${updated.length}`
      );
    }
    updated = replaced;
  }

  updated = updated.replace(
    /var\s+SCRIPT_VERSION\s*=\s*(['"])[^'"]*\1\s*;/,
    "var SCRIPT_VERSION = '2026-07-19-live-score-v5';"
  );

  if (updated === source) return { exists: true, changed: false };
  await fs.writeFile(TODAY_UI_FILE, updated, 'utf8');
  return { exists: true, changed: true };
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
    ui: await patchTodayUi(),
    files: {},
    totals: { changedFiles: 0, thirdPlaceMatches: 0, finalMatches: 0 },
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
    report.files[name] = { exists: true, changed, ...result };
  }

  if (report.ui.changed) report.totals.changedFiles += 1;
  console.log(`[${VERSION}] ${JSON.stringify(report)}`);
}

main().catch((error) => {
  console.error(`[${VERSION}] failed`, error);
  process.exitCode = 1;
});
