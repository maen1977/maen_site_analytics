import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const FILES = ['matches.json', 'broadcasts.json', 'standings.json'];

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
  let hour = pick('hour');
  if (hour === '24') hour = '00';

  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}:${pick('second')}+03:00`;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    console.warn(`[worldcup-heartbeat] Cannot read ${filePath}: ${error.message}`);
    return null;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function touchFile(fileName, nowIso) {
  const filePath = path.join(WC_DIR, fileName);
  const data = await readJson(filePath);
  if (!data || typeof data !== 'object') return false;

  data.metadata ||= {};

  if (!data.metadata.last_data_change_at && data.metadata.last_updated) {
    data.metadata.last_data_change_at = data.metadata.last_updated;
  }

  data.metadata.last_checked_at = nowIso;
  data.metadata.last_updated = nowIso;
  data.metadata.automation_heartbeat = true;
  data.metadata.automation_heartbeat_at = nowIso;
  data.metadata.automation_heartbeat_note_ar =
    'تم فحص بيانات كأس العالم تلقائيا. قد لا تتغير النتائج إذا لم يرسل المصدر نتيجة جديدة.';

  await writeJson(filePath, data);
  console.log(`[worldcup-heartbeat] touched ${fileName} at ${nowIso}`);
  return true;
}

async function writeHeartbeat(nowIso, touched) {
  await fs.mkdir(WC_DIR, { recursive: true });

  const heartbeat = {
    name: 'World Cup 2026 heartbeat',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    files_touched: touched,
    source: 'github-actions',
    note_ar: 'هذا الملف يتغير كل تشغيل حتى يجبر Cloudflare Pages والمتصفح على رؤية فحص جديد.'
  };

  await writeJson(path.join(WC_DIR, 'heartbeat.json'), heartbeat);
  console.log(`[worldcup-heartbeat] wrote heartbeat.json at ${nowIso}`);
}

await fs.mkdir(WC_DIR, { recursive: true });

const nowIso = jordanIso(new Date());
let touched = 0;

for (const fileName of FILES) {
  if (await touchFile(fileName, nowIso)) touched += 1;
}

await writeHeartbeat(nowIso, touched);
console.log(`[worldcup-heartbeat] done. Files touched: ${touched}`);
