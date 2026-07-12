import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SOURCE_DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worldcup-semifinal-lock-'));
const tempDataDir = path.join(tempRoot, 'public', 'worldcup-2026');
const dataFiles = ['matches.json', 'bracket.json', 'knockout-live.json', 'manual-results-overrides.json'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(tempDataDir, file), 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(tempDataDir, file), JSON.stringify(data, null, 2) + '\n');
}

function teamName(value) {
  if (value && typeof value === 'object') return value.name_en || value.name_ar || '';
  return String(value || '');
}

function setTeam(match, side, nameEn, nameAr) {
  const key = `team${side}`;
  if (match[key] && typeof match[key] === 'object') {
    match[key].name_en = nameEn;
    match[key].name_ar = nameAr;
    match[key].unresolved = false;
  } else {
    match[key] = nameEn;
    match[`${key}_ar`] = nameAr;
  }
}

function setScore(match, a, b, winnerSide) {
  match.home_score = a;
  match.away_score = b;
  match.score1 = a;
  match.score2 = b;
  match.winner_side = winnerSide;
  match.canonical_locked = false;
  match.official_result_locked = false;
  if (match.score && typeof match.score === 'object') {
    match.score.current = [a, b];
    match.score.ft = [a, b];
    match.score.winner_side = winnerSide;
  }
}

function corruptData() {
  for (const file of ['matches.json', 'bracket.json', 'knockout-live.json']) {
    const data = readJson(file);
    const byId = new Map((data.matches || []).map((match) => [match.id, match]));
    const m100 = byId.get('M100');
    const m102 = byId.get('M102');
    if (!m100 || !m102) throw new Error(`${file} is missing M100 or M102`);
    setTeam(m100, 1, 'Argentina', 'الأرجنتين');
    setTeam(m100, 2, 'Switzerland', 'سويسرا');
    setScore(m100, 1, 3, 2);
    setTeam(m102, 2, 'Switzerland', 'سويسرا');
    writeJson(file, data);
  }

  const overrides = readJson('manual-results-overrides.json');
  overrides.metadata = overrides.metadata || {};
  overrides.metadata.semifinals_official_lock_version = 'stale-version';
  overrides.results = (overrides.results || []).filter((row) => row.id !== 'M099');
  const m100 = overrides.results.find((row) => row.id === 'M100');
  if (!m100) throw new Error('manual-results-overrides.json is missing M100');
  setScore(m100, 1, 3, 2);
  m100.locked = false;
  m100.force = false;
  writeJson('manual-results-overrides.json', overrides);
}

function runNode(script) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: tempRoot,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Asia/Amman' },
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
}

function assertRepaired() {
  for (const file of ['matches.json', 'bracket.json', 'knockout-live.json']) {
    const data = readJson(file);
    const byId = new Map((data.matches || []).map((match) => [match.id, match]));
    const m100 = byId.get('M100');
    const m102 = byId.get('M102');
    if (teamName(m100.team1) !== 'Argentina' || teamName(m100.team2) !== 'Switzerland') {
      throw new Error(`${file}: M100 teams were not restored`);
    }
    if (Number(m100.score1 ?? m100.home_score) !== 3 || Number(m100.score2 ?? m100.away_score) !== 1 || Number(m100.winner_side) !== 1) {
      throw new Error(`${file}: M100 score/winner were not restored`);
    }
    if (m100.canonical_locked !== true || m100.official_result_locked !== true) {
      throw new Error(`${file}: M100 lock flags were not restored`);
    }
    if (teamName(m102.team1) !== 'England' || teamName(m102.team2) !== 'Argentina') {
      throw new Error(`${file}: M102 is not England vs Argentina after repair`);
    }
  }
}

try {
  fs.mkdirSync(tempDataDir, { recursive: true });
  for (const file of dataFiles) fs.copyFileSync(path.join(SOURCE_DATA_DIR, file), path.join(tempDataDir, file));
  corruptData();
  runNode('scripts/worldcup-canonical-finalizer.mjs');
  runNode('scripts/worldcup-state-validator.mjs');
  assertRepaired();
  console.log('PASS: stale Switzerland data is repaired and M102 remains England vs Argentina in every public data file.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
