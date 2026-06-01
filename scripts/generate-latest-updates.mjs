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
  return safeText(value, 120).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-').replace(/^-+|-+$/g, '') || 'update';
}

function groupCounts(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = item.satelliteGroup || item.satellite || 'غير محدد';
    const row = map.get(key) || { satellite: key, frequencies: 0, services: 0 };
    row.frequencies += 1;
    row.services += Number(item.channelCount || (Array.isArray(item.channels) ? item.channels.length : (item.channel ? String(item.channel).split('،').length : 1)) || 1);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.frequencies - a.frequencies || String(a.satellite).localeCompare(String(b.satellite))).slice(0, 12);
}

function makeItem({ category = 'alert', title, summary, date, important = false, satellite = '', frequency = '', oldFrequency = '', polarity = '', symbolRate = '', status = '', sources = [], tags = [] }) {
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

export async function generateLatestUpdates(options = {}) {
  const now = new Date().toISOString();
  const payload = options.frequencyPayload || await readJsonOptional(frequencyPath, { items: [], updatedAt: now, count: 0 });
  const report = options.frequencyReport || await readJsonOptional(reportPath, null);
  const manual = await readJsonOptional(manualPath, { items: [] });
  const items = [];

  const changes = report?.changes || payload?.changes || {};
  const hasReport = Boolean(report || payload?.changes);
  if (hasReport) {
    items.push(makeItem({
      category: 'frequency',
      important: true,
      date: report?.generatedAt || payload?.updatedAt || now,
      title: 'تلميح الترددات: آخر فحص جاهز',
      summary: `الخلاصة: تمت مراجعة قاعدة الترددات اليوم. إضافات جديدة: ${changes.added || 0}، تعديلات على ترددات موجودة: ${changes.updated || 0}، ترددات حُذفت/أُخفيت: ${changes.removed || payload.removedCount || 0}، منها بإجماع الإغلاق: ${changes.closedConsensusRemoved || 0}، وأسماء قنوات حُذفت بسبب الإغلاق: ${changes.closedConsensusChannelNamesRemoved || 0}.`,
      status: 'قاعدة الترددات محدثة',
      sources: ['نظام التحديث اليومي', 'مصادر رسمية ومصادر مقارنة'],
      tags: ['ترددات', 'تحديث يومي', 'الشرق الأوسط']
    }));
  } else {
    items.push(makeItem({
      category: 'frequency',
      important: true,
      date: payload.updatedAt || now,
      title: 'تلميح سريع: قاعدة الترددات جاهزة للبحث',
      summary: `الخلاصة: يتوفر حاليًا ${payload.count || (payload.items || []).length || 0} ترددًا وباقة ضمن أقمار الشرق الأوسط. يمكنك البحث باسم القناة أو رقم التردد أو اسم القمر.`,
      status: 'جاهزة للاستخدام',
      sources: ['قاعدة الترددات'],
      tags: ['ترددات', 'بحث']
    }));
  }

  const counts = payload.groupCounts || groupCounts(payload.items || []);
  for (const g of counts.slice(0, 5)) {
    items.push(makeItem({
      category: 'satellite',
      date: payload.updatedAt || now,
      title: `تلميح قمر: ${g.satelliteGroup || g.satellite || 'قمر'} — ${g.frequencies || 0} ترددًا متاحًا`,
      summary: `الخلاصة: يتضمن هذا القمر أو المجموعة حوالي ${g.frequencies || 0} ترددًا و ${g.services || 0} قناة/خدمة قابلة للبحث.`,
      satellite: g.satelliteGroup || g.satellite,
      status: 'متوفر في البحث',
      sources: ['قاعدة الترددات المحلية'],
      tags: ['أقمار', 'ترددات']
    }));
  }

  for (const removed of (report?.removedItems || payload.removedItems || []).slice(0, 12)) {
    items.push(makeItem({
      category: 'alert',
      important: true,
      date: removed.removedAt || report?.generatedAt || now,
      title: removed.removedReason === 'closed-by-source-consensus' ? 'انتبه: تردد حُذف لأنه مغلق' : 'تلميح مراجعة: تردد يحتاج تأكد',
      summary: removed.removedReason === 'closed-by-source-consensus'
        ? `الخلاصة: تم حذف هذا التردد من نتائج البحث لأن أكثر من مصدر موثوق أشار إلى إغلاقه، ولا يوجد مصدر حالي مستقل يؤكد أنه ما زال يعمل.`
        : `الخلاصة: هذا التردد لم يظهر في آخر فحص للمصادر، لذلك تم وضعه كتنبيه للمراجعة قبل عرضه كبيان مؤكد.`,
      satellite: [removed.satelliteGroup, removed.orbitalSlot].filter(Boolean).join(' / '),
      oldFrequency: removed.frequency,
      polarity: removed.pol,
      symbolRate: removed.sr,
      status: removed.removedReason === 'closed-by-source-consensus' ? 'محذوف من البحث' : 'قيد المراجعة',
      sources: removed.closedSources || ['تقرير المقارنة اليومي'],
      tags: removed.removedReason === 'closed-by-source-consensus' ? ['تردد مغلق', 'حُذف تلقائيًا'] : ['تردد متوقف', 'تنبيه']
    }));
  }

  const allowedManualCategories = new Set(['frequency', 'satellite', 'channels', 'sports', 'alert']);
  for (const item of (manual.items || [])) {
    if (item && item.title && allowedManualCategories.has(item.category)) items.push(makeItem(item));
  }

  const unique = new Map();
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item);
  const finalItems = [...unique.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 80);
  const out = {
    ok: true,
    generatedAt: now,
    mode: 'daily-static-hints',
    region: 'MENA / الشرق الأوسط',
    count: finalItems.length,
    categories: ['frequency', 'satellite', 'channels', 'sports', 'alert'],
    presentation: 'hints-feed',
    editorialPolicy: 'المصادر الرسمية أولًا، ثم مصادر مقارنة. تعرض الصفحة التحديثات على شكل تلميحات مختصرة، ولا تُنشر أخبار الرياضة وحقوق البث كحقيقة إلا من مصدر رسمي أو بعد مراجعة يدوية. لا يتم نشر روابط أو سيرفرات غير مرخصة.',
    items: finalItems
  };
  await mkdir(updatesDir, { recursive: true });
  await writeFile(updatesPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateLatestUpdates().then(out => console.log(JSON.stringify({ ok: true, count: out.count, file: 'public/updates/latest-updates.json' }, null, 2))).catch(error => { console.error(error); process.exit(1); });
}
