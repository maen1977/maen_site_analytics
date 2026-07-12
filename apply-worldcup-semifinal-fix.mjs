#!/usr/bin/env node
/**
 * تطبيق تقسيم أدوار كأس العالم وتحديث نصف النهائي.
 * شغّل هذا الملف من جذر المستودع:
 *   node apply-worldcup-semifinal-fix.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const TARGET = path.join(ROOT, "public", "worldcup-knockout-cards-ui.js");
const PATCH_FILE = path.join(HERE, "worldcup-semifinal-split-patch.js");

const START = "/* MAENSAT_WORLDCUP_STAGE_SPLIT_FIX_START_20260712 */";
const END = "/* MAENSAT_WORLDCUP_STAGE_SPLIT_FIX_END_20260712 */";

const overrides = {
  101: {
    match_number: 101,
    stage_key: "semifinal",
    stage_ar: "نصف النهائي",
    home_name_ar: "فرنسا",
    home_code: "FRA",
    away_name_ar: "إسبانيا",
    away_code: "ESP",
    kickoff_at: "2026-07-14T22:00:00+03:00",
    venue_ar: "ملعب دالاس",
    status: "scheduled"
  },
  102: {
    match_number: 102,
    stage_key: "semifinal",
    stage_ar: "نصف النهائي",
    home_name_ar: "إنجلترا",
    home_code: "ENG",
    away_name_ar: "الأرجنتين",
    away_code: "ARG",
    kickoff_at: "2026-07-15T22:00:00+03:00",
    venue_ar: "ملعب أتلانتا",
    status: "scheduled"
  }
};

function fail(message) {
  console.error(`\nخطأ: ${message}\n`);
  process.exit(1);
}

function backup(file) {
  const backupFile = `${file}.bak-20260712`;
  if (!fs.existsSync(backupFile)) fs.copyFileSync(file, backupFile);
}

function replacePatch(source, patch) {
  const start = source.indexOf(START);
  const end = source.indexOf(END);

  if (start !== -1 && end !== -1 && end > start) {
    const after = end + END.length;
    return `${source.slice(0, start).trimEnd()}\n\n${patch.trim()}\n${source.slice(after).trimStart()}`;
  }
  return `${source.trimEnd()}\n\n${patch.trim()}\n`;
}

function numberFrom(value) {
  const fields = [
    value?.match_number,
    value?.matchNumber,
    value?.number,
    value?.match_no,
    value?.matchNo,
    value?.id,
    value?.code,
    value?.name
  ];
  for (const field of fields) {
    const match = String(field ?? "").match(/(?:M|MATCH\s*)?(\d{2,3})/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function patchTeam(existing, nameAr, code) {
  if (typeof existing === "string") return nameAr;
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return { name_ar: nameAr, name: nameAr, code };
  }
  return {
    ...existing,
    name_ar: nameAr,
    arabic_name: nameAr,
    name: existing.name && /الفائز|winner|يتحدد/i.test(String(existing.name))
      ? nameAr
      : (existing.name || nameAr),
    code
  };
}

function updateMatchObject(obj, patch) {
  const homeKeys = ["home_team", "home", "team1", "homeTeam"];
  const awayKeys = ["away_team", "away", "team2", "awayTeam"];

  let homeUpdated = false;
  let awayUpdated = false;

  for (const key of homeKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = patchTeam(obj[key], patch.home_name_ar, patch.home_code);
      homeUpdated = true;
    }
  }
  for (const key of awayKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = patchTeam(obj[key], patch.away_name_ar, patch.away_code);
      awayUpdated = true;
    }
  }

  if (!homeUpdated) obj.home_team = patchTeam(null, patch.home_name_ar, patch.home_code);
  if (!awayUpdated) obj.away_team = patchTeam(null, patch.away_name_ar, patch.away_code);

  const directValues = {
    home_name_ar: patch.home_name_ar,
    home_team_name_ar: patch.home_name_ar,
    home_code: patch.home_code,
    home_team_code: patch.home_code,
    away_name_ar: patch.away_name_ar,
    away_team_name_ar: patch.away_name_ar,
    away_code: patch.away_code,
    away_team_code: patch.away_code,
    stage_key: patch.stage_key,
    stage_ar: patch.stage_ar,
    round_key: patch.stage_key,
    round_name_ar: patch.stage_ar,
    status: patch.status
  };

  for (const [key, value] of Object.entries(directValues)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = value;
  }

  if (!("stage_key" in obj)) obj.stage_key = patch.stage_key;
  if (!("stage_ar" in obj)) obj.stage_ar = patch.stage_ar;

  const dateKeys = [
    "kickoff_at", "kickoff", "datetime", "date_time",
    "start_time", "utc_date"
  ];
  let dateUpdated = false;
  for (const key of dateKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = patch.kickoff_at;
      dateUpdated = true;
    }
  }
  if (!dateUpdated) obj.kickoff_at = patch.kickoff_at;

  const venueKeys = ["venue_ar", "stadium_ar", "stadium"];
  let venueUpdated = false;
  for (const key of venueKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = patch.venue_ar;
      venueUpdated = true;
    }
  }
  if (!venueUpdated) obj.venue_ar = patch.venue_ar;
}

