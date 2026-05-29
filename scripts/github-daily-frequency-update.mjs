#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateLatestUpdates } from './generate-latest-updates.mjs';

import {
  EXPECTED_SOURCE_SERVICE_COUNTS,
  FREQUENCY_DATA_VERSION,
  JORDAN_MENA_SATELLITES,
  buildFrequencyReport,
  buildGroupCounts,
  buildSatelliteIdentityCounts,
  fetchSourceCandidates,
  mapWithConcurrency,
  mergeFrequencyData,
  sendFrequencyUpdateEmail,
  setRuntimeContext
} from '../functions/_lib/frequency-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

setRuntimeContext({ env: process.env, baseUrl: process.env.PUBLIC_BASE_URL || process.env.PAGES_BASE_URL || '' });

const dataPath = path.join(root, 'public', 'frequencies', 'frequency-data.json');
const sourcesPath = path.join(root, 'public', 'frequencies', 'frequency-sources.json');
const netlifyBaselinePath = path.join(root, 'netlify', 'frequency-baseline.json');
const latestReportPath = path.join(root, 'public', 'frequencies', 'latest-frequency-update-report.json');

function readJson(file) {
  return readFile(file, 'utf8').then(text => JSON.parse(text));
}

function stringifyJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, stringifyJson(value), 'utf8');
}

async function main() {
  const baseline = await readJson(dataPath);
  const sources = await readJson(sourcesPath);
  if (!baseline || !Array.isArray(baseline.items)) throw new Error(`Invalid frequency data file: ${dataPath}`);
  if (!Array.isArray(sources) || !sources.length) throw new Error(`Invalid frequency sources file: ${sourcesPath}`);

  const startedAt = new Date().toISOString();
  console.log(`[frequency] Daily GitHub update started at ${startedAt}`);
  console.log(`[frequency] Baseline items: ${baseline.items.length}; sources: ${sources.length}`);

  const sourceResults = await mapWithConcurrency(
    sources,
    process.env.FREQUENCY_SOURCE_CONCURRENCY || 16,
    fetchSourceCandidates
  );

  const candidates = sourceResults.flatMap(r => r.candidates || []);
  const successfulSourceCount = sourceResults.filter(r => r.ok && !r.coverageOnly).length;
  const merged = mergeFrequencyData(baseline.items || [], candidates, sources, { successfulSourceCount });

  const payload = {
    ok: true,
    mode: 'github-actions-static',
    servedFrom: 'github-actions-static-json',
    version: FREQUENCY_DATA_VERSION,
    updatedAt: merged.checkedAt,
    count: merged.items.length,
    removedCount: (merged.removedItems || []).length,
    candidateCount: merged.candidateCount || candidates.length,
    successfulSourceCount,
    groupCounts: buildGroupCounts(merged.items),
    satelliteIdentityCounts: buildSatelliteIdentityCounts(merged.items),
    satellitePositionPolicy: 'v5 merge identity = satelliteGroup + orbitalSlot + satelliteName + frequency + polarity + symbolRate. This prevents accidental merging when multiple physical satellites share one orbital position.',
    expectedSourceServiceCounts: EXPECTED_SOURCE_SERVICE_COUNTS,
    items: merged.items,
    removedItems: (merged.removedItems || []).slice(0, 300),
    reviewedOnly: merged.reviewedOnly.slice(0, 200),
    sourceResults: sourceResults.map(r => ({
      id: r.source && r.source.id,
      name: r.source && r.source.name,
      ok: Boolean(r.ok),
      status: r.status || null,
      candidates: (r.candidates || []).length,
      coverageOnly: Boolean(r.coverageOnly),
      error: r.error || null
    })),
    changes: merged.changes,
    satellites: JORDAN_MENA_SATELLITES,
    note: 'Daily GitHub Actions update: imports current trusted satellite sources, refreshes channel names, adds new approved/consensus rows, removes rows missing from the daily source scan when coverage is sufficient, then commits the updated static JSON. Cloudflare Pages and Netlify stay as hosting layers.'
  };

  const report = buildFrequencyReport(payload);
  report.generatedBy = 'github-actions';
  report.staticDataPath = 'public/frequencies/frequency-data.json';

  await writeJson(dataPath, payload);
  // Keep Netlify fallback/baseline synced even though Netlify is now static-hosting only.
  await writeJson(netlifyBaselinePath, payload);
  await writeJson(latestReportPath, report);
  const latestUpdates = await generateLatestUpdates({ frequencyPayload: payload, frequencyReport: report });

  const email = await sendFrequencyUpdateEmail(report);

  console.log(`[frequency] Items after update: ${payload.count}`);
  console.log(`[frequency] Changes: ${JSON.stringify(payload.changes)}`);
  console.log(`[frequency] Email: ${JSON.stringify(email)}`);
  console.log(`[frequency] Latest updates generated: ${latestUpdates.count}`);

  // Small machine-readable output for GitHub Actions logs.
  console.log(JSON.stringify({ ok: true, count: payload.count, changes: payload.changes, latestUpdates: latestUpdates.count, email }, null, 2));
}

main().catch(error => {
  console.error('[frequency] Update failed:', error && error.stack || error);
  process.exit(1);
});
