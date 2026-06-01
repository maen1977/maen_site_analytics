#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServiceKnowledgeIndex } from './build-service-knowledge-index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const serviceDir = path.join(root, 'public', 'service');
const reportDir = path.join(serviceDir, 'reports');
const reviewDir = path.join(serviceDir, 'review');
const cacheDir = path.join(serviceDir, 'cache');

async function readJson(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } }
async function writeJson(file, data) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8'); }
function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function esc(s = '') { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

async function queryD1(sql, params = []) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const db = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !db || !token || typeof fetch !== 'function') return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`;
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ sql, params }) });
  if (!res.ok) throw new Error(`Cloudflare D1 query failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json?.result?.[0]?.results || [];
}

function topFromRows(rows = [], key = 'value') {
  return rows.map(r => ({ value: r[key] || r.question || r.intent || r.device || 'غير محدد', hits: Number(r.hits || r.count || 0) })).filter(x => x.value).slice(0, 20);
}

export async function runDailyServiceUpdate() {
  const now = new Date();
  const generatedAt = now.toISOString();
  const today = dayKey(now);
  const index = await buildServiceKnowledgeIndex();
  const pending = await readJson(path.join(reviewDir, 'pending-ai-answers.json'), { items: [] });
  const unanswered = await readJson(path.join(reviewDir, 'unanswered-questions.json'), { items: [] });
  const approved = await readJson(path.join(cacheDir, 'approved-answers.json'), { items: [] });
  let d1 = { available: false, totalQuestions24h: 0, aiUsed24h: 0, internalAnswers24h: 0, topQuestions: [], topDevices: [], topIntents: [] };
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const totals = await queryD1(`SELECT COUNT(*) AS total, SUM(CASE WHEN answer_source='ai' THEN 1 ELSE 0 END) AS ai_used, SUM(CASE WHEN answer_source='internal' THEN 1 ELSE 0 END) AS internal_used FROM service_questions_daily WHERE ts >= ?`, [since]);
    const questions = await queryD1(`SELECT question AS value, COUNT(*) AS hits FROM service_questions_daily WHERE ts >= ? GROUP BY question_hash, question ORDER BY hits DESC LIMIT 15`, [since]);
    const devices = await queryD1(`SELECT COALESCE(device,'غير محدد') AS value, COUNT(*) AS hits FROM service_questions_daily WHERE ts >= ? GROUP BY value ORDER BY hits DESC LIMIT 15`, [since]);
    const intents = await queryD1(`SELECT COALESCE(intent,'غير محدد') AS value, COUNT(*) AS hits FROM service_questions_daily WHERE ts >= ? GROUP BY value ORDER BY hits DESC LIMIT 15`, [since]);
    if (totals) {
      d1 = { available: true, totalQuestions24h: Number(totals[0]?.total || 0), aiUsed24h: Number(totals[0]?.ai_used || 0), internalAnswers24h: Number(totals[0]?.internal_used || 0), topQuestions: topFromRows(questions), topDevices: topFromRows(devices), topIntents: topFromRows(intents) };
    }
  } catch (error) {
    d1 = { ...d1, available: false, error: String(error.message || error).slice(0, 300) };
  }

  const suggested = {
    generatedAt,
    items: [
      ...(unanswered.items || []).slice(0, 20).map((q, i) => ({ id: q.id || `unanswered-${i}`, type: 'unanswered-question', priority: 'review', title: q.question || q.title || 'سؤال غير مجاب', reason: 'ظهر في الأسئلة غير المجابة ويحتاج مقالة معرفة.' })),
      ...(pending.items || []).slice(0, 20).map((a, i) => ({ id: a.id || `pending-ai-${i}`, type: 'ai-answer-review', priority: 'review', title: a.question || a.title || 'جواب AI يحتاج مراجعة', reason: 'تم توليده بالذكاء الاصطناعي ولا يدخل للداتا الرسمية قبل المراجعة.' }))
    ]
  };
  await writeJson(path.join(reviewDir, 'suggested-knowledge.json'), suggested);

  const report = {
    ok: true,
    generatedAt,
    date: today,
    mode: 'github-daily-service-knowledge-update',
    adminPage: false,
    index: { articles: index.count, categories: index.categoryCounts, brands: Object.keys(index.brandCounts || {}).length },
    cache: { approvedAnswers: (approved.items || []).length, pendingAiAnswers: (pending.items || []).length, unansweredQuestions: (unanswered.items || []).length },
    d1,
    actions: [
      'تم بناء فهرس خدمة وصيانة الداخلي من ملفات GitHub.',
      'تم تحديث ملف الاقتراحات للمراجعة بدون صفحة أدمن.',
      'لم يتم اعتماد أجوبة AI تلقائيًا كداتا رسمية؛ تدخل للمراجعة أولًا.'
    ]
  };
  await writeJson(path.join(reportDir, 'daily-service-report.json'), report);
  const md = `# تقرير خدمة وصيانة اليومي\n\n` +
    `**التاريخ:** ${generatedAt}\n\n` +
    `## ماذا عمل GitHub اليوم؟\n\n` +
    `- بنى فهرس البحث الداخلي: **${index.count}** مقالة/حل.\n` +
    `- عدد التصنيفات: **${Object.keys(index.categoryCounts || {}).length}**.\n` +
    `- عدد العلامات/الأجهزة في الفهرس: **${Object.keys(index.brandCounts || {}).length}**.\n` +
    `- أجوبة AI المعلقة للمراجعة: **${(pending.items || []).length}**.\n` +
    `- أسئلة غير مجابة محفوظة: **${(unanswered.items || []).length}**.\n\n` +
    `## آخر 24 ساعة من الأسئلة\n\n` +
    (d1.available ? `- عدد الأسئلة المسجلة: **${d1.totalQuestions24h}**.\n- أجوبة من الداتا الداخلية: **${d1.internalAnswers24h}**.\n- استخدام AI: **${d1.aiUsed24h}**.\n` : `- لم يتم جلب بيانات D1. السبب: ${esc(d1.error || 'لم يتم ضبط أسرار Cloudflare أو لا توجد بيانات بعد.')}\n`) +
    `\n## أكثر الأسئلة/الأجهزة\n\n` +
    (d1.topQuestions?.length ? d1.topQuestions.map(x => `- ${esc(x.value)} — ${x.hits}`).join('\n') : '- لا توجد بيانات كافية بعد.') +
    `\n\n## سياسة الاعتماد\n\nلا توجد صفحة أدمن. أي جواب AI أو سؤال جديد يدخل ملفات المراجعة في GitHub، ونراجعه يدويًا قبل اعتماده في الداتا الرسمية.\n`;
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, 'daily-service-report.md'), md, 'utf8');
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyServiceUpdate().then(out => console.log(JSON.stringify({ ok: true, file: 'public/service/reports/daily-service-report.md', articles: out.index.articles }, null, 2))).catch(error => { console.error(error); process.exit(1); });
}
