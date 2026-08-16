import assert from 'node:assert/strict';
import { mergeFrequencyData, setRuntimeContext } from '../functions/_lib/frequency-utils.js';

setRuntimeContext({ env: {
  FREQUENCY_REMOVE_MOVED_CHANNELS: '1',
  FREQUENCY_MIN_CANDIDATES_FOR_REMOVAL: '1',
  FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_REMOVAL: '1'
} });

const baseline = [{
  satelliteGroup: 'Nilesat', satellite: '7.0W / Eutelsat E7WA', satelliteName: '7.0W / Eutelsat E7WA', orbitalSlot: '7W',
  frequency: '12187', pol: 'H', sr: '27500', system: 'DVB-S2', mod: '8PSK',
  channels: ['beIN SPORTS NEWS', 'beIN SPORTS 5'], channel: 'beIN SPORTS NEWS، beIN SPORTS 5',
  channelEncryption: { 'beIN SPORTS NEWS': 'free', 'beIN SPORTS 5': 'encrypted' }
}];
const candidate = {
  satelliteGroup: 'Nilesat', satellite: '7.0W / Eutelsat E7WA', satelliteName: '7.0W / Eutelsat E7WA', orbitalSlot: '7W',
  frequency: '12245', pol: 'V', sr: '27500', system: 'DVB-S2', mod: '8PSK',
  channels: ['beIN SPORTS NEWS'], channel: 'beIN SPORTS NEWS', updatePolicy: 'auto-approve', source: 'test'
};

const result = mergeFrequencyData(baseline, [candidate], [{ id: 'test', name: 'test' }], {
  successfulSourceCount: 1,
  sourceQuality: { totalCandidates: 1, missingSystemModCount: 0, validTuningCount: 1 }
});

assert.equal(result.items.some(item => item.frequency === '12245' && item.channels.includes('beIN SPORTS NEWS')), true);
const old = result.items.find(item => item.frequency === '12187');
assert.equal(old?.channels.includes('beIN SPORTS NEWS') || false, false);
assert.equal(old?.channels.includes('beIN SPORTS 5') || false, true);
assert.equal(result.changes.movedChannelsRemoved, 1);
console.log('✓ moved channel is removed from old tuning and retained on new tuning');
