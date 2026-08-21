import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const readText = async file => readFile(path.join(root, file), 'utf8');

const full = await readJson('public/frequencies/frequency-data.json');
const shard = await readJson('public/frequencies/frequency-data-nilesat-fta.json');
const index = await readJson('public/frequencies/search-index.json');
const generator = await readText('scripts/generate-frequency-assets.mjs');
const shared = await readText('public/assets/maensat-enhancements.js');
const pages = await Promise.all(['public/index.html', 'public/index_phone.html'].map(readText));

const allItems = Array.isArray(full.items) ? full.items : [];
const shardItems = Array.isArray(shard.items) ? shard.items : [];
assert.ok(allItems.length > 0, 'full frequency data must not be empty');
assert.ok(shardItems.length > 0, 'Nilesat/FTA shard must not be empty');
assert.match(generator, /channelEncryption:\s*item\.channelEncryption/);
assert.match(shared, /function fallbackChannelsForService/);

for (const page of pages) {
  assert.match(page, /encKey === 'free'\s*\)/, 'FTA must accept only free channels');
  assert.doesNotMatch(page, /encKey === 'free'\s*\|\|\s*encKey === 'unknown'/, 'unknown must not be silently shown as FTA');
  assert.match(page, /v=20260821-service-filter-v1/);
}

const channelsOf = item => Array.isArray(item.channels)
  ? item.channels.filter(Boolean)
  : String(item.channel || '').split(/[،,|]+/).map(x => x.trim()).filter(Boolean);
const statusOf = (item, channel) => {
  const map = item.channelEncryption || {};
  if (map[channel] != null) return String(map[channel]).toLowerCase();
  const key = Object.keys(map).find(x => x.trim().toLowerCase() === channel.trim().toLowerCase());
  return key ? String(map[key]).toLowerCase() : 'unknown';
};
const filterBy = (item, filter) => channelsOf(item).filter(channel => {
  const status = statusOf(item, channel);
  if (filter === 'free') return status === 'free';
  if (filter === 'encrypted') return status === 'encrypted';
  return true;
});

let mixedItems = 0;
for (const item of allItems) {
  const channels = channelsOf(item);
  const statuses = channels.map(channel => statusOf(item, channel));
  if (statuses.includes('free') && statuses.includes('encrypted')) {
    mixedItems += 1;
    assert.ok(filterBy(item, 'free').every(channel => statusOf(item, channel) === 'free'));
    assert.ok(filterBy(item, 'encrypted').every(channel => statusOf(item, channel) === 'encrypted'));
    assert.equal(filterBy(item, 'all').length, channels.length);
  }
}
assert.ok(mixedItems > 0, 'test data must include at least one mixed free/encrypted frequency');

const target = shardItems.find(item => item.frequency === '12245' && item.pol === 'V');
assert.ok(target, 'Nilesat 12245 V must remain in the FTA shard');
assert.ok(filterBy(target, 'free').includes('beIN SPORTS NEWS'));
assert.ok(filterBy(target, 'free').includes('beIN SPORTS MAX 6'));
assert.equal(filterBy(target, 'encrypted').length, 0, 'FTA shard must not contain encrypted beIN channels');
assert.equal(filterBy(target, 'all').length, filterBy(target, 'free').length);

const indexedTarget = index.items.find(item => item.satelliteGroup === 'Nilesat' && item.orbitalSlot === '7W' && item.frequency === '12245' && item.pol === 'V');
assert.ok(indexedTarget, 'search index must contain Nilesat 12245 V');
assert.equal(String(indexedTarget.channelEncryption?.['beIN SPORTS MAX 6']).toLowerCase(), 'free');

console.log(`✓ service filters are per-channel across ${mixedItems} mixed frequencies; beIN MAX 6 is retained as FTA`);
