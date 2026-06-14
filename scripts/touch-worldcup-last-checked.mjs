import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';

const FILES = [
  'matches.json',
  'broadcasts.json',
  'standings.json'
];

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
    console.warn(`[worldcup-heartbeat] Skip ${filePath}: ${error.message}`);
    return null;
  }
}

async function touchFile(fileName, nowIso) {
  const filePath = path.join(WC_DIR, fileName);
  const data = await readJson(filePath);
  if (!data || typeof data !== 'object') return false;

  data.metadata ||= {};

  // احفظ آخر وقت تغيير حقيقي معروف قبل ما نحول last_updated إلى مؤشر فحص حي.
  if (!data.metadata.last_data_change_at && data.metadata.last_updated) {
    data.metadata.last_data_change_at = data.metadata.last_updated;
  }

  // هذا اللي غالبًا يقرأه الموقع ويظهره للمستخدم.
  data.metadata.last_updated = nowIso;
  data.metadata.last_checked_at = nowIso;

  // حقول توضيحية حتى نعرف أن التحديث جاء من GitHub Action حتى لو ما تغيرت نتيجة.
  data.metadata.automation_heartbeat = true;
  data.metadata.automation_heartbeat_at = nowIso;
  data.metadata.automation_heartbeat_note_ar =
    'تم فحص بيانات كأس العالم تلقائيًا. قد لا تتغير النتائج إذا لم يرسل المصدر نتيجة جديدة.';

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[worldcup-heartbeat] touched public/worldcup-2026/${fileName} at ${nowIso}`);
  return true;
}

const nowIso = jordanIso(new Date());
let touched = 0;

for (const fileName of FILES) {
  if (await touchFile(fileName, nowIso)) touched += 1;
}

console.log(`[worldcup-heartbeat] Done. Files touched: ${touched}`);
