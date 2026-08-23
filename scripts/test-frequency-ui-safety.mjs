#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlFiles = ['public/index.html', 'public/index_phone.html'];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  assert.match(html, /frequencyRenderToken/);
  assert.match(html, /cancelAnimationFrame\(frequencyChunkFrame\)/);
  assert.match(html, /requestAnimationFrame\(appendBatch\)/);
  assert.match(html, /window\.__frequencyExtraChannels/);
  assert.match(html, /channels\.slice\(0, FREQUENCY_VISIBLE_CHANNEL_LIMIT\)/);
  assert.match(html, /classList\.contains\('active'\)/);
  assert.match(html, /const FREQUENCY_INITIAL_LIMIT/);
  assert.match(html, /const FREQUENCY_SEARCH_LIMIT/);
  assert.match(html, /const FREQUENCY_FILTER_BATCH_SIZE/);
  assert.match(html, /const FREQUENCY_RENDER_BATCH_SIZE/);
  assert.match(html, /const FREQUENCY_VISIBLE_CHANNEL_LIMIT/);
  assert.match(html, /channels\.slice\(0, FREQUENCY_VISIBLE_CHANNEL_LIMIT\)/);
  assert.match(html, /offset \+ FREQUENCY_RENDER_BATCH_SIZE/);
  assert.match(html, /let frequencyFilterFrame = 0/);
  assert.match(html, /cancelAnimationFrame\(frequencyFilterFrame\)/);
  assert.match(html, /const scanBatch = function/);
  assert.match(html, /const finishRows = function/);
  assert.match(html, /__maenAppliedLanguage/);
  assert.match(html, /if\(languageChanged\)/);
  assert.match(html, /if\(lang==='en'\)/);
  assert.match(html, /var languageChanged=previousLanguage!==lang/);
  assert.match(html, /if\(!languageChanged\)return/);
  assert.match(html, /maensat-enhancements\.js\?v=20260823-security-audit-v2/);
}

const enhancements = await readFile('public/assets/maensat-enhancements.js', 'utf8');
assert.match(enhancements, /item && \(item\.channelAliases \|\| item\.aliases\)/);
assert.match(enhancements, /matches\.forEach/);
assert.match(enhancements, /Thmanyah\.1–3 are currently on Arabsat \/ BADR 8 at 11919 H, not on Nilesat/);
assert.match(enhancements, /قنوات الثمانية 1–3 متاحة حالياً على عربسات \/ بدر 8 بتردد 11919 H، وليست على نايل سات/);
assert.match(enhancements, /function translateFrequencyUi\(\)/);
assert.match(enhancements, /Choose channel type/);
assert.match(enhancements, /Search: MBC, sports, religious, beIN/);

console.log('✓ desktop/mobile frequency UIs use cancellable rAF batches, lazy channel extras, bounded limits, cancellable filter scans, language-work caching, and correct fallback aliases');
