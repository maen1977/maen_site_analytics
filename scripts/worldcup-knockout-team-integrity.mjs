#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const CHECK_ONLY = process.argv.includes('--check');
const VERSION = '20260720-knockout-team-integrity-v1';

// The display number and the internal match id are intentionally different for
// matches 86-88. W86/W87/W88 refer to the numeric part of id, not the display
// number. Keeping this map in one place prevents stale names from cascading.
const MATCHES = new Map([
  [73,  { id:'M073', teams:['South Africa','Canada'], ar:['جنوب أفريقيا','كندا'], slots:['2A','2B'] }],
  [74,  { id:'M074', teams:['Germany','Paraguay'], ar:['ألمانيا','باراغواي'], slots:['1E','3A/B/C/D/F'] }],
  [75,  { id:'M075', teams:['Netherlands','Morocco'], ar:['هولندا','المغرب'], slots:['1F','2C'] }],
  [76,  { id:'M076', teams:['Brazil','Japan'], ar:['البرازيل','اليابان'], slots:['1C','2F'] }],
  [77,  { id:'M077', teams:['France','Sweden'], ar:['فرنسا','السويد'], slots:['1I','3C/D/F/G/H'] }],
  [78,  { id:'M078', teams:['Ivory Coast','Norway'], ar:['كوت ديفوار','النرويج'], slots:['2E','2I'] }],
  [79,  { id:'M079', teams:['Mexico','Ecuador'], ar:['المكسيك','الإكوادور'], slots:['1A','3C/E/F/H/I'] }],
  [80,  { id:'M080', teams:['England','DR Congo'], ar:['إنجلترا','الكونغو الديمقراطية'], slots:['1L','3E/H/I/J/K'] }],
  [81,  { id:'M081', teams:['USA','Bosnia & Herzegovina'], ar:['الولايات المتحدة','البوسنة والهرسك'], slots:['1D','3B/E/F/I/J'] }],
  [82,  { id:'M082', teams:['Belgium','Senegal'], ar:['بلجيكا','السنغال'], slots:['1G','3A/E/H/I/J'] }],
  [83,  { id:'M083', teams:['Portugal','Croatia'], ar:['البرتغال','كرواتيا'], slots:['2K','2L'] }],
  [84,  { id:'M084', teams:['Spain','Austria'], ar:['إسبانيا','النمسا'], slots:['1H','2J'] }],
  [85,  { id:'M085', teams:['Switzerland','Algeria'], ar:['سويسرا','الجزائر'], slots:['1B','3E/F/G/I/J'] }],
  [86,  { id:'M088', teams:['Australia','Egypt'], ar:['أستراليا','مصر'], slots:['2D','2G'] }],
  [87,  { id:'M086', teams:['Argentina','Cape Verde'], ar:['الأرجنتين','الرأس الأخضر'], slots:['1J','2H'] }],
  [88,  { id:'M087', teams:['Colombia','Ghana'], ar:['كولومبيا','غانا'], slots:['1K','3D/E/I/J/L'] }],
  [89,  { id:'M089', teams:['Paraguay','France'], ar:['باراغواي','فرنسا'], slots:['W74','W77'] }],
  [90,  { id:'M090', teams:['Canada','Morocco'], ar:['كندا','المغرب'], slots:['W73','W75'] }],
  [91,  { id:'M091', teams:['Brazil','Norway'], ar:['البرازيل','النرويج'], slots:['W76','W78'] }],
  [92,  { id:'M092', teams:['Mexico','England'], ar:['المكسيك','إنجلترا'], slots:['W79','W80'] }],
  [93,  { id:'M093', teams:['Portugal','Spain'], ar:['البرتغال','إسبانيا'], slots:['W83','W84'] }],
  [94,  { id:'M094', teams:['USA','Belgium'], ar:['الولايات المتحدة','بلجيكا'], slots:['W81','W82'] }],
  [95,  { id:'M095', teams:['Argentina','Egypt'], ar:['الأرجنتين','مصر'], slots:['W86','W88'] }],
  [96,  { id:'M096', teams:['Switzerland','Colombia'], ar:['سويسرا','كولومبيا'], slots:['W85','W87'] }],
  [97,  { id:'M097', teams:['France','Morocco'], ar:['فرنسا','المغرب'], slots:['W89','W90'] }],
  [98,  { id:'M098', teams:['Spain','Belgium'], ar:['إسبانيا','بلجيكا'], slots:['W93','W94'] }],
  [99,  { id:'M099', teams:['Norway','England'], ar:['النرويج','إنجلترا'], slots:['W91','W92'] }],
  [100, { id:'M100', teams:['Argentina','Switzerland'], ar:['الأرجنتين','سويسرا'], slots:['W95','W96'] }],
  [101, { id:'M101', teams:['France','Spain'], ar:['فرنسا','إسبانيا'], slots:['W97','W98'] }],
  [102, { id:'M102', teams:['England','Argentina'], ar:['إنجلترا','الأرجنتين'], slots:['W99','W100'] }],
  [103, { id:'M103', teams:['France','England'], ar:['فرنسا','إنجلترا'], slots:['L101','L102'] }],
]);

