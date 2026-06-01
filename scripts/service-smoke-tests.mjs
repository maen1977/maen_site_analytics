import { readFile } from 'node:fs/promises';

function normalizeArabic(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function score(q, a) {
  const nq = normalizeArabic(q);
  const text = normalizeArabic([a.title, a.summary, (a.steps || []).join(' '), (a.keywords || []).join(' '), a.brand, a.nameAr].join(' '));
  let s = 0;
  for (const t of nq.split(' ').filter(x => x.length > 1)) if (text.includes(t)) s += 1;
  return s;
}

async function loadServiceIndex() {
  let manifest = JSON.parse(await readFile('public/service/index/service-index-manifest.json', 'utf8'));
  if (!manifest.sharded) return manifest;
  const articles = [];
  for (const shard of manifest.shards || []) {
    const payload = JSON.parse(await readFile('public/service/index/' + shard.file, 'utf8'));
    articles.push(...(payload.articles || []));
  }
  return { ...manifest, articles };
}

const index = await loadServiceIndex();
const queries = ['كيف أشبك ريسيفر سبايدر على النت', 'كيف أنزل يوتيوب على G Guard', 'شاشة سامسونج اليوتيوب علق', 'IPTV يقطع على Android Box', 'No Signal على الرسيفر'];
for (const q of queries) {
  const best = (index.articles || []).map(a => ({ a, s: score(q, a) })).sort((x, y) => y.s - x.s)[0];
  if (!best || best.s <= 0) throw new Error(`No service result for ${q}`);
  console.log(`✓ ${q} -> ${best.a.title}`);
}
console.log(JSON.stringify({ ok: true, serviceArticles: index.count || index.articles.length, shards: index.shardCount || 0 }, null, 2));
