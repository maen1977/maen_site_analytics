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
  assert.match(html, /channels\.slice\(0, 10\)/);
  assert.match(html, /classList\.contains\('active'\)/);
  assert.match(html, /const FREQUENCY_INITIAL_LIMIT/);
  assert.match(html, /const FREQUENCY_SEARCH_LIMIT/);
}

const enhancements = await readFile('public/assets/maensat-enhancements.js', 'utf8');
assert.match(enhancements, /item && \(item\.channelAliases \|\| item\.aliases\)/);
assert.match(enhancements, /matches\.forEach/);
assert.match(enhancements, /Thmanyah\.1–3 are currently on Arabsat \/ BADR 8 at 11919 H, not on Nilesat/);
assert.match(enhancements, /قنوات الثمانية 1–3 متاحة حالياً على عربسات \/ بدر 8 بتردد 11919 H، وليست على نايل سات/);

console.log('✓ desktop/mobile frequency UIs use cancellable rAF batches, lazy channel extras, bounded initial limits, and correct fallback aliases');