const FILES = ['matches.json', 'bracket.json', 'knockout-live.json'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function displayNumber(match) {
  const direct = match?.number ?? match?.match_number ?? match?.matchNumber;
  const directMatch = String(direct ?? '').match(/(\d{1,3})/);
  if (directMatch) return Number(directMatch[1]);
  const idMatch = String(match?.id ?? match?.match_id ?? '').match(/(\d{1,3})/);
  return idMatch ? Number(idMatch[1]) : 0;
}

function collectMatches(document) {
  const output = [];
  const seen = new Set();
  const push = (match) => {
    if (!match || typeof match !== 'object') return;
    if (seen.has(match)) return;
    seen.add(match);
    output.push(match);
  };
  if (Array.isArray(document)) document.forEach(push);
  if (Array.isArray(document?.matches)) document.matches.forEach(push);
  for (const round of document?.rounds || []) {
    for (const match of round?.matches || []) push(match);
  }
  return output;
}

function setValue(object, key, value, changes) {
  if (object[key] !== value) {
    object[key] = value;
    changes.count += 1;
  }
}

function repairTopLevel(match, canonical, changes) {
  setValue(match, 'id', canonical.id, changes);
  if ('number' in match || !('match_number' in match)) setValue(match, 'number', displayNumber(match), changes);
  if ('match_number' in match) setValue(match, 'match_number', displayNumber(match), changes);

  for (const side of [1, 2]) {
    const teamKey = `team${side}`;
    const arabicKey = `team${side}_ar`;
    const teamValue = match[teamKey];
    const english = canonical.teams[side - 1];
    const arabic = canonical.ar[side - 1];
    const slot = canonical.slots[side - 1];

    const nestedTeam = teamValue && typeof teamValue === 'object';
    if (nestedTeam) {
      setValue(teamValue, 'name_en', english, changes);
      setValue(teamValue, 'name_ar', arabic, changes);
      setValue(teamValue, 'slot', slot, changes);
      setValue(teamValue, 'unresolved', false, changes);
      setValue(teamValue, 'resolved_from', slot, changes);
    } else {
      setValue(match, teamKey, english, changes);
      setValue(match, arabicKey, arabic, changes);
    }

    for (const key of [
      `team${side}_slot`, `team${side}_source_slot`, `team${side}_original_slot`,
      `team${side}_seed`, `source_slot${side}`
    ]) {
      // matches.json/bracket.json keep explicit slot fields. knockout-live.json
      // stores the slot inside the nested team object, so do not add duplicate fields.
      if (key in match || (!nestedTeam && (key === `team${side}_slot` || key === `team${side}_source_slot`))) {
        setValue(match, key, slot, changes);
      }
    }

    if (`team${side}_resolved_from` in match) setValue(match, `team${side}_resolved_from`, slot, changes);
    if (`team${side}_resolution_status` in match) setValue(match, `team${side}_resolution_status`, 'resolved', changes);
  }
}

function expectedProblems(match, canonical, file) {
  const problems = [];
  if (String(match.id || '') !== canonical.id) problems.push(`${file} M${displayNumber(match)} id=${match.id}; expected ${canonical.id}`);
  for (const side of [1, 2]) {
    const value = match[`team${side}`];
    const english = value && typeof value === 'object' ? value.name_en : value;
    const arabic = value && typeof value === 'object' ? value.name_ar : match[`team${side}_ar`];
    const slot = value && typeof value === 'object' ? value.slot : (match[`team${side}_source_slot`] || match[`team${side}_slot`] || match[`source_slot${side}`]);
    if (english !== canonical.teams[side - 1]) problems.push(`${file} M${displayNumber(match)} team${side}=${english}; expected ${canonical.teams[side - 1]}`);
    if (arabic !== canonical.ar[side - 1]) problems.push(`${file} M${displayNumber(match)} team${side}_ar=${arabic}; expected ${canonical.ar[side - 1]}`);
    if (slot !== canonical.slots[side - 1]) problems.push(`${file} M${displayNumber(match)} slot${side}=${slot}; expected ${canonical.slots[side - 1]}`);
  }
  return problems;
}

let totalChanges = 0;
const allProblems = [];

for (const file of FILES) {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) continue;
  const document = readJson(file);
  const finalBefore = structuredClone(collectMatches(document).find((match) => displayNumber(match) === 104));
  const changes = { count: 0 };

  // Keep one authoritative English -> Arabic dictionary for every renderer.
  if (document && typeof document === 'object' && !Array.isArray(document) && file === 'matches.json') {
    if (!document.team_ar || typeof document.team_ar !== 'object') document.team_ar = {};
    for (const canonical of MATCHES.values()) {
      for (let index = 0; index < 2; index += 1) {
        setValue(document.team_ar, canonical.teams[index], canonical.ar[index], changes);
      }
    }
  }

  for (const match of collectMatches(document)) {
    const number = displayNumber(match);
    const canonical = MATCHES.get(number);
    if (!canonical) continue; // M104 and non-knockout data are intentionally untouched.
    if (!CHECK_ONLY) repairTopLevel(match, canonical, changes);
    allProblems.push(...expectedProblems(match, canonical, file));
  }

  const finalAfter = collectMatches(document).find((match) => displayNumber(match) === 104);
  if (JSON.stringify(finalAfter) !== JSON.stringify(finalBefore)) {
    throw new Error(`${file}: M104 changed; the integrity guard must never modify the final.`);
  }

  if (!CHECK_ONLY && changes.count > 0) writeJson(file, document);
  totalChanges += changes.count;
  console.log(`${file}: ${CHECK_ONLY ? 'checked' : 'repaired'} fields=${changes.count}; M104 preserved.`);
}

if (allProblems.length) {
  throw new Error(`[${VERSION}] integrity failure:\n${allProblems.join('\n')}`);
}

console.log(`[${VERSION}] OK; total changes=${totalChanges}; M104 untouched.`);
