#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const baseUrl = (process.env.PUBLIC_BASE_URL || 'https://maensat.pages.dev').replace(/\/$/, '');
const now = new Date().toISOString();

const pages = [
  { file: 'index.html', title: 'معن حنونة للستلايت', hash: '#home', priority: '1.0', changefreq: 'daily', desc: 'بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت في الفحيص وعمان الغربية والسلط والسرو.' },
  { file: 'frequencies.html', title: 'بحث ترددات القنوات', hash: '#frequencies', priority: '0.9', changefreq: 'daily', desc: 'بحث سريع في ترددات نايل سات وعرب سات وأقمار الشرق الأوسط.' },
  { file: 'updates.html', title: 'آخر تحديثات الترددات والقنوات', hash: '#updates', priority: '0.9', changefreq: 'daily', desc: 'آخر تحديثات الترددات والمحطات والأقمار والقنوات الرياضية المجانية المعلنة للشرق الأوسط.' },
  { file: 'maintenance.html', title: 'خدمات تركيب وصيانة الستلايت', hash: '#maintenance', priority: '0.8', changefreq: 'weekly', desc: 'خدمات تركيب وصيانة وبرمجة الستلايت والأطباق واللواقط.' },
  { file: 'devices.html', title: 'أجهزة رسيفر ولواقط', hash: '#devices', priority: '0.8', changefreq: 'weekly', desc: 'أجهزة رسيفر ولواقط وقطع ستلايت متوفرة مع تواصل مباشر.' }
];

function esc(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

function landingPage(p) {
  const target = `${baseUrl}/${p.hash}`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)} | معن حنونة للستلايت</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=/${p.hash}">
<style>body{font-family:Tahoma,Arial,sans-serif;background:#f8f5ed;color:#111;line-height:1.8;margin:0}.wrap{max-width:780px;margin:70px auto;background:#fff;border-radius:26px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.10)}a{color:#111;font-weight:900;background:#ffd23f;border-radius:999px;padding:10px 14px;text-decoration:none;display:inline-flex}</style>
<script>location.replace('/${p.hash}');</script>
</head>
<body><main class="wrap"><h1>${esc(p.title)}</h1><p>${esc(p.desc)}</p><p><a href="/${p.hash}">فتح القسم الآن</a></p></main></body></html>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  const urls = pages.map(p => `  <url><loc>${baseUrl}/${p.file === 'index.html' ? '' : p.file}</loc><lastmod>${now}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n');
  await writeFile(path.join(publicDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'utf8');
  await writeFile(path.join(publicDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`, 'utf8');
  for (const p of pages.filter(p => p.file !== 'index.html' && !p.standalone)) await writeFile(path.join(publicDir, p.file), landingPage(p), 'utf8');
  await writeFile(path.join(publicDir, 'site.webmanifest'), JSON.stringify({
    name: 'معن حنونة للستلايت', short_name: 'MaenSat', lang: 'ar', dir: 'rtl', start_url: '/', display: 'standalone', background_color: '#f8f5ed', theme_color: '#ffd23f', description: pages[0].desc
  }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, sitemap: 'public/sitemap.xml', pages: pages.length }, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
