#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const payload = JSON.parse(await readFile('public/frequencies/frequency-data.json', 'utf8'));
const items = payload.items || [];

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function compact(text = '') { return normalize(text).replace(/\s+/g, ''); }
function channels(item) { return Array.isArray(item.channels) ? item.channels : String(item.channel || '').split(/[،,\n]/).map(s => s.trim()).filter(Boolean); }
function aliasesFor(channel, item) {
  const aliases = item.channelAliases || {};
  return [...(aliases[channel] || []), ...(aliases[normalize(channel)] || []), ...(aliases[compact(channel)] || [])];
}
function channelBlob(channel, item) { return [channel, ...aliasesFor(channel, item), item.package || '', item.packageId || '', item.searchAliases || ''].join(' '); }
function wordSafeMatch(blob, query) {
  const q = compact(query);
  const words = normalize(blob).split(' ').map(compact).filter(Boolean);
  if (/^[a-z0-9]{2,3}$/.test(q)) return words.some(w => w === q || w.startsWith(q));
  const n = normalize(blob), c = compact(blob);
  return n.includes(normalize(query)) || c.includes(q);
}
const equivalentPairs = [
  [['jazeera','aljazeera','al jazera','جزيره','جزيرة','الجزيره','الجزيرة'], ['al jazeera','aljazeera','الجزيرة','الجزيره']],
  [['bein','beinsport','beinsports','be in','بي ان','بي إن','بين'], ['bein sports','beinsports','be in sports','بي ان سبورت']],
  [['ontime','on time','on time sport','on time sports','on sport','on sports','اون تايم','أون تايم','اون تايم سبورت','أون تايم سبورت','اون سبورت','أون سبورت'], ['ontime','on time sports','on sport','on sports','اون تايم سبورت','اون سبورت']],
  [['rai','raï','راي','راى'], ['rai','rai 1','rai 2','rai 3','rai news']]
];
function queryVariants(query) {
  const q = compact(query);
  for (const [keys, values] of equivalentPairs) {
    if (keys.some(key => compact(key) === q || compact(key).startsWith(q) || q.startsWith(compact(key)))) return values;
  }
  return [query];
}
function searchChannels(query) {
  const variants = queryVariants(query);
  const hits = [];
  for (const item of items) {
    for (const channel of channels(item)) {
      if (variants.some(v => wordSafeMatch(channelBlob(channel, item), v))) hits.push({ channel, item });
    }
  }
  return hits;
}
function isNilesat(item) { return /nilesat/i.test(item.satelliteGroup || '') || /7w|8w/i.test([item.orbit, item.orbitalSlot].join(' ')); }
function isFree(channel, item) { return (item.channelEncryption || {})[channel] === 'free'; }
function isSports(channel, item) { return ((item.channelCategories || {})[channel] || []).includes('sports') || /sport/i.test(channel); }
function assert(name, condition, detail = '') {
  if (!condition) throw new Error(`Search smoke test failed: ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`✓ ${name}`);
}

assert('frequency 11766 is available', items.some(item => String(item.frequency) === '11766'));
const jazeera = searchChannels('الجزيرة');
assert('Arabic Al Jazeera query returns Al Jazeera channels', jazeera.some(h => /jazeera/i.test(h.channel)), jazeera.slice(0, 5).map(h => h.channel).join(', '));
const bein = searchChannels('beinsport');
assert('beinsport query returns beIN Sports channels', bein.some(h => /bein/i.test(h.channel) && /sport/i.test(h.channel)), bein.slice(0, 5).map(h => h.channel).join(', '));
const rai = searchChannels('rai').slice(0, 20);
assert('rai short query does not match Bahrain by substring', !rai.some(h => /bahrain/i.test(h.channel)), rai.map(h => h.channel).join(', '));
assert('natural query: free sports on Nilesat has results', items.some(item => isNilesat(item) && channels(item).some(ch => isSports(ch, item) && isFree(ch, item))));

const ontime = searchChannels('اون تايم سبورت');
assert('Arabic ON Time Sports query returns the current 11977 V Nilesat row', ontime.some(h => String(h.item.frequency) === '11977' && String(h.item.pol).toUpperCase() === 'V'), ontime.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
assert('ON Sport query returns new Plus/Max channels on 11977', searchChannels('on sport').some(h => String(h.item.frequency) === '11977' && /plus|max|sport/i.test(h.channel)), searchChannels('on sport').slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
assert('ON Time Sports Arabsat fallback exists', items.some(item => String(item.frequency) === '12379' && /arabsat|badr/i.test(item.satelliteGroup || '') && channels(item).some(ch => /on time/i.test(ch))));
assert('manifest and versioned-data strategy is present', Boolean(JSON.parse(await readFile('public/frequencies/frequency-manifest.json', 'utf8')).dataFile));
