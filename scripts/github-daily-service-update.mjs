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

function safeText(value = '', max = 1000) { return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }

function normalizeArabic(value = '') {
  return String(value ?? '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function makeLocalId(prefix, text) {
  const normalized = normalizeArabic(text).slice(0, 120).replace(/\s+/g, '-').replace(/[^\u0600-\u06FFa-z0-9-]/gi, '').slice(0, 70);
  return `${prefix}-${normalized || Date.now()}`;
}

const unsafePatterns = [
  /كسر\s*تشفير|فتح\s*قنوات\s*مشفر|فتح\s*قنوات\s*مدفوعه|فتح\s*قنوات\s*مدفوعة|مشاهده\s*مجانيه|مشاهدة\s*مجانية/i,
  /سيرفر\s*مجاني|اكواد\s*تفعيل|أكواد\s*تفعيل|كود\s*تفعيل|cccam|newcamd|mgcamd|keys?\s*bin|softcam|biss\s*key/i,
  /باتش\s*مهكر|سوفت\s*مهكر|crack|piracy|decrypt|hack/i,
  /افتح\s*الجهاز|فك\s*الغطاء|لحام|كاويه|بورده|باور\s*سبلاي|مزود\s*الطاقه|مكثف|فولت\s*عالي|صعق/i
];

function containsUnsafeContent(value = '') {
  const text = normalizeArabic(value);
  return unsafePatterns.some(rx => rx.test(text));
}

function splitSteps(answer = '') {
  return String(answer || '')
    .split(/\n+|(?<=\.)\s+|[؛;]/)
    .map(s => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(s => s.length >= 8)
    .slice(0, 8);
}

function inferDeviceType(question = '') {
  const q = normalizeArabic(question);
  if (/(شاشه|شاشة|تلفزيون|tv|سمارت|google tv|android tv)/.test(q)) return 'tv';
  if (/(ريسيفر|رسيفر|receiver|ستلايت|ip tv|iptv)/.test(q)) return 'receiver';
  if (/(بوكس|box|اندرويد|android)/.test(q)) return 'android-receiver-iptv-box';
  return 'approved-answer';
}

function inferIntent(question = '', answer = '') {
  const q = normalizeArabic(`${question} ${answer}`);
  if (/(يوتيوب|youtube)/.test(q)) return /علق|توقف|لا يعمل|ما بفتح/.test(q) ? 'youtube_problem' : 'install_youtube';
  if (/(شاهد|shahid|netflix|نتفليكس|tod|osn|starz|prime|disney)/.test(q)) return /علق|توقف|لا يعمل|ما بفتح/.test(q) ? 'app_problem' : 'install_tv_apps';
  if (/(واي فاي|wifi|انترنت|نت|شبك|لان|lan|dns|هوتسبوت)/.test(q)) return 'connect_internet';
  if (/(اشاره|اشارة|no signal|سنكل|lnb|دايزك|diseqc)/.test(q)) return 'signal_problem';
  if (/(تحديث|سوفت|سوفتوير|firmware|فلاشه|فلاشة)/.test(q)) return 'software_update';
  if (/(ريموت|remote|تحكم)/.test(q)) return 'remote_problem';
  if (/(hdmi|arc|earc|صوت|صوره|صورة)/.test(q)) return 'audio_video_problem';
  return 'approved_ai_answer';
}

function inferBrand(question = '', index = null) {
  const q = normalizeArabic(question);
  const brands = index?.brandCounts ? Object.keys(index.brandCounts) : [];
  const direct = brands.find(b => {
    const nb = normalizeArabic(b);
    return nb && nb.length >= 3 && q.includes(nb);
  });
  if (direct) return direct;
  const aliases = [
    ['G-Guard', /g\s*guard|جي\s*جارد|جى\s*جارد|حارس/i],
    ['General View', /جنرال\s*فيو|general\s*view/i],
    ['Magic', /ماجيك|magic/i],
    ['Spider', /سبايدر|spider/i],
    ['Tiger', /تايجر|tiger/i],
    ['Ghazal', /غزال|ghazal|gazal/i],
    ['Majestic', /ماجستيك|ماجستك|majestic/i],
    ['Infinity', /انفنتي|انفينتي|إنفينيتي|infinity|infiniti/i],
    ['Samsung', /سامسونج|samsung/i],
    ['LG', /ال\s*جي|الجي|lg/i],
    ['TCL', /tcl|تي\s*سي\s*ال/i],
    ['Hisense', /هايسنس|hisense|vidaa/i]
  ];
  return aliases.find(([, rx]) => rx.test(q))?.[0] || '';
}

function canAutoApprove(item = {}) {
  const text = `${item.question || item.title || ''}\n${item.answer || item.summary || ''}`;
  const answer = String(item.answer || item.summary || '');
  const question = String(item.question || item.title || '');
  if (question.trim().length < 4 || answer.trim().length < 20) return { ok: false, reason: 'السؤال أو الجواب قصير جدًا.' };
  if (answer.length > 7000) return { ok: false, reason: 'الجواب طويل جدًا ويحتاج مراجعة.' };
  if (containsUnsafeContent(text)) return { ok: false, reason: 'يحتوي كلمات حساسة أو تعليمات تحتاج مراجعة.' };
  return { ok: true, reason: 'تم اعتماده آليًا لأنه آمن وكافٍ.' };
}

function approvedItemFromAi(item = {}, index = null) {
  const question = safeText(item.question || item.title || 'سؤال خدمة وصيانة', 700);
  const answer = safeText(item.answer || item.summary || item.aiAnswer || '', 5000);
  const id = item.id || makeLocalId('auto-ai', `${question}|${answer.slice(0, 40)}`);
  return {
    id,
    question,
    title: item.title || question,
    deviceBrand: item.deviceBrand || item.device || inferBrand(question, index),
    deviceType: item.deviceType || inferDeviceType(question),
    intent: item.intent || inferIntent(question, answer),
    answer,
    steps: Array.isArray(item.steps) && item.steps.length ? item.steps : splitSteps(answer),
    keywords: [...new Set([question, item.deviceBrand, item.device, item.intent, inferIntent(question, answer), inferBrand(question, index)].filter(Boolean))],
    safe: true,
    source: item.source || 'auto-approved-ai-cache',
    autoApproved: true,
    approvedAt: new Date().toISOString()
  };
}

function mergeApproved(existing = [], additions = []) {
  const map = new Map();
  for (const item of existing) {
    const key = normalizeArabic(item.question || item.title || item.id || '');
    if (key) map.set(key, item);
  }
  let added = 0;
  for (const item of additions) {
    const key = normalizeArabic(item.question || item.title || item.id || '');
    if (!key || map.has(key)) continue;
    map.set(key, item);
    added += 1;
  }
  return { items: [...map.values()], added };
}

async function approveSafeAiAnswers({ index, pending, approved }) {
  const candidates = [];
  const rejected = [];
  const now = new Date().toISOString();

  for (const item of (pending.items || [])) {
    const decision = canAutoApprove(item);
    if (decision.ok) candidates.push(approvedItemFromAi(item, index));
    else rejected.push({ ...item, autoApproval: 'blocked', reason: decision.reason, checkedAt: now });
  }

  let d1Rows = [];
  try {
    d1Rows = await queryD1(`SELECT id, question, answer, context_ids, ts FROM service_ai_answers WHERE COALESCE(status, 'pending_review') IN ('pending_review', 'pending', '') ORDER BY ts DESC LIMIT 100`);
  } catch { d1Rows = []; }
  for (const row of d1Rows || []) {
    const item = { id: row.id, question: row.question, answer: row.answer, source: 'cloudflare-d1-ai-cache' };
    const decision = canAutoApprove(item);
    if (decision.ok) candidates.push(approvedItemFromAi(item, index));
    else rejected.push({ id: row.id, question: row.question, title: row.question, type: 'ai-answer-review-blocked', priority: 'review', reason: decision.reason, checkedAt: now });
    try { await queryD1(`UPDATE service_ai_answers SET status = ? WHERE id = ?`, [decision.ok ? 'auto_approved' : 'needs_manual_review', row.id]); } catch {}
  }

  const merged = mergeApproved(approved.items || [], candidates);
  const remainingPending = (pending.items || []).filter(item => !candidates.some(c => normalizeArabic(c.question) === normalizeArabic(item.question || item.title || '')));
  return { approved: { ...approved, items: merged.items }, pending: { ...pending, items: remainingPending }, autoApproved: merged.added, rejected, candidates: candidates.length };
}

export async function runDailyServiceUpdate() {
  const now = new Date();
  const generatedAt = now.toISOString();
  const today = dayKey(now);
  const index = await buildServiceKnowledgeIndex();
  const pending = await readJson(path.join(reviewDir, 'pending-ai-answers.json'), { items: [] });
  const unanswered = await readJson(path.join(reviewDir, 'unanswered-questions.json'), { items: [] });
  let approved = await readJson(path.join(cacheDir, 'approved-answers.json'), { items: [] });
  const approval = await approveSafeAiAnswers({ index, pending, approved });
  approved = approval.approved;
  await writeJson(path.join(cacheDir, 'approved-answers.json'), approved);
  await writeJson(path.join(reviewDir, 'pending-ai-answers.json'), approval.pending);
  const updatedIndex = approval.autoApproved > 0 ? await buildServiceKnowledgeIndex() : index;
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
    mode: 'auto-approve-safe-answers',
    autoApprovedToday: approval.autoApproved,
    items: [
      ...(approval.rejected || []).slice(0, 20).map((a, i) => ({ id: a.id || `blocked-ai-${i}`, type: 'blocked-ai-auto-approval', priority: 'review', title: a.question || a.title || 'جواب يحتاج مراجعة', reason: a.reason || 'تم منعه من الاعتماد الآلي بسبب فلتر الأمان.' })),
      ...(unanswered.items || []).slice(0, 20).map((q, i) => ({ id: q.id || `unanswered-${i}`, type: 'unanswered-question', priority: 'auto-template', title: q.question || q.title || 'سؤال غير مجاب', reason: 'سؤال غير مجاب؛ إذا تكرر سيتم توليد جواب داخلي أو طلب موديل بدل استخدام AI مباشرة.' }))
    ]
  };
  await writeJson(path.join(reviewDir, 'suggested-knowledge.json'), suggested);

  const report = {
    ok: true,
    generatedAt,
    date: today,
    mode: 'github-daily-service-knowledge-update',
    adminPage: false,
    index: { articles: updatedIndex.count, categories: updatedIndex.categoryCounts, brands: Object.keys(updatedIndex.brandCounts || {}).length },
    cache: { approvedAnswers: (approved.items || []).length, autoApprovedToday: approval.autoApproved, blockedAutoApproval: (approval.rejected || []).length, pendingAiAnswers: (approval.pending.items || []).length, unansweredQuestions: (unanswered.items || []).length },
    d1,
    actions: [
      'تم بناء فهرس خدمة وصيانة الداخلي من ملفات GitHub.',
      'تم اعتماد أجوبة AI الآمنة تلقائيًا داخل cache/approved-answers.json حتى لا يعاد استخدام AI لنفس السؤال.',
      'تم منع أي جواب حساس أو غير قانوني أو خطر من الاعتماد الآلي ووضعه في ملف الاقتراحات للمراجعة.',
      'لا توجد صفحة أدمن؛ GitHub يعمل التحديث والاعتماد والتقرير يوميًا.'
    ]
  };
  await writeJson(path.join(reportDir, 'daily-service-report.json'), report);
  const md = `# تقرير خدمة وصيانة اليومي\n\n` +
    `**التاريخ:** ${generatedAt}\n\n` +
    `## ماذا عمل GitHub اليوم؟\n\n` +
    `- بنى فهرس البحث الداخلي: **${updatedIndex.count}** مقالة/حل.\n` +
    `- عدد التصنيفات: **${Object.keys(updatedIndex.categoryCounts || {}).length}**.\n` +
    `- عدد العلامات/الأجهزة في الفهرس: **${Object.keys(updatedIndex.brandCounts || {}).length}**.\n` +
    `- أجوبة AI الآمنة التي تم اعتمادها تلقائيًا اليوم: **${approval.autoApproved}**.\n` +
    `- أجوبة منعها فلتر الأمان وبقيت للمراجعة: **${(approval.rejected || []).length}**.\n` +
    `- أجوبة AI المتبقية للمراجعة: **${(approval.pending.items || []).length}**.\n` +
    `- أسئلة غير مجابة محفوظة: **${(unanswered.items || []).length}**.\n\n` +
    `## آخر 24 ساعة من الأسئلة\n\n` +
    (d1.available ? `- عدد الأسئلة المسجلة: **${d1.totalQuestions24h}**.\n- أجوبة من الداتا الداخلية: **${d1.internalAnswers24h}**.\n- استخدام AI: **${d1.aiUsed24h}**.\n` : `- لم يتم جلب بيانات D1. السبب: ${esc(d1.error || 'لم يتم ضبط أسرار Cloudflare أو لا توجد بيانات بعد.')}\n`) +
    `\n## أكثر الأسئلة/الأجهزة\n\n` +
    (d1.topQuestions?.length ? d1.topQuestions.map(x => `- ${esc(x.value)} — ${x.hits}`).join('\n') : '- لا توجد بيانات كافية بعد.') +
    `\n\n## سياسة الاعتماد\n\nلا توجد صفحة أدمن. GitHub يعتمد تلقائيًا الأجوبة الآمنة ويضيفها إلى كاش الأجوبة المعتمدة، ويترك فقط الأجوبة الحساسة أو الخطرة أو غير القانونية في ملفات المراجعة.\n`;
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, 'daily-service-report.md'), md, 'utf8');
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyServiceUpdate().then(out => console.log(JSON.stringify({ ok: true, file: 'public/service/reports/daily-service-report.md', articles: out.index.articles, autoApprovedToday: out.cache.autoApprovedToday }, null, 2))).catch(error => { console.error(error); process.exit(1); });
}
