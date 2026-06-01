(() => {
  const state = { index: null, articles: [], lastResults: [] };
  const $ = (s) => document.querySelector(s);
  const els = {};
  function normalizeArabic(value = '') {
    return String(value ?? '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\u0600-\u06FFa-z0-9\s+.-]/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokens(q) { return normalizeArabic(q).split(' ').filter(t => t.length > 1); }
  function scoreArticle(q, article) {
    const ts = tokens(q); if (!ts.length) return 0;
    let score = 0; const text = article.normalizedText || ''; const at = new Set(article.tokens || []);
    for (const t of ts) {
      if (at.has(t)) score += 8;
      else if (text.includes(t)) score += 4;
      for (const kw of (article.keywords || [])) if (normalizeArabic(kw).includes(t)) score += 3;
    }
    const nq = normalizeArabic(q);
    if (article.intent && nq.includes(normalizeArabic(article.intent))) score += 4;
    if (article.brand && nq.includes(normalizeArabic(article.brand))) score += 10;
    if (article.nameAr && nq.includes(normalizeArabic(article.nameAr))) score += 10;
    return score;
  }
  async function loadIndex() {
    const res = await fetch('/service/index/service-search-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل قاعدة المعرفة');
    state.index = await res.json(); state.articles = state.index.articles || [];
    $('#statArticles').textContent = state.index.count || state.articles.length;
    $('#statBrands').textContent = Object.keys(state.index.brandCounts || {}).length;
    $('#statCats').textContent = Object.keys(state.index.categoryCounts || {}).length;
  }
  function bestResults(q, limit = 8) {
    return state.articles.map(a => ({ article: a, score: scoreArticle(q, a) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  function renderAnswer(payload) {
    const a = payload.article || payload;
    const source = payload.source || 'internal';
    $('#answer').classList.add('active');
    $('#answer').innerHTML = `<div class="answer-card">
      <div class="answer-head"><h2 class="answer-title">${esc(a.title || 'إجابة خدمة وصيانة')}</h2><span class="source-pill ${source === 'ai' ? 'ai' : ''}">${source === 'ai' ? 'جواب AI للمراجعة' : 'من الداتا الداخلية'}</span></div>
      <div class="answer-summary">${esc(a.summary || '')}</div>
      ${Array.isArray(a.steps) && a.steps.length ? `<ol class="steps">${a.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${modelPrompt(a)}
      ${safetyNote(a)}
    </div>`;
    window.scrollTo({ top: $('#answer').offsetTop - 15, behavior: 'smooth' });
  }
  function modelPrompt(a) {
    const needs = a.needsModelWhen || [];
    if (!needs.length && !String(a.intent || '').includes('identify')) return '';
    return `<div class="need-model"><strong>حتى أعطيك جواب أدق:</strong> اكتب موديل الجهاز الكامل من الملصق الخلفي أو من الإعدادات ← حول الجهاز. خصوصًا في الشاشات لأن نفس الماركة قد تأتي بأنظمة مختلفة.</div>`;
  }
  function safetyNote(a) {
    const text = `${a.title || ''} ${a.summary || ''}`;
    if (/صيانة|كهرباء|شاشة سوداء|سوفتوير|تحديث|الشعار|بوردة|لحام/.test(text)) return `<div class="safety">تنبيه أمان: لا تفتح شاشة أو ريسيفر ولا تفصل/تركب قطع داخلية إذا لم تكن فنيًا. عند رائحة حرق أو مشكلة كهربائية راجع فني مختص.</div>`;
    return '';
  }
  function renderList(results) {
    $('#results').innerHTML = results.length ? `<div class="results-list">${results.map((r, i) => `<button type="button" class="mini-result" data-i="${i}"><strong>${esc(r.article.title)}</strong><small>${esc(r.article.brand || r.article.category || '')} · مطابقة ${r.score}</small></button>`).join('')}</div>` : '';
    $('#results').querySelectorAll('.mini-result').forEach(btn => btn.addEventListener('click', () => renderAnswer({ article: state.lastResults[Number(btn.dataset.i)].article, source: 'internal' })));
  }
  async function ask() {
    const q = $('#question').value.trim(); if (q.length < 3) { alert('اكتب السؤال أولًا.'); return; }
    $('#askBtn').disabled = true; $('#askBtn').textContent = 'جاري البحث...'; $('#answer').classList.remove('active'); $('#answer').innerHTML = '';
    try {
      const results = bestResults(q, 8); state.lastResults = results; renderList(results);
      if (results[0] && results[0].score >= 18) {
        renderAnswer({ article: results[0].article, source: 'internal' });
        logQuestion(q, 'internal', results[0].article).catch(()=>{});
      } else {
        const api = await askApi(q, results.map(x => x.article));
        if (api && api.ok) renderAnswer(api);
        else renderNoAnswer(q, results);
      }
    } catch (err) { renderNoAnswer(q, []); }
    finally { $('#askBtn').disabled = false; $('#askBtn').textContent = 'اسأل المساعد'; }
  }
  async function askApi(question, context) {
    try {
      const res = await fetch('/api/service-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, context: context.slice(0, 5), page: location.pathname }) });
      if (!res.ok) return null; return await res.json();
    } catch { return null; }
  }
  async function logQuestion(question, source, article) {
    try { await fetch('/api/service-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, context: [article], logOnly: true, page: location.pathname, answerSource: source }) }); } catch {}
  }
  function renderNoAnswer(q, results) {
    $('#answer').classList.add('active');
    $('#answer').innerHTML = `<div class="answer-card"><div class="answer-head"><h2 class="answer-title">أحتاج تفاصيل أكثر</h2><span class="source-pill ai">للمراجعة</span></div><div class="answer-summary">لم أجد جوابًا مؤكدًا بما يكفي داخل الداتا الحالية. اكتب نوع الجهاز والموديل الكامل، مثل: <b>G-Guard 55 Google TV</b> أو <b>Spider T888</b>، واشرح المشكلة بجملة واحدة.</div>${results.length ? '<div class="need-model">وجدت نتائج قريبة تحت مربع السؤال، اختر واحدة منها إذا كانت تشبه مشكلتك.</div>' : ''}</div>`;
  }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function setQuestion(q) { $('#question').value = q; $('#question').focus(); ask(); }
  document.addEventListener('DOMContentLoaded', async () => {
    els.q = $('#question');
    $('#askBtn').addEventListener('click', ask);
    $('#clearBtn').addEventListener('click', () => { $('#question').value=''; $('#answer').innerHTML=''; $('#answer').classList.remove('active'); $('#results').innerHTML=''; });
    document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => setQuestion(b.dataset.example)));
    $('#question').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });
    try { await loadIndex(); } catch (e) { $('#answer').classList.add('active'); $('#answer').innerHTML = `<div class="answer-card"><h2 class="answer-title">تعذر تحميل الداتا</h2><p>${esc(e.message)}</p></div>`; }
  });
})();