function patchJsonTree(value) {
  let changed = 0;

  function walk(node) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const number = numberFrom(node);
    if (number && overrides[number]) {
      updateMatchObject(node, overrides[number]);
      changed += 1;
    }

    if (
      Array.isArray(node.matches) &&
      node.matches.some((match) => [101, 102].includes(numberFrom(match)))
    ) {
      if ("title_ar" in node) node.title_ar = "نصف النهائي";
      if ("stage_ar" in node) node.stage_ar = "نصف النهائي";
      if ("round_name_ar" in node) node.round_name_ar = "نصف النهائي";
      if ("key" in node && /semi|sf|نصف/i.test(String(node.key))) node.key = "semifinal";
    }

    for (const child of Object.values(node)) walk(child);
  }

  walk(value);
  return changed;
}

if (!fs.existsSync(TARGET)) {
  fail(`لم أجد الملف: ${TARGET}\nشغّل الأمر من داخل مجلد المستودع maen_site_analytics.`);
}
if (!fs.existsSync(PATCH_FILE)) {
  fail(`لم أجد ملف التعديل: ${PATCH_FILE}`);
}

const patch = fs.readFileSync(PATCH_FILE, "utf8");
backup(TARGET);
const current = fs.readFileSync(TARGET, "utf8");
fs.writeFileSync(TARGET, replacePatch(current, patch), "utf8");

const dataDir = path.join(ROOT, "public", "worldcup-2026");
let jsonFilesChanged = 0;
let matchObjectsChanged = 0;

if (fs.existsSync(dataDir)) {
  const jsonFiles = fs.readdirSync(dataDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .map((name) => path.join(dataDir, name));

  for (const file of jsonFiles) {
    try {
      const original = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(original);
      const changed = patchJsonTree(parsed);
      if (changed > 0) {
        backup(file);
        fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
        jsonFilesChanged += 1;
        matchObjectsChanged += changed;
      }
    } catch (error) {
      console.warn(`تجاوزت ${path.basename(file)}: ${error.message}`);
    }
  }
}

console.log(`
تم تطبيق التعديل بنجاح.

- فُصلت الأدوار إلى: دور الـ32، دور الـ16، ربع النهائي، نصف النهائي، المركز الثالث، النهائي.
- أصبح نصف النهائي هو العرض الافتراضي داخل تبويب "الأدوار".
- تم تحديث:
  فرنسا × إسبانيا — 14 يوليو 2026، 10:00 مساءً بتوقيت الأردن.
  إنجلترا × الأرجنتين — 15 يوليو 2026، 10:00 مساءً بتوقيت الأردن.
- عُدّل ملف الواجهة:
  public/worldcup-knockout-cards-ui.js
- ملفات JSON المعدلة: ${jsonFilesChanged}
- كائنات المباريات المعدلة: ${matchObjectsChanged}

الخطوة التالية:
  git add public/worldcup-knockout-cards-ui.js public/worldcup-2026
  git commit -m "Split World Cup knockout rounds and update semifinals"
  git push
`);
