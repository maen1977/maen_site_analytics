#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const publicRoot = resolve('public');
const htmlFiles = ['public/index.html', 'public/index_phone.html'];
const discovered = new Map();

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  assert.match(html, /function primeDeviceImages\(section\)/, `${file}: missing device image primer`);
  assert.match(html, /img\.loading='eager'/, `${file}: device images are not promoted to eager`);
  assert.match(html, /img\.fetchPriority='low'/, `${file}: device images do not use low fetch priority`);
  assert.match(html, /img\.cloneNode\(true\)/, `${file}: unloaded images are not retried eagerly`);
  assert.match(html, /img\.replaceWith\(eager\)/, `${file}: eager retry is not installed in the card`);
  assert.match(html, /if\(id==='devices'\)\{primeDeviceImages\(target\);\}/, `${file}: device image primer is not called on section activation`);

  const section = html.match(/<section[^>]+id="devices"[\s\S]*?<\/section>/)?.[0] || '';
  const cards = [...section.matchAll(/<article[^>]+class="[^"]*device-card[^"]*"[\s\S]*?<\/article>/g)];
  const images = cards.map(card => card[0].match(/<img[^>]+src="([^"]+)"/)?.[1]).filter(Boolean);
  assert.ok(images.length >= 12, `${file}: expected at least 12 device images, found ${images.length}`);
  discovered.set(file, images);
  for (const src of images) {
    const local = resolve(publicRoot, src.replace(/^\//, ''));
    await access(local);
  }
}

assert.deepEqual(discovered.get('public/index.html'), discovered.get('public/index_phone.html'), 'desktop/mobile device image catalogs differ');
console.log(`✓ desktop/mobile device catalogs contain ${discovered.get('public/index.html').length} existing image assets and activate eager loading only when opened`);
