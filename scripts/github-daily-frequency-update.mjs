#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnSync } from 'node:child_process';

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
  normalizeFrequency,
  normalizePol,
  normalizeSr,
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


function validateCompleteProgrammingSystems(items) {
  const missing = (items || []).filter(item => !String(item.system || '').trim() || !String(item.mod || '').trim());
  if (missing.length) {
    const sample = missing.slice(0, 12).map(item => `${item.satelliteGroup || item.satellite || 'sat'} ${item.frequency || ''}${item.pol || ''}`).join(', ');
    throw new Error(`Refusing to publish incomplete frequency data: ${missing.length} rows missing system/mod values. Check LyngSat source rows first. Sample: ${sample}`);
  }
}

function stringifyJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, stringifyJson(value), 'utf8');
}

function frequencyCandidateQuality(candidates = []) {
  const totalCandidates = candidates.length;
  const missingSystemMod = candidates.filter(item => !String(item.system || '').trim() || !String(item.mod || '').trim());
  const validTuning = candidates.filter(item => normalizeFrequency(item.frequency || '') && normalizePol(item.pol || '') && normalizeSr(item.sr || ''));
  return {
    totalCandidates,
    missingSystemModCount: missingSystemMod.length,
    missingSystemModRatio: totalCandidates ? Number((missingSystemMod.length / totalCandidates).toFixed(4)) : 0,
    validTuningCount: validTuning.length,
    validTuningRatio: totalCandidates ? Number((validTuning.length / totalCandidates).toFixed(4)) : 0,
    sampleMissingSystemMod: missingSystemMod.slice(0, 20).map(item => ({
      satelliteGroup: item.satelliteGroup || item.satellite || '',
      satelliteName: item.satelliteName || '',
      frequency: item.frequency || '',
      pol: item.pol || '',
      sr: item.sr || '',
      source: item.source || item.sourceId || ''
    }))
  };
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
  const closedCandidates = sourceResults.flatMap(r => r.closedCandidates || []);
  const successfulSourceCount = sourceResults.filter(r => r.ok && !r.coverageOnly).length;
  const sourceQuality = frequencyCandidateQuality(candidates);
  console.log(`[frequency] Source quality: ${sourceQuality.missingSystemModCount}/${sourceQuality.totalCandidates} candidates missing system/mod (${sourceQuality.missingSystemModRatio}); valid tuning ${sourceQuality.validTuningCount}/${sourceQuality.totalCandidates} (${sourceQuality.validTuningRatio}).`);
  if (sourceQuality.missingSystemModCount) {
    console.log(`[frequency] Missing system/mod sample: ${JSON.stringify(sourceQuality.sampleMissingSystemMod.slice(0, 8))}`);
  }
  const minSuccessfulSourcesForPublish = Number(process.env.FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_PUBLISH || 5);
  const minCandidatesForPublish = Number(process.env.FREQUENCY_MIN_CANDIDATES_FOR_PUBLISH || 50);
  if (successfulSourceCount < minSuccessfulSourcesForPublish || candidates.length < minCandidatesForPublish) {
    throw new Error(`Refusing to publish an incomplete frequency scan: ${successfulSourceCount} successful sources and ${candidates.length} candidates; required at least ${minSuccessfulSourcesForPublish} sources and ${minCandidatesForPublish} candidates.`);
  }

  const merged = mergeFrequencyData(baseline.items || [], candidates, sources, { successfulSourceCount, closedCandidates, sourceQuality, sourceResults });

  validateCompleteProgrammingSystems(merged.items);

  const payload = {
    ok: true,
    mode: 'github-actions-static',
    servedFrom: 'github-actions-static-json',
    version: FREQUENCY_DATA_VERSION,
    updatedAt: merged.checkedAt,
    count: merged.items.length,
    removedCount: (merged.removedItems || []).length,
    candidateCount: merged.candidateCount || candidates.length,
    closedCandidateCount: merged.closedCandidateCount || closedCandidates.length,
    closedConsensusCount: merged.closedConsensusCount || 0,
    successfulSourceCount,
    sourceQuality,
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
      closedCandidates: (r.closedCandidates || []).length,
      coverageOnly: Boolean(r.coverageOnly),
      error: r.error || null
    })),
    changes: merged.changes,
    satellites: JORDAN_MENA_SATELLITES,
    note: 'Daily GitHub Actions update: imports current trusted satellite sources, refreshes channel names, adds new approved/consensus rows, removes rows missing from the daily source scan after the protected missing streak when coverage is sufficient, and deletes rows/channels that multiple trusted sources mark as closed when no current source still confirms them. Incomplete scans are refused before publication. Cloudflare Pages and Netlify stay as hosting layers.'
  };

  const report = buildFrequencyReport(payload);
  report.generatedBy = 'github-actions';
  report.staticDataPath = 'public/frequencies/frequency-data.json';

  await writeJson(dataPath, payload);
  const assets = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-frequency-assets.mjs')], { stdio: 'inherit' });
  if (assets.status !== 0) throw new Error('Failed to generate versioned frequency assets');
  // Keep Netlify fallback/baseline synced even though Netlify is now static-hosting only.
  await writeJson(netlifyBaselinePath, payload);
  await writeJson(latestReportPath, report);

  const email = await sendFrequencyUpdateEmail(report);

  console.log(`[frequency] Items after update: ${payload.count}`);
  console.log(`[frequency] Changes: ${JSON.stringify(payload.changes)}`);
  console.log(`[frequency] Email: ${JSON.stringify(email)}`);

  // Small machine-readable output for GitHub Actions logs.
  console.log(JSON.stringify({ ok: true, count: payload.count, changes: payload.changes, email }, null, 2));
}

main().catch(error => {
  console.error('[frequency] Update failed:', error && error.stack || error);
  process.exit(1);
});
