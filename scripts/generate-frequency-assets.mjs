#!/usr/bin/env node
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'public', 'frequencies', 'frequency-data.json');
const outDir = path.join(root, 'public', 'frequencies');

function cleanDate(value) {
  const text = String(value || new Date().toISOString());
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}` : new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function compactItem(item = {}) {
  const channels = Array.isArray(item.channels) ? item.channels : String(item.channel || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);
  return {
    satelliteGroup: item.satelliteGroup || '',
    satellite: item.satellite || '',
    satelliteName: item.satelliteName || '',
    orbitalSlot: item.orbitalSlot || item.orbit || '',
    frequency: item.frequency || '',
    pol: item.pol || '',
    sr: item.sr || '',
    fec: item.fec || '',
    system: item.system || '',
    mod: item.mod || '',
    channels: channels.slice(0, 80),
    aliases: item.channelAliases || {},
    searchAliases: item.searchAliases || '',
    package: item.package || item.packageName || '',
    packageId: item.packageId || '',
    categorySummary: item.categorySummary || [],
    searchPriority: item.searchPriority || 0,
    isCurrent: Boolean(item.isCurrent),
    isLegacy: Boolean(item.isLegacy),
    isDeprecated: Boolean(item.isDeprecated),
    hideFromNamedSearch: Boolean(item.hideFromNamedSearch),
    currentStatus: item.currentStatus || '',
    dataQuality: item.dataQuality || '',
    lastCheckedDisplay: item.lastCheckedDisplay || item.verifiedOn || item.encryptionLastChecked || '',
    sourceUrl: item.officialSourceUrl || item.sourceAuditUrl || item.sourceUrl || ''
  };
}

async function main() {
  const payload = JSON.parse(await readFile(dataPath, 'utf8'));
  if (!payload || !Array.isArray(payload.items)) throw new Error('Invalid public/frequencies/frequency-data.json');
  await mkdir(outDir, { recursive: true });
  const version = cleanDate(payload.updatedAt || payload.generatedAt);
  const versionFileName = `frequency-data.v${version}.json`;
  const versionPath = path.join(outDir, versionFileName);
  const searchIndexPath = path.join(outDir, 'search-index.json');
  const manifestPath = path.join(outDir, 'frequency-manifest.json');

  await writeFile(versionPath, JSON.stringify(payload) + '\n', 'utf8');

  // Keep only the current versioned frequency file to avoid publishing stale duplicates.
  const existingFiles = await readdir(outDir).catch(() => []);
  await Promise.all(existingFiles
    .filter(name => /^frequency-data\.v\d+\.json$/.test(name) && name !== versionFileName)
    .map(name => unlink(path.join(outDir, name)).catch(() => {}))
  );

  const searchIndex = {
    ok: true,
    generatedAt: new Date().toISOString(),
    updatedAt: payload.updatedAt || null,
    count: payload.items.length,
    note: 'Compact client-side search/suggestion index generated from the static frequency data. Full search results still use frequency-data JSON.',
    items: payload.items.map(compactItem)
  };
  await writeFile(searchIndexPath, JSON.stringify(searchIndex) + '\n', 'utf8');

  const manifest = {
    ok: true,
    strategy: 'versioned-static-json',
    updatedAt: payload.updatedAt || null,
    count: payload.items.length,
    version,
    dataFile: `/frequencies/${versionFileName}`,
    canonicalFile: '/frequencies/frequency-data.json',
    searchIndexFile: '/frequencies/search-index.json',
    generatedAt: new Date().toISOString(),
    cachePolicy: 'HTML loads this tiny manifest with no-cache, then loads the versioned JSON with normal immutable cache behavior. This lowers repeated Netlify/Cloudflare bandwidth.'
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, versionFileName, count: payload.items.length }, null, 2));
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
