import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';

const JSON_FILES = [
  'matches.json',
  'broadcasts.json',
  'standings.json',
  'bracket.json'
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

  const pick = (type) => parts.find((part) => part.type === type)?.value || '00';
  let hour = pick('hour');
  if (hour === '24') hour = '00';

  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}:${pick('second')}+03:00`;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    console.warn(`[worldcup-heartbeat] Skip ${path.relative(ROOT, filePath)}: ${error.message}`);
    return null;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function touchJsonFile(fileName, nowIso, runInfo) {
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
  data.metadata.force_quarter_hour_update = true;
  data.metadata.cloudflare_deploy_trigger = true;
  data.metadata.github_run_id = runInfo.runId;
  data.metadata.github_run_number = runInfo.runNumber;
  data.metadata.github_sha = runInfo.sha;
  data.metadata.note_ar =
    'تم فحص بيانات كأس العالم تلقائياً. هذا الوقت يتغير كل ربع ساعة مع وجود مباراة أو بدون مباراة لإجبار GitHub وCloudflare Pages على نشر نسخة حديثة.';

  await writeJson(filePath, data);
  console.log(`[worldcup-heartbeat] touched ${path.relative(ROOT, filePath)} at ${nowIso}`);
  return true;
}

async function writeHeartbeat(nowIso, touched, runInfo) {
  await fs.mkdir(WC_DIR, { recursive: true });

  const heartbeat = {
    name: 'World Cup 2026 quarter-hour heartbeat',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    schedule: 'every 15 minutes',
    files_touched: touched,
    force_cloudflare_deploy: true,
    deploy_hook_secret_name: 'CLOUDFLARE_PAGES_DEPLOY_HOOK',
    source: 'github-actions',
    github: runInfo,
    note_ar:
      'هذا الملف يتغير كل ربع ساعة مع وجود مباراة أو بدون مباراة. إذا كان Cloudflare Pages مربوطاً عبر Git أو Deploy Hook، يجب أن يظهر deploy جديد بعد كل تشغيل.'
  };

  await writeJson(path.join(WC_DIR, 'heartbeat.json'), heartbeat);

  const marker = [
    'World Cup 2026 quarter-hour deploy marker',
    `last_checked_at=${nowIso}`,
    `timezone=${TIMEZONE}`,
    `github_run_id=${runInfo.runId}`,
    `github_run_number=${runInfo.runNumber}`,
    `github_sha=${runInfo.sha}`,
    'cloudflare_deploy_trigger=true',
    'deploy_hook_secret_name=CLOUDFLARE_PAGES_DEPLOY_HOOK',
    ''
  ].join('\n');

  await fs.writeFile(path.join(WC_DIR, 'deploy-marker.txt'), marker, 'utf8');

  console.log(`[worldcup-heartbeat] wrote heartbeat.json and deploy-marker.txt at ${nowIso}`);
}

const nowIso = jordanIso(new Date());

const runInfo = {
  runId: process.env.GITHUB_RUN_ID || '',
  runNumber: process.env.GITHUB_RUN_NUMBER || '',
  workflow: process.env.GITHUB_WORKFLOW || '',
  eventName: process.env.GITHUB_EVENT_NAME || '',
  schedule: process.env.GITHUB_EVENT_SCHEDULE || '',
  repository: process.env.GITHUB_REPOSITORY || '',
  ref: process.env.GITHUB_REF || '',
  sha: process.env.GITHUB_SHA || ''
};

let touched = 0;

await fs.mkdir(WC_DIR, { recursive: true });

for (const fileName of JSON_FILES) {
  if (await touchJsonFile(fileName, nowIso, runInfo)) touched += 1;
}

await writeHeartbeat(nowIso, touched, runInfo);

console.log(`[worldcup-heartbeat] Done. JSON files touched: ${touched}`);
