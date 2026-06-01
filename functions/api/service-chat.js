import { corsHeaders, hashId, jsonResponse, localDateKey, localHour, referrerHost, safePage, safeText } from "../_lib/analytics.js";

function normalizeArabic(value = "") {
  return String(value ?? "").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, " ").replace(/\s+/g, " ").trim();
}
function tokens(q = "") { return normalizeArabic(q).split(" ").filter(t => t.length > 1); }
function scoreArticle(q, article) {
  const ts = tokens(q); let score = 0; const text = article.normalizedText || ""; const at = new Set(article.tokens || []);
  for (const t of ts) { if (at.has(t)) score += 8; else if (text.includes(t)) score += 4; for (const kw of (article.keywords || [])) if (normalizeArabic(kw).includes(t)) score += 3; }
  const nq = normalizeArabic(q);
  if (article.brand && nq.includes(normalizeArabic(article.brand))) score += 10;
  if (article.nameAr && nq.includes(normalizeArabic(article.nameAr))) score += 10;
  return score;
}
async function loadIndex(request, env) {
  const url = new URL("/service/index/service-search-index.json", request.url);
  const res = env.ASSETS && typeof env.ASSETS.fetch === "function" ? await env.ASSETS.fetch(url) : await fetch(url);
  if (!res.ok) throw new Error("Knowledge index unavailable");
  return await res.json();
}
function bestResults(question, articles = [], limit = 5) {
  return articles.map(article => ({ article, score: scoreArticle(question, article) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
async function ensureSchema(env = {}) {
  if (!env.MAEN_DB || typeof env.MAEN_DB.prepare !== "function") return false;
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS service_questions_daily (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    local_date TEXT NOT NULL,
    local_hour TEXT,
    question TEXT NOT NULL,
    question_hash TEXT NOT NULL,
    device TEXT,
    intent TEXT,
    answer_source TEXT,
    page TEXT,
    referrer_host TEXT,
    country TEXT,
    hits INTEGER DEFAULT 1,
    last_seen TEXT NOT NULL
  )`).run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_service_questions_daily_date ON service_questions_daily(local_date)").run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_service_questions_daily_hash ON service_questions_daily(question_hash)").run();
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS service_ai_answers (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    question TEXT NOT NULL,
    question_hash TEXT NOT NULL,
    answer TEXT NOT NULL,
    context_ids TEXT,
    status TEXT DEFAULT 'pending_review'
  )`).run();
  return true;
}
async function logQuestion({ request, env, question, answerSource, article, answer }) {
  if (!await ensureSchema(env)) return { stored: false };
  const now = new Date(); const localDate = localDateKey(now, env); const hash = await hashId(normalizeArabic(question), "service-question", env); const id = `${localDate}|${hash}|${answerSource || "unknown"}`; const cf = request.cf || {};
  await env.MAEN_DB.prepare(`INSERT INTO service_questions_daily (id, ts, local_date, local_hour, question, question_hash, device, intent, answer_source, page, referrer_host, country, hits, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET hits = hits + 1, last_seen = excluded.last_seen`)
    .bind(id, now.toISOString(), localDate, localHour(now, env), safeText(question, 500), hash, safeText(article?.brand || article?.nameAr || "", 120), safeText(article?.intent || "", 120), safeText(answerSource || "unknown", 40), safePage("/service.html"), referrerHost(request.headers.get("referer") || ""), safeText(cf.country || request.headers.get("cf-ipcountry") || "unknown", 40), now.toISOString()).run();
  if (answerSource === "ai" && answer) {
    const aiId = `${hash}|${Date.now()}`;
    await env.MAEN_DB.prepare(`INSERT INTO service_ai_answers (id, ts, question, question_hash, answer, context_ids, status) VALUES (?, ?, ?, ?, ?, ?, 'pending_review')`).bind(aiId, now.toISOString(), safeText(question, 700), hash, safeText(answer, 5000), JSON.stringify([article?.id].filter(Boolean))).run();
  }
  return { stored: true };
}
async function askWorkersAi(env, question, contexts = []) {
  if (!env.AI || env.SERVICE_AI_ENABLED === "0") return null;
  const model = env.SERVICE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const contextText = contexts.slice(0, 5).map((a, i) => `(${i+1}) ${a.title}\n${a.summary}\n${(a.steps || []).join("\n")}`).join("\n\n").slice(0, 8000);
  const system = "أنت مساعد صيانة عربي محترف للشاشات والريسيفرات في الشرق الأوسط. أجب بخطوات آمنة وقانونية فقط. لا تشرح كسر تشفير أو قرصنة أو فتح قنوات مدفوعة بدون اشتراك. لا تعطِ تعليمات فتح جهاز كهربائي أو لحام لغير الفنيين. إذا الموديل مهم وغير مذكور اطلبه بوضوح.";
  const prompt = `السؤال: ${question}\n\nمعلومات داخلية قريبة:\n${contextText || "لا توجد معلومات داخلية كافية."}\n\nأعطِ جوابًا مختصرًا عمليًا بالعربية. إذا غير متأكد اطلب الموديل.`;
  const out = await env.AI.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: prompt }] });
  const answer = safeText(out?.response || out?.result?.response || out?.text || "", 4500);
  if (!answer) return null;
  return { title: "إجابة مقترحة تحتاج مراجعة", summary: answer, steps: [], safe: true };
}
export async function onRequestOptions({ request, env }) {
  const cors = corsHeaders(request, env);
  return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
}
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
  let payload = {};
  try { const raw = await request.text(); if (raw.length > 12000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors); payload = raw ? JSON.parse(raw) : {}; } catch { return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors); }
  const question = safeText(payload.question || "", 700);
  if (question.length < 3) return jsonResponse({ ok: false, error: "Question too short" }, 400, cors);
  if (payload.logOnly) { await logQuestion({ request, env, question, answerSource: payload.answerSource || "internal", article: (payload.context || [])[0] || null }); return jsonResponse({ ok: true, logged: true }, 200, cors); }
  const index = await loadIndex(request, env);
  const results = bestResults(question, index.articles || [], 5);
  if (results[0] && results[0].score >= 18) {
    await logQuestion({ request, env, question, answerSource: "internal", article: results[0].article });
    return jsonResponse({ ok: true, source: "internal", score: results[0].score, article: results[0].article, related: results.slice(1).map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors);
  }
  const contexts = payload.context && Array.isArray(payload.context) ? payload.context : results.map(x => x.article);
  const aiArticle = await askWorkersAi(env, question, contexts);
  if (aiArticle) { await logQuestion({ request, env, question, answerSource: "ai", article: contexts[0] || null, answer: aiArticle.summary }); return jsonResponse({ ok: true, source: "ai", article: aiArticle, related: results.map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors); }
  await logQuestion({ request, env, question, answerSource: "unanswered", article: results[0]?.article || null });
  return jsonResponse({ ok: false, source: "unanswered", message: "لم أجد جوابًا مؤكدًا داخل الداتا الحالية. اكتب الموديل الكامل وسنضيفه للمراجعة.", related: results.map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors);
}
export async function onRequest() { return jsonResponse({ ok: false, error: "Method not allowed" }, 405); }
