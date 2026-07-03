#!/usr/bin/env node

import { access } from 'node:fs/promises';

const requiredFiles = [
  'scripts/github-daily-frequency-update.mjs',
  'scripts/github-daily-analytics-report.mjs',
  'functions/_lib/frequency-utils.js',
  'functions/_lib/analytics.js',
  'public/frequencies/frequency-data.json',
  'public/frequencies/frequency-sources.json'
];

const requiredForMail = ['RESEND_API_KEY', 'REPORT_EMAIL'];
const requiredForD1 = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'];
const recommended = ['REPORT_FROM', 'ANALYTICS_TIMEZONE', 'PUBLIC_BASE_URL'];

function isPresent(name) {
  return Boolean(String(process.env[name] || '').trim());
}

function listMissing(names) {
  return names.filter((name) => !isPresent(name));
}

async function verifyFiles() {
  const missing = [];
  for (const file of requiredFiles) {
    try {
      await access(file);
    } catch {
      missing.push(file);
    }
  }
  return missing;
}

const missingFiles = await verifyFiles();
const missingMail = listMissing(requiredForMail);
const missingD1 = listMissing(requiredForD1);
const missingRecommended = listMissing(recommended);

console.log('[daily-report-env] Checking required files and secrets.');
console.log(`[daily-report-env] Timezone: ${process.env.ANALYTICS_TIMEZONE || 'Asia/Amman'}`);
console.log(`[daily-report-env] Public base URL: ${process.env.PUBLIC_BASE_URL || 'https://maensat.pages.dev'}`);

if (missingRecommended.length) {
  console.warn(`[daily-report-env] Recommended values missing: ${missingRecommended.join(', ')}`);
}

if (missingFiles.length || missingMail.length || missingD1.length) {
  if (missingFiles.length) console.error(`[daily-report-env] Missing files: ${missingFiles.join(', ')}`);
  if (missingMail.length) console.error(`[daily-report-env] Missing mail secrets: ${missingMail.join(', ')}`);
  if (missingD1.length) console.error(`[daily-report-env] Missing Cloudflare D1 secrets: ${missingD1.join(', ')}`);
  console.error('[daily-report-env] Add the missing values in GitHub → Settings → Secrets and variables → Actions.');
  process.exit(1);
}

console.log('[daily-report-env] Required files and secrets are present.');
