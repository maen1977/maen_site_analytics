import { corsHeaders, hashId, jsonResponse, localDateKey, localHour, referrerHost, safePage, safeText } from "../_lib/analytics.js";

function normalizeArabic(value = "") {
  return String(value ?? "").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, " ").replace(/\s+/g, " ").trim();
}
function tokens(q = "") { return normalizeArabic(q).split(" ").filter(t => t.length > 1); }
function scoreArticle(q, article) {
  const ts = tokens(q); let score = 0; const text = article.normalizedText || ""; const at = new Set(article.tokens || []);
  for (const t of ts) { if (at.has(t)) score += 8; else if (text.includes(t)) score += 4; for (const kw of (article.keywords || [])) if (normalizeArabic(kw).includes(t)) score += 3; }
  const nq = normalizeArabic(q);
  if (article.brand && nq.includes(normalizeArabic(article.brand))) score += 24;
  if (article.nameAr && nq.includes(normalizeArabic(article.nameAr))) score += 24;
  for (const alias of (article.keywords || [])) {
    const na = normalizeArabic(alias);
    if (na.length >= 3 && (nq.includes(na) || na.includes(nq))) { score += 18; break; }
  }
  score += deviceTypeBoost(nq, article);
  score += intentBoost(nq, article);
  return score;
}
function deviceTypeBoost(nq, article) {
  const type = String(article.deviceType || article.category || '').toLowerCase();
  const title = normalizeArabic(article.title || '');
  const intent = String(article.intent || '').toLowerCase();
  let boost = 0;
  if (/(ريسيفر|رسيفر|receiver|ستلايت)/.test(nq)) {
    if (/receiver/.test(type) || /ريسيفر/.test(title)) boost += 22;
    if (/tv/.test(type) || /شاشه|تلفزيون/.test(title)) boost -= 16;
  }
  if (/(شاشه|شاشة|تلفزيون|tv)/.test(nq)) {
    if (/tv/.test(type) || /شاشه|تلفزيون/.test(title)) boost += 22;
    if (/receiver/.test(type) && !/android-receiver-iptv-box/.test(type)) boost -= 14;
  }
  if (/(ريموت|remote|تحكم|اقتران|pair)/.test(nq) && /(remote|pair|ريموت|اقتران)/.test(intent + ' ' + title)) boost += 34;
  if (/(موديل|model|نظام التشغيل|حول الجهاز|about)/.test(nq) && /(identify|model|os|موديل|نظام)/.test(intent + ' ' + title)) boost += 34;
  if (/(شاهد|netflix|نتفليكس|tod|osn|يوتيوب|youtube)/.test(nq) && /(app|install|youtube|تطبيق|تنزيل)/.test(intent + ' ' + title)) boost += 16;
  return boost;
}
function intentBoost(nq, article) {
  const intent = String(article.intent || '');
  const title = normalizeArabic(article.title || '');
  const category = String(article.category || '');
  let boost = 0;
  if (/(نت|انترنت|واي فاي|wifi|شبك|اتصال|لان|lan)/.test(nq) && /connect_internet|network|wifi|ethernet/.test(intent + ' ' + category + ' ' + title)) boost += 28;
  if (/(يوتيوب|youtube)/.test(nq) && /youtube|app_install|install_tv_apps/.test(intent + ' ' + title)) boost += 22;
  if (/(نزل|تنزيل|ثبت|تثبيت|متجر|play|store|شاهد|netflix|tod|osn)/.test(nq) && /install|app/.test(intent + ' ' + category)) boost += 20;
  if (/(اشاره|اشارة|signal|سنكل|no signal)/.test(nq) && /signal|no_signal/.test(intent + ' ' + title)) boost += 30;
  if (/(تحديث|سوفت|سوفتوير|firmware|فلاشه|فلاشة)/.test(nq) && /software|firmware|update/.test(intent + ' ' + title)) boost += 26;
  if (/(ip ?tv|اي بي|تقطيع|يقطع)/.test(nq) && /iptv/.test(intent + ' ' + title)) boost += 24;
    if (/(سوفتوير|فلاشه|فلاشة|firmware)/.test(nq)) {
      if (/receiver/.test(String(article.deviceType || article.category || '').toLowerCase()) || /ريسيفر/.test(title)) boost += 18;
      if (/tv/.test(String(article.deviceType || article.category || '').toLowerCase()) && !/(شاشه|شاشة|تلفزيون|tv)/.test(nq)) boost -= 14;
    }
  return boost;
}
async function loadIndex(request, env) {
  const url = new URL("/service/index/service-search-index.json", request.url);
  const res = env.ASSETS && typeof env.ASSETS.fetch === "function" ? await env.ASSETS.fetch(url) : await fetch(url);
  if (!res.ok) throw new Error("Knowledge index unavailable");
  return await res.json();
}
function safeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: safeText(item?.content || item?.text || "", 700)
  })).filter(item => item.content.length > 0);
}
function conversationQuestion(question, history = []) {
  const transcript = safeHistory(history).map(item => `${item.role === "assistant" ? "المساعد" : "المستخدم"}: ${item.content}`).join("\n");
  return `${transcript}\nالمستخدم الآن: ${question}`.trim();
}
function preferDeviceSpecific(results, question) {
  if (!results.length) return results;
  const nq = normalizeArabic(question);
  const top = results[0];
  const hasDeviceWord = /(ريسيفر|رسيفر|receiver|شاشه|شاشة|تلفزيون|tv|بوكس|box)/.test(nq);
  const preferred = results.find(x => {
    const a = x.article || {};
    const type = String(a.deviceType || a.category || '').toLowerCase();
    const isDevice = /receiver|tv|android-receiver-iptv-box/.test(type);
    if (!isDevice || x.score < top.score - 22) return false;
    const brandHit = [a.brand, a.nameAr, ...(a.keywords || [])].some(v => {
      const nv = normalizeArabic(v || '');
      return nv.length >= 3 && nq.includes(nv);
    });
    const typeHit = hasDeviceWord && ((/(ريسيفر|رسيفر|receiver)/.test(nq) && /receiver/.test(type)) || (/(شاشه|شاشة|تلفزيون|tv)/.test(nq) && /tv/.test(type)));
    return brandHit || typeHit;
  });
  if (preferred && preferred !== top) return [preferred, ...results.filter(x => x !== preferred)];
  return results;
}
function bestResults(question, articles = [], limit = 5, history = []) {
  const fullQuestion = conversationQuestion(question, history);
  const results = articles.map(article => ({ article, score: Math.max(scoreArticle(question, article), scoreArticle(fullQuestion, article) - 4) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(limit, 16));
  return preferDeviceSpecific(results, question).slice(0, limit);
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
async function askWorkersAi(env, question, contexts = [], history = [], allowAi = false) {
  if (!allowAi || !env.AI || env.SERVICE_AI_ENABLED !== "1") return null;
  const model = env.SERVICE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const contextText = contexts.slice(0, 5).map((a, i) => `(${i+1}) ${a.title}\n${a.summary}\n${(a.steps || []).join("\n")}`).join("\n\n").slice(0, 8000);
  const historyText = safeHistory(history).map(item => `${item.role === "assistant" ? "المساعد" : "المستخدم"}: ${item.content}`).join("\n").slice(0, 2500);
  const system = "أنت مساعد صيانة عربي محترف للشاشات والريسيفرات في الشرق الأوسط. أجب كفني ضمن محادثة مباشرة. استخدم المعلومات الداخلية أولًا. أجب بخطوات آمنة وقانونية فقط. لا تشرح كسر تشفير أو قرصنة أو فتح قنوات مدفوعة بدون اشتراك. لا تعطِ تعليمات فتح جهاز كهربائي أو لحام لغير الفنيين. إذا الموديل مهم وغير مذكور اطلبه بوضوح.";
  const prompt = `سياق المحادثة السابق:\n${historyText || "لا يوجد."}\n\nرسالة المستخدم الآن: ${question}\n\nمعلومات داخلية قريبة:\n${contextText || "لا توجد معلومات داخلية كافية."}\n\nأعطِ جوابًا عمليًا بالعربية كأنك تكمل معه في نفس المحادثة. إذا غير متأكد اطلب الموديل أو اسأله عن الذي يظهر على الشاشة.`;
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
  const history = safeHistory(payload.history);
  const index = await loadIndex(request, env);
  const results = bestResults(question, index.articles || [], 5, history);
  if (results[0] && results[0].score >= 10) {
    await logQuestion({ request, env, question, answerSource: "internal", article: results[0].article });
    return jsonResponse({ ok: true, source: "internal", score: results[0].score, article: results[0].article, related: results.slice(1).map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors);
  }
  const contexts = payload.context && Array.isArray(payload.context) ? payload.context : results.map(x => x.article);
  const aiArticle = await askWorkersAi(env, question, contexts, history, payload.allowAi === true);
  if (aiArticle) { await logQuestion({ request, env, question, answerSource: "ai", article: contexts[0] || null, answer: aiArticle.summary }); return jsonResponse({ ok: true, source: "ai", article: aiArticle, related: results.map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors); }
  await logQuestion({ request, env, question, answerSource: "unanswered", article: results[0]?.article || null });
  return jsonResponse({ ok: false, source: "unanswered", message: "لم أجد جوابًا مؤكدًا داخل الداتا الحالية. اكتب الموديل الكامل وسنضيفه للمراجعة.", related: results.map(x => ({ id: x.article.id, title: x.article.title, score: x.score })) }, 200, cors);
}
export async function onRequest() { return jsonResponse({ ok: false, error: "Method not allowed" }, 405); }
