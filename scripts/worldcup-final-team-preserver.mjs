#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];
const TEAM_FIELDS = [
  'team1', 'team2', 'team1_ar', 'team2_ar',
  'team1_slot', 'team2_slot', 'team1_source_slot', 'team2_source_slot',
  'team1_original_slot', 'team2_original_slot', 'team1_seed', 'team2_seed',
  'source_slot1', 'source_slot2',
  'team1_resolved_from', 'team2_resolved_from',
  'team1_resolution_status', 'team2_resolution_status',
  'home', 'away', 'home_team', 'away_team', 'home_team_ar', 'away_team_ar',
  'search_text'
];

function matchNumber(match) {
  const value = match?.number ?? match?.match_number ?? match?.matchNumber ?? match?.id ?? match?.match_id;
  const found = String(value ?? '').match(/(\d{1,3})/);
  return found ? Number(found[1]) : 0;
}

function collectMatches(document) {
  const output = [];
  if (Array.isArray(document?.matches)) output.push(...document.matches);
  for (const round of document?.rounds || []) {
    if (Array.isArray(round?.matches)) output.push(...round.matches);
  }
  return output;
}

function readDocument(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeDocument(file, document) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(document, null, 2) + '\n', 'utf8');
}

function pickTeamFields(match) {
  const snapshot = {};
  for (const key of TEAM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(match, key)) snapshot[key] = structuredClone(match[key]);
  }
  return snapshot;
}

function applyTeamFields(match, snapshot) {
  let changed = false;
  for (const key of TEAM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      const before = JSON.stringify(match[key]);
      match[key] = structuredClone(snapshot[key]);
      if (before !== JSON.stringify(match[key])) changed = true;
    } else if (Object.prototype.hasOwnProperty.call(match, key)) {
      delete match[key];
      changed = true;
    }
  }
  return changed;
}

function snapshot(outputPath) {
  const result = { version: '20260720-m104-team-preserver-v1', files: {} };
  for (const file of FILES) {
    const document = readDocument(file);
    const final = collectMatches(document).find((match) => matchNumber(match) === 104);
    if (!final) throw new Error(`${file}: M104 not found`);
    result.files[file] = pickTeamFields(final);
  }
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Saved M104 team fields to ${outputPath}`);
}

function restore(inputPath) {
  const snapshotData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  let changedFiles = 0;
  for (const file of FILES) {
    const document = readDocument(file);
    const saved = snapshotData?.files?.[file];
    if (!saved) throw new Error(`${inputPath}: missing snapshot for ${file}`);
    let changed = false;
    let found = 0;
    for (const match of collectMatches(document)) {
      if (matchNumber(match) !== 104) continue;
      found += 1;
      if (applyTeamFields(match, saved)) changed = true;
    }
    if (!found) throw new Error(`${file}: M104 not found during restore`);
    if (changed) {
      writeDocument(file, document);
      changedFiles += 1;
    }
    console.log(`${file}: restored M104 team fields in ${found} occurrence(s); changed=${changed}`);
  }
  console.log(`M104 team restore complete; changed files=${changedFiles}`);
}

const [mode, filePath] = process.argv.slice(2);
if (!['snapshot', 'restore'].includes(mode) || !filePath) {
  console.error('Usage: node scripts/worldcup-final-team-preserver.mjs snapshot|restore <snapshot-file>');
  process.exit(2);
}

if (mode === 'snapshot') snapshot(filePath);
else restore(filePath);
