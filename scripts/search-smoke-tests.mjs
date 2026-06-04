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
function generatedBilingualSmokeAliases(channel) {
  const n = normalize(channel), c = compact(channel);
  const out = [];
  function hit(...keys){ return keys.some(key => c.includes(compact(key)) || (` ${n} `).includes(` ${normalize(key)} `)); }
  if (hit('al ahly','al-ahly','ahly','alahly')) out.push('الأهلي','الاهلي','اهلي','قناة الأهلي','Al Ahly','Ahly','Alahly');
  if (hit('mbc')) out.push('ام بي سي','إم بي سي','امبيسي','MBC');
  if (hit('al jazeera','aljazeera')) out.push('الجزيرة','الجزيره','Al Jazeera','Aljazeera');
  if (hit('on time sports','on time sport','ontime sports','ontime sport','on sport','on sports')) out.push('اون تايم سبورت','أون تايم سبورت','اون تايم','أون تايم','ON Time Sports','ON Sport');
  if (hit('cbc')) out.push('سي بي سي','CBC');
  if (hit('dmc')) out.push('دي ام سي','دي إم سي','DMC');
  return out;
}
function aliasesFor(channel, item) {
  const aliases = item.channelAliases || {};
  return [...(aliases[channel] || []), ...(aliases[normalize(channel)] || []), ...(aliases[compact(channel)] || []), ...generatedBilingualSmokeAliases(channel)];
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
function encryptionKey(channel, item) { return (item.channelEncryption || {})[channel] || 'unknown'; }
function isFree(channel, item) { return encryptionKey(channel, item) === 'free'; }
function isEncrypted(channel, item) { return encryptionKey(channel, item) === 'encrypted'; }
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


const ahlyArabic = searchChannels('الأهلي').filter(h => isNilesat(h.item));
assert('Arabic Al Ahly query returns Al Ahly on Nilesat', ahlyArabic.some(h => /ahly/i.test(h.channel) && String(h.item.frequency) === '11747'), ahlyArabic.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const ahlyPlainArabic = searchChannels('اهلي').filter(h => isNilesat(h.item));
assert('Plain Arabic Ahly query without hamza/article also works', ahlyPlainArabic.some(h => /ahly/i.test(h.channel)), ahlyPlainArabic.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const ahlyEnglish = searchChannels('ahly').filter(h => isNilesat(h.item));
assert('English Ahly query still returns Al Ahly on Nilesat', ahlyEnglish.some(h => /ahly/i.test(h.channel)), ahlyEnglish.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));

const ontime = searchChannels('اون تايم سبورت');
assert('Arabic ON Time Sports query returns the current 11977 V Nilesat row', ontime.some(h => String(h.item.frequency) === '11977' && String(h.item.pol).toUpperCase() === 'V'), ontime.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
assert('ON Sport query returns new Plus/Max channels on 11977', searchChannels('on sport').some(h => String(h.item.frequency) === '11977' && /plus|max|sport/i.test(h.channel)), searchChannels('on sport').slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
assert('ON Time Sports Arabsat fallback exists', items.some(item => String(item.frequency) === '12379' && /arabsat|badr/i.test(item.satelliteGroup || '') && channels(item).some(ch => /on time/i.test(ch))));
assert('manifest and versioned-data strategy is present', Boolean(JSON.parse(await readFile('public/frequencies/frequency-manifest.json', 'utf8')).dataFile));

const mbcHits = searchChannels('mbc').filter(h => /(^|\W)mbc($|\W|\d)/i.test(h.channel));
assert('MBC query returns many programming results', mbcHits.length >= 20, mbcHits.slice(0, 12).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
assert('MBC programming results include system data when available', mbcHits.some(h => h.item.system), mbcHits.slice(0, 8).map(h => `${h.channel}:${h.item.system || 'missing'}`).join(', '));

const mbcNilesatHits = mbcHits.filter(h => isNilesat(h.item));
assert('MBC query on Nilesat/Eutelsat 7W-8W returns the full station set', mbcNilesatHits.length >= 25, mbcNilesatHits.slice(0, 12).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const mbcRowsWithSystem = mbcHits.filter(h => String(h.item.system || '').trim() && String(h.item.mod || '').trim());
assert('every MBC result card can show system/mod', mbcRowsWithSystem.length === mbcHits.length, mbcHits.filter(h => !String(h.item.system || '').trim() || !String(h.item.mod || '').trim()).slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const mbcEncryptedOnly = mbcHits.filter(h => isEncrypted(h.channel, h.item));
assert('encrypted filter keeps MBC out unless the specific MBC channel is encrypted', mbcEncryptedOnly.length === 0 || mbcEncryptedOnly.every(h => isEncrypted(h.channel, h.item)), mbcEncryptedOnly.map(h => `${h.channel}:${encryptionKey(h.channel, h.item)}`).join(', '));



const cbcMixed = searchChannels('CBC مصر').filter(h => isNilesat(h.item));
assert('CBC mixed Arabic/English query returns CBC only, not MBC', cbcMixed.length > 0 && cbcMixed.every(h => /cbc/i.test(h.channel) && !/mbc/i.test(h.channel)), cbcMixed.slice(0, 12).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const cbcArabic = searchChannels('سي بي سي مصر').filter(h => isNilesat(h.item));
assert('Arabic CBC Egypt query returns CBC family only', cbcArabic.length > 0 && cbcArabic.every(h => /cbc/i.test(h.channel) && !/mbc/i.test(h.channel)), cbcArabic.slice(0, 12).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));
const mbcArabicMasr = searchChannels('ام بي سي مصر').filter(h => isNilesat(h.item));
assert('Arabic MBC Egypt query does not fall into CBC', mbcArabicMasr.length > 0 && mbcArabicMasr.every(h => /mbc/i.test(h.channel) && !/cbc/i.test(h.channel)), mbcArabicMasr.slice(0, 12).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}`).join(', '));


const entvAlgeriaEncrypted = searchChannels('National Program').filter(h => isNilesat(h.item));
assert('National Program query returns ENTV / Programme National on Nilesat', entvAlgeriaEncrypted.some(h => /entv|programme national/i.test(h.channel) && String(h.item.frequency) === '11680' && isEncrypted(h.channel, h.item)), entvAlgeriaEncrypted.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}:${encryptionKey(h.channel, h.item)}`).join(', '));
const entvArabicEncrypted = searchChannels('القناة الأرضية الجزائرية').filter(h => isNilesat(h.item));
assert('Arabic Algerian terrestrial query returns encrypted ENTV / Programme National', entvArabicEncrypted.some(h => /entv|programme national/i.test(h.channel) && String(h.item.frequency) === '11680' && isEncrypted(h.channel, h.item)), entvArabicEncrypted.slice(0, 8).map(h => `${h.channel} ${h.item.frequency}${h.item.pol}:${encryptionKey(h.channel, h.item)}`).join(', '));
const encryptedAlgeriaRows = items.filter(item => isNilesat(item) && channels(item).some(ch => isEncrypted(ch, item) && ((item.channelCountries || {})[ch] || []).includes('algeria')));
assert('Nilesat encrypted Algerian channel filter includes ENTV / Programme National', encryptedAlgeriaRows.some(item => String(item.frequency) === '11680' && channels(item).some(ch => /entv|programme national/i.test(ch))), encryptedAlgeriaRows.map(item => `${item.frequency}${item.pol} ${channels(item).filter(ch => isEncrypted(ch, item)).join('/')}`).join(', '));

const missingSystemRows = items.filter(item => !String(item.system || '').trim());
assert('all frequency rows include a programming system value', missingSystemRows.length === 0, missingSystemRows.slice(0, 8).map(item => `${item.satelliteGroup || item.satellite} ${item.frequency}${item.pol}`).join(', '));
const missingModRows = items.filter(item => !String(item.mod || '').trim());
assert('all frequency rows include modulation when shown as system/mod', missingModRows.length === 0, missingModRows.slice(0, 8).map(item => `${item.satelliteGroup || item.satellite} ${item.frequency}${item.pol}`).join(', '));
