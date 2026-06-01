#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const updatesDir = path.join(root, 'public', 'updates');
const updatesPath = path.join(updatesDir, 'latest-updates.json');
const manualPath = path.join(updatesDir, 'manual-updates.json');
const frequencyPath = path.join(root, 'public', 'frequencies', 'frequency-data.json');
const reportPath = path.join(root, 'public', 'frequencies', 'latest-frequency-update-report.json');

async function readJsonOptional(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

function safeText(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function slug(value) {
  return safeText(value, 120).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-+|-+$/g, '') || 'news';
}

function makeItem({ category = 'channels', title, summary, date, important = false, satellite = '', frequency = '', oldFrequency = '', polarity = '', symbolRate = '', status = '', sources = [], tags = [] }) {
  const stamp = date || new Date().toISOString();
  return {
    id: `${stamp.slice(0, 10)}-${category}-${slug(title)}`,
    category,
    title: safeText(title, 180),
    summary: safeText(summary, 650),
    date: stamp,
    important: Boolean(important),
    satellite: safeText(satellite, 120),
    frequency: safeText(frequency, 60),
    oldFrequency: safeText(oldFrequency, 60),
    polarity: safeText(polarity, 20),
    symbolRate: safeText(symbolRate, 30),
    status: safeText(status, 140),
    sources: (sources || []).slice(0, 5).map(x => typeof x === 'string' ? x : { name: safeText(x.name, 120), url: safeText(x.url, 400) }),
    tags: (tags || []).slice(0, 10).map(x => safeText(x, 60))
  };
}

function isPublicNews(item = {}) {
  const text = [item.title, item.summary, item.status, ...(item.tags || []), ...(item.sources || []).map(s => typeof s === 'string' ? s : s?.name || '')].join(' ');
  const hidden = ['كاش', 'أداء', 'سرعة الصفحة', 'استضافة', 'خفيف', 'خفيفة', 'سياسة نشر', 'سياسة تحريرية', 'منع تكرار', 'جودة النتائج', 'تحسين واجهة', 'Cloudflare', 'Netlify', 'GitHub', 'JSON'];
  return !hidden.some(word => text.includes(word));
}

export async function generateLatestUpdates(options = {}) {
  const now = new Date().toISOString();
  const payload = options.frequencyPayload || await readJsonOptional(frequencyPath, { items: [], updatedAt: now, count: 0 });
  const report = options.frequencyReport || await readJsonOptional(reportPath, null);
  const manual = await readJsonOptional(manualPath, { items: [] });
  const items = [];

  const changes = report?.changes || payload?.changes || {};
  const changeCount = Number(changes.added || 0) + Number(changes.updated || 0) + Number(changes.removed || payload.removedCount || 0);
  if (report || payload?.updatedAt) {
    items.push(makeItem({
      category: 'frequency',
      important: changeCount > 0,
      date: report?.generatedAt || payload?.updatedAt || now,
      title: changeCount > 0 ? 'تحديث جديد على قاعدة الترددات' : 'قاعدة الترددات جاهزة للبحث',
      summary: changeCount > 0
        ? `تمت مراجعة قاعدة الترددات. الإضافات الجديدة: ${changes.added || 0}، التعديلات: ${changes.updated || 0}، والترددات المحذوفة أو المخفية: ${changes.removed || payload.removedCount || 0}.`
        : `تتوفر قاعدة الترددات للبحث باسم القناة أو رقم التردد أو اسم القمر، بعدد يقارب ${payload.count || (payload.items || []).length || 0} ترددًا وباقة.`,
      status: 'معلومة منشورة',
      sources: ['فريق المتابعة'],
      tags: ['ترددات', 'أخبار']
    }));
  }

  for (const removed of (report?.removedItems || payload.removedItems || []).slice(0, 8)) {
    items.push(makeItem({
      category: 'alert',
      important: true,
      date: removed.removedAt || report?.generatedAt || now,
      title: removed.removedReason === 'closed-by-source-consensus' ? 'إغلاق تردد من نتائج البحث' : 'تردد بحاجة إلى مراجعة',
      summary: removed.removedReason === 'closed-by-source-consensus'
        ? 'تم حذف هذا التردد من نتائج البحث بعد ظهوره كمغلق في أكثر من مصدر موثوق، حتى لا تظهر للمستخدمين معلومات غير دقيقة.'
        : 'هذا التردد لم يظهر بوضوح في آخر مراجعة للمصادر، لذلك تم وضعه للمراجعة قبل عرضه كمعلومة مؤكدة.',
      satellite: [removed.satelliteGroup, removed.orbitalSlot].filter(Boolean).join(' / '),
      oldFrequency: removed.frequency,
      polarity: removed.pol,
      symbolRate: removed.sr,
      status: removed.removedReason === 'closed-by-source-consensus' ? 'محذوف من البحث' : 'قيد المراجعة',
      sources: ['فريق المتابعة'],
      tags: ['ترددات', 'تنبيه']
    }));
  }

  const allowedManualCategories = new Set(['frequency', 'satellite', 'channels', 'sports', 'alert']);
  for (const item of (manual.items || [])) {
    if (item && item.title && allowedManualCategories.has(item.category) && isPublicNews(item)) {
      items.push(makeItem(item));
    }
  }

  const unique = new Map();
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item);
  const finalItems = [...unique.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
  const out = {
    ok: true,
    generatedAt: now,
    mode: 'daily-static-news',
    region: 'MENA / الشرق الأوسط',
    count: finalItems.length,
    categories: ['frequency', 'satellite', 'channels', 'sports', 'alert'],
    presentation: 'news-feed',
    editorialPolicy: 'تعرض الصفحة المعلومات المختصرة كأخبار فقط: عنوان، تاريخ، وخلاصة. لا يتم نشر روابط أو بيانات غير مرخصة.',
    items: finalItems
  };
  await mkdir(updatesDir, { recursive: true });
  await writeFile(updatesPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateLatestUpdates().then(out => console.log(JSON.stringify({ ok: true, count: out.count, file: 'public/updates/latest-updates.json' }, null, 2))).catch(error => { console.error(error); process.exit(1); });
}
