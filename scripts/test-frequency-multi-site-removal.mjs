import assert from 'node:assert/strict';
import { mergeFrequencyData, setRuntimeContext } from '../functions/_lib/frequency-utils.js';

const baseline = [{
  satelliteGroup: 'Nilesat', satelliteName: '7.0W / Eutelsat E7WA', orbitalSlot: '7W',
  frequency: '12187', pol: 'H', sr: '27500', system: 'DVB-S2', mod: '8PSK',
  channels: ['Old Channel'], channel: 'Old Channel'
}];
const current = {
  satelliteGroup: 'Nilesat', satelliteName: '7.0W / Eutelsat E7WA', orbitalSlot: '7W',
  frequency: '12245', pol: 'V', sr: '27500', system: 'DVB-S2', mod: '8PSK',
  channels: ['Current Channel'], channel: 'Current Channel', updatePolicy: 'baseline-refresh'
};
const sources = [
  { id: 'source-a', name: 'Reference A', url: 'https://reference-a.example/nilesat', satelliteGroup: 'Nilesat', orbit: '7W' },
  { id: 'source-b', name: 'Reference B', url: 'https://reference-b.example/nilesat', satelliteGroup: 'Nilesat', orbit: '7W' }
];
const sourceResults = sources.map(source => ({ source, ok: true, coverageOnly: false, candidates: [current], closedCandidates: [] }));

setRuntimeContext({ env: {
  FREQUENCY_REMOVE_MISSING: '1',
  FREQUENCY_REMOVE_MOVED_CHANNELS: '0',
  FREQUENCY_MIN_CANDIDATES_FOR_REMOVAL: '1',
  FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_REMOVAL: '1',
  FREQUENCY_REMOVE_MISSING_AFTER_CHECKS: '1',
  FREQUENCY_MIN_MISSING_CONFIRMATION_SITES: '2',
  FREQUENCY_MIN_COMPLETE_CANDIDATES_FOR_REMOVAL: '1',
  FREQUENCY_MIN_VALID_TUNING_FOR_REMOVAL: '1'
} });

const confirmed = mergeFrequencyData(baseline, [current], sources, {
  successfulSourceCount: 2,
  sourceResults,
  sourceQuality: { totalCandidates: 1, missingSystemModCount: 0, validTuningCount: 1 }
});
assert.equal(confirmed.items.some(item => item.frequency === '12187'), false);
assert.equal(confirmed.removedItems[0].confirmationSiteCount, 2);
assert.match(confirmed.removedItems[0].removedReason, /2-independent-source-sites/);

const singleSource = mergeFrequencyData(baseline, [current], sources, {
  successfulSourceCount: 1,
  sourceResults: [sourceResults[0]],
  sourceQuality: { totalCandidates: 1, missingSystemModCount: 0, validTuningCount: 1 }
});
assert.equal(singleSource.items.some(item => item.frequency === '12187'), true);
assert.equal(singleSource.changes.missingConfirmationProtected, 1);
console.log('✓ old tuning is removed only with two independent source sites; one site protects it');
