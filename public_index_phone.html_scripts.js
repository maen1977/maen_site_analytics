// Embedded database
window.embeddedFrequencyBackup = [];
window.MAEN_FREQUENCY_DATA_STRATEGY = 'static-json-versioned';

;

// Embedded frequency search
/* Final strict frequency search - no mixed results
   Modes are separated in this order:
   1) frequency number => frequency only (+/-5 MHz)
   2) exact package button => exact package only
   3) clear category word => category only
   4) clear country word => country only
   5) free text => names and aliases only
*/
(function(){
'use strict';

let DATA = Array.isArray(window.embeddedFrequencyBackup) ? window.embeddedFrequencyBackup : [];
window.frequencyDataStatus = { source: 'embedded-backup', updatedAt: null, count: DATA.length };
async function fetchJsonWithTimeout(url, options){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(function(){ controller.abort(); }, (options && options.timeout) || 6500) : null;
  try {
    const response = await fetch(url, Object.assign({ cache: 'default' }, options || {}, controller ? { signal: controller.signal } : {}));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function loadLiveFrequencyData(){
  const status = document.getElementById('frequencyLiveStatus');
  const setStatus = function(text){ if (status) { status.hidden = !text; status.textContent = text || ''; } };
  try {
    setStatus('جارٍ تحميل قاعدة الترددات...');
    let dataUrl = '/frequencies/frequency-data.json';
    let manifest = null;
    try {
      manifest = await fetchJsonWithTimeout('/frequencies/frequency-manifest.json', { cache: 'no-cache', timeout: 3500 });
      if (manifest && manifest.dataFile) dataUrl = manifest.dataFile;
    } catch (manifestError) {
      // Manifest is an optimization only. The canonical JSON remains a safe fallback.
    }
    const payload = await fetchJsonWithTimeout(dataUrl, { cache: 'default', timeout: 7500 });
    if (payload && Array.isArray(payload.items) && payload.items.length) {
      DATA = payload.items;
      window.embeddedFrequencyBackup = DATA;
      window.frequencyDataStatus = {
        source: payload.servedFrom || payload.mode || 'static-json',
        updatedAt: payload.updatedAt || (manifest && manifest.updatedAt) || null,
        count: DATA.length,
        changes: payload.changes || null,
        dataFile: dataUrl
      };
      setStatus('');
      return true;
    }
    throw new Error('Empty frequency payload');
  } catch (error) {
    console.warn('Using embedded frequency backup', error);
    window.frequencyDataStatus = { source: 'embedded-backup', updatedAt: null, count: DATA.length, error: String(error && error.message || error) };
    if (DATA.length) setStatus('');
    else setStatus('تعذر تحميل قاعدة الترددات مؤقتًا. جرّب تحديث الصفحة.');
    return false;
  }
}
let exactPackageMode = null;
let frequencyRenderFrame = 0;
let frequencySearchTimer = 0;
let frequencySuggestionTimer = 0;
let frequencyVisibleLimit = 60;
const FREQUENCY_INITIAL_LIMIT = 60;
const FREQUENCY_SEARCH_LIMIT = 80;
const STATION_CARD_LIMIT = 60;
const FREQUENCY_SEARCH_DEBOUNCE_MS = 320;
const FREQUENCY_SUGGEST_DEBOUNCE_MS = 220;
const FREQUENCY_DATA_LOW_CREDIT_MODE = true;


function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(text = '') {
  return normalizeText(text).replace(/\s+/g, '');
}


const SMART_QUERY_EQUIVALENTS = [
  [['rai','raï','راي','راى','راي ايطاليا','راي ايطالي'], ['rai','rai 1','rai 2','rai 3','rai news','راي']],
  [['اليونان','يونان','يوناني','يونانية','يونانيه','قنوات اليونان','قنوات يونانية','greece','greek','hellas','ellada','ellinika'], ['اليونان','يونان','يونانية','greece','greek','hellas','ert','ert cosmos','vouli','vouli tv','cosmote','nova greece']],
  [['سوسيرا','سويسرا','سويسري','سويسرية','سويسريه','قنوات سويسرا','قنوات سوسيرا','switzerland','swiss','suisse','schweiz','svizzera','srg','ssr','srf','rts','rsi','kabelio'], ['سوسيرا','سويسرا','سويسرية','switzerland','swiss','suisse','schweiz','svizzera','srg ssr','srf','rts','rsi','kabelio']],
  [['اسرائيل','إسرائيل','اسرائيلي','إسرائيلي','عبري','عبرية','قنوات اسرائيل','قنوات إسرائيل','hebrew','israel','israeli','yes israel','kan','keshet','reshet','makan'], ['israel','israeli','hebrew','yes','kan','kan 11','keshet 12','reshet 13','makan 33','now 14','yes movies','yes tv','sport israel']],
  [['jazeera','aljazeera','al jazera','al jzeera','جزيره','جزيرة','الجزيره','الجزيرة'], ['al jazeera','aljazeera','الجزيرة','الجزيره']],
  [['arabiya','alarabiya','al arabia','العربيه','العربية','عربيه','عربية'], ['al arabiya','alarabiya','العربية','العربيه']],
  [['hadath','alhadath','al hadath','الحدث'], ['al hadath','al-hadath','الحدث']],
  [['bein','beinsport','beinsports','be in','بي ان','بي إن','بين','بيين'], ['bein','be in','bein sports','beinsports','بي ان سبورت']],
  [['mbc','امبيسي','ام بي سي','إم بي سي'], ['mbc','ام بي سي','إم بي سي']],
  [['osn','او اس ان','أو إس إن'], ['osn','orbit showtime']],
  [['ssc','اس اس سي','إس إس سي'], ['ssc','السعودية الرياضية']],
  [['rotana','روتانا','رتانا'], ['rotana','روتانا']],
  [['noursat','nour sat','noorsat','نورسات','نور سات'], ['noursat','nour sat','نورسات','نور سات']],
  [['spacetoon','space toon','سبيستون','سبستون'], ['spacetoon','space toon','سبيستون']],
  [['natgeo','nat geo','national geographic','ناشيونال جيوغرافيك','ناشونال جيوغرافيك'], ['national geographic','nat geo','ناشيونال جيوغرافيك']],
  [['quran','koran','قران','قرآن','القران','القرآن'], ['quran','قرآن','قران']],
  [['radio','راديو','اذاعة','إذاعة','اف ام','fm'], ['radio','راديو','fm']],
  [['sport','sports','سبورت','سبورتس','رياضه','رياضة','رياضيه','رياضية','كوره','كرة'], ['sport','sports','سبورت','رياضة']],
  [['ontime','on time','on time sport','on time sports','ontime sport','ontime sports','on sport','on sports','ون تايم','اون تايم','أون تايم','اون تايم سبورت','أون تايم سبورت','اون سبورت','أون سبورت'], ['ontime','on time','on time sports','on sport','on sports','اون تايم','اون تايم سبورت','اون سبورت']],
  [['kids','اطفال','أطفال','كرتون','كارتون'], ['kids','children','اطفال','كرتون']],
  [['movies','movie','cinema','افلام','أفلام','سينما'], ['movies','movie','cinema','افلام','سينما']],
  [['news','اخبار','أخبار','اخباريه','اخبارية'], ['news','اخبار','أخبار']],
  [['documentary','وثائقي','وثائقية','وثائقيه'], ['documentary','وثائقي']],
  [['christian','coptic','مسيحي','مسيحية','مسيحيه','قبطي','كنيسة','كنيسه'], ['christian','coptic','مسيحية','قنوات مسيحية']],
  [['islamic','muslim','اسلامي','اسلامية','اسلاميه','ديني اسلامي','دينية اسلامية'], ['islamic','muslim','اسلامية','قنوات اسلامية']]
];

function smartTokenVariants(token) {
  const q = normalizeText(token);
  const c = compactText(token);
  const out = new Set([String(token || ''), q]);
  SMART_QUERY_EQUIVALENTS.forEach(pair => {
    const keys = pair[0] || [];
    const vals = pair[1] || [];
    const hit = keys.some(k => {
      const nk = normalizeText(k);
      const ck = compactText(k);
      if (!nk || !ck || !c) return false;
      return q === nk || c === ck || ck.startsWith(c) || c.startsWith(ck) || (ck.length >= 4 && c.includes(ck));
    });
    if (hit) vals.forEach(v => out.add(v));
  });
  return Array.from(out).filter(Boolean);
}

function isLatinShortToken(text) {
  const c = compactText(text);
  return /^[a-z0-9]{2,3}$/.test(c);
}

function shortTokenMatchesSafely(blob, token) {
  const q = compactText(token);
  if (!q) return true;
  const words = normalizeText(blob).split(' ').map(compactText).filter(Boolean);
  return words.some(w => w === q || w.startsWith(q)) || compactText(blob).startsWith(q);
}

function smartChannelTokenMatch(channelBlob, token) {
  const text = normalizeText(channelBlob);
  const compact = compactText(channelBlob);
  const variants = smartTokenVariants(token);
  for (const variant of variants) {
    const q = normalizeText(variant);
    const qc = compactText(variant);
    if (!q || !qc) continue;
    if (isLatinShortToken(qc)) {
      if (shortTokenMatchesSafely(channelBlob, qc)) return true;
      continue;
    }
    if (text.includes(q) || compact.includes(qc)) return true;
    if (qc.length >= 5 && compact.length <= 220 && tokenMatchesFuzzy(channelBlob, variant)) return true;
  }
  return false;
}

function editDistance(a, b, limit = 3) {
  a = compactText(a); b = compactText(b);
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const prev = Array(b.length + 1);
  const curr = Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > limit) return limit + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function tokenMatchesFuzzy(blob, token) {
  const q = normalizeText(token);
  const qc = compactText(token);
  if (!q || !qc) return true;
  const text = normalizeText(blob);
  const compact = compactText(blob);
  if (text.includes(q) || compact.includes(qc)) return true;
  if (qc.length < 4 || compact.length > 240) return false;
  const limit = qc.length <= 6 ? 1 : 2;
  const words = text.split(' ').filter(Boolean).slice(0, 28);
  for (const word of words) {
    const wc = compactText(word);
    if (!wc || wc.length < 3) continue;
    if (wc.startsWith(qc) || qc.startsWith(wc)) return true;
    if (Math.abs(wc.length - qc.length) > limit) continue;
    if (wc[0] !== qc[0] && wc[wc.length - 1] !== qc[qc.length - 1]) continue;
    if (editDistance(wc, qc, limit) <= limit) return true;
  }
  return false;
}

function fuzzyTextScore(blob, query) {
  const tokens = queryTokens(query).slice(0, 4);
  if (!tokens.length) return 0;
  const text = normalizeText(blob);
  const compact = compactText(blob);
  let score = 0;
  tokens.forEach(token => {
    const q = normalizeText(token);
    const qc = compactText(token);
    if (!q || !qc) return;
    if (text === q || compact === qc) score += 900;
    else if (text.startsWith(q) || compact.startsWith(qc)) score += 650;
    else if (q.length >= 2 && text.includes(q)) score += 420;
    else if (qc.length >= 3 && compact.includes(qc)) score += 360;
    else if (qc.length >= 5 && tokenMatchesFuzzy(blob, token)) score += 120;
  });
  return score;
}

function containsAny(text, keys){
  const n = normalizeText(text);
  const c = compactText(text);
  return (keys || []).some(key => {
    const nk = normalizeText(key);
    const ck = compactText(key);
    return nk && (n.includes(nk) || (ck.length >= 4 && c.includes(ck)));
  });
}

function isFrequencySearch(query) {
  return /^\d{4,6}$/.test(String(query || '').trim());
}


function isChristianIntentQuery(query) {
  const q = normalizeText(query);
  if (!q) return false;
  const christianIntent = [
    'مسيحي','مسيحية','مسيحيه','المسيحية','المسيحيه','قنوات مسيحية','قنوات مسيحيه','محطات مسيحية','محطات مسيحيه',
    'ديني مسيحي','دينية مسيحية','دينيه مسيحيه','قنوات دينية مسيحية','قنوات دينيه مسيحيه',
    'كنيسة','كنيسه','كنائس','انجيل','إنجيل','الانجيل','الإنجيل','قبطي','قبطية','قبطيه','ترانيم','قداس','يسوع','المسيح',
    'christian','christians','christianity','christian channels','christian tv','coptic','church','gospel','bible','jesus','worship','praise','mass'
  ];
  return christianIntent.some(phrase => dictionaryWordMatches(q, phrase));
}

function isIslamicIntentQuery(query) {
  const q = normalizeText(query);
  const c = compactText(query);
  if (!q || !c) return false;
  const exactPhrases = [
    'اسلامي','اسلامية','اسلاميه','إسلامي','إسلامية','قنوات اسلامية','قنوات اسلاميه','محطات اسلامية','محطات اسلاميه',
    'ديني اسلامي','دينية اسلامية','دينيه اسلاميه','دين اسلامي','دين اسلامى','دينه اسلاميه','دينية اسلاميه',
    'قنوات دينية اسلامية','قنوات دينيه اسلاميه','محطات دينية اسلامية','محطات دينيه اسلاميه',
    'مسلم','مسلمة','اسلام','islam','islamic','muslim','islam channels','islamic channels','religious islamic',
    'دي اسلامي','دي اسلالمي','اسلالمي','اسلاامي'
  ];
  if (exactPhrases.some(phrase => dictionaryWordMatches(q, phrase))) return true;
  const tokens = queryTokens(q);
  const hasIslam = tokens.some(t => dictionaryWordMatches(t, 'اسلامي') || dictionaryWordMatches(t, 'اسلامية') || dictionaryWordMatches(t, 'islamic') || dictionaryWordMatches(t, 'muslim') || dictionaryWordMatches(t, 'اسلالمي'));
  const hasReligion = tokens.some(t => dictionaryWordMatches(t, 'ديني') || dictionaryWordMatches(t, 'دينية') || dictionaryWordMatches(t, 'دين') || dictionaryWordMatches(t, 'religious') || dictionaryWordMatches(t, 'religion'));
  return hasIslam && (hasReligion || tokens.length <= 3);
}

const CATEGORY_KEYWORDS = {
  kids: ['اطفال','الأطفال','الاطفال','طفل','كرتون','كارتون','kids','children','cartoon','mbc3','mbc 3','spacetoon','سبيستون'],
  sports: ['رياضه','رياضة','رياضيه','رياضية','سبورت','سبورتس','مباريات','ماتشات','كوره','كرة','sport','sports','football','soccer'],
  movies: ['افلام','أفلام','فيلم','سينما','movies','movie','cinema','action'],
  series: ['مسلسلات','مسلسل','دراما','series','drama'],
  news: ['اخبار','أخبار','اخباريه','اخبارية','news'],
  music: ['اغاني','أغاني','موسيقى','موسيقي','طرب','كليبات','كليب','music','songs','song','clips'],
  documentary: ['وثائقي','وثائقيه','وثائقية','documentary','national geographic','nat geo','discovery'],
  quran: ['قران','قرآن','القران','القرآن','quran','koran'],
  religion: ['ديني','دينية','دينيه','دين','دين اسلامي','دين اسلامى','دينى','دي اسلالمي','دي اسلامي','ديني اسلامي','دينيه اسلاميه','دينية اسلامية','قنوات اسلامية','قنوات اسلامي','اسلامي','اسلامية','اسلاميه','إسلامية','اسلاميه','اسلالمي','اسلاامي','islam','islamic','muslim','religion','religious'],
  christian: [
    'مسيحي','مسيحية','مسيحيه','المسيحية','المسيحيه','قنوات مسيحية','قنوات مسيحيه','محطات مسيحية','محطات مسيحيه','ديني مسيحي','دينية مسيحية','دينيه مسيحيه','قنوات دينية مسيحية','قنوات دينيه مسيحيه',
    'نصراني','نصرانية','نصرانيه','قبطي','قبطية','قبطيه','كنيسة','كنيسه','كنائس','الكنيسة','الكنيسه','انجيل','إنجيل','الانجيل','الإنجيل','يسوع','المسيح','ترانيم','قداس','صلوات','لاهوت','كاثوليك','كاثوليكية','ارثوذكسي','أرثوذكسي','ارثوذكسية','أرثوذكسية','بروتستانت','انجيلي','إنجيلي','انجيلية','إنجيلية',
    'christian','christians','christianity','christian channels','christian tv','coptic','coptic tv','church','church tv','gospel','bible','jesus','christ','worship','praise','mass','prayer','orthodox','catholic','protestant','evangelical','baptist','ministry'
  ],
  cooking: ['طبخ','مطبخ','اكل','أكل','وصفات','cooking','food','kitchen'],
  education: ['تعليم','تعليمي','دروس','مدرسة','مدرستنا','education','educational','learning'],
  radio: ['راديو','اذاعة','إذاعة','radio','fm'],
  shopping: ['تسوق','تسويق','shopping','shop'],
  general: ['منوعات','عام','عامة','general','variety']
};

const COUNTRY_KEYWORDS = {
  // الدول العربية الأساسية
  lebanon: ['لبنان','لبناني','لبنانية','لبنانيه','lebanon','lebanese','beirut','بيروت'],
  egypt: ['مصر','مصري','مصرية','مصريه','القاهره','القاهرة','egypt','egyptian','masr','misr','cairo'],
  jordan: ['اردن','الأردن','الاردن','اردني','اردنية','jordan','jordanian'],
  palestine: ['فلسطين','فلسطيني','فلسطينية','palestine','palestinian'],
  syria: ['سوريا','سوري','سورية','syrian','syria'],
  iraq: ['العراق','عراق','عراقي','عراقية','iraq','iraqi'],
  saudi: ['السعوديه','السعودية','سعودي','سعودية','saudi','ksa'],
  uae: ['الامارات','الإمارات','اماراتي','uae','dubai','دبي','abu dhabi','ابوظبي'],
  qatar: ['قطر','قطري','qatar','qatari'],
  kuwait: ['الكويت','كويت','kuwait','kuwaiti'],
  morocco: ['المغرب','مغربي','مغربية','morocco','moroccan','maroc','maghreb'],
  algeria: ['الجزائر','جزائري','جزائرية','algeria','algerian','algerie'],
  tunisia: ['تونس','تونسي','تونسية','tunisia','tunisian','tunisie'],
  libya: ['ليبيا','ليبي','ليبية','libya','libyan'],
  sudan: ['السودان','سودان','سوداني','سودانية','sudan','sudanese'],
  yemen: ['اليمن','يمن','يمني','يمنية','yemen','yemeni'],
  bahrain: ['البحرين','بحرين','بحريني','bahrain','bahraini'],
  oman: ['عمان','سلطنة عمان','عماني','عمانية','oman','omani'],
  israel: ['اسرائيل','إسرائيل','اسرائيلي','إسرائيلي','عبري','عبرية','hebrew','israel','israeli','yes israel','kan','keshet','reshet','makan'],

  // أوروبا واللغات الأوروبية الشائعة
  greece: ['اليونان','يونان','يوناني','يونانية','يونانيه','قنوات اليونان','قنوات يونانية','greek','greece','hellas','ellada','ellinika'],
  italy: ['ايطاليا','إيطاليا','ايطالي','إيطالي','ايطالية','إيطالية','قنوات ايطالية','قنوات إيطالية','italy','italia','italian'],
  france: ['فرنسا','فرنسي','فرنسية','فرنسيه','قنوات فرنسية','french','france','francais','français'],
  germany: ['المانيا','ألمانيا','الماني','ألماني','المانية','ألمانية','قنوات المانية','germany','german','deutschland','deutsch'],
  spain: ['اسبانيا','إسبانيا','اسباني','إسباني','اسبانية','إسبانية','قنوات اسبانية','spain','spanish','espanol','español','espana','españa'],
  portugal: ['البرتغال','برتغالي','برتغالية','portugal','portuguese'],
  poland: ['بولندا','بولندي','بولندية','poland','polish','polska','polski'],
  netherlands: ['هولندا','هولندي','هولندية','netherlands','dutch','holland','nederland','bvn'],
  belgium: ['بلجيكا','بلجيكي','belgium','belgian'],
  switzerland: ['سويسرا','سوسيرا','سويسري','سويسرية','سويسريه','قنوات سويسرا','قنوات سوسيرا','switzerland','swiss','suisse','schweiz','svizzera','srg','ssr','srf','rts','rsi','kabelio'],
  austria: ['النمسا','نمسا','نمساوي','austria','austrian'],
  uk: ['بريطانيا','المملكة المتحدة','انجلترا','إنجلترا','انجليزي بريطاني','بريطاني','بريطانية','united kingdom','britain','british','england'],
  english: ['انجليزي','إنجليزي','انجليزية','إنجليزية','english','english channels'],
  ireland: ['ايرلندا','إيرلندا','ايرلندي','irish','ireland'],

  // شرق أوروبا والبلقان
  russia: ['روسيا','روسي','روسية','روسيه','قنوات روسية','russia','russian','russkiy','rtvi'],
  ukraine: ['اوكرانيا','أوكرانيا','اوكراني','ukraine','ukrainian'],
  romania: ['رومانيا','روماني','رومانية','romania','romanian'],
  bulgaria: ['بلغاريا','بلغاري','بلغارية','bulgaria','bulgarian'],
  albania: ['البانيا','ألبانيا','الباني','ألباني','albania','albanian','shqip'],
  serbia: ['صربيا','صربي','serbia','serbian','srbija'],
  croatia: ['كرواتيا','كرواتي','croatia','croatian','hrvatska'],
  bosnia: ['البوسنة','بوسنة','بوسني','bosnia','bosnian'],
  slovenia: ['سلوفينيا','سلوفيني','slovenia','slovenian','slovenija'],
  slovakia: ['سلوفاكيا','سلوفاكي','slovakia','slovak'],
  czech: ['التشيك','تشيك','تشيكي','czech','czechia'],
  hungary: ['المجر','مجري','هنغاريا','hungary','hungarian','magyar'],

  // تركيا وآسيا الوسطى
  turkey: ['تركيا','تركي','تركية','تركيه','قنوات تركية','turkey','turkish','turk','türk','turkce','türkçe'],
  azerbaijan: ['اذربيجان','أذربيجان','اذري','أذري','azerbaijan','azerbaijani','azeri','azerbaycan'],
  armenia: ['ارمينيا','أرمينيا','ارمني','armenian','armenia'],
  georgia: ['جورجيا','جورجي','georgia','georgian'],
  tajikistan: ['طاجيكستان','طاجيكي','tajikistan','tajik'],

  // إيران/فارس/كردي/أفغانستان
  iran: ['ايران','إيران','ايراني','إيراني','فارسية','فارسي','فارسيه','persian','farsi','iran','iranian'],
  afghanistan: ['افغانستان','أفغانستان','افغاني','أفغاني','afghanistan','afghan'],
  kurdish: ['كردي','كردية','كرديه','كردستان','kurdish','kurdi','kurdistan'],

  // آسيا
  india: ['الهند','هند','هندي','هندية','هنديه','هندي hd','hindi','india','indian'],
  pakistan: ['باكستان','باكستاني','اوردو','أوردو','urdu','pakistan','pakistani'],
  china: ['الصين','صيني','صينية','china','chinese'],
  japan: ['اليابان','ياباني','يابانية','japan','japanese'],
  korea: ['كوريا','كوري','كورية','korea','korean'],

  // أمريكا والقنوات الدولية
  usa: ['امريكا','أمريكا','الولايات المتحدة','امريكي','أمريكي','امريكية','أمريكية','usa','america','american','united states'],
  canada: ['كندا','كندي','canada','canadian'],
  brazil: ['البرازيل','برازيلي','brazil','brazilian','portuguese brazil'],

  // أفريقيا / دول تظهر أحياناً في الباقات
  ethiopia: ['اثيوبيا','إثيوبيا','اثيوبي','ethiopia','ethiopian'],
  somalia: ['الصومال','صومال','صومالي','somalia','somali'],
  eritrea: ['اريتريا','إريتريا','eritrea','eritrean'],
  senegal: ['السنغال','سنغالي','senegal'],
  cameroon: ['الكاميرون','cameroon']
};

const PACKAGE_KEYWORDS = {
  noursat: ['نورسات','نور سات','noursat','nour sat','noorsat','noor sat','nour el shabeb','nour al shabab','نور الشباب','nour mariam','نور مريم','nour al sharq','nour el sharq','نور الشرق','nour koddass','nour kaddass','نور قداس','نور كداس'],
  'bein-sports': ['bein sports','beinsports','be in sports','بي ان سبورت','بي إن سبورت','بين سبورت'],
  bein: ['bein','be in','بي ان','بي إن','بين','beinsports','bein sports','bein movie','bein movies','bein drama','bein kids','bein documentary'],
  osn: ['osn','او اس ان','أو إس إن','orbit showtime','osn movies','osn yahala','osn kids'],
  mbc: ['mbc','ام بي سي','إم بي سي','امبيسي','mbc masr','mbc action','mbc bollywood','mbc drama','mbc iraq'],
  rotana: ['rotana','روتانا','روتانا سينما','روتانا خليجية','روتانا كلاسيك','rotana cinema'],
  ssc: ['ssc','اس اس سي','إس إس سي','ksa sport','ksa sports','السعودية الرياضية'],
  ontime: ['ontime','on time','on time sport','on time sports','ontime sport','ontime sports','on sport','on sports','ون تايم','اون تايم','أون تايم','اون تايم سبورت','أون تايم سبورت','اون سبورت','أون سبورت'],
  mix: ['mix','مكس','ميكس','mix hollywood','mix one','mix بالعربي','mix drama','mix cinema','mix action'],
  thmanyah: ['الثمانية','ثمانية','ثمانيه','thmanyah','thamanyah','thamanya','althmanyah','al thmanyah','ثمانيه tv','الثمانيه']
};

const PACKAGE_LABELS = {
  noursat: 'نورسات',
  'bein-sports': 'beIN Sports',
  bein: 'beIN',
  osn: 'OSN',
  mbc: 'MBC',
  rotana: 'روتانا',
  ssc: 'SSC',
  ontime: 'ON Time Sports',
  mix: 'MIX',
  thmanyah: 'الثمانية'
};

const SATELLITE_QUERY_KEYWORDS = {
  Nilesat: ['نايل سات','نايلسات','نيل سات','nilesat','eutelsat 7w','eutelsat 8w','7w','8w'],
  Arabsat: ['عرب سات','عربسات','بدر','badr','arabsat','26e'],
  "Es'hailSat": ['سهيل سات','سهيلسات','eshail','es hail','25.5e'],
  'Hot Bird': ['هوت بيرد','هوتبرد','hotbird','hot bird','13e'],
  'Eutelsat 16E': ['يوتلسات 16','eutelsat 16','16e'],
  'Eutelsat 9E': ['يوتلسات 9','eutelsat 9','9e'],
  'Türksat': ['تركسات','turksat','türksat','42e'],
  Yahsat: ['ياه سات','ياهسات','yahsat','52.5e'],
  'Hellas Sat': ['هيلاس سات','hellas','39e'],
  'Eutelsat 36E': ['يوتلسات 36','eutelsat 36','36e'],
  Astra: ['استرا','أسترا','astra','19.2e','28.2e'],
  Amos: ['اموس','أموس','amos','4w'],
  Intelsat: ['انتلسات','إنتلسات','intelsat','68.5e'],
  Azerspace: ['اذر سبيس','أذر سبيس','azerspace','46e']
};

function detectSatelliteFromQuery(raw){
  const q = normalizeText(raw || '');
  const c = compactText(raw || '');
  if (!q && !c) return null;
  for (const key of Object.keys(SATELLITE_QUERY_KEYWORDS)) {
    const aliases = SATELLITE_QUERY_KEYWORDS[key] || [];
    if (aliases.some(alias => {
      const nq = normalizeText(alias);
      const cq = compactText(alias);
      return (nq && q.includes(nq)) || (cq && cq.length >= 2 && c.includes(cq));
    })) return key;
  }
  return null;
}

const CATEGORY_LABELS = {
  sports: 'رياضة',
  kids: 'أطفال',
  movies: 'أفلام',
  series: 'مسلسلات',
  news: 'أخبار',
  documentary: 'وثائقي',
  quran: 'قرآن',
  religion: 'إسلامية',
  christian: 'مسيحية',
  music: 'موسيقى',
  cooking: 'طبخ',
  education: 'تعليمية',
  radio: 'راديو',
  shopping: 'تسوق',
  general: 'منوعات'
};

function stripArabicArticle(text) {
  return normalizeText(text).replace(/(^|\s)ال(?=[\u0600-\u06FF]{3,})/g, '$1').trim();
}

function dictionaryWordMatches(q, word) {
  const nq = normalizeText(q);
  const nw = normalizeText(word);
  const qc = compactText(nq);
  const wc = compactText(nw);
  if (!nq || !nw || !wc) return false;

  // Dictionary detection decides search modes (country/category/package).
  // It must be conservative: a channel query like "الجزيرة" must NOT be
  // treated as "الجزائر", and "العربية" must NOT become "السعودية".
  if (nq === nw) return true;
  if (new RegExp('(^| )' + nw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($| )').test(nq)) return true;
  if (wc.length >= 5 && (qc === wc || qc.includes(wc))) return true;

  const qTokens = queryTokens(nq);
  const wTokens = queryTokens(nw);
  if (wTokens.length > 1 && wTokens.every(wt => qTokens.includes(wt))) return true;

  // Small typo tolerance only when the real word stems start the same.
  // Avoid broad edit-distance matches between unrelated Arabic names.
  const sq = compactText(stripArabicArticle(nq));
  const sw = compactText(stripArabicArticle(nw));
  if (sq.length >= 5 && sw.length >= 5 && Math.abs(sq.length - sw.length) <= 1 && sq.slice(0, 3) === sw.slice(0, 3)) {
    if (editDistance(sq, sw, 1) <= 1) return true;
  }
  return false;
}

function detectFromDictionary(query, dictionary) {
  const q = normalizeText(query);
  for (const key in dictionary) {
    if ((dictionary[key] || []).some(word => dictionaryWordMatches(q, word))) return key;
  }
  return null;
}

function containsCountryMarker(text, keys){
  const n = ' ' + normalizeText(text || '') + ' ';
  const compact = compactText(text || '');
  return (keys || []).some(key => {
    const nk = normalizeText(key);
    const ck = compactText(key);
    if (!nk || !ck) return false;
    const escaped = nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wholeWord = new RegExp('(^| )' + escaped + '($| )').test(n.trim());
    if (/^[a-z0-9]+$/.test(nk) && nk.length <= 3) return wholeWord;
    if (wholeWord || n.includes(' ' + nk + ' ')) return true;
    if (/^[\u0600-\u06FF]+$/.test(nk) && nk.length >= 4 && n.includes(nk)) return true;
    return ck.length >= 5 && compact.includes(ck);
  });
}


function splitChannels(item) {
  const raw = Array.isArray(item && item.channels) && item.channels.length
    ? item.channels.map(String)
    : String(item && item.channel || '').split(/،|,|\n/);
  const seen = new Set();
  const out = [];
  raw.map(s => String(s || '').trim())
    .filter(s => s && !/\d+\s*قناة/.test(s) && normalizeText(s) !== 'etc')
    .forEach(s => {
      const key = compactText(s);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(s);
    });
  return out;
}


// Per-channel encryption / FTA status helpers.
// Keeps original frequency data intact: status is read from channelEncryption when present, otherwise inferred conservatively.
const ENCRYPTION_STATUS_META = {
  free: { label: 'مفتوحة / FTA', shortLabel: 'مفتوحة', icon: '🔓', note: '' },
  encrypted: { label: 'مشفرة', shortLabel: 'مشفرة', icon: '🔒', note: '' },
  unknown: { label: 'غير مؤكد', shortLabel: 'غير مؤكد', icon: '؟', note: '' }
};
const ENCRYPTION_PAY_PACKAGE_MARKERS = ['osn','bein','be in','polsat box','canal+','canal plus','canal+/polsat','canal+ polska','sky italia','sky deutschland','sky uk','nova greece','cosmote','vivacom','digitalb','tring','a1 croatia','a1 bulgaria','total tv','united media','telekom srbija','max tv','antik sat','afn europe','m7 / european','m7','nordic / baltic','d-smart','d smart','german private hd','orange romania','bulsatcom','trikolor','dstv','south asia entertainment','bis/polsat','bis / polsat','polsat','paramount','warner bros. discovery / tivùsat','warner bros discovery','tvn / nova','tvn warner','ukraine package','romanian hd package','kabelio','srg ssr','srg/ssr'];
const ENCRYPTION_FREE_PACKAGE_MARKERS = ['fta','free to air','freesat','trt national package','turkish national fta','turkish news package','turkish music / regional','anatolia regional package','snrt morocco','dubai racing','saudi broadcasting authority','telespazio','arqiva','eutelsat / international','european fta / news','india fta / news','news / international','african religious package','israeli fta / radio','east europe fta','eutelsat 16a fta radios','azerspace international','azerspace regional','قنوات مسيحية','balkan fta / feeds','trt','turkish national','azer','russia / eurasia sports','international services','cctv/cgtn','cctv','cgtn'];
const ENCRYPTION_PAY_CHANNEL_MARKERS = ['osn tv','osn movies','osn documentary','osn showcase','osn one','osn yahala','osn kids','osn comedy','osn crime','osn now','alfa cinema','alfa series','beinsports','bein sports 1','bein sports 2','bein sports 3','bein sports 4','bein sports 5','bein sports 6','bein sports 7','bein sports 8','bein sports 9','bein sports max','bein sports xtra','bein movies','bein series','bein drama','bein 4k','box office','sky cinema','sky sport','sky showcase','sky atlantic','canal+','canal plus','polsat sport premium','eleven sports','cinemax','hbo','nova sport','nova greece','cosmote sport','super sport africa','supersport africa','m-net','m net','afn sports','afn prime','afn family','digitalb','tring sport','arena sport','sport klub','moviesmart','discovery turkey','history turkey','nickelodeon polska','comedy central polska','rtl hd','vox hd','n-tv hd','rtl zwei hd','super rtl hd','orange romania','bulsatcom','trikolor','cartoon network africa','nickelodeon arabia','nick jr arabia','disney channel poland','disney channel','disney junior'];
const ENCRYPTION_FREE_CHANNEL_EXACT = ['bein sports news','beinsports news','bein sports haber','quran tv','sunna tv','saudi quran hd','saudi sunnah hd','al jazeera hd','aljazeera channel','al jazeera english hd','al jazeera documentary','al jazeera mubasher','france 24 arabic','france 24 english','france 24 français','france 24 francais','bbc world news','dw english','trt world','trt haber','trt spor','trt çocuk','trt cocuk','trt belgesel','trt türk','trt turk','cnn türk','cnn turk','a haber','ntv','habertürk','haberturk','sky news arabia','sky news hd','dubai tv hd','sudan tv','jordan tv','oman tv hd','ktv 1 hd','saudi tv','sbc hd','al ekhbaria hd','qatar tv hd','qatar tv quran','qatar radio','palestine hd','india today','aaj tak','news18 india','zee news','republic bharat'];
const ENCRYPTION_FREE_CHANNEL_MARKERS = ['quran','sunna','sunnah','radio','france 24','al jazeera','aljazeera','euronews','cgtn','cctv','dw-tv','dw english','trt ','trt-','trt_','saudi ','qatar ','oman tv','kuwait tv','ktv ','dubai tv','abu dhabi','sharjah','jordan tv','palestine','al maghribia','al aoula','assadissa','tamazight','tbn ','daystar','god tv','faith','supreme master tv','mta international','mta 2','mta 3','vatican media'];
const ENCRYPTION_AMBIGUOUS_PACKAGE_MARKERS = ['globecast','tivùsat','tivusat','rai / tivùsat','rai / tivusat','muxip','ikomg','eutelsat-rmb','data','feeds','feed','yahlive persian','gem group','mena entertainment','twofour54','eutelsat/4k','4k services','rai','italian regional mux','hungarian / central europe'];

function normalizeEncryptionStatus(value){
  const v = normalizeText(value || '');
  if (['free','fta','clear','مفتوحه','مفتوحة','غير مشفر','غير مشفره','غير مشفرة'].includes(v)) return 'free';
  if (['encrypted','scrambled','coded','مشفر','مشفره','مشفرة'].includes(v)) return 'encrypted';
  return 'unknown';
}
function getStoredChannelEncryption(name, item){
  const meta = item && item.channelEncryption;
  if (!meta) return null;
  if (meta[name]) return normalizeEncryptionStatus(meta[name]);
  const wanted = normalizeText(name);
  for (const key in meta) if (normalizeText(key) === wanted) return normalizeEncryptionStatus(meta[key]);
  return null;
}
function getChannelEncryptionStatus(name, item){
  const stored = getStoredChannelEncryption(name, item);
  if (stored) return { key: stored, ...ENCRYPTION_STATUS_META[stored], source: 'مدقق داخل الداتا' };
  const packageText = [item && item.package, item && item.packageId, item && item.network, item && item.provider, item && item.source, item && item.sourceLastUpdated].filter(Boolean).join(' ');
  const channelText = String(name || '');
  const channelNorm = normalizeText(channelText);
  const cats = (getChannelCategories(name, item) || []).map(normalizeText);
  if (ENCRYPTION_FREE_CHANNEL_EXACT.some(x => normalizeText(x) === channelNorm)) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'اسم قناة مفتوحة معروف' };
  if (containsAny(channelText, ENCRYPTION_PAY_CHANNEL_MARKERS)) return { key:'encrypted', ...ENCRYPTION_STATUS_META.encrypted, source:'اسم/باقة مدفوعة' };
  if (containsAny(packageText, ENCRYPTION_PAY_PACKAGE_MARKERS)) return { key:'encrypted', ...ENCRYPTION_STATUS_META.encrypted, source:'باقة مشفرة/مدفوعة' };
  if (containsAny(packageText, ENCRYPTION_FREE_PACKAGE_MARKERS)) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'باقة أو مصدر FTA' };
  if (containsAny(packageText, ENCRYPTION_AMBIGUOUS_PACKAGE_MARKERS)) {
    if (containsAny(channelText, ENCRYPTION_FREE_CHANNEL_MARKERS) || cats.some(c => ['radio','quran','islamic','christian'].includes(c))) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'قناة عامة ضمن باقة مختلطة' };
    return { key:'unknown', ...ENCRYPTION_STATUS_META.unknown, source:'باقة مختلطة/غير مؤكدة' };
  }
  if (cats.some(c => ['radio','quran','islamic','christian'].includes(c))) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'تصنيف قناة مفتوحة غالباً' };
  if (!String(item && item.package || '').trim()) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'لا توجد إشارة باقة مدفوعة' };
  if (containsAny(channelText, ENCRYPTION_FREE_CHANNEL_MARKERS)) return { key:'free', ...ENCRYPTION_STATUS_META.free, source:'اسم قناة عامة/إخبارية' };
  return { key:'unknown', ...ENCRYPTION_STATUS_META.unknown, source:'غير مؤكد' };
}
function channelEncryptionBadgeHtml(name, item){
  const st = getChannelEncryptionStatus(name, item);
  return '<span class="encryption-badge encryption-' + esc(st.key) + '" title="' + esc(st.note + ' المصدر: ' + (st.source || '')) + '"><span>' + esc(st.icon) + '</span><span>' + esc(st.label) + '</span></span>';
}
function channelEncryptionMiniHtml(name, item){
  const st = getChannelEncryptionStatus(name, item);
  return '<em class="channel-encryption-mini encryption-' + esc(st.key) + '" title="' + esc(st.note) + '">' + esc(st.icon + ' ' + st.shortLabel) + '</em>';
}
function channelChipHtml(name, item, extraClass){
  return '<span class="channel-chip' + (extraClass ? ' ' + esc(extraClass) : '') + '"><b>' + esc(name) + '</b>' + channelEncryptionMiniHtml(name, item) + '</span>';
}


// v7 service filter: all / free+unknown / encrypted / radio. TV option removed.
const FREQUENCY_SERVICE_FILTER_LABELS = {
  all: 'الكل',
  free: 'قنوات مجانية / FTA',
  encrypted: 'قنوات مشفرة',
  radio: 'راديو'
};
function getFrequencyServiceFilter(){
  const el = document.getElementById('frequencyServiceFilter');
  const value = el ? String(el.value || 'all') : 'all';
  return FREQUENCY_SERVICE_FILTER_LABELS[value] ? value : 'all';
}
function channelLooksRadio(name, item){
  const cats = (getChannelCategories(name, item) || []).map(normalizeText);
  if (cats.indexOf('radio') !== -1) return true;
  // Strict name-only radio detection. Do not use package/source here because many transponders mix TV + radio.
  const aliasText = [name, ...(getChannelAliases(name, item) || [])].join(' ');
  return containsAny(aliasText, ['radio','راديو','اذاعة','إذاعة','fm','am radio']);
}
function channelLooksDataOrFeed(name, item){
  const text = [name, item && item.channel, item && item.package, item && item.packageId, item && item.source, item && item.notes].filter(Boolean).join(' ');
  const n = normalizeText(text);
  if (containsAny(n, ['data','feeds','feed','test card','testcard','beacon','internet','biss feed','occasional use','occasional','service id'])) return true;
  if (/(^| )tp ?\d/i.test(n) || /(^| )transponder( |$)/i.test(n)) return true;
  return false;
}
function channelServiceKind(name, item){
  if (channelLooksRadio(name, item)) return 'radio';
  if (channelLooksDataOrFeed(name, item)) return 'data';
  return 'tv';
}
function frequencyServiceAllowsChannel(name, item, filter){
  const f = filter || getFrequencyServiceFilter();
  if (f === 'all') return true;
  const kind = channelServiceKind(name, item);
  if (f === 'radio') return kind === 'radio';
  if (f === 'free') {
    const encKey = getChannelEncryptionStatus(name, item).key;
    return kind === 'tv' && (encKey === 'free' || encKey === 'unknown');
  }
  if (f === 'encrypted') return kind === 'tv' && getChannelEncryptionStatus(name, item).key === 'encrypted';
  return true;
}
function applyFrequencyServiceFilter(channels, item, filter){
  const f = filter || getFrequencyServiceFilter();
  if (f === 'all') return channels;
  return (channels || []).filter(name => frequencyServiceAllowsChannel(name, item, f));
}

function channelAliases(name){
  const aliases = [];
  const n = normalizeText(name);
  function add(){ aliases.push(...arguments); }
  if (containsAny(n, ['al malakoot','malakoot','malakut','the kingdom sat'])) add('الملكوت','الملكو','ملكوت','malakoot','al malakoot','kingdom tv','قنوات مسيحية');
  if (containsAny(n, ['aghapy'])) add('اغابي','أغابي','aghapy','قنوات مسيحية');
  if (containsAny(n, ['al karma','alkarma'])) add('الكرمة','الكرمه','alkarma','al karma','قنوات مسيحية');
  if (containsAny(n, ['al kalema','alkalema'])) add('الكلمة','الكلمه','al kalema','alkalema','قنوات مسيحية');
  if (containsAny(n, ['sat 7','sat7'])) add('سات 7','sat7','sat 7','قنوات مسيحية');
  if (containsAny(n, ['ctv','coptic'])) add('سي تي في','قبطي','coptic tv','ctv','قنوات مسيحية');
  if (containsAny(n, ['noursat','nour sat','nour el shabeb','nour al shabab'])) add('نورسات','نور سات','نور الشباب','noursat','nour sat','قنوات مسيحية');
  if (containsAny(n, ['salvation tv mena','salvation tv'])) add('خلاص','salvation','christian','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['north africa tv'])) add('north africa','christian','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['logos tv'])) add('لوغوس','logos','christian','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['nasara tv'])) add('nasara','نصارى','christian','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['nhyira baptist tv','baptist'])) add('baptist','معمدانية','christian','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['faith tv','kto','sbn global','hope channel','god tv','tbn','ewtn','daystar','3abn','cbn'])) add('christian','church','gospel','bible','مسيحية','قنوات مسيحية');
  if (containsAny(n, ['mbc3','mbc 3'])) add('اطفال','kids','mbc3');
  if (containsAny(n, ['spacetoon','space toon'])) add('اطفال','kids','سبيستون');
  if (containsAny(n, ['national geographic','nat geo'])) add('وثائقي','documentary','ناشيونال جيوغرافيك');

  if (containsAny(n, ['al arabiya','alarabiya','al-arabiya','al arabiya hd','alarabiya business','al arabiya fm'])) add('العربية','العربيه','قناة العربية','العربية الحدث','al arabiya','alarabiya','al-arabiya');
  if (containsAny(n, ['al hadath','al-hadath','alarabiya alhadath','al-arabiya alhadath'])) add('الحدث','العربية الحدث','العربيه الحدث','al hadath','al-hadath');
  if (containsAny(n, ['al jazeera','aljazeera'])) add('الجزيرة','الجزيره','al jazeera','aljazeera');
  if (containsAny(n, ['sky news arabia'])) add('سكاي نيوز عربية','سكاي نيوز عربيه','sky news arabia');
  if (containsAny(n, ['bbc arabic'])) add('بي بي سي عربي','bbc arabic');
  if (containsAny(n, ['france 24 arabic'])) add('فرانس 24 عربي','france 24 arabic');
  if (containsAny(n, ['bein sports','be in sports'])) add('رياضة','sports','بي ان سبورت');
  if (containsAny(n, ['ontime','on time','on time sport','on time sports','on sport','on sports','on sport hd','on sport plus','on sport max'])) add('رياضة','sports','سبورت','اون تايم','اون تايم سبورت','أون تايم سبورت','اون سبورت','أون سبورت','ontime','on time sports','on sport','on sports');
  if (containsAny(n, ['mix'])) add('مكس','ميكس','mix');
  if (containsAny(n, ['mtv lebanon','ام تي في لبنان'])) add('لبنان','لبنانية','lebanon','lebanese','ام تي في لبنان');
  if (containsAny(n, ['lbc international','lbci','lbc sat','lbc lebanon','ال بي سي لبنان','ال بي سي اي'])) add('لبنان','لبنانية','lebanon','lebanese','ال بي سي لبنان','ال بي سي اي');
  if (containsAny(n, ['al jadeed'])) add('لبنان','لبنانية','lebanon','lebanese','الجديد','الجديد اللبنانية');
  if (containsAny(n, ['otv lebanon','او تي في لبنان'])) add('لبنان','لبنانية','lebanon','lebanese','او تي في لبنان');
  if (containsAny(n, ['nbn'])) add('لبنان','لبنانية','lebanon','lebanese','ان بي ان');
  if (containsAny(n, ['tele liban','télé liban','lebanon tv'])) add('لبنان','لبنانية','lebanon','lebanese','تلفزيون لبنان','تيلي لبنان');
  if (containsAny(n, ['arabica tv','arabica'])) add('لبنان','لبنانية','lebanon','lebanese','عربيكا');
  if (containsAny(n, ['hawacom'])) add('لبنان','لبنانية','lebanon','lebanese','هواكم');
  if (containsAny(n, ['jaras'])) add('لبنان','لبنانية','lebanon','lebanese','جرس');
  // بحث عربي/إنجليزي لقنوات اليونان على هوت بيرد وغيرها بدون تعديل الداتا نفسها.
  if (containsAny(n, [
    'ert cosmos','ert world','ert news','ert 1','ert 2','ert 3',
    'vouli tv','vouli','cosmote sport','cosmote','nova greece',
    'ant1 europe','antenna sat','skai tv','mega tv','alpha sat',
    'star channel greece','open beyond','makedonia tv','mad greekz','ellada tv'
  ])) add('اليونان','يونان','يوناني','يونانية','يونانيه','قنوات اليونان','قنوات يونانية','greece','greek','hellas','ellada','ellinika','greek channels');

  // بحث عربي/إنجليزي لقنوات سويسرا، مع دعم الخطأ الشائع: سوسيرا.
  
  if (containsAny(n, ['kan 11','kan bet','kan gimmel','kan reka','kan 88','makan 33','makan tv','keshet 12','reshet 13','now 14','yes movies','yes tv','yes docu','yes israeli','sport 1 israel','sport 2 israel','sport 3 israel','sport 4 israel','5 sport','5 gold','5 live','5 plus','one israel','one 2','knesset channel'])) add('اسرائيل','إسرائيل','اسرائيلي','إسرائيلي','عبري','عبرية','قنوات اسرائيل','قنوات إسرائيل','hebrew','israel','israeli','yes israel','yes israel package','kan','keshet','reshet','makan','yes');
  if (containsAny(n, ['starlightmedia','telekanal stb','ictv ukraine','novy kanal','m1 ukraine','rada','galychyna tv','pershyy zakhidnyy','donechchyna tv','lale','boutique tv ukraina','8 kanal ukraine','televsesvit','malyatko tv','chepe info','radio meydan'])) add('اوكرانيا','أوكرانيا','اوكراني','أوكراني','ukraine','ukrainian','ukrainian channels');
  if (containsAny(n, ['srf info','radio srf','rts première','rts premiere','rts espace','rts couleur','rsi rete','radio swiss','kabelio','srg ssr','swiss'])) add('سويسرا','سوسيرا','سويسري','سويسرية','قنوات سويسرا','قنوات سوسيرا','switzerland','swiss','suisse','schweiz','svizzera','srg','ssr','srf','rts','rsi','kabelio','swiss channels');
  return aliases;
}

function getChannelAliases(name, item = {}) {
  const cacheKey = String(name || '');
  if (item && typeof item === 'object') {
    if (!item.__aliasCache) {
      try { Object.defineProperty(item, '__aliasCache', { value: Object.create(null), enumerable: false }); } catch(e) { item.__aliasCache = Object.create(null); }
    }
    if (item.__aliasCache[cacheKey]) return item.__aliasCache[cacheKey];
  }
  const generated = channelAliases(name) || [];
  const meta = item && item.channelAliases;
  let manual = [];
  if (meta) {
    if (Array.isArray(meta[name])) manual = meta[name];
    else {
      const wanted = normalizeText(name);
      for (const key in meta) {
        if (normalizeText(key) === wanted && Array.isArray(meta[key])) { manual = meta[key]; break; }
      }
    }
  }
  const aliases = [];
  const seen = new Set();
  [...generated, ...manual].forEach(value => {
    const text = String(value || '').trim();
    const key = compactText(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    aliases.push(text);
  });
  if (item && typeof item === 'object' && item.__aliasCache) item.__aliasCache[cacheKey] = aliases;
  return aliases;
}

function searchableChannelText(name, item = {}) {
  return [
    name,
    ...(getChannelAliases(name, item) || []),
    item.package,
    item.packageName,
    item.network,
    item.searchAliases
  ].flat().filter(Boolean).join(' ');
}

const CHRISTIAN_STRICT_KEYS = [
  'al malakoot','malakoot','malakut','the kingdom sat','الملكوت','الملكو','ملكوت',
  'aghapy','اغابي','أغابي','agapy','al karma','alkarma','الكرمه','الكرمة','al kalema','alkalema','alkalima','الكلمه','الكلمة',
  'sat 7','sat7','sat-7','سات 7','سات سفن','twr arabic','radio mariam','راديو مريم','logos tv','لوغوس',
  'ctv egypt','coptic tv','coptic','al basira','البصيره','البصيرة','almagd tv','almagad tv','المجد tv',
  'almahaba','al mahaba','المحبه','المحبة','grace tv','قناة النعمه','noursat','nour sat','noorsat','nour el shabeb','nour al shabab','نور الشباب',
  'nour mariam','نور مريم','nour al sharq','nour el sharq','نور الشرق','nour koddass','nour kaddass','نور قداس','نور كداس','loveworld mena','love world mena','christ army tv','better life radio',
  'praise live','miracle channel','hope channel','me sat','mesat','al hayat christian','الحياة المسيحية','الحياه المسيحيه','salvation tv mena','north africa tv',
  'nasara tv','nhyira baptist tv','baptist tv','faith tv','kto','god tv','tbn','ewtn','daystar','3abn','cbn','sbn global','praisefm global'
];

const ISLAMIC_FALSE_POSITIVE_KEYS = [
  'al kahera wal nas','al qahera wal nas','القاهره والناس','القاهرة والناس','القاهرة و الناس','القاهره و الناس'
];

const CATEGORY_RULES = {
  christian: (name) => containsAny(searchableChannelText(name), CHRISTIAN_STRICT_KEYS),
  kids: (name) => containsAny(searchableChannelText(name), ['mbc3','mbc 3','spacetoon','space toon','سبيستون','كراميش','طيور الجنه','طيور الجنة','براعم','cartoon network','cn arabia','nickelodeon','nick jr','kids','kidz','اطفال','كرتون','koky kids','سمسم','atfal','mawaheb','مواهب','majid kids','majed kids']),
  sports: (name) => containsAny(searchableChannelText(name), ['sport','sports','سبورت','رياضه','رياضة','bein sports','ontime','on time','ssc','الكاس','alkass','ad sport','dubai sports','ksa sports','nile sport','jordan sport']),
  movies: (name) => containsAny(searchableChannelText(name), ['movie','movies','cinema','سينما','افلام','أفلام','film','action','hollywood','mix hollywood','روتانا سينما','top cinema','family cinema','cima','سيما']),
  series: (name) => containsAny(searchableChannelText(name), ['drama','دراما','series','مسلسلات','مسلسل','hekayat','حكايات']),
  news: (name) => containsAny(searchableChannelText(name), ['news','اخبار','أخبار','al jazeera','العربيه','العربية','الحدث','sky news','bbc arabic','france 24','al hadath','الميادين','al mayadeen']),
  quran: (name) => containsAny(searchableChannelText(name), ['quran','قران','قرآن','quraan']),
  religion: (name) => !CATEGORY_RULES.christian(name) && containsAny(searchableChannelText(name), ['al rahma','الرحمه','الرحمة','al nas tv','قناة الناس','iqraa','اقرا','إقرأ','al resalah','al risala','رساله','رسالة','sunna','sunnah','السنة','الرسالة','المجد قرآن','almajd quran','quran','قران','قرآن']),
  documentary: (name) => containsAny(searchableChannelText(name), ['documentary','وثائقي','national geographic','nat geo','ناشيونال جيوغرافيك','discovery','animal planet','history channel']),
  music: (name) => containsAny(searchableChannelText(name), ['music','اغاني','أغاني','موسيقى','موسيقي','mazika','maziika','mazzika','مزيكا','rotana music','rotana clip','روتانا موسيقى','روتانا كليب','ميلودي','melody','nogoum','نجوم','nogoum fm tv','wanasa','wnasa','وناسة','وناسه','arabica tv','عربيكا','alfa fann','alfa music','الفا فن','الفا ميوزيك','med music','mdlbeast','tarab','طرب','clip','clips','sout alkhaleej','صوت الخليج','nagham','نغم','radio fann']),
  cooking: (name) => containsAny(searchableChannelText(name), ['cooking','طبخ','مطبخ','food','فتافيت','cbc sofra','sofra','سفره','سفرة'])
};

function getChannelCategories(name, item) {
  const meta = item && item.channelCategories;
  if (meta) {
    if (Array.isArray(meta[name])) return meta[name];
    const wanted = normalizeText(name);
    for (const key in meta) {
      if (normalizeText(key) === wanted && Array.isArray(meta[key])) return meta[key];
    }
  }
  return null;
}

function channelInCategory(name, category, item) {
  const fullText = searchableChannelText(name, item);

  if (category === 'christian') {
    const cats = getChannelCategories(name, item);
    if (cats) return cats.indexOf('christian') !== -1;
    return containsAny([name, ...(getChannelAliases(name, item) || [])].join(' '), CHRISTIAN_STRICT_KEYS);
  }

  // Islamic search must be stricter than normal text search.
  // Some channel names contain words like "ناس" but are not Islamic channels
  // (example: Al Kahera Wal Nas), so exclude known false positives first.
  if ((category === 'religion' || category === 'quran') && containsAny(fullText, ISLAMIC_FALSE_POSITIVE_KEYS)) return false;

  const cats = getChannelCategories(name, item);
  if (cats) {
    if (cats.indexOf(category) !== -1) return true;
    // The database uses "islamic" for Islamic religious channels,
    // while the UI/search mode uses "religion" as the Arabic-facing category.
    if (category === 'religion' && (cats.indexOf('islamic') !== -1 || cats.indexOf('quran') !== -1)) return true;
    if (category === 'quran' && cats.indexOf('islamic') !== -1 && containsAny(fullText, ['quran','قران','قرآن','القران','القرآن','coran','holy quran'])) return true;
    return false;
  }
  return CATEGORY_RULES[category] ? CATEGORY_RULES[category](name) : false;
}

function itemCountryIs(item, country) {
  const wanted = normalizeText(country);
  const values = [item.country, item.countryCode, item.originCountry, item.region]
    .filter(Boolean)
    .map(normalizeText);
  return values.some(v => v === wanted || v.includes(wanted));
}


const CHANNEL_COUNTRY_RULES = {
  lebanon: ['mtv lebanon','lbc international','lbci','lbc sat','lbc lebanon','al jadeed','الجديد','otv lebanon','nbn','tele liban','télé liban','lebanon tv','hawacom','arabica tv','jaras tv','al iman tv lebanon','al manar','one tv lebanon'],
  jordan: ['jordan tv','jordan sport','jordan amen','jordan sama','sama jordan','amman tv','jordan radio','jordan alhurra','roya','رؤيا','almamlaka','المملكة','المملكه','quran kareem jordan','rotana tarab jordan','radio fann jordan','radio yaqeen jordan','radio al wasat'],
  palestine: ['palestine tv','palestine today','maan tv','ma an tv','al aqsa tv','musawa','watan hd','فلسطين اليوم','الاقصى'],
  syria: ['syria tv','syrian tv','sama tv','lana tv','syria news','alikhbaria syria','al ikhbaria syria','misk syria','radio damascus','damascus radio','ana sooria','ana syria','anasyria','انا سوريا'],
  iraq: ['iraqiya','al iraqiya','iraq tv','utv iraq','دجلة','الشرقية','العراقية','al rasheed','kirkuk tv','iraqia turkmen','iraqia kurdish'],
  egypt: ['cbc','dmc','on tv','on e','on drama','on time','ontime','al hayah','الحياه','الحياة','al nahar','النهار','sada elbalad','صدى البلد','ten tv','mehwar','المحور','extra news','nile news','nile cinema','nile drama','nile sport','النيل','ماسبيرو','mbc masr','masr','misr','al kahera wal nas','القاهرة والناس','ert u','ertu'],
  saudi: ['saudi tv','ksa sports','ssc','al saudiya','السعودية','السعوديه','قناة السعودية','sbc','thikrayat tv','ekhbaria tv','saudia alaan','quran tv','sunna tv'],
  uae: ['dubai tv','dubai sports','dubai racing','دبي','abu dhabi','ابوظبي','ad tv','sharjah tv','الشارقة','الشارقه','sama dubai','dubai one','abu dhabi drama'],
  qatar: ['qatar tv','al kass','alkass','الكاس','qatar today'],
  kuwait: ['kuwait tv','ktv','atv kuwait','scope tv','alrai tv','al rai tv','قناة الراي'],
  bahrain: ['bahrain tv','bahrain hd','bahrain sport','bahrain quran','radio bahrain','البحرين','بحرين'],
  oman: ['oman tv','oman hd','oman radio','oman cultural','sawtoman','سلطنة عمان','تلفزيون عمان'],
  morocco: ['2m maroc','2m monde','2m tv','medi 1 tv','morocco','maroc','al maghribia','al aoula','arryadia','athaqafia','assadissa','tamazight','laayoune tv','المغرب'],
  algeria: ['algerie','algeria','algérie','الشروق tv','النهار الجزائرية','الجزائر','dzair','ennahar tv'],
  tunisia: ['tunisia','tunisie','تونس','الوطنية التونسية','elhiwar ettounsi','nessma','hannibal tv','zitouna tv'],
  libya: ['libya','libya alrasmia','ليبيا','ليبيا الرسمية','ليبيا الاحرار','218 tv'],
  sudan: ['sudan tv','sudan','السودان','النيل الازرق','blue nile tv'],
  yemen: ['yemen tv','yemen shabab','اليمن','اليمن شباب','aden tv','عدن tv','hadramout tv'],
  israel: ['kan 11','kan','makan 33','makan tv','keshet 12','reshet 13','now 14','yes','yes movies','yes tv','sport 1 israel','sport 2 israel','sport 3 israel','sport 4 israel','5 sport','5 gold','5 live','5 plus','one israel','one 2','knesset channel','kan educational','kan 88','kan bet','kan gimmel','kan reka','galgalaz','israel','israeli','hebrew','عبري','إسرائيل','اسرائيل'],

  greece: ['ert cosmos','ert world','ert news','ert 1','ert 2','ert 3','vouli tv','vouli','cosmote sport','cosmote','cosmote tv','nova greece','ant1 europe','antenna sat','skai tv','mega tv greece','mega tv','alpha sat','star channel greece','open beyond','makedonia tv','mad greekz','ellada tv','smile tv greece','vergina kypros','hellas sat','greece','greek','hellas','ellada','ellinika'],
  italy: ['rai','rai 1','rai 2','rai 3','rai 4','rai 4k','rai 5','rai gulp','rai movie','rai news','rai premium','rai scuola','rai sport','rai storia','rai yoyo','canale 5','canale italia','mediaset','italia','italian','italiano','tivusat','tivùsat','sky italia','real time italia','dmax italia','food network italia','camera dei deputati','senato italiano','uninettuno','teleclubitalia','super!'],
  france: ['france 24','franceinfo','français','francais','french','tv5','tv5monde','rfi','radio france internationale','canal+ réunion','canal plus reunion','mezz o','mezzo'],
  germany: ['zdf','zdf hd','zdfneo','zdf neo','zdfinfo','das erste','ard','kika','3sat','deutschlandfunk','deutschlandfunk nova','tagesschau24','swr hd','rtl deutschland','rtl hd','rtl television','rtl zwei','super rtl','vox','n-tv','nitro','sky sport bundesliga','canal+ germany','discovery hd germany','warner tv serie'],
  spain: ['tve','la 1','la 2','antena 3','telecinco','cuatro','atreseries','spanish','espanol','español','espana','españa'],
  portugal: ['rtp','sic','tvi','portugal','portuguese'],
  poland: ['tvp','tvp hd','tvp info','tvp rozrywka','polsat','polsat box','polsat sport','canal+ polska','polska','poland','polish','wpolsce','nuta tv','home tv polska','stopklatka','4fun tv','tv republika','animal planet polska','eurosport polska','disney channel poland','warner tv poland'],
  netherlands: ['bvn','npo','rtl nederland','netherlands','dutch','nederland'],
  switzerland: ['srf info','radio srf','srf 1','srf zwei','rts première','rts premiere','rts espace','rts couleur','rts option','rsi rete','radio swiss','srg ssr','kabelio','suisse','schweiz','svizzera','swiss'],
  uk: ['bbc one','bbc two','bbc news','bbc brit','bbc earth','bbc first','bbc lifestyle','bbc world news','bbc arabic','bbc persian','cbbc','itv 1','itv 2','channel 4','film4','e4','quest','dave','talking pictures','that\'s tv uk','sky news','sky showcase','sky atlantic','sky cinema','sky sports news','crime + investigation uk','omega tv uk'],
  english: ['english','bbc one','bbc two','bbc news','bbc world news','bbc brit','bbc earth','bbc first','bbc lifestyle','cbbc','itv','channel 4','film4','e4','quest','dave','sky news','sky showcase','sky atlantic','sky cinema','cnn international','cnn hd','cnbc europe','al jazeera english','france 24 english','trt world','kbs world','voa','one america news','star movies middle east','star world middle east'],
  usa: ['cnn international','cnn international europe','cnn hd','cnbc europe','one america news','voa','voa 365','voice of america','abn usa','disney channel','disney jr','national geographic','warner tv','cartoon network','nickelodeon'],
  russia: ['russia today','rtvi','tv rus','karavan tv','russian','russia','rossiya'],
  ukraine: ['ukraine','ukrainian','ua tv','1+1 ukraine','stb ukraine','music box ukraine'],
  romania: ['romania','romanian','antena 1 romania','antena stars','antena 3 cnn','pro tv','pro tv hd','digi24','kanal d romania','prima tv','pro cinema','pro arena','acasa gold','romania tv','realitatea plus','national tv romania'],
  bulgaria: ['bulgaria','bulgarian','nova tv bulgaria','bulgaria on air','btv','diema','planeta folk','cartoon network bulgaria','eurosport bulgaria'],
  albania: ['albania','albanian','tring','supersport albania','euronews albania','vizion plus','klan hd','rtsh','shqip','radio tirana'],
  serbia: ['serbia','serbian','rts svet','rts 1','rts 2','n1 serbia','nova s','radio televizija srbije'],
  croatia: ['croatia','croatian','hrvatska','arena sport croatia','arena sport hrvatska','nova tv croatia','rtl croatia','sport klub 1 hrvatska'],
  bosnia: ['bosnia','bosnian','face tv','federalna tv','hayat tv','hayat 2','hayat folk box','hayat music box','bn tv','radio sarajevo'],
  slovenia: ['slovenia','slovenian','slovenija','tv slovenija','prvi','val 202','radio si'],
  slovakia: ['slovakia','slovak','markiza international','joj cinema','ta3'],
  czech: ['czech','czechia','ct24'],
  hungary: ['hungary','hungarian','tippmix','magyar'],

  turkey: ['trt','trt 1','trt haber','trt spor','trt belgesel','trt çocuk','trt turk','trt türk','trt world','cnn türk','habertürk','a haber','tgrt haber','atv türkiye','atv turkiye','power türk','dream türk','kral pop','history turkey','discovery turkey','turkey','turkish','türk','turk'],
  azerbaijan: ['azerbaijan','azerbaycan','azeri','cbc azerbaycan','regional tv azerbaijan','xezer tv','atv azerbaijan','arb tv'],
  armenia: ['armenia','armenian','armnews','shant tv'],
  tajikistan: ['tajikistan','tajik','tojikiston','tv safina','tv bahoriston','jahonnamo','varzish tv','sinamo tv','tv dushanbe'],

  iran: ['iran','iranian','persian','farsi','bbc persian','ifilm persian','mbc persia','iran international','simay-azadi','simaye azadi','quran tv iran','radio iran','radio quran iran','marjaeyat tv persian','gem tv','gem series','gem film','gem drama','gem sport','gem music','gem onyx','gem rubix','gem river','hodhod farsi','ayeneh tv','mohabat tv','ganj e hozour'],
  afghanistan: ['afghanistan','afghan','afghanistan international','watan hd'],
  kurdish: ['kurdish','kurdi','kurdistan','trt kurdi','sahar kurdi','gem kurd','gali kurdistan','kurdistan 24','kurdistan tv','kurdmax','nûçe tv','nuce tv','medya haber'],
  india: ['india','indian','hindi','india today','news18 india','star sports 1 hindi','sony entertainment television'],
  pakistan: ['pakistan','pakistani','urdu'],
  china: ['china','chinese'],
  japan: ['japan','japanese','nhk world'],
  korea: ['korea','korean','kbs world','arirang'],
  brazil: ['brazil','brazilian'],
  ethiopia: ['ethiopia','ethiopian'],
  somalia: ['somalia','somali'],
  cameroon: ['cameroon','crtv news']
};

function addUniqueCountryHit(hits, id){
  if (id && !hits.includes(id)) hits.push(id);
}

function inferChannelCountries(name, item = {}) {
  const t = searchableChannelText(name, item || {});
  const hits = [];

  Object.keys(CHANNEL_COUNTRY_RULES).forEach(countryId => {
    if (containsCountryMarker(t, CHANNEL_COUNTRY_RULES[countryId])) addUniqueCountryHit(hits, countryId);
  });

  // بعض القنوات التركية أسماؤها عامة، لذلك نربطها بتركيا فقط إذا جاءت من قمر تركسات.
  const satBlob = satelliteSearchBlob(item || {});
  if (containsCountryMarker(satBlob, ['turksat','türksat','42e']) && containsCountryMarker(name, [
    'kanal d','show tv','star tv','kanal 7','beyaz tv','tv8','ntv','kanal b','krt tv','eurostar','brt 1','brt 2','kıbrıs tv','kibris tv','ada tv','kanal 3','kanal 5','kon tv','kanal fırat','kanal firat','local anatolia tv'
  ])) addUniqueCountryHit(hits, 'turkey');

  // قنوات إنجليزية بأسماء عامة داخل باقات إنجليزية.
  if (containsCountryMarker(satBlob, ['astra','28e']) && containsCountryMarker(name, ['itv 1','itv 2','channel 4','film4','e4','quest','dave','drama'])) {
    addUniqueCountryHit(hits, 'uk');
    addUniqueCountryHit(hits, 'english');
  }

  return hits;
}

function inferChannelCountry(name, item = {}) {
  const hits = inferChannelCountries(name, item);
  return hits.length ? hits[0] : null;
}

function getChannelCountry(name, item) {
  const meta = item && item.channelCountries;
  if (meta) {
    if (meta[name]) return meta[name];
    const wanted = normalizeText(name);
    for (const key in meta) {
      if (normalizeText(key) === wanted) return meta[key];
    }
  }
  return null;
}

function channelInCountry(name, item, country) {
  // Country filters must work per-channel, not per-transponder.
  // Some transponders carry Egyptian and non-Egyptian channels together;
  // if the whole row is tagged as Egypt, blindly accepting the row pulls unrelated channels.
  const taggedCountry = getChannelCountry(name, item);
  if (taggedCountry) return taggedCountry === country;

  const inferredCountries = inferChannelCountries(name, item);
  if (inferredCountries.length) return inferredCountries.includes(country);

  // Only use row-level country metadata as a safe fallback for single-channel rows.
  // Multi-channel mixed rows need explicit per-channel inference above.
  const channels = splitChannels(item);
  if (channels.length <= 1) return itemCountryIs(item, country);

  return false;
}

function channelPackageText(name, item = {}) {
  // Package filters are per-channel, not per-transponder.
  // A single frequency can contain MIX plus unrelated channels.
  return [name, ...(getChannelAliases(name, item) || [])].filter(Boolean).join(' ');
}

function channelInPackage(name, item, pkg) {
  const text = channelPackageText(name, item);
  const keys = PACKAGE_KEYWORDS[pkg] || [];
  if (containsAny(text, keys)) return true;

  // If the row is explicitly tagged as this package, every channel in that row belongs to it.
  // This is needed for packages like OSN where many carried channels do not include "OSN" in their names
  // (History, Nickelodeon, Discovery, TLC, CNN, Cartoon Network, Fatafeat...).
  const explicitRowPackage = [item.package, item.packageName, item.network, item.searchAliases]
    .flat()
    .filter(Boolean)
    .join(' ');
  if (containsAny(explicitRowPackage, keys)) {
    // ON/ON Time transponders are often mixed with unrelated stations. Keep this
    // package per-channel unless the channel name/aliases itself carries ON markers.
    if (pkg === 'ontime') return containsAny(text, keys);
    return true;
  }

  // For untagged mixed transponders, stay per-channel to avoid pulling unrelated stations.
  return false;
}

function getFrequency(item) {
  const n = parseInt(String(item.frequency || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function satelliteAllowed(item, selected) {
  const s = normalizeText(selected || 'all');
  const group = normalizeText(item.satelliteGroup || '');
  const sat = normalizeText(item.satellite || '');
  const orbit = normalizeText(item.orbit || '');
  const slot = normalizeText(item.orbitalSlot || '');
  const satName = normalizeText(item.satelliteName || '');
  const cluster = normalizeText(item.satelliteCluster || '');
  const blob = [group, sat, orbit, slot, satName, cluster].join(' ');
  if (s === 'all') return true;
  if (s === 'nilesat') return group.includes('nilesat') || sat.includes('nilesat') || orbit.includes('7w') || orbit.includes('8w');
  if (s === 'arabsat' || s === 'badr') return group.includes('arabsat') || group.includes('badr') || sat.includes('arabsat') || sat.includes('badr') || orbit.includes('26e');
  if (s.includes('eshail') || s.includes('es hail')) return blob.includes('eshail') || blob.includes('es hail') || orbit.includes('25');
  if (s.includes('hot bird')) return blob.includes('hot') || orbit.includes('13e');
  if (s.includes('turksat')) return blob.includes('turksat') || blob.includes('turk') || orbit.includes('42e');
  if (s.includes('yahsat')) return blob.includes('yahsat') || orbit.includes('52');
  if (s.includes('hellas')) return blob.includes('hellas') || orbit.includes('39e');
  if (s.includes('eutelsat 16')) return blob.includes('eutelsat 16') || orbit.includes('16e');
  if (s.includes('eutelsat 9')) return blob.includes('eutelsat 9') || orbit.includes('9e');
  if (s.includes('eutelsat 36')) return blob.includes('eutelsat 36') || orbit.includes('36e');
  if (s.includes('astra')) return blob.includes('astra') || orbit.includes('19') || orbit.includes('28');
  if (s.includes('amos')) return blob.includes('amos') || orbit.includes('4w');
  if (s.includes('intelsat')) return blob.includes('intelsat') || orbit.includes('68');
  if (s.includes('azerspace')) return blob.includes('azer') || orbit.includes('46e');
  return group.includes(s) || sat.includes(s) || orbit.includes(s);
}

function satelliteSearchBlob(item) {
  return [item && item.satelliteGroup, item && item.satellite, item && item.satelliteName, item && item.orbitalSlot, item && item.orbit, item && item.satelliteCluster].filter(Boolean).join(' ');
}

function suggestionAllowedForSelectedSatellite(suggestion, selected) {
  const selectedValue = String(selected || 'all');
  if (normalizeText(selectedValue) === 'all') return true;
  if (!suggestion || !suggestion.satelliteBlob) return true;
  return satelliteAllowed({ satelliteGroup: suggestion.satelliteBlob, satellite: suggestion.satelliteBlob, orbit: suggestion.satelliteBlob }, selectedValue);
}

function satelliteLabel(value) {
  const v = String(value || '');
  const n = normalizeText(v);
  if (n.includes('nilesat') || n.includes('7w') || n.includes('8w')) return 'نايل سات';
  if (n.includes('arabsat') || n.includes('badr') || n.includes('26e')) return 'عربسات / بدر';
  if (n.includes('eshail') || n.includes('25e')) return 'سهيل سات';
  if (n.includes('hot bird') || n.includes('13e')) return 'هوت بيرد';
  if (n.includes('turksat') || n.includes('turk') || n.includes('42e')) return 'تركسات';
  if (n.includes('yahsat') || n.includes('52')) return 'ياه سات';
  if (n.includes('hellas') || n.includes('39e')) return 'هيلاس سات';
  if (n.includes('eutelsat 16') || n.includes('16e')) return 'يوتلسات 16E';
  if (n.includes('eutelsat 9') || n.includes('9e')) return 'يوتلسات 9E';
  if (n.includes('eutelsat 36') || n.includes('36e')) return 'يوتلسات 36E';
  if (n.includes('astra')) return 'أسترا';
  if (n.includes('amos')) return 'أموس';
  if (n.includes('intelsat')) return 'إنتلسات';
  if (n.includes('azer')) return 'أذر سبيس';
  if (n.includes('eutelsat 8 west')) return 'يوتلسات 8 غرب';
  if (n.includes('dror')) return 'درور 1';
  if (n.includes('badr')) return 'بدر';
  if (n.includes('eshail') || n.includes('es hail')) return 'سهيل سات';
  return v || '-';
}

function physicalSatelliteLabel(item) {
  if (!item) return '-';
  const name = String(item.satelliteName || item.satellite || '').trim();
  const slot = String(item.orbitalSlot || item.orbit || '').trim();
  if (name && slot && !normalizeText(name).includes(normalizeText(slot))) return name + ' / ' + slot;
  return name || slot || '-';
}

function queryTokens(query) {
  const stop = new Set(['قنوات','قناة','قناه','القنوات','القناه','تردد','ترددات','باقة','باقات','على','في','من','الى','إلى','ال','و','او','أو','hd','sd','tv','channel','channels','freq','frequency','sat','satellite','all','كل']);
  return normalizeText(query).split(' ').filter(t => t.length > 1 && !stop.has(t));
}

function strictChannelSearchText(name, item) {
  // Only the channel name and aliases for THIS channel.
  // No row-level package/searchAliases/channel summary here.
  const cacheKey = String(name || '');
  if (item && typeof item === 'object') {
    if (!item.__searchTextCache) {
      try { Object.defineProperty(item, '__searchTextCache', { value: Object.create(null), enumerable: false }); } catch(e) { item.__searchTextCache = Object.create(null); }
    }
    if (item.__searchTextCache[cacheKey]) return item.__searchTextCache[cacheKey];
  }
  const text = [name, ...(getChannelAliases(name, item) || [])].filter(Boolean).join(' ');
  if (item && typeof item === 'object' && item.__searchTextCache) item.__searchTextCache[cacheKey] = text;
  return text;
}


function detectNamedChannelIntent(query) {
  const q = normalizeText(query);
  const c = compactText(query);
  if (!q || !c) return null;
  if (['الجزيره','الجزيرة','جزيره','جزيرة','aljazeera','al jazeera','jazeera'].some(x => q === normalizeText(x) || c === compactText(x))) return 'aljazeera';
  if (['العربيه','العربية','عربيه','عربية','alarabiya','al arabiya','al-arabiya'].some(x => q === normalizeText(x) || c === compactText(x))) return 'alarabiya';
  if (['الحدث','حدث','alhadath','al hadath','al-hadath'].some(x => q === normalizeText(x) || c === compactText(x))) return 'alhadath';
  if (['rai','raï','راي','راى','قناة راي','قنوات راي'].some(x => q === normalizeText(x) || c === compactText(x))) return 'rai';
  return null;
}

function channelMatchesNamedIntent(name, item, brand) {
  const n = normalizeText(name);
  const c = compactText(name);
  const aliases = (getChannelAliases(name, item) || []).map(normalizeText);
  if (brand === 'aljazeera') {
    return containsAny(name, ['al jazeera','aljazeera']) || aliases.some(a => ['الجزيره','الجزيرة','al jazeera','aljazeera'].includes(a));
  }
  if (brand === 'alarabiya') {
    return containsAny(name, ['al arabiya','alarabiya','al-arabiya']) || aliases.some(a => ['العربيه','العربية','قناة العربيه','قناة العربية','al arabiya','alarabiya','al-arabiya'].includes(a));
  }
  if (brand === 'alhadath') {
    return containsAny(name, ['al hadath','alhadath','al-hadath']) || aliases.some(a => ['الحدث','قناة الحدث','al hadath','alhadath','al-hadath'].includes(a));
  }
  if (brand === 'rai') {
    return n === 'rai' || n.startsWith('rai ') || aliases.some(a => a === 'rai' || a === 'راي' || a === 'راى' || a.startsWith('rai '));
  }
  return false;
}

function strictTokenMatchInChannel(name, item, token) {
  const q = normalizeText(token);
  const qc = compactText(token);
  if (!q || !qc) return true;

  // Frequency numbers are matched only against frequency fields.
  if (/^\d{3,6}$/.test(qc)) {
    return [item.frequency, item.sr].some(v => compactText(v).includes(qc));
  }

  // Smart free text: per-channel only, but with aliases, typo tolerance,
  // Arabic normalization, and safe handling for short Latin names like RAI/MBC.
  const channelBlob = strictChannelSearchText(name, item);
  return smartChannelTokenMatch(channelBlob, token);
}

function freeTextMatch(name, item, tokens) {
  if (!tokens.length) return true;
  return tokens.every(t => strictTokenMatchInChannel(name, item, t));
}

function getSearchMode(query) {
  const raw = String(query || '').trim();
  if (!raw) return { type: 'all', raw };
  if (isFrequencySearch(raw)) return { type: 'frequency', raw, frequency: Number(raw) };
  if (exactPackageMode) return { type: 'package', raw, package: exactPackageMode };

  const earlySatellite = detectSatelliteFromQuery(raw);

  // بحث القنوات المسيحية لازم يكون تصنيف مسيحي صريح فقط، وليس بحثاً عاماً أو دينياً.
  if (isChristianIntentQuery(raw)) return { type: 'category', raw, category: 'christian', strictChristianIntent: true, satellite: earlySatellite };

  // كل مرادفات البحث عن القنوات الإسلامية تعطي نفس النتيجة الدقيقة.
  // لا نتركها تسقط إلى البحث النصي الحر حتى لا تظهر قنوات غير إسلامية.
  if (isIslamicIntentQuery(raw)) return { type: 'category', raw, category: 'religion', strictIslamicIntent: true, satellite: earlySatellite };

  // Known channel names must stay channel-name searches before dictionary modes.
  // Otherwise "الجزيرة" may be interpreted as Algeria and "العربية" as Saudi/Arab.
  const namedChannel = detectNamedChannelIntent(raw);
  if (namedChannel) return { type: 'namedChannel', raw, brand: namedChannel, satellite: earlySatellite };

  const country = detectFromDictionary(raw, COUNTRY_KEYWORDS);
  const pkg = detectFromDictionary(raw, PACKAGE_KEYWORDS);
  const category = detectFromDictionary(raw, CATEGORY_KEYWORDS);
  const satellite = earlySatellite || detectSatelliteFromQuery(raw);

  // Specific package names win before broad categories. Example: "beinsport"
  // should open beIN Sports, not every sports channel in the database.
  if (country && pkg) return { type: 'countryPackage', raw, country, package: pkg, satellite };
  if (country && category) return { type: 'countryCategory', raw, country, category, satellite };
  if (pkg) return { type: 'package', raw, package: pkg, satellite };
  if (country) return { type: 'country', raw, country, satellite };
  if (category) return { type: 'category', raw, category, satellite };
  const tokens = queryTokens(raw).filter(function(token){
    const tc = compactText(token);
    return !(satellite && Object.keys(SATELLITE_QUERY_KEYWORDS).some(function(key){ return key === satellite && (SATELLITE_QUERY_KEYWORDS[key] || []).some(function(alias){ return compactText(alias) === tc; }); }));
  });
  if (!tokens.length && satellite) return { type: 'all', raw, satellite };
  if (!tokens.length) return { type: 'all', raw, stopwordOnly: true };
  return { type: 'free', raw, tokens, satellite };
}

function channelMatchesMode(channel, item, mode) {
  if (mode.type === 'all') return true;
  if (mode.type === 'frequency') return true;
  if (mode.type === 'package') return channelInPackage(channel, item, mode.package);
  if (mode.type === 'namedChannel') return channelMatchesNamedIntent(channel, item, mode.brand);
  if (mode.type === 'category') return channelInCategory(channel, mode.category, item);
  if (mode.type === 'country') return channelInCountry(channel, item, mode.country);
  if (mode.type === 'countryCategory') return channelInCountry(channel, item, mode.country) && channelInCategory(channel, mode.category, item);
  if (mode.type === 'countryPackage') return channelInCountry(channel, item, mode.country) && channelInPackage(channel, item, mode.package);
  if (mode.type === 'free') return freeTextMatch(channel, item, mode.tokens || []);
  return false;
}

function itemMatchesMode(item, mode) {
  if (mode.type === 'all') return true;
  if (mode.type === 'frequency') {
    const f = getFrequency(item);
    return f !== null && Math.abs(f - mode.frequency) <= 5;
  }
  if (item && item.hideFromNamedSearch && !/قديم|احتياطي|backup|legacy|old/i.test(String(mode.raw || ''))) return false;
  const channels = splitChannels(item);
  if (['package','namedChannel','category','country','countryCategory','countryPackage','free'].includes(mode.type)) {
    return channels.some(ch => channelMatchesMode(ch, item, mode));
  }
  return false;
}

function matchingChannels(item, mode) {
  const channels = splitChannels(item);
  if (mode.type === 'all' || mode.type === 'frequency') return channels;
  return channels.filter(ch => channelMatchesMode(ch, item, mode));
}

function rowScore(item, mode, index) {
  let score = 100000 - index;
  const priority = Number(item && item.searchPriority || 0);
  if (Number.isFinite(priority)) score += priority;
  if (item && item.isCurrent) score += 800;
  if (item && item.isLegacy) score -= 600;
  if (item && item.isDeprecated) score -= 1200;
  if (mode.type === 'frequency') {
    const f = getFrequency(item);
    if (f !== null) score += Math.max(0, 2000 - Math.abs(f - mode.frequency) * 100);
  }
  if (mode.type === 'package') score += 1500;
  if (mode.type === 'namedChannel') score += 3000;
  if (mode.type === 'category') score += 1200;
  if (mode.type === 'country') score += 1000;
  if (mode.type === 'free') {
    const q = mode.raw || '';
    const tokens = (mode.tokens || queryTokens(q)).slice(0, 4);
    const nq = normalizeText(q);
    const cq = compactText(q);
    splitChannels(item).forEach(ch => {
      const blob = strictChannelSearchText(ch, item);
      const nt = normalizeText(blob);
      const ct = compactText(blob);
      if (nt === nq || ct === cq) score += 2000;
      else if (nt.startsWith(nq) || ct.startsWith(cq)) score += 1200;
      else if (cq.length >= 3 && (nt.includes(nq) || ct.includes(cq))) score += 700;
      else if (cq.length >= 5) score += fuzzyTextScore(blob, q);
      if (tokens.length && tokens.every(t => smartChannelTokenMatch(blob, t))) score += 420;
    });
  }
  if (String(item.quality || '').toLowerCase().includes('hd')) score += 25;
  return score;
}

const LOGO_RULES = [
  ['al-malakoot.svg', ['الملكو','الملكوت','malakoot','al malakoot','el malakoot']],
  ['noursat.svg', ['نورسات','نور سات','noursat','nour sat','noorsat','nour el shabeb','nour al shabab','نور الشباب','نور مريم','نور الشرق']],
  ['sat7.svg', ['sat 7','sat7','سات 7']],
  ['aghapy.svg', ['aghapy','اغابي','أغابي']],
  ['alkarma.svg', ['karma tv','al karma','alkarma','الكرمه','الكرمة']],
  ['alkalema.svg', ['al kalema','alkalema','الكلمه','الكلمة']],
  ['ctv.svg', ['ctv','coptic','سي تي في']],
  ['me-sat.svg', ['me sat','mesat']],
  ['loveworld-mena.svg', ['loveworld','love world','loveworld mena']],
  ['christ-army.svg', ['christ army']],
  ['better-life-radio.svg', ['better life radio']],
  ['grace-tv.svg', ['grace tv']],
  ['al-basira.svg', ['al basira','البصيرة','البصيره']],
  ['al-mahaba.svg', ['almahaba','al mahaba','المحبة','المحبه']],
  ['bein-sports.svg', ['bein sports','beinsports','بي ان سبورت']],
  ['osn.svg', ['osn','او اس ان','أو إس إن']],
  ['mbc3.svg', ['mbc3','mbc 3','ام بي سي 3']],
  ['mbc.svg', ['mbc','ام بي سي','إم بي سي']],
  ['rotana.svg', ['rotana','روتانا']],
  ['ssc.svg', ['ssc','اس اس سي','إس إس سي']],
  ['ontime.svg', ['ontime','on time','on sport','اون تايم']],
  ['mix.svg', ['mix','مكس','ميكس']],
  ['aljazeera.svg', ['al jazeera','aljazeera','الجزيره','الجزيرة']],
  ['alarabiya.svg', ['al arabiya','alarabiya','العربيه','العربية']],
  ['national-geographic.svg', ['national geographic','nat geo','ناشونال جيوغرافيك']],
  ['spacetoon.svg', ['spacetoon','space toon','سبيستون']],
  ['majid.svg', ['majid','ماجد']],
  ['cbc.svg', ['cbc','سي بي سي']],
  ['dmc.svg', ['dmc','دي ام سي','دي إم سي']],
  ['dubai.svg', ['dubai','دبي']],
  ['mtv-lebanon.svg', ['mtv lebanon','mtv','ام تي في','ام تي في لبنان']],
  ['lbci.svg', ['lbc international','lbci','lbc','ال بي سي','ال بي سي اي']],
  ['al-jadeed.svg', ['al jadeed','الجديد','الجديد اللبنانية']],
  ['otv-lebanon.svg', ['otv lebanon','otv','او تي في']],
  ['nbn.svg', ['nbn','ان بي ان']],
  ['tele-liban.svg', ['tele liban','télé liban','lebanon tv','تلفزيون لبنان','تيلي لبنان']],
  ['arabica-tv.svg', ['arabica tv','arabica','عربيكا']],
  ['hawacom-tv.svg', ['hawacom','hawa com','هواكم']],
  ['jaras-tv.svg', ['jaras tv','jaras','جرس']],
  ['roya.svg', ['roya','رؤيا','رويا']]
];

function logoSrc(name) {
  for (const [file, keys] of LOGO_RULES) if (containsAny(name, keys)) return 'images/logos/' + file;
  return 'assets/images-hq/32-image-32-e0425f2812.svg';
}

function logoHtml(name) {
  return '<div class="station-logo station-logo-img-wrap"><img class="station-logo-img" src="' + esc(logoSrc(name)) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'assets/images-hq/32-image-32-e0425f2812.svg\';"></div>';
}

function frequencyTrustInfo(item){
  const sourceUrl = item && (item.officialSourceUrl || item.sourceAuditUrl || item.sourceUrl || '');
  const checked = item && (item.lastCheckedDisplay || item.verifiedOn || item.encryptionLastChecked || (item.lastCheckedAt ? String(item.lastCheckedAt).slice(0,10) : ''));
  const sourceText = item && (item.source || item.sourceLastUpdated || (Array.isArray(item.classificationSources) ? item.classificationSources.join(' / ') : ''));
  let level = 'low';
  let label = 'بحاجة متابعة';
  if (sourceUrl && checked) { level = 'high'; label = 'ثقة عالية'; }
  else if (sourceUrl || checked || sourceText) { level = 'medium'; label = 'ثقة متوسطة'; }
  return { level, label, checked: checked || '', source: sourceText || '', sourceUrl: sourceUrl || '' };
}

function frequencyTrustBadgesHtml(item){
  const info = frequencyTrustInfo(item || {});
  const bits = ['<span class="frequency-trust-badge '+esc(info.level)+'" title="'+esc(info.source || info.sourceUrl || info.label)+'">✓ '+esc(info.label)+'</span>'];
  if (info.checked) bits.push('<span class="frequency-trust-badge" title="آخر فحص للتردد أو المصدر">آخر فحص: '+esc(info.checked)+'</span>');
  if (info.sourceUrl) bits.push('<span class="frequency-trust-badge" title="يوجد رابط مصدر أو تدقيق محفوظ">مصدر محفوظ</span>');
  return '<div class="frequency-trust-row">' + bits.join('') + '</div>';
}

function renderStationCards(rows, mode) {
  const container = document.getElementById('stationSearchResults');
  if (!container) return;
  if (mode.type === 'all' && !String(mode.raw || '').trim() && getFrequencyServiceFilter() === 'all') {
    container.innerHTML = '';
    container.classList.remove('active');
    return;
  }
  const entries = [];
  const seen = new Set();
  rows.forEach(row => {
    (Array.isArray(row.channels) ? row.channels : matchingChannels(row.item, mode)).forEach(name => {
      const key = normalizeText([name, row.item.frequency, row.item.pol, row.item.sr].join('|'));
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ name, item: row.item });
    });
  });
  if (!entries.length) {
    container.innerHTML = '<div class="station-empty">لا توجد محطة مطابقة. جرّب اسم القناة أو التردد.</div>';
    container.classList.add('active');
    return;
  }
  function meta(label, value){ return '<span><em>'+esc(label)+'</em><strong>'+esc(value || '-')+'</strong></span>'; }
  const displayedEntries = entries.slice(0, STATION_CARD_LIMIT);
  const cards = displayedEntries.map(e => '<article class="station-card station-frequency-card">' +
    logoHtml(e.name) + '<div class="station-info"><h3>' + esc(e.name) + '</h3><div class="station-encryption-row">' + channelEncryptionBadgeHtml(e.name, e.item) + '</div>' + frequencyTrustBadgesHtml(e.item) + '<div class="station-meta station-frequency-meta">' +
    [meta('القمر:', satelliteLabel(e.item.satelliteGroup || '')), meta('المدار:', e.item.orbitalSlot || e.item.orbit || '-'), meta('التردد:', e.item.frequency), meta('الاستقطاب:', e.item.pol), meta('SR:', e.item.sr), meta('FEC:', e.item.fec), meta('النظام:', [e.item.system,e.item.mod].filter(Boolean).join(' / '))].join('') +
    '</div></div></article>').join('');
  const titles = { frequency:'نتائج التردد', package:'فلتر باقة دقيق', namedChannel:'نتائج اسم القناة', category:(mode.category === 'christian' ? 'القنوات المسيحية المطابقة' : 'نتائج التصنيف'), country:'نتائج الدولة', countryCategory:'نتائج الدولة والتصنيف', countryPackage:'نتائج الدولة والباقة', free:'نتائج البحث' };
  const serviceFilter = getFrequencyServiceFilter();
  const titleText = serviceFilter !== 'all' ? (FREQUENCY_SERVICE_FILTER_LABELS[serviceFilter] || 'نتائج البحث') : (titles[mode.type] || 'نتائج البحث');
  container.innerHTML = '<div class="station-results-head"><strong>' + esc(titleText) + '</strong><div class="station-results-head-side"><span>' + entries.length + ' قناة</span></div></div><div class="station-results-grid">' + cards + '</div>';
  container.classList.add('active');
}


function sortedEntriesByCount(map, preferredOrder) {
  return Array.from(map.entries()).sort((a, b) => {
    const ai = preferredOrder.indexOf(a[0]);
    const bi = preferredOrder.indexOf(b[0]);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return b[1] - a[1];
  });
}

function buildAutomaticFrequencyFilters() {
  const packageSelect = document.getElementById('frequencyAutoPackage');
  const categorySelect = document.getElementById('frequencyAutoCategory');
  if (!packageSelect && !categorySelect) return;

  const packageCounts = new Map();
  const categoryCounts = new Map();
  const seenPackageChannel = new Set();
  const seenCategoryChannel = new Set();

  DATA.forEach(item => {
    splitChannels(item).forEach(channel => {
      Object.keys(PACKAGE_KEYWORDS).forEach(pkg => {
        if (!channelInPackage(channel, item, pkg)) return;
        const key = pkg + '|' + normalizeText(channel);
        if (seenPackageChannel.has(key)) return;
        seenPackageChannel.add(key);
        packageCounts.set(pkg, (packageCounts.get(pkg) || 0) + 1);
      });
      Object.keys(CATEGORY_LABELS).forEach(cat => {
        if (!channelInCategory(channel, cat, item)) return;
        const key = cat + '|' + normalizeText(channel);
        if (seenCategoryChannel.has(key)) return;
        seenCategoryChannel.add(key);
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      });
    });
  });

  if (packageSelect) {
    const current = packageSelect.value;
    const preferred = ['bein','bein-sports','osn','ssc','mbc','rotana','mix','noursat','thmanyah'];
    packageSelect.innerHTML = '<option value="">الكل</option>' + sortedEntriesByCount(packageCounts, preferred).map(([id, count]) => '<option value="' + esc(id) + '">' + esc(PACKAGE_LABELS[id] || id) + ' (' + count + ')</option>').join('');
    packageSelect.value = current;
  }

  if (categorySelect) {
    const current = categorySelect.value;
    const preferred = ['quran','religion','christian','sports','kids','movies','series','news','documentary','music','cooking','education','radio','shopping','general'];
    categorySelect.innerHTML = '<option value="">الكل</option>' + sortedEntriesByCount(categoryCounts, preferred).map(([id, count]) => '<option value="' + esc(id) + '">' + esc(CATEGORY_LABELS[id] || id) + ' (' + count + ')</option>').join('');
    categorySelect.value = current;
  }
}

window.setFrequencyAutoPackage = function(value){
  const id = String(value || '').trim();
  if (!id) return window.clearFrequencySearch();
  window.setFrequencyPackageExact(id, PACKAGE_LABELS[id] || id);
};

window.setFrequencyAutoCategory = function(value){
  const id = String(value || '').trim();
  if (!id) return window.clearFrequencySearch();
  exactPackageMode = null;
  const pkgSelect = document.getElementById('frequencyAutoPackage');
  if (pkgSelect) pkgSelect.value = '';
  const input = document.getElementById('frequencySearch');
  if (input) { input.value = CATEGORY_LABELS[id] || id; input.focus(); }
  frequencyVisibleLimit = FREQUENCY_SEARCH_LIMIT;
  window.renderFrequencies();
};

window.setFrequencyPackageExact = function(id, label){
  exactPackageMode = String(id || '').trim() || null;
  const input = document.getElementById('frequencySearch');
  const categorySelect = document.getElementById('frequencyAutoCategory');
  if (categorySelect) categorySelect.value = '';
  if (input) { input.value = label || exactPackageMode || ''; input.focus(); }
  frequencyVisibleLimit = FREQUENCY_SEARCH_LIMIT;
  window.renderFrequencies();
};

window.setFrequencyCategory = function(value){
  exactPackageMode = null;
  const input = document.getElementById('frequencySearch');
  const packageSelect = document.getElementById('frequencyAutoPackage');
  if (packageSelect) packageSelect.value = '';
  if (input) { input.value = String(value || ''); input.focus(); }
  frequencyVisibleLimit = FREQUENCY_SEARCH_LIMIT;
  window.renderFrequencies();
};

window.clearFrequencySearch = function(){
  exactPackageMode = null;
  const input = document.getElementById('frequencySearch');
  const packageSelect = document.getElementById('frequencyAutoPackage');
  const categorySelect = document.getElementById('frequencyAutoCategory');
  const serviceSelect = document.getElementById('frequencyServiceFilter');
  if (packageSelect) packageSelect.value = '';
  if (categorySelect) categorySelect.value = '';
  if (serviceSelect) serviceSelect.value = 'all';
  if (input) { input.value = ''; input.focus(); }
  frequencyVisibleLimit = FREQUENCY_INITIAL_LIMIT;
  window.renderFrequencies();
};

function updateActiveFrequencyFilters(mode){
  const packageSelect = document.getElementById('frequencyAutoPackage');
  const categorySelect = document.getElementById('frequencyAutoCategory');
  if (packageSelect) packageSelect.value = mode.type === 'package' ? (mode.package || '') : '';
  if (categorySelect) categorySelect.value = mode.type === 'category' ? (mode.category || '') : '';
}

window.renderFrequencies = function(){
  if (frequencyRenderFrame) cancelAnimationFrame(frequencyRenderFrame);
  frequencyRenderFrame = requestAnimationFrame(renderFrequenciesNow);
};

window.showMoreFrequencies = function(){
  frequencyVisibleLimit += 60;
  window.renderFrequencies();
};

function scheduleFrequencySearch(){
  clearTimeout(frequencySearchTimer);
  frequencySearchTimer = setTimeout(function(){
    frequencyVisibleLimit = FREQUENCY_SEARCH_LIMIT;
    window.renderFrequencies();
  }, FREQUENCY_SEARCH_DEBOUNCE_MS);
}

const FAILED_SEARCH_MIN_LENGTH = 3;
const FAILED_SEARCH_DEBOUNCE_MS = 2200;
let failedSearchTimer = 0;
let failedSearchLastKey = '';
function failedSearchEndpoint(){
  if (window.MAEN_SEARCH_FEEDBACK_ENDPOINT) return window.MAEN_SEARCH_FEEDBACK_ENDPOINT;
  if (location.hostname.indexOf('pages.dev') > -1) return '/api/search-feedback';
  return 'https://maensat.pages.dev/api/search-feedback';
}
function scheduleFailedSearchLog(query, mode, selected, serviceFilter, rowCount){
  clearTimeout(failedSearchTimer);
  const clean = String(query || '').trim().replace(/\s+/g,' ');
  if (rowCount > 0 || clean.length < FAILED_SEARCH_MIN_LENGTH) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return;
  const date = new Date().toISOString().slice(0,10);
  const key = [date, compactText(clean).slice(0,80), selected || 'all', serviceFilter || 'all'].join('|');
  if (key === failedSearchLastKey) return;
  try { if (localStorage.getItem('maen_failed_search_' + key)) return; } catch(e) {}
  failedSearchLastKey = key;
  failedSearchTimer = setTimeout(function(){
    try { localStorage.setItem('maen_failed_search_' + key, '1'); } catch(e) {}
    const payload = {
      query: clean.slice(0,80),
      mode: mode && mode.type || 'free',
      satellite: selected || 'all',
      serviceFilter: serviceFilter || 'all',
      page: location.pathname + location.search + location.hash,
      ts: new Date().toISOString()
    };
    fetch(failedSearchEndpoint(), {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      keepalive:true,
      credentials:'omit'
    }).catch(function(){});
  }, FAILED_SEARCH_DEBOUNCE_MS);
}

function renderFrequenciesNow(){
  const tbody = document.getElementById('frequencyTableBody');
  if (!tbody) return;
  const selected = (document.getElementById('frequencySatellite')?.value || 'all');
  const query = (document.getElementById('frequencySearch')?.value || '').trim();
  const serviceFilter = getFrequencyServiceFilter();
  if (!query) exactPackageMode = null;
  const mode = getSearchMode(query);
  const searchActive = !!query || !!exactPackageMode || serviceFilter !== 'all';
  const effectiveSelected = selected !== 'all' ? selected : (mode.satellite || selected);
  const tableWrap = tbody.closest('.frequency-table-wrap');
  if (tableWrap) tableWrap.classList.toggle('frequency-search-hidden', searchActive);
  updateActiveFrequencyFilters(mode);

  const rows = [];
  for (let index = 0; index < DATA.length; index++) {
    const item = DATA[index];
    if (!satelliteAllowed(item, effectiveSelected)) continue;
    if (!itemMatchesMode(item, mode)) continue;
    const serviceChannels = applyFrequencyServiceFilter(matchingChannels(item, mode), item, serviceFilter);
    if (!serviceChannels.length) continue;
    rows.push({ item, index, channels: serviceChannels, score: mode.type === 'all' ? (100000 - index) : rowScore(item, mode, index) });
  }
  if (mode.type !== 'all') rows.sort((a, b) => b.score - a.score);

  const baseLimit = mode.type === 'all' ? FREQUENCY_INITIAL_LIMIT : FREQUENCY_SEARCH_LIMIT;
  const activeLimit = Math.max(baseLimit, frequencyVisibleLimit || 0);
  const visibleRows = rows.slice(0, activeLimit);

  tbody.innerHTML = visibleRows.map(row => {
    const item = row.item;
    const channels = Array.isArray(row.channels) ? row.channels : matchingChannels(item, mode);
    const visible = channels.slice(0, 10).map(ch => channelChipHtml(ch, item, '')).join('');
    const hidden = channels.slice(10).map(ch => channelChipHtml(ch, item, 'channel-extra')).join('');
    const chHtml = channels.length ? '<div class="frequency-row-trust">' + frequencyTrustBadgesHtml(item) + '</div><div class="channels-cell">' + visible + hidden + (channels.length > 10 ? '<button type="button" class="show-more-channels" onclick="toggleChannelList(this)">عرض المزيد (' + (channels.length - 10) + ')</button>' : '') + '</div>' : '<div class="channels-missing">لا توجد محطات مطابقة داخل هذا التردد</div>';
    return '<tr><td><span class="frequency-badge">' + esc(satelliteLabel(item.satelliteGroup || '')) + '</span></td><td>' + esc(physicalSatelliteLabel(item)) + '</td><td>' + esc(item.frequency || '') + '</td><td>' + esc(item.pol || '') + '</td><td>' + esc(item.sr || '') + '</td><td>' + esc(item.fec || '') + '</td><td>' + esc([item.system || '', item.mod || ''].filter(Boolean).join(' / ')) + '</td><td>' + chHtml + '</td></tr>';
  }).join('');

  renderStationCards(searchActive ? rows : visibleRows, mode);
  scheduleFailedSearchLog(query, mode, effectiveSelected, serviceFilter, rows.length);
  const empty = document.getElementById('frequencyEmpty');
  if (empty) empty.classList.toggle('active', rows.length === 0);
}


function buildSearchSuggestions(){
  const suggestions = [];
  const seen = new Set();
  function add(type, value, meta, keywords, weight, satelliteBlob){
    const label = String(value || '').trim();
    if (!label) return;
    const key = type + '|' + compactText(label) + '|' + compactText(satelliteBlob || 'global');
    if (seen.has(key)) return;
    seen.add(key);
    const blob = [label, meta || '', keywords || ''].join(' ');
    suggestions.push({
      type,
      value: label,
      meta: meta || '',
      keywords: keywords || '',
      weight: weight || 0,
      satelliteBlob: satelliteBlob || '',
      _valueCompact: compactText(label),
      _blobNorm: normalizeText(blob),
      _blobCompact: compactText(blob)
    });
  }

  Object.keys(CATEGORY_LABELS).forEach(id => add('category', CATEGORY_LABELS[id], 'تصنيف', (CATEGORY_KEYWORDS[id] || []).join(' '), 500));
  Object.keys(PACKAGE_LABELS).forEach(id => add('package', PACKAGE_LABELS[id], 'باقة', (PACKAGE_KEYWORDS[id] || []).join(' '), 600));
  Object.keys(COUNTRY_KEYWORDS).forEach(id => add('country', (COUNTRY_KEYWORDS[id] || [id])[0], 'دولة', (COUNTRY_KEYWORDS[id] || []).join(' '), 420));

  const channelCounts = new Map();
  const channelMeta = new Map();
  const freqSeen = new Set();
  DATA.forEach(item => {
    const sat = satelliteLabel(item.satelliteGroup || item.satellite || item.orbit || '');
    const satBlob = satelliteSearchBlob(item);
    const freqKey = String(item.frequency || '') + '|' + compactText(satBlob);
    if (item.frequency && !freqSeen.has(freqKey)) {
      freqSeen.add(freqKey);
      add('frequency', String(item.frequency), 'تردد MHz · ' + sat, [item.pol, item.sr, sat].filter(Boolean).join(' '), 350, satBlob);
    }
    splitChannels(item).forEach(ch => {
      const key = compactText(ch);
      if (!key) return;
      channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
      if (!channelMeta.has(key)) channelMeta.set(key, { name: ch, sat, aliases: getChannelAliases(ch, item).join(' '), satelliteBlob: satBlob, satelliteLabels: new Set([sat]) });
      else {
        const info = channelMeta.get(key);
        info.satelliteBlob = [info.satelliteBlob, satBlob].filter(Boolean).join(' ');
        if (info.satelliteLabels) info.satelliteLabels.add(sat);
      }
    });
  });
  Array.from(channelCounts.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0, 900)
    .forEach(([key,count]) => {
      const info = channelMeta.get(key);
      if (!info) return;
      const sats = info.satelliteLabels ? Array.from(info.satelliteLabels).slice(0, 3).join(' / ') : info.sat;
      add('channel', info.name, 'قناة · ' + sats + (count > 1 ? ' · ' + count + ' ترددات' : ''), info.aliases, 700 + Math.min(count, 8) * 30, info.satelliteBlob);
    });
  return suggestions;
}

let cachedSearchSuggestions=[];
function suggestionScore(s,term){
  const q = String(term || '').trim();
  if (q.length < 2) return 0;
  const nq = normalizeText(q);
  const cq = compactText(q);
  if (!cq) return 0;
  const cv = s._valueCompact || compactText(s.value);
  const nb = s._blobNorm || normalizeText([s.value, s.meta, s.keywords].join(' '));
  const cb = s._blobCompact || compactText([s.value, s.meta, s.keywords].join(' '));
  let score = 0;

  if (cv === cq) score += 2200;
  else if (cv.startsWith(cq)) score += 1200;
  else if (cq.length >= 3 && cv.includes(cq)) score += 720;
  else if (nb.includes(nq) || (cq.length >= 3 && cb.includes(cq))) score += 520;
  queryTokens(q).slice(0, 4).forEach(t => {
    const tc = compactText(t);
    if (tc.length >= 2 && cb.includes(tc)) score += 120;
  });

  if (!score && s.type === 'frequency' && /^\d{2,6}$/.test(cq) && cv.startsWith(cq)) score += 900;
  if (!score) return 0;
  score += s.weight || 0;
  if (s.type === 'channel') score += 160;
  if (s.type === 'frequency' && /^\d{3,6}$/.test(cq)) score += 1200;
  return score;
}
function getSearchSuggestions(term){
  const q = String(term || '').trim();
  if (q.length < 2) return [];
  if (!cachedSearchSuggestions.length) cachedSearchSuggestions = buildSearchSuggestions();
  const selected = (document.getElementById('frequencySatellite')?.value || 'all');
  const out = [];
  for (let i = 0; i < cachedSearchSuggestions.length; i++) {
    const s = cachedSearchSuggestions[i];
    if (!suggestionAllowedForSelectedSatellite(s, selected)) continue;
    const score = suggestionScore(s, q);
    if (score > 0) out.push(Object.assign({ score }, s));
  }
  return out.sort((a,b) => b.score - a.score).slice(0, 10);
}
function hideFrequencySuggestions(){const box=document.getElementById('frequencySearchSuggest');if(!box)return;box.classList.remove('active');box.innerHTML='';}
function suggestionTypeLabel(type){return ({channel:'قناة',frequency:'تردد',package:'باقة',category:'تصنيف',country:'دولة'}[type]||'اقتراح');}
function suggestionTypeIcon(type){return ({channel:'📺',frequency:'📡',package:'⭐',category:'🔎',country:'🌍'}[type]||'•');}
function renderFrequencySuggestions(){
  const box=document.getElementById('frequencySearchSuggest');
  const input=document.getElementById('frequencySearch');
  if(!box||!input)return;
  const term=(input.value||'').trim();
  const items=getSearchSuggestions(term);
  if(!items.length){hideFrequencySuggestions();return;}
  box.innerHTML=items.map(function(s){
    const suggestionValue = esc(JSON.stringify(String(s.value || '')));
    return '<button type="button" class="frequency-suggest-item" role="option" onmousedown="event.preventDefault();window.applyFrequencySuggestion('+suggestionValue+')">'
      +'<span class="frequency-suggest-icon">'+esc(suggestionTypeIcon(s.type))+'</span>'
      +'<span class="frequency-suggest-main"><strong>'+esc(s.value)+'</strong><small>'+esc(s.meta||'اقتراح بحث ذكي')+'</small></span>'
      +'<span class="frequency-suggest-type">'+esc(suggestionTypeLabel(s.type))+'</span>'
      +'</button>';
  }).join('');
  box.classList.add('active');
}
function scheduleFrequencySuggestions(){
  clearTimeout(frequencySuggestionTimer);
  frequencySuggestionTimer=setTimeout(renderFrequencySuggestions,FREQUENCY_SUGGEST_DEBOUNCE_MS);
}
window.applyFrequencySuggestion=function(value){const input=document.getElementById('frequencySearch');if(input){input.value=String(value || '');input.focus();}exactPackageMode=null;hideFrequencySuggestions();frequencyVisibleLimit=FREQUENCY_SEARCH_LIMIT;window.renderFrequencies();};

function initFrequencyFeature(){if(initFrequencyFeature.done)return;initFrequencyFeature.done=true;
  Promise.resolve(loadLiveFrequencyData()).finally(function(){
    buildAutomaticFrequencyFilters();
    cachedSearchSuggestions = buildSearchSuggestions();
    // Warm up cached channel lists once so typing stays responsive.
    DATA.forEach(splitChannels);
    const input = document.getElementById('frequencySearch');
    if (input) {
      input.value = '';
      input.defaultValue = '';
      input.setAttribute('placeholder', 'ابحث داخل القمر المختار باسم القناة أو التردد...');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', function(){ exactPackageMode = null; scheduleFrequencySuggestions(); scheduleFrequencySearch(); });
      input.addEventListener('focus', scheduleFrequencySuggestions);
      input.addEventListener('blur', function(){ setTimeout(hideFrequencySuggestions, 180); });
      input.addEventListener('keydown', function(e){ if (e.key === 'Escape') hideFrequencySuggestions(); });
    }
    const sat = document.getElementById('frequencySatellite');
    if (sat) sat.addEventListener('change', function(){ frequencyVisibleLimit = FREQUENCY_INITIAL_LIMIT; hideFrequencySuggestions(); window.renderFrequencies(); scheduleFrequencySuggestions(); });
    const serviceSelect = document.getElementById('frequencyServiceFilter');
    if (serviceSelect) serviceSelect.addEventListener('change', function(){ frequencyVisibleLimit = FREQUENCY_SEARCH_LIMIT; hideFrequencySuggestions(); window.renderFrequencies(); });
    setTimeout(function(){ window.renderFrequencies(); }, 0);
  });
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initFrequencyFeature);}else{initFrequencyFeature();}
})();

;

// Override lazy loader since scripts are already embedded
window._embeddedScriptsLoaded = true;

;

function shareSite(){var shareData={title:'معن حنونة للستلايت',text:'موقع معن حنونة للستلايت-أجهزة رسيفرات، ستلايت ولواقط، تركيب وصيانة.',url:window.location.href};if(navigator.share){navigator.share(shareData).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(window.location.href).then(function(){alert('تم نسخ رابط الموقع');});}else{alert('انسخ رابط الصفحة من المتصفح لمشاركته');}}const translations={"معن حنونة للستلايت":"Maen Hanouneh Satellite","بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت طوال أيام الأسبوع والأعياد":"Sales,maintenance,installation,and programming of all satellite systems all week and on holidays","✨ بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت طوال أيام الأسبوع والأعياد":"✨ Sales,maintenance,installation,and programming of all satellite systems all week and on holidays","أجهزة الرسيفرات":"Receivers","الستلايت واللواقط":"Satellite & LNBs","التركيب والصيانة":"Installation & Maintenance","من أعمالنا":"Our Work","تواصل معنا":"Contact Us","دخول القسم":"Open Section","واتساب":"WhatsApp","واتساب الآن":"WhatsApp Now","اتصال مباشر":"Call Now","فيس بوك":"Facebook","صفحتنا على فيس بوك":"Our Facebook Page","الإيميل":"Email","الخدمات":"Services","نخدمكم بالفحيص وعمان الغربية والسلط":"We serve Fuheis,West Amman,and Salt","نخدمكم بالفحيص وعمان الغربية والسلط السرو":"We serve Fuheis,West Amman,Salt,and Al-Saru","نخدمكم بالفحيص وعمان الغربية والسلط والسرو":"We serve Fuheis,West Amman,Salt,and Al-Saru","لماذا تختارنا؟":"Why Choose Us?","خدمة واضحة وسريعة وقريبة منك":"Clear,fast service near you","استجابة سريعة":"Fast Response","نتابع طلبك عبر واتساب أو الاتصال المباشر ونحدد الخدمة المناسبة حسب موقعك.":"We follow up through WhatsApp or direct call and recommend the right service based on your location.","تركيب وصيانة وبرمجة":"Installation,Maintenance & Programming","نخدم أنظمة الستلايت والرسيفرات واللواقط والتمديدات طوال أيام الأسبوع والأعياد.":"We service satellite systems,receivers,LNBs,and wiring throughout the week and on holidays.","مناطق خدمة واسعة":"Wide Service Areas","الفحيص، دابوق، الحمر، السرو، صويلح، مرج الحمام، وعمان الغربية.":"Fuheis,Dabouq,Al-Hummar,Al-Saru,Sweileh,Marj Al-Hamam,and West Amman.","كل طرق التواصل في مكان واحد":"All contact methods in one place","اختر الطريقة المناسبة لك:واتساب للاستفسار السريع، اتصال مباشر، فيس بوك، أو إيميل.":"Choose the best way to reach us:WhatsApp,direct call,Facebook,or email.","اضغط هنا لفتح واتساب برسالة جاهزة.":"Click to open WhatsApp with a ready message.","للزبائن من الموبايل أو التابلت، اضغط للاتصال فوراً.":"For mobile or tablet users,click to call directly.","تابع صفحتنا وشاهد التحديثات.":"Follow our page and see updates.","اضغط هنا لفتح رسالة بريد إلكتروني جاهزة.":"Click to open a ready email message.","صفحة مستقلة لعرض جميع الأجهزة مع الصور عالية الجودة، الأسعار، والتفاصيل. اضغط على صورة أي جهاز لتكبير البروشور وقراءة المعلومات كاملة.":"A dedicated page for receivers with high-quality photos,prices,and details. Click any image to enlarge the brochure and read the full information.","صفحة مستقلة لعرض اللواقط، الدايزك، أطباق الاستقبال، وقطع الستلايت. اضغط على صورة أي منتج لتكبير البروشور وقراءة التفاصيل كاملة.":"A dedicated page for LNBs,DiSEqC switches,satellite dishes,and satellite accessories. Click any product image to enlarge the brochure and read the details.","ملاحظة:الأسعار قابلة للتغيير حسب التوفر والعروض. الرجاء التواصل للتأكيد قبل الطلب.":"Note:Prices may change depending on availability and offers. Please contact us to confirm before ordering.","متوفر":"Available","السعر":"Price","بدون سعر":"No price listed","اطلب الآن":"Order Now","استفسار":"Ask","حسب الموديل":"Depends on model","للطلب والاستفسار":"For orders and inquiries","تواصل معنا لمعرفة التوفر والتفاصيل حسب الموديل.":"Contact us to check availability and details by model.","هل تريد قطع ستلايت أو لواقط؟":"Need satellite parts or LNBs?","تواصل معنا على واتساب لمعرفة تفاصيل المنتجات المتوفرة.":"Contact us on WhatsApp to check available products.","نقدّم خدمات تركيب وصيانة وبرمجة أنظمة الستلايت، ضبط الإشارة، تركيب اللواقط، فحص التمديدات، وتجهيز الرسيفرات حسب الحاجة.":"We provide satellite installation,maintenance and programming,signal adjustment,LNB installation,wiring checks,and receiver setup as needed.","خدماتنا في التركيب والصيانة":"Our Installation & Maintenance Services","نقدم خدمة ميدانية لتركيب وصيانة أنظمة الستلايت والرسيفرات، ضبط الإشارة، تركيب الأطباق واللواقط،\n فحص الأعطال، تبديل القطع المناسبة، وترتيب القنوات حسب طلب الزبون.":"We provide on-site satellite and receiver installation and maintenance,signal adjustment,dish and LNB installation,troubleshooting,parts replacement,and channel organization upon request.","تركيب ستلايت":"Satellite Installation","صيانة أعطال":"Troubleshooting","ضبط إشارة":"Signal Adjustment","تركيب لواقط":"LNB Installation","فحص تمديدات":"Wiring Check","برمجة رسيفرات":"Receiver Programming","اطلب الخدمة عبر واتساب":"Request Service on WhatsApp","شاهد من أعمالنا":"See Our Work","المناطق التي نخدمها":"Service Areas","يمكننا تقديم خدمة التركيب والصيانة في المناطق التالية:":"We provide installation and maintenance service in the following areas:","الفحيص":"Fuheis","دابوق":"Dabouq","الحمر":"Al-Hummar","السرو":"Al-Saru","صويلح":"Sweileh","مرج الحمام":"Marj Al-Hamam","عمان الغربية بجميع مناطقها":"West Amman-all areas","أسئلة شائعة":"FAQ","أسئلة قد تهمك":"Questions You May Have","إجابات مختصرة تساعد الزبون قبل التواصل معنا.":"Short answers to help customers before contacting us.","هل تعملون أيام الجمعة والأعياد؟":"Do you work on Fridays and holidays?","نعم، نقدم خدمات بيع وصيانة وتركيب وبرمجة أنظمة الستلايت طوال أيام الأسبوع والأعياد حسب التوفر والموعد.":"Yes,we provide sales,maintenance,installation,and programming of satellite systems all week and on holidays depending on availability and scheduling.","هل تقدمون خدمة في عمان الغربية؟":"Do you serve West Amman?","نعم، نخدم عمان الغربية بجميع مناطقها، بالإضافة إلى الفحيص ودابوق والحمر والسرو وصويلح ومرج الحمام.":"Yes,we serve all West Amman areas,in addition to Fuheis,Dabouq,Al-Hummar,Al-Saru,Sweileh,and Marj Al-Hamam.","هل يمكن فحص ضعف الإشارة؟":"Can you check weak signal problems?","نعم، يمكن فحص الإشارة، اتجاه الطبق، اللواقط، التمديدات، والدايزك لمعرفة سبب المشكلة.":"Yes,we can check the signal,dish direction,LNBs,wiring,and DiSEqC switch to identify the issue.","هل يمكن طلب جهاز أو لاقط عبر واتساب؟":"Can I order a receiver or LNB by WhatsApp?","نعم، اضغط على زر واتساب الخاص بالمنتج، وستظهر رسالة جاهزة باسم المنتج المطلوب.":"Yes,click the product WhatsApp button and a ready message with the product name will appear.","نماذج حقيقية من أعمال التركيب والصيانة":"Real Examples of Our Installation & Maintenance Work","صور حقيقية من أعمال التركيب والصيانة، تركيب أطباق الستلايت، ضبط اللواقط، ترتيب التمديدات، وتجهيز نقاط التوزيع. اضغط على أي صورة لتكبيرها.":"Real photos from our installation and maintenance work:satellite dish installation,LNB adjustment,organized wiring,and distribution point setup. Click any photo to enlarge it.","عمل ميداني رقم 1":"Field Work #1","عمل ميداني رقم 2":"Field Work #2","عمل ميداني رقم 3":"Field Work #3","عمل ميداني رقم 4":"Field Work #4","عمل ميداني رقم 5":"Field Work #5","عمل ميداني رقم 6":"Field Work #6","عمل ميداني رقم 7":"Field Work #7","عمل ميداني رقم 8":"Field Work #8","عمل ميداني رقم 9":"Field Work #9","عمل ميداني رقم 10":"Field Work #10","أعجبتك أعمالنا؟":"Like Our Work?","تواصل معنا عبر واتساب أو اتصال مباشر لطلب خدمة التركيب والصيانة.":"Contact us by WhatsApp or direct call to request installation and maintenance service.","إغلاق":"Close","رجوع":"Back","مشاركة الموقع":"Share Website","الفحيص • عمان الغربية • السلط • السرو":"Fuheis • West Amman • Salt • Al-Saru","اتصال":"Call","الصيانة":"Maintenance","الأجهزة":"Devices","اللواقط":"LNBs","أعمالنا":"Our Work","سوفتوير":"Software","الترددات":"Frequencies","العربية":"Arabic","الرئيسية":"Home","سوفتويرات الأجهزة":"Device Software","ترددات القنوات":"Channel Frequencies","📞 اتصال مباشر":"📞 Direct Call","خدمة طوال الأسبوع":"Service All Week","حتى أيام العطل والأعياد":"Even on holidays","تواصل مباشر":"Direct Contact","واتساب واتصال بضغطة واحدة":"WhatsApp and calls in one tap","صور وبروشورات":"Photos & Brochures","تكبير واضح لكل منتج":"Clear zoom for every product","الدخول إلى صفحة خاصة بعرض الأجهزة والصور والأسعار.":"Open a dedicated page for devices, photos, and prices.","الدخول إلى صفحة خاصة بعرض اللواقط وقطع الستلايت.":"Open a dedicated page for LNBs and satellite parts.","شاهد أعمالنا أولاً ثم تفاصيل خدمات التركيب والصيانة في الفحيص ودابوق والحمر والسرو وصويلح ومرج الحمام وعمان الغربية.":"See our work first, then installation and maintenance details in Fuheis, Dabouq, Al-Hummar, Al-Saru, Sweileh, Marj Al-Hamam, and West Amman.","صور حقيقية من أعمال التركيب والصيانة وتركيب أطباق الستلايت واللواقط.":"Real photos from installation, maintenance, satellite dish, and LNB work.","بحث سريع في ترددات نايل سات وعرب سات مع روابط المصادر الرسمية للتحديث.":"Quick search in Nilesat and Arabsat frequencies with official update sources.","روابط تحديثات الرسيفرات من مواقع الشركات الرسمية فقط.":"Receiver update links from official company websites only.","اختر الطريقة المناسبة لك: واتساب للاستفسار السريع، اتصال مباشر، فيس بوك، أو إيميل.":"Choose the best contact method: WhatsApp for quick questions, direct call, Facebook, or email.","ملاحظة: الأسعار قابلة للتغيير حسب التوفر والعروض. الرجاء التواصل للتأكيد قبل الطلب.":"Note: prices may change depending on availability and offers. Please contact us to confirm before ordering.","تحتاج تركيب أو صيانة؟":"Need installation or maintenance?","أرسل موقعك ونوع المشكلة على واتساب، أو اتصل مباشرة على نفس الرقم.":"Send your location and issue on WhatsApp, or call the same number directly.","تصفية وبحث سريع":"Quick Filter & Search","اكتب اسم الجهاز أو اختر الشركة لعرض النتائج مباشرة.":"Type the device name or choose the brand to show results instantly.","كل الشركات":"All brands","ابحث عن جهاز...":"Search for a device...","بحث عن جهاز":"Device search","تصفية أجهزة الرسيفرات":"Receiver device filter","جهاز SPIDER مميز مع خدمات متعددة وريموت بلوتوث.":"Premium SPIDER receiver with multiple services and a Bluetooth remote.","رسيفر 5G يدعم WiFi Mobile وخدمات مشاهدة متعددة.":"5G receiver with WiFi Mobile and multiple viewing services.","جهاز Majestic مع WiFi Built-in و LAN وذاكرة 2 RAM / 16 Flash.":"Majestic receiver with built-in WiFi, LAN, and 2 RAM / 16 Flash memory.","رسيفر بتصميم أبيض أنيق مع WiFi 5G وريموت بلوتوث.":"Receiver with an elegant white design, 5G WiFi, and a Bluetooth remote.","إصدار أسود يدعم WiFi 5G ومجموعة تطبيقات IPTV.":"Black edition with 5G WiFi and a set of IPTV apps.","جهاز صغير عملي مع إمكانية إضافة كود VIP للقنوات الرياضية.":"Compact practical receiver with optional VIP code for sports channels.","رسيفر 5G بوايرلس داخلي ومدخل إنترنت ويوتيوب وريموت بلوتوث.":"5G receiver with built-in wireless, Ethernet port, YouTube, and Bluetooth remote.","رسيفر Majestic ذهبي عملي مع WiFi ويوتيوب وDQ Cam.":"Practical gold Majestic receiver with WiFi, YouTube, and DQ Cam.","رسيفر Gazal Royal 5G بخدمات متعددة ووايرلس داخلي.":"Gazal Royal 5G receiver with multiple services and built-in wireless.","رسيفر Gazal 8080 Turbo 5G عملي مع وايرلس داخلي.":"Practical Gazal 8080 Turbo 5G receiver with built-in wireless.","ابحث عن لاقط، دايزك، أو طبق استقبال.":"Search for an LNB, DiSEqC, or satellite dish.","ابحث عن منتج...":"Search for a product...","بحث عن منتج ستلايت":"Satellite product search","تصفية منتجات الستلايت":"Satellite product filter","كل المنتجات":"All products","لاقط غزال G1":"Gazal G1 LNB","لاقط غزال KL-212A":"Gazal KL-212A LNB","لاقط Gazal Super KL-415A":"Gazal Super KL-415A LNB","لاقط غزال Super KL-812A":"Gazal Super KL-812A LNB","دايزك غزال سوبر KL-41C":"Gazal Super KL-41C DiSEqC","طبق استقبال Gazal 4K":"Gazal 4K Satellite Dish","Universal Single LNB - Digital Ku-Band لأداء ثابت وجودة عالية في استقبال الإشارة.":"Universal Single LNB - Digital Ku-Band for stable performance and high-quality signal reception.","مخرج واحد · Ku-Band · 4K · LTE Protected":"Single output · Ku-Band · 4K · LTE Protected","Universal Twin LNB بمخرجين لإشارة ثابتة وجودة عالية.":"Universal Twin LNB with two outputs for a stable, high-quality signal.","مخرجين Twin · Ku-Band · 4K · High Gain":"Twin outputs · Ku-Band · 4K · High Gain","Universal Quad LNB بأربعة مخارج لاستقبال قوي وثابت.":"Universal Quad LNB with four outputs for strong, stable reception.","4 مخارج · Ku-Band · LTE · صناعة أردنية":"4 outputs · Ku-Band · LTE · Jordanian-made","Universal Octo LNB بثمانية مخارج لتوزيع الإشارة على عدة أجهزة.":"Universal Octo LNB with eight outputs for distributing signal to several receivers.","8 مخارج · Full HD · 4K · توزيع مثالي":"8 outputs · Full HD · 4K · Ideal distribution","مفتاح DiSEqC 4x1 بجودة عالية لتبديل الإشارة بين عدة لواقط.":"High-quality DiSEqC 4x1 switch for switching signal between multiple LNBs.","طبق استقبال 4K بجودة عالية وتصميم عملي مناسب للاستقبال الفضائي.":"High-quality 4K satellite dish with a practical design for satellite reception.","طبق 4K · سهل التركيب · هيكل متين · طقم كامل":"4K dish · Easy installation · Strong body · Full kit","نقدم خدمة ميدانية لتركيب وصيانة أنظمة الستلايت والرسيفرات، ضبط الإشارة، تركيب الأطباق واللواقط، فحص الأعطال، تبديل القطع المناسبة، وترتيب القنوات حسب طلب الزبون.":"We provide field service for satellite and receiver installation and maintenance, signal adjustment, dish and LNB installation, troubleshooting, part replacement, and channel sorting as requested.","تركيب طبقين ستلايت على السور الخارجي مع تثبيت احترافي وضبط اتجاه الإشارة.":"Installing two satellite dishes on an outdoor wall with professional mounting and signal alignment.","تنفيذ عملي لتركيب طبقين ستلايت مع مخرجات جاهزة وتمديدات مرتبة.":"Practical installation of two satellite dishes with ready outputs and organized wiring.","من أعمالنا في تثبيت الأطباق وضبط اللواقط على أسطح المباني.":"From our work in mounting dishes and adjusting LNBs on rooftops.","تنسيق أكثر من طبق ستلايت مع مراعاة زاوية الالتقاط وثبات التركيب.":"Arranging multiple satellite dishes while maintaining reception angle and mounting stability.","تركيب طبقين ستلايت مع تنظيم الكوابل وتجهيز نقطة التوزيع.":"Installing two satellite dishes with cable organization and distribution point setup.","تجهيز نظام ستلايت مزدوج مع علبة توزيع وترتيب التوصيلات بشكل آمن.":"Preparing a dual satellite system with a distribution box and safe wiring organization.","تنفيذ عملي آخر لتركيب الأطباق مع تثبيت قوي وتمديدات منظمة.":"Another practical dish installation with strong mounting and organized wiring.","لقطة إضافية من أعمالنا في تركيب الأطباق وربطها مع صندوق التوزيع.":"Additional shot from our work installing dishes and connecting them to the distribution box.","من أعمالنا في تركيب عدة أطباق ستلايت مع لواقط متعددة المخارج.":"From our work installing multiple satellite dishes with multi-output LNBs.","تنفيذ ميداني لتركيب ثلاثة أطباق ستلايت مع تمديدات مرتبة ومثبتة جيداً.":"Field installation of three satellite dishes with organized and well-secured wiring.","صورة من أعمال التركيب والصيانة رقم 1":"Installation and maintenance work photo #1","صورة من أعمال التركيب والصيانة رقم 2":"Installation and maintenance work photo #2","صورة من أعمال التركيب والصيانة رقم 3":"Installation and maintenance work photo #3","صورة من أعمال التركيب والصيانة رقم 4":"Installation and maintenance work photo #4","صورة من أعمال التركيب والصيانة رقم 5":"Installation and maintenance work photo #5","صورة من أعمال التركيب والصيانة رقم 6":"Installation and maintenance work photo #6","صورة من أعمال التركيب والصيانة رقم 7":"Installation and maintenance work photo #7","صورة من أعمال التركيب والصيانة رقم 8":"Installation and maintenance work photo #8","صورة من أعمال التركيب والصيانة رقم 9":"Installation and maintenance work photo #9","صورة من أعمال التركيب والصيانة رقم 10":"Installation and maintenance work photo #10","اضغط لتكبير الصورة":"Click to enlarge image","رابط مباشر لموقع Spider الرسمي لاختيار موديل الرسيفر وتحميل ملف التحديث المناسب.":"Direct link to the official Spider website to choose the receiver model and download the proper update file.","سوفتويرات أجهزة Spider":"Spider Device Software","تحديثات الموديلات المتوفرة":"Available model updates","ملفات قنوات حسب توفر الشركة":"Channel files depending on company availability","الدخول إلى Spider":"Open Spider","مكتبة Gazal الرسمية للوصول إلى تحديثات الأجهزة وملفات الرسيفرات المتاحة من الشركة.":"Official Gazal library for device updates and receiver files available from the company.","سوفتويرات أجهزة Gazal":"Gazal Device Software","ملفات القنوات الرسمية":"Official channel files","ملفات التنظيف حسب الموديل":"Clean files by model","الدخول إلى Gazal":"Open Gazal","رابط مباشر لموقع Infinity SAT الرسمي لمراجعة التحديثات والملفات الخاصة بالأجهزة.":"Direct link to the official Infinity SAT website to check updates and files for the devices.","تحديثات أجهزة Infinity":"Infinity Device Updates","ملفات سوفتوير رسمية":"Official software files","اختيار الملف حسب الموديل":"Choose the file by model","الدخول إلى Infinity":"Open Infinity","روابط سوفتويرات الأجهزة الرسمية":"Official device software links","روابط مباشرة للموبايل":"Direct mobile links","بطاقات مواقع سوفتويرات الأجهزة للكمبيوتر":"Device software website cards for desktop","قائمة القنوات":"Channel List","كل الأقمار":"All satellites","نايل سات":"Nilesat","عرب سات":"Arabsat","بدر سات":"Badr Sat","مسح":"Clear","تردد متاح للبحث.":"Frequency available for search.","7W نايل سات / يوتلسات":"7W Nilesat / Eutelsat","تمت إعادة بنائها من المصادر الحديثة":"Rebuilt from recent sources","8W يوتلسات":"8W Eutelsat","26E بدر":"26E Badr","25.5E سهيل":"25.5E Es'hail","القمر":"Satellite","المدار":"Orbit","التردد MHz":"Frequency MHz","الاستقطاب":"Polarity","أسماء المحطات داخل التردد":"Channels inside this frequency","لا توجد نتائج مطابقة للبحث الحالي.":"No results match the current search.","العودة إلى الصفحة الرئيسية":"Back to Home","اختيار القمر":"Choose satellite","بحث ذكي في الترددات":"Smart frequency search","© 2026 معن حنونة للستلايت — نخدمكم بالفحيص وعمان الغربية والسلط السرو":"© 2026 Maen Hanouneh Satellite — Serving Fuheis, West Amman, Salt, and Al-Saru","متوافق مع أجهزة الكمبيوتر واللابتوب والتابلت والأندرويد والآيفون وجميع المتصفحات الحديثة":"Compatible with desktops, laptops, tablets, Android, iPhone, and all modern browsers","السلة":"Cart","سلة الطلبات":"Order Cart","السلة فارغة حالياً":"Your cart is currently empty","المجموع":"Total","أضف للسلة":"Add to Cart","اطلب الآن عبر واتساب":"Order Now via WhatsApp","تفريغ السلة":"Clear Cart","الكمية":"Qty","سعر القطعة":"Unit price","الإجمالي":"Subtotal","المجموع التقريبي":"Estimated total","السلة فارغة":"The cart is empty","تم نسخ رابط الموقع":"Website link copied","انسخ رابط الصفحة من المتصفح لمشاركته":"Copy the page link from your browser to share it","صورة":"Image","15 د.أ":"15 JOD","20 د.أ":"20 JOD","25 د.أ":"25 JOD","35 د.أ":"35 JOD","40 د.أ":"40 JOD","50 د.أ":"50 JOD","55 د.أ":"55 JOD","60 د.أ":"60 JOD","شعار معن حنونة للستلايت":"Maen Hanouneh Satellite logo","شريط الموبايل المختصر":"Compact mobile bar","قائمة أقسام الموقع للموبايل":"Mobile site sections menu","القائمة الرئيسية":"Main menu","تعريف معن حنونة للستلايت للكمبيوتر":"Maen Hanouneh Satellite desktop intro"};Object.assign(translations,{"العربية":"Arabic","الدخول إلى صفحة خاصة بعرض الأجهزة والصور والأسعار.":"Open a dedicated page showing receiver devices,photos,and prices.","الدخول إلى صفحة خاصة بعرض اللواقط وقطع الستلايت.":"Open a dedicated page for LNBs and satellite accessories.","شاهد أعمالنا أولاً ثم تفاصيل خدمات التركيب والصيانة في الفحيص ودابوق والحمر والسرو وصويلح ومرج الحمام وعمان الغربية.":"View our work first,then see installation and maintenance service details for Fuheis,Dabouq,Al-Hummar,Al-Saru,Sweileh,Marj Al-Hamam,and West Amman.","صور حقيقية من أعمال التركيب والصيانة وتركيب أطباق الستلايت واللواقط.":"Real photos from installation and maintenance work,including satellite dishes and LNBs.","جهاز SPIDER مميز مع خدمات متعددة وريموت بلوتوث.":"A premium SPIDER receiver with multiple services and a Bluetooth remote.","50 د.أ":"50 JOD","25 د.أ":"25 JOD","55 د.أ":"55 JOD","60 د.أ":"60 JOD","15 د.أ":"15 JOD","40 د.أ":"40 JOD","رسيفر 5G يدعم WiFi Mobile وخدمات مشاهدة متعددة.":"A 5G receiver that supports mobile WiFi and multiple viewing services.","جهاز Majestic مع WiFi Built-in و LAN وذاكرة 2 RAM/16 Flash.":"A Majestic receiver with built-in WiFi,LAN,and 2 RAM/16 Flash memory.","رسيفر بتصميم أبيض أنيق مع WiFi 5G وريموت بلوتوث.":"An elegant white receiver with 5G WiFi and a Bluetooth remote.","إصدار أسود يدعم WiFi 5G ومجموعة تطبيقات IPTV.":"A black edition receiver supporting 5G WiFi and IPTV applications.","جهاز صغير عملي مع إمكانية إضافة كود VIP للقنوات الرياضية.":"A compact practical receiver with the option to add a VIP code for sports channels.","رسيفر 5G بوايرلس داخلي ومدخل إنترنت ويوتيوب وريموت بلوتوث.":"A 5G receiver with built-in wireless,internet port,YouTube,and Bluetooth remote.","لاقط غزال G1":"Gazal G1 LNB","Universal Single LNB-Digital Ku-Band لأداء ثابت وجودة عالية في استقبال الإشارة.":"Universal Single LNB-Digital Ku-Band for stable performance and high-quality signal reception.","مخرج واحد · Ku-Band · 4K · LTE Protected":"Single Output · Ku-Band · 4K · LTE Protected","لاقط غزال KL-212A":"Gazal KL-212A LNB","Universal Twin LNB بمخرجين لإشارة ثابتة وجودة عالية.":"Universal Twin LNB with two outputs for stable,high-quality signal reception.","مخرجين Twin · Ku-Band · 4K · High Gain":"Twin Output · Ku-Band · 4K · High Gain","لاقط Gazal Super KL-415A":"Gazal Super KL-415A LNB","Universal Quad LNB بأربعة مخارج لاستقبال قوي وثابت.":"Universal Quad LNB with four outputs for strong and stable reception.","4 مخارج · Ku-Band · LTE · صناعة أردنية":"4 Outputs · Ku-Band · LTE · Jordanian Made","لاقط غزال Super KL-812A":"Gazal Super KL-812A LNB","Universal Octo LNB بثمانية مخارج لتوزيع الإشارة على عدة أجهزة.":"Universal Octo LNB with eight outputs for distributing signal to multiple receivers.","8 مخارج · Full HD · 4K · توزيع مثالي":"8 Outputs · Full HD · 4K · Ideal Distribution","دايزك غزال سوبر KL-41C":"Gazal Super KL-41C DiSEqC","مفتاح DiSEqC 4x1 بجودة عالية لتبديل الإشارة بين عدة لواقط.":"High-quality DiSEqC 4x1 switch for switching signal between multiple LNBs.","طبق استقبال Gazal 4K":"Gazal 4K Satellite Dish","طبق استقبال 4K بجودة عالية وتصميم عملي مناسب للاستقبال الفضائي.":"A high-quality 4K satellite dish with a practical design for satellite reception.","طبق 4K · سهل التركيب · هيكل متين · طقم كامل":"4K Dish · Easy Installation · Durable Body · Complete Kit","تحتاج تركيب أو صيانة؟":"Need installation or maintenance?","أرسل موقعك ونوع المشكلة على واتساب، أو اتصل مباشرة على نفس الرقم.":"Send your location and issue on WhatsApp,or call the same number directly.","نقدم خدمة ميدانية لتركيب وصيانة أنظمة الستلايت والرسيفرات، ضبط الإشارة، تركيب الأطباق واللواقط، فحص الأعطال، تبديل القطع المناسبة، وترتيب القنوات حسب طلب الزبون.":"We provide field service for installing and maintaining satellite systems and receivers,signal adjustment,dish and LNB installation,troubleshooting,replacing suitable parts,and arranging channels upon request.","تركيب طبقين ستلايت على السور الخارجي مع تثبيت احترافي وضبط اتجاه الإشارة.":"Installing two satellite dishes on an exterior wall with professional mounting and signal direction adjustment.","تنفيذ عملي لتركيب طبقين ستلايت مع مخرجات جاهزة وتمديدات مرتبة.":"Practical installation of two satellite dishes with ready outputs and organized wiring.","من أعمالنا في تثبيت الأطباق وضبط اللواقط على أسطح المباني.":"From our work in mounting satellite dishes and adjusting LNBs on rooftops.","تنسيق أكثر من طبق ستلايت مع مراعاة زاوية الالتقاط وثبات التركيب.":"Arranging multiple satellite dishes while considering reception angle and stable mounting.","تركيب طبقين ستلايت مع تنظيم الكوابل وتجهيز نقطة التوزيع.":"Installing two satellite dishes with organized cables and a prepared distribution point.","تجهيز نظام ستلايت مزدوج مع علبة توزيع وترتيب التوصيلات بشكل آمن.":"Preparing a dual satellite system with a distribution box and safe wiring organization.","تنفيذ عملي آخر لتركيب الأطباق مع تثبيت قوي وتمديدات منظمة.":"Another practical dish installation with strong mounting and organized wiring.","لقطة إضافية من أعمالنا في تركيب الأطباق وربطها مع صندوق التوزيع.":"An additional shot from our work installing dishes and connecting them to the distribution box.","من أعمالنا في تركيب عدة أطباق ستلايت مع لواقط متعددة المخارج.":"From our work installing several satellite dishes with multi-output LNBs.","تنفيذ ميداني لتركيب ثلاثة أطباق ستلايت مع تمديدات مرتبة ومثبتة جيداً.":"Field installation of three satellite dishes with neat and well-secured wiring.","© 2026 معن حنونة للستلايت — نخدمكم بالفحيص وعمان الغربية والسلط السرو":"© 2026 Maen Hanouneh Satellite — We serve Fuheis,West Amman,Salt,and Al-Saru","متوافق مع أجهزة الكمبيوتر واللابتوب والتابلت والأندرويد والآيفون وجميع المتصفحات الحديثة":"Compatible with computers,laptops,tablets,Android,iPhone,and all modern browsers","📞 اتصال مباشر":"📞 Call Now","صور حقيقية من أعمال التركيب والصيانة، تركيب أطباق الستلايت، ضبط اللواقط، ترتيب التمديدات، وتجهيز نقاط التوزيع. اضغط على أي صورة لتكبيرها.":"Real photos from installation and maintenance work,including satellite dish installation,LNB adjustment,organized wiring,and distribution point setup. Click any image to enlarge it.","حلول الستلايت والرسيفرات في الفحيص وعمان الغربية والسلط":"Satellite and receiver solutions in Fuheis,West Amman,and Salt","عمل ميداني رقم 1":"Field Work #1","عمل ميداني رقم 2":"Field Work #2","عمل ميداني رقم 3":"Field Work #3","عمل ميداني رقم 4":"Field Work #4","عمل ميداني رقم 5":"Field Work #5","عمل ميداني رقم 6":"Field Work #6","عمل ميداني رقم 7":"Field Work #7","عمل ميداني رقم 8":"Field Work #8","عمل ميداني رقم 9":"Field Work #9","عمل ميداني رقم 10":"Field Work #10"});Object.assign(translations,{"القائمة الرئيسية":"Main Menu","الرئيسية":"Home","نخدمكم بالفحيص وعمان الغربية والسلط السرو":"We serve Fuheis,West Amman,Salt,and Al-Saru"});if(typeof translations !=='undefined'){Object.assign(translations,{"تصفية وبحث سريع":"Quick Search & Filter","اكتب اسم الجهاز أو اختر الشركة لعرض النتائج مباشرة.":"Type the receiver name or choose the brand to show results instantly.","ابحث عن جهاز...":"Search for a receiver...","كل الشركات":"All brands","ابحث عن لاقط، دايزك، أو طبق استقبال.":"Search for an LNB,DiSEqC,or satellite dish.","ابحث عن منتج...":"Search for a product...","كل المنتجات":"All products","تكبير":"Zoom","خدمة طوال الأسبوع":"Service All Week","حتى أيام العطل والأعياد":"Including holidays","تواصل مباشر":"Direct Contact","واتساب واتصال بضغطة واحدة":"WhatsApp and calls in one tap","صور وبروشورات":"Photos & Brochures","تكبير واضح لكل منتج":"Clear zoom for every product","لا توجد نتائج مطابقة للبحث الحالي.":"No results match your current search."});}if(typeof translations !=='undefined'){Object.assign(translations,{"العودة إلى الصفحة الرئيسية":"Back to Home"});}if(typeof translations !=='undefined'){Object.assign(translations,{"ترددات القنوات":"Channel Frequencies","بحث سريع في ترددات نايل سات وعرب سات مع روابط المصادر الرسمية للتحديث.":"Quick search for Nilesat and Arabsat frequencies with official source links for updates.","قائمة القنوات":"Nilesat and Arabsat Frequency List","قائمة محدثة قابلة للبحث والتصفية تضم 166 ترددًا من قاعدة البيانات الحالية، منها 96 ترددًا على مدار نايل سات/7W و70 ترددًا/باقة على مدار عرب سات/Badr، مع روابط المصادر الرسمية للتأكد قبل البرمجة.":"A searchable frequency section based on the current database of 166 entries,with official source links for verification before programming.","ملاحظة مهمة:":"Important note:","الترددات قد تتغير من وقت لآخر. هذه القائمة مدمجة داخل الملف للاستخدام السريع، ويُفضّل التأكد من المصدر الرسمي قبل البرمجة.":"Frequencies may change from time to time. Use this as an initial list and check the official source links before programming.","مصدر نايل سات الرسمي":"Official Nilesat Source","مصدر عرب سات الرسمي":"Official Arabsat Source","كل الأقمار":"All Satellites","نايل سات":"Nilesat","عرب سات":"Arabsat","ابحث باسم المحطة أو التردد ±5 أو القمر...":"Search by channel or frequency...","القمر":"Satellite","القناة/الباقة":"Channel/Package","التردد":"Frequency","الاستقطاب":"Polarity","معدل الترميز":"Symbol Rate","ملاحظات":"Notes","لا توجد نتائج مطابقة للبحث الحالي.":"No results match your current search.","راجع المصدر":"Check source","قائمة مبدئية":"Initial list","قائمة مبدئية، تأكد من المصدر الرسمي قبل البرمجة":"Initial list;verify with the official source before programming"});}if(typeof translations !=='undefined'){Object.assign(translations,{"قائمة محدثة قابلة للبحث والتصفية تضم 166 ترددًا من قاعدة البيانات الحالية، منها 96 ترددًا على مدار نايل سات/7W و70 ترددًا/باقة على مدار عرب سات/Badr، مع روابط المصادر الرسمية للتأكد قبل البرمجة.":"An updated searchable and filterable list with 166 entries:96 Nilesat/7W entries and 70 Arabsat/Badr entries/packages. Frequencies may change,so official source links remain available for verification before programming.","الترددات قد تتغير من وقت لآخر. هذه القائمة مدمجة داخل الملف للاستخدام السريع، ويُفضّل التأكد من المصدر الرسمي قبل البرمجة.":"Frequencies may change from time to time. This list is embedded in the file for quick use,and it is recommended to verify with the official source before programming.","داخل الملف الآن:":"Inside this file now:","تردد نايل سات/7W":"Nilesat channels","تردد/باقة عرب سات/Badr.":"Arabsat/Badr channels/packages."});}if(typeof translations !=='undefined'){Object.assign(translations,{"قائمة ترددات أقمار مدار نايل سات وعرب سات":"Frequency List for Nilesat and Arabsat Orbital Positions","":"Nilesat orbital position 7° West","":"Arabsat/Badr orbital position 26° East","قائمة محدثة قابلة للبحث والتصفية تضم 166 ترددًا من قاعدة البيانات الحالية، منها 96 ترددًا على مدار نايل سات/7W و70 ترددًا/باقة على مدار عرب سات/Badr، مع روابط المصادر الرسمية للتأكد قبل البرمجة.":"An updated searchable and filterable list covering the Nilesat 7°W orbital position and Arabsat/Badr positions. The current database includes 166 entries:96 Nilesat/7W entries and 70 Arabsat/Badr entries/packages,with official source links for verification before programming."});}if(typeof translations !=='undefined'){Object.assign(translations,{"قائمة من الملف المرفق":"Live update from external sources","يعتمد الموقع على ملف frequencies.json قابل للتحديث التلقائي، ويحاول أيضًا جلب قائمة من الملف المرفق عند توفر الإنترنت.":"The site will try to load the latest channels for 7.1W/8.0W/26.0E/25.5E when internet is available.","إعادة عرض القائمة":"Update now","كل المدارات المطلوبة":"All requested orbital positions"});}if(typeof translations !=='undefined'){Object.assign(translations,{"يعتمد الموقع على ملف frequencies.json قابل للتحديث التلقائي، ويحاول أيضًا جلب قائمة من الملف المرفق عند توفر الإنترنت.":"The site uses an auto-updatable frequencies.json file and also tries live external updates when internet is available.","تعذر تحميل frequencies.json من المتصفح، سيتم استخدام القائمة الاحتياطية المدمجة. عند رفع الموقع على استضافة سيعمل الملف الخارجي بشكل طبيعي.":"The browser could not load frequencies.json,so the embedded backup list will be used. Once hosted,the external file should work normally."});}if(typeof translations !=='undefined'){Object.assign(translations,{"قائمة القنوات":"Frequency/Transponder List from Uploaded File","قائمة من الملف المرفق":"List from Uploaded File","إعادة عرض القائمة":"Reload List","تم حذف قائمة المحطات السابقة واعتماد ترددات/ترانسبوندرات الملف المرفق فقط.":"The previous channel list was removed and only the uploaded frequency/transponder list is used.","":"Frequency/transponder list from the uploaded file,used to scan all channels on the requested orbital positions. Enter the frequencies in the receiver or run Blind Scan/Network Scan.","أسماء المحطات مدمجة للترددات التي توفر لها ربط سابق، وقد تتغير يوميًا. استخدم الترددات للمسح الكامل عند الحاجة.":"This list has been fully replaced from the uploaded file. Channel names may change daily,so it is best to use these frequencies for a full receiver scan.","المدار/القمر":"Orbit/Satellite","التردد MHz":"Frequency MHz","معدل الترميز SR":"Symbol Rate SR","القمر/ملاحظات":"Satellite/Notes","ابحث باسم المحطة أو التردد ±5 أو القمر...":"Search by frequency,orbit,or system...","تردد على 7.1W/7W":"Frequencies on 7.1W/7W","تردد على 8.0W":"Frequencies on 8.0W","تردد على 26.0E":"Frequencies on 26.0E","تردد على 25.5E":"Frequencies on 25.5E"});}if(typeof translations !=='undefined'){Object.assign(translations,{"قائمة القنوات":"Frequencies with Channel Names by Satellite","":"The list is split into Nilesat,Arabsat,and Badr,with available channel names linked inside each frequency. Frequencies without linked channel names can be scanned using Blind Scan/Network Scan.","أسماء المحطات مدمجة للترددات التي توفر لها ربط سابق، وقد تتغير يوميًا. استخدم الترددات للمسح الكامل عند الحاجة.":"Channel names are embedded for frequencies where a previous match was available. They may change daily,so use frequencies for full scanning when needed.","كل الأقمار":"All Satellites","نايل سات":"Nilesat","عرب سات":"Arabsat","بدر":"Badr","القمر":"Satellite","المدار":"Orbit","أسماء المحطات داخل التردد":"Channel Names inside Frequency","عرض المزيد":"Show more","إخفاء":"Hide","لا توجد أسماء محطات مربوطة لهذا التردد — استخدم Blind Scan/Network Scan":"No linked channel names for this frequency — use Blind Scan/Network Scan","تردد نايل سات":"Nilesat frequencies","تردد عرب سات":"Arabsat frequencies","تردد بدر":"Badr frequencies","منها تحتوي أسماء محطات":"with channel names"});}if(typeof translations !=='undefined'){Object.assign(translations,{"ابحث باسم المحطة أو التردد ±5 أو القمر...":"Search by frequency ±5,channel name,or satellite...","داخل الملف الآن:":"Inside this file now:","مع اعتماد مطابقة التردد ±5 MHz.":"using ±5 MHz frequency matching."});}if(typeof translations !=='undefined'){Object.assign(translations,{"ابحث باسم المحطة أو التردد ±5 أو القمر...":"Search by channel name,frequency ±5,or satellite...","نتائج المحطات المطابقة":"Matching Station Results","محطة":"stations","لا توجد محطة مطابقة مباشرة. جرّب البحث بالتردد أو نفّذ Blind Scan/Network Scan لهذا التردد.":"No directly matching station. Try searching by frequency or run Blind Scan/Network Scan for this frequency.","تم عرض أول 80 نتيجة":"Showing the first 80 results","خصّص البحث أكثر لنتائج أدق.":"Refine your search for more accurate results.","القمر:":"Satellite:","المدار:":"Orbit:","التردد:":"Frequency:","الاستقطاب:":"Polarity:","النظام:":"System:"});}if(typeof translations !=='undefined'){Object.assign(translations,{"جاري تحميل الشعارات الحقيقية من الإنترنت...":"Loading real logos from the internet...","تم تحميل الشعارات الحقيقية لـ":"Real logos loaded for","محطة":"stations","جاري تجهيز الشعارات...":"Preparing logos..."});}if(typeof translations !=='undefined'){Object.assign(translations,{"سيتم جلب شعارات القنوات الحقيقية من الإنترنت عند البحث، مع عرض الاسم الأصلي والاسم العربي للمحطة. إذا لم يتوفر شعار رسمي يبقى الشعار النصي كبديل.":"Real channel logos will be loaded from the internet when searching,with both the original and Arabic station name shown. If no official logo is available,the text logo remains as a fallback."});}if(typeof translations !=='undefined'){Object.assign(translations,{"سوفتويرات الأجهزة":"Receiver Software","روابط تحديثات الرسيفرات من مواقع الشركات الرسمية فقط.":"Receiver update links by brand and model from official or trusted sources.","تحديثات الرسيفرات حسب الشركة والموديل":"Receiver Updates by Brand and Model","ابحث باسم الشركة أو الموديل، ثم افتح موقع الشركة الرسمي فقط لتحميل آخر تحديث متوفر. يفضّل دائمًا التأكد من رقم الموديل والهاردوير قبل التحديث.":"Search by brand or model,then open the relevant source to download the latest available update. Always verify the model and hardware version before updating.","تنبيه قبل التحديث:":"Update warning:","لا تقم بتحميل سوفتوير إلا بعد مطابقة اسم الجهاز ورقم الموديل والهاردوير. تحديث خاطئ قد يؤدي إلى توقف الجهاز.":"Do not install firmware unless the device name,model number,and hardware version match. A wrong update may damage the receiver.","كل الشركات":"All brands","ابحث باسم الجهاز أو الموديل...":"Search by device or model...","ربط مع مصادر التحديث":"Linked update sources","الأزرار تفتح مواقع الشركات الرسمية فقط للحصول على آخر تحديث متوفر وقت التحميل.":"Buttons open company pages or firmware libraries so you can get the latest available update at download time.","تحديث العرض":"Refresh view","فتح المصدر":"Open source","تأكد من رقم الموديل والهاردوير قبل التحديث.":"Check model and hardware version before updating.","لا توجد نتيجة مطابقة للبحث الحالي.":"No matching software source found.","الدخول إلى Spider":"Open Spider","الدخول إلى Gazal":"Open Gazal","الدخول إلى Infinity":"Open Infinity","رابط مباشر لموقع Spider الرسمي لاختيار موديل الرسيفر وتحميل ملف التحديث المناسب.":"Direct link to Spider's official website to choose the receiver model and download the matching update file.","مكتبة Gazal الرسمية للوصول إلى تحديثات الأجهزة وملفات الرسيفرات المتاحة من الشركة.":"Gazal's official library for available receiver updates and files.","رابط مباشر لموقع Infinity SAT الرسمي لمراجعة التحديثات والملفات الخاصة بالأجهزة.":"Direct link to Infinity SAT's official website for device updates and files.","سوفتويرات أجهزة Spider":"Spider receiver firmware","تحديثات الموديلات المتوفرة":"Available model updates","ملفات قنوات حسب توفر الشركة":"Channel files when available","سوفتويرات أجهزة Gazal":"Gazal receiver firmware","ملفات القنوات الرسمية":"Official channel files","ملفات التنظيف حسب الموديل":"Clean files by model","تحديثات أجهزة Infinity":"Infinity device updates","ملفات سوفتوير رسمية":"Official firmware files","اختيار الملف حسب الموديل":"Choose files by model"});}if(typeof translations !=='undefined'){Object.assign(translations,{"روابط تحديثات الرسيفرات من مواقع الشركات الرسمية فقط.":"Receiver update links from official company websites only.","ابحث باسم الشركة أو الموديل، ثم افتح موقع الشركة الرسمي فقط لتحميل آخر تحديث متوفر. يفضّل دائمًا التأكد من رقم الموديل والهاردوير قبل التحديث.":"Search by brand or model,then open the official company website only to download the latest available update. Always verify the model and hardware version before updating.","الأزرار تفتح مواقع الشركات الرسمية فقط للحصول على آخر تحديث متوفر وقت التحميل.":"Buttons open official company websites only to get the latest available update at download time.","مصادر رسمية فقط:":"Official sources only:","تم حذف أي روابط خارجية مثل مكتبات التحميل العامة أو المنتديات، والإبقاء فقط على مواقع الشركات:Spider و Gazal و Infinity.":"External links such as public download libraries or forums were removed;only company websites remain:Spider,Gazal,and Infinity."});}function translateNodeText(root,lang){var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){if(!node.nodeValue || !node.nodeValue.trim())return NodeFilter.FILTER_REJECT;if(node.parentElement &&['SCRIPT','STYLE'].includes(node.parentElement.tagName))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});var nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(function(node){if(!node.datasetOriginalText){node.datasetOriginalText=node.nodeValue;}var original=node.datasetOriginalText;var trimmed=original.trim();if(lang==='ar'){node.nodeValue=original;}else if(translations[trimmed]){node.nodeValue=original.replace(trimmed,translations[trimmed]);}});}function translateAttributes(lang){var attrs=['alt','title','aria-label'];document.querySelectorAll('[alt],[title],[aria-label]').forEach(function(el){attrs.forEach(function(attr){if(!el.hasAttribute(attr))return;var key='data-original-'+attr;if(!el.hasAttribute(key)){el.setAttribute(key,el.getAttribute(attr));}var original=el.getAttribute(key);var trimmed=(original || '').trim();if(lang==='ar'){el.setAttribute(attr,original);}else if(translations[trimmed]){el.setAttribute(attr,translations[trimmed]);}});});}function setLanguage(lang){localStorage.setItem('siteLang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='en' ? 'ltr':'rtl';document.body.classList.toggle('lang-en',lang==='en');var arBtn=document.getElementById('langArBtn');var enBtn=document.getElementById('langEnBtn');if(arBtn && enBtn){arBtn.classList.toggle('active',lang==='ar');enBtn.classList.toggle('active',lang==='en');}translateNodeText(document.body,lang);translateAttributes(lang);if(typeof setupWhatsAppMessages==='function')setupWhatsAppMessages();if(typeof renderFrequencies==='function')renderFrequencies();if(typeof renderReceiverSoftware==='function')renderReceiverSoftware();}function lockSidebarPosition(){var side=document.querySelector('.side-nav');if(!side)return;if(window.innerWidth>=700){side.style.position='fixed';side.style.top='14px';side.style.left='18px';side.style.width='310px';side.style.height='calc(100vh-28px)';}else{side.style.position='';side.style.top='';side.style.left='';side.style.width='';side.style.height='';}}window.addEventListener('resize',lockSidebarPosition);window.addEventListener('scroll',lockSidebarPosition,{passive:true});function scrollToTopPro(){document.documentElement.scrollTop=0;document.body.scrollTop=0;window.scrollTo({top:0,behavior:'smooth'});}function smartNormalize(value){return String(value || '').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[^\u0600-\u06FFa-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}function smartCompact(value){return smartNormalize(value).replace(/\s+/g,'');}function smartTokens(value){return smartNormalize(value).split(' ').filter(function(t){return t.length>1;});}function smartDistance(a,b){a=smartCompact(a);b=smartCompact(b);if(!a || !b)return 99;if(a===b)return 0;if(Math.abs(a.length-b.length)>3)return 99;var prev=Array(b.length+1).fill(0).map(function(_,i){return i;});for(var i=1;i<=a.length;i++){var cur=[i];for(var j=1;j<=b.length;j++){var cost=a[i-1]===b[j-1]? 0:1;cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);}prev=cur;}return prev[b.length];}function getCardSearchFields(card){var title=card.querySelector('h3')?.textContent || '';var brand=card.getAttribute('data-brand')|| card.querySelector('.brand')?.textContent || '';var desc=card.querySelector('.desc')?.textContent || '';var features=card.querySelector('.features')?.textContent || '';var price=card.querySelector('.price-row strong')?.textContent || '';var all=[title,brand,desc,features,price,card.textContent].join(' ');var aliases=[];var n=smartNormalize(all);if(n.includes('رسيفر')|| n.includes('receiver'))aliases.push('جهاز','رسيفر','ستلايت','receiver','satellite');if(n.includes('لاقط')|| n.includes('lnb'))aliases.push('لاقط','lnb','عين','راس');if(n.includes('طبق')|| n.includes('dish'))aliases.push('طبق','صحن','دش','dish');if(n.includes('spider'))aliases.push('سبايدر','spider');if(n.includes('gazal'))aliases.push('غزال','gazal');if(n.includes('majestic'))aliases.push('ماجستك','majestic');if(n.includes('infinity'))aliases.push('انفنتي','infinity');if(n.includes('5g'))aliases.push('فايف جي','5g');if(n.includes('4k'))aliases.push('فور كي','4k','uhd');return{title:title,brand:brand,desc:desc,features:features,price:price,all:all+' '+aliases.join(' ')};}function smartCardScore(card,query){var q=smartNormalize(query);if(!q)return 1000;var qc=smartCompact(query);var f=getCardSearchFields(card);var title=smartNormalize(f.title),titleC=smartCompact(f.title);var brand=smartNormalize(f.brand),brandC=smartCompact(f.brand);var all=smartNormalize(f.all),allC=smartCompact(f.all);var score=0;if(title===q || titleC===qc)score+=120;if(title.startsWith(q)|| titleC.startsWith(qc))score+=95;if(title.includes(q)||(qc.length>2 && titleC.includes(qc)))score+=80;if(brand===q || brandC===qc)score+=70;if(brand.includes(q)||(qc.length>2 && brandC.includes(qc)))score+=55;if(all.includes(q)||(qc.length>2 && allC.includes(qc)))score+=35;var words=all.split(' ');smartTokens(query).forEach(function(t){var tc=smartCompact(t);if(title.split(' ').some(function(w){return w.startsWith(t);}))score+=25;if(words.some(function(w){return w.startsWith(t);}))score+=14;if(tc.length>=3 && allC.includes(tc))score+=16;var best=Math.min.apply(null,words.slice(0,80).map(function(w){return smartDistance(t,w);}).concat([99]));if(t.length>=4 && best<=1)score+=20;else if(t.length>=5 && best<=2)score+=12;});if((card.textContent || '').includes('متوفر'))score+=4;return score;}function ensureProductSuggestBox(tools){if(!tools)return null;var actions=tools.querySelector('.pro-tools-actions')|| tools;var box=tools.querySelector('.product-smart-suggestions');if(!box){box=document.createElement('div');box.className='product-smart-suggestions';box.setAttribute('role','listbox');box.setAttribute('aria-label','اقتراحات البحث');actions.appendChild(box);}return box;}function hideProductSuggestions(tools){var box=tools && tools.querySelector('.product-smart-suggestions');if(box){box.classList.remove('active');box.innerHTML='';}}function renderProductSuggestions(sectionId){var section=document.getElementById(sectionId);if(!section)return;var tools=section.querySelector('.pro-tools');var input=tools?.querySelector('.pro-search');var box=ensureProductSuggestBox(tools);if(!input || !box)return;var query=input.value.trim();if(!query)return hideProductSuggestions(tools);var cards=Array.from(section.querySelectorAll('.device-card,.satellite-card,.software-card'));var seen=new Set();var suggestions=[];cards.forEach(function(card){var f=getCardSearchFields(card);[f.title,f.brand].concat(String(f.features || '').split('·')).forEach(function(v){v=String(v || '').trim();var key=smartCompact(v);if(!v || key.length<2 || seen.has(key))return;seen.add(key);var fake=document.createElement('div');fake.textContent=v+' '+f.all;suggestions.push({value:v,score:smartCardScore(fake,query),detail:f.brand || 'منتج'});});});suggestions=suggestions.filter(function(s){return s.score>0;}).sort(function(a,b){return b.score-a.score || a.value.length-b.value.length;}).slice(0,8);if(!suggestions.length)return hideProductSuggestions(tools);box.innerHTML=suggestions.map(function(s){return '<button type="button" data-value="'+String(s.value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];})+'"><strong>'+s.value+'</strong><small>'+s.detail+'</small></button>';}).join('');box.classList.add('active');}function bindSmartProductSearch(sectionId){var section=document.getElementById(sectionId);if(!section || section.getAttribute('data-smart-search-ready')==='1')return;section.setAttribute('data-smart-search-ready','1');var tools=section.querySelector('.pro-tools');var input=tools?.querySelector('.pro-search');ensureProductSuggestBox(tools);if(input){input.setAttribute('autocomplete','off');input.addEventListener('input',function(){renderProductSuggestions(sectionId);});input.addEventListener('focus',function(){renderProductSuggestions(sectionId);});input.addEventListener('keydown',function(e){if(e.key==='Escape')hideProductSuggestions(tools);});}tools?.addEventListener('mousedown',function(e){var btn=e.target.closest('.product-smart-suggestions button[data-value]');if(!btn || !input)return;e.preventDefault();input.value=btn.getAttribute('data-value')|| '';hideProductSuggestions(tools);filterProducts(sectionId);});}function filterProducts(sectionId){var section=document.getElementById(sectionId);if(!section)return;bindSmartProductSearch(sectionId);var tools=section.querySelector('.pro-tools');if(!tools)return;var query=(tools.querySelector('.pro-search')?.value || '').trim();var selected=smartNormalize(tools.querySelector('.pro-select')?.value || 'all');var cards=Array.from(section.querySelectorAll('.device-card,.satellite-card,.software-card'));var ranked=cards.map(function(card,index){var f=getCardSearchFields(card);var brand=smartNormalize(f.brand);var fullText=smartNormalize(f.all);var matchesBrand=selected==='all' || brand.includes(selected)|| fullText.includes(selected);var score=!query ? 1000-index:smartCardScore(card,query);return{card:card,index:index,score:score,show:matchesBrand &&(!query || score>0)};}).sort(function(a,b){return b.score-a.score || a.index-b.index;});var visibleCount=0;var grid=section.querySelector('.grid');ranked.forEach(function(row){row.card.classList.toggle('pro-hidden',!row.show);row.card.setAttribute('data-search-score',row.show ? String(row.score):'0');if(row.show && grid)grid.appendChild(row.card);if(row.show)visibleCount++;});if(!grid)return;var empty=grid.querySelector('.pro-empty-state');if(!empty){empty=document.createElement('div');empty.className='pro-empty-state';grid.appendChild(empty);}empty.innerHTML=query ? 'لا توجد نتائج مطابقة لـ<strong>'+query.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];})+'</strong>. جرّب اسم الشركة أو رقم الموديل.':'لا توجد نتائج مطابقة للفلتر الحالي.';empty.classList.toggle('active',visibleCount===0);renderProductSuggestions(sectionId);}function toggleChannelList(button){var cell=button.closest('.channels-cell');if(!cell)return;var expanded=cell.classList.toggle('expanded');if(!button.getAttribute('data-original-text'))button.setAttribute('data-original-text',button.textContent);button.textContent=expanded ? 'إخفاء':button.getAttribute('data-original-text');}window.toggleChannelList=toggleChannelList;function softwareBrandClass(brand){return 'software-brand-'+String(brand || '').toLowerCase().replace(/[^a-z0-9]+/g,'-');}function renderReceiverSoftware(){var container=document.getElementById('softwareResults');if(!container)return;var selected=(document.getElementById('softwareBrandFilter')?.value || 'all').toLowerCase();var query=(document.getElementById('softwareSearch')?.value || '').trim();var rows=receiverSoftwareData.map(function(item,index){var brand=smartNormalize(item.brand || '');var text=smartNormalize([item.brand,item.model,item.latest,item.date,item.source,item.notes].join(' '));var compact=smartCompact(text);var q=smartNormalize(query);var qc=smartCompact(query);var score=!q ? 1000-index:0;if(q && text.includes(q))score+=70;if(q && qc.length>2 && compact.includes(qc))score+=45;smartTokens(query).forEach(function(t){if(text.split(' ').some(function(w){return w.startsWith(t);}))score+=18;var best=Math.min.apply(null,text.split(' ').slice(0,60).map(function(w){return smartDistance(t,w);}).concat([99]));if(t.length>=4 && best<=1)score+=14;});return{item:item,brand:brand,score:score,index:index};}).filter(function(row){var brandOk=selected==='all' || row.brand===selected;var queryOk=!query || row.score>0;return brandOk && queryOk;}).sort(function(a,b){return b.score-a.score || a.index-b.index;}).map(function(row){return row.item;});if(!rows.length){container.innerHTML='<div class="software-empty">'+(document.body.classList.contains('lang-en')? 'No matching software source found.':'لا توجد نتيجة مطابقة للبحث الحالي.')+'</div>';return;}container.innerHTML=rows.map(function(item){var openText=document.body.classList.contains('lang-en')? 'Open source':'فتح المصدر';var noteText=document.body.classList.contains('lang-en')? 'Check model and hardware version before updating.':'تأكد من رقم الموديل والهاردوير قبل التحديث.';return '<article class="software-card '+softwareBrandClass(item.brand)+'">'+'<div class="software-card-head">'+'<span class="software-brand">'+item.brand+'</span>'+'<span class="software-date">'+item.date+'</span>'+'</div>'+'<h3>'+item.model+'</h3>'+'<div class="software-meta">'+'<span>آخر تحديث/معلومة:<strong>'+item.latest+'</strong></span>'+'<span>المصدر:<strong>'+item.source+'</strong></span>'+'</div>'+'<p>'+item.notes+'</p>'+'<div class="software-actions">'+'<a href="'+item.url+'" target="_blank" rel="noopener">'+openText+'</a>'+'<small>'+noteText+'</small>'+'</div>'+'</article>';}).join('');}function setupWhatsAppMessages(){var links=document.querySelectorAll('a[href*="wa.me/962788272988"]');links.forEach(function(link){var msg='مرحبا، أريد الاستفسار من موقع معن حنونة للستلايت.';var card=link.closest('.device-card,.satellite-card,.software-card,.work-card');var title=card ? card.querySelector('h3'):null;var titleText=title ? title.textContent.trim():'';if(card && card.classList.contains('satellite-card')&& titleText){msg='مرحبا، أريد الاستفسار عن منتج الستلايت/اللواقط:'+titleText+'، هل هو متوفر؟';}else if(card && titleText){msg='مرحبا، أريد الاستفسار عن جهاز:'+titleText+'، هل هو متوفر؟';}if(link.closest('#maintenance')){msg='مرحبا، أريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:';}if(link.closest('#works')){msg='مرحبا، شاهدت أعمالكم وأريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:';}if(link.closest('#contact')){msg='مرحبا، أريد التواصل معكم بخصوص خدمات الستلايت والرسيفرات.';}link.href='https://wa.me/962788272988?text='+encodeURIComponent(msg);});}function resetSectionScrollById(id){var page=document.getElementById(id);if(page){page.scrollTop=0;}}function resetActivePageScroll(){var active=document.querySelector('.page.active');if(active){active.scrollTop=0;}document.documentElement.scrollTop=0;document.body.scrollTop=0;}function forceScrollTop(){document.documentElement.scrollTop=0;document.body.scrollTop=0;window.scrollTo(0,0);}var frequencyFeatureLoading=null;function loadScriptOnce(src){return new Promise(function(resolve,reject){var existing=document.querySelector('script[src="'+src+'"]');if(existing){if(existing.dataset.loaded==='true')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}var script=document.createElement('script');script.src=src;script.defer=true;script.dataset.lazyFrequency='true';script.addEventListener('load',function(){script.dataset.loaded='true';resolve();},{once:true});script.addEventListener('error',reject,{once:true});document.body.appendChild(script);});}function loadFrequencyFeature(){if(!frequencyFeatureLoading){frequencyFeatureLoading=Promise.resolve().then(function(){if(typeof window.renderFrequencies==='function'){window.renderFrequencies();}});}return frequencyFeatureLoading;}window.loadFrequencyFeature=loadFrequencyFeature;window.setFrequencyCategory=window.setFrequencyCategory || function(value){loadFrequencyFeature().then(function(){if(typeof window.setFrequencyCategory==='function')window.setFrequencyCategory(value);});};window.setFrequencyPackageExact=window.setFrequencyPackageExact || function(id,label){loadFrequencyFeature().then(function(){if(typeof window.setFrequencyPackageExact==='function')window.setFrequencyPackageExact(id,label);});};function showPage(id,skipHistory){var pages=document.querySelectorAll('.page');pages.forEach(function(page){page.classList.remove('active');});var target=document.getElementById(id);if(target){target.classList.add('active');}if(id==='frequencies'){loadFrequencyFeature();}document.querySelectorAll('[data-nav-target]').forEach(function(btn){btn.classList.toggle('active',btn.getAttribute('data-nav-target')===id);});if(!skipHistory){var newHash='#'+id;if(window.location.hash !==newHash){history.pushState({page:id},'',newHash);}}if(typeof setLanguage==='function'){setLanguage(localStorage.getItem('siteLang')|| 'ar');}resetSectionScrollById(id);resetActivePageScroll();forceScrollTop();requestAnimationFrame(function(){resetActivePageScroll();forceScrollTop();});setTimeout(forceScrollTop,30);setTimeout(forceScrollTop,120);}window.addEventListener('load',function(){var initialPage=(window.location.hash || '#home').replace('#','');if(!document.getElementById(initialPage)){initialPage='home';}history.replaceState({page:initialPage},'','#'+initialPage);showPage(initialPage,true);if(typeof setupWhatsAppMessages==='function'){setupWhatsAppMessages();}if(typeof renderReceiverSoftware==='function'){renderReceiverSoftware();}lockSidebarPosition();resetActivePageScroll();forceScrollTop();setTimeout(function(){resetActivePageScroll();forceScrollTop();},30);});window.addEventListener('popstate',function(event){var page=(event.state && event.state.page)||(window.location.hash || '#home').replace('#','')|| 'home';if(!document.getElementById(page)){page='home';}showPage(page,true);});function openLightbox(src,title){src=String(src||'').replace('/assets/images-optimized/','/assets/images-hq/').replace('assets/images-optimized/','assets/images-hq/');var box=document.getElementById('imageLightbox');var img=document.getElementById('lightboxImage');var text=document.getElementById('lightboxTitle');if(!box || !img || !text)return;img.src=src;img.alt=title || 'صورة';text.textContent=title || 'صورة';box.classList.add('active');document.body.style.overflow='hidden';}function hideLightbox(){var box=document.getElementById('imageLightbox');var img=document.getElementById('lightboxImage');if(!box || !img)return;box.classList.remove('active');img.src='';document.body.style.overflow='';}function closeLightbox(event){if(event.target && event.target.id==='imageLightbox'){hideLightbox();}}document.addEventListener('keydown',function(event){if(event.key==='Escape'){hideLightbox();}});(function(){var PHONE='962788272988';var CART_KEY='maen_sat_store_cart_v1';function readCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)|| '[]');}catch(e){return[];}}function saveCart(cart){localStorage.setItem(CART_KEY,JSON.stringify(cart));updateCartBadge();}function productFromCard(card){var name=card.getAttribute('data-product-name')||(card.querySelector('h3')? card.querySelector('h3').textContent.trim():'منتج');var priceAttr=card.getAttribute('data-product-price');var priceText=priceAttr ||(card.querySelector('.price-row strong')? card.querySelector('.price-row strong').textContent:'0');var price=Number(String(priceText).replace(/[^0-9.]/g,''))|| 0;var image=card.querySelector('.image-wrap img')? card.querySelector('.image-wrap img').getAttribute('src'):'';return{name:name,price:price,image:image,qty:1};}function addToCart(product){var cart=readCart();var found=cart.find(function(x){return x.name===product.name;});if(found){found.qty+=1;}else{cart.push(product);}saveCart(cart);openCart();}window.storeChangeQty=function(name,delta){var cart=readCart();cart=cart.map(function(item){if(item.name===name){item.qty+=delta;}return item;}).filter(function(item){return item.qty>0;});saveCart(cart);renderCart();};window.storeClearCart=function(){saveCart([]);renderCart();};function money(n){return(Math.round(n*100)/100)+' د.أ';}function renderCart(){var list=document.getElementById('storeCartList');var totalEl=document.getElementById('storeCartTotal');if(!list || !totalEl)return;var cart=readCart();if(!cart.length){list.innerHTML='<div class="store-empty">السلة فارغة حالياً</div>';totalEl.textContent=money(0);return;}var total=cart.reduce(function(sum,item){return sum+(item.price*item.qty);},0);list.innerHTML=cart.map(function(item){return '<div class="store-cart-item"><div><strong>'+escapeHtml(item.name)+'</strong><small>'+money(item.price)+' × '+item.qty+'</small></div><div class="store-cart-actions"><button type="button" onclick="storeChangeQty(\''+escapeAttr(item.name)+'\',1)">+</button><button type="button" onclick="storeChangeQty(\''+escapeAttr(item.name)+'\',-1)">−</button></div></div>';}).join('');totalEl.textContent=money(total);}function checkout(){var cart=readCart();if(!cart.length){alert('السلة فارغة');return;}var lines=['مرحبا، أريد تأكيد طلب من موقع معن حنونة للستلايت:'];var total=0;cart.forEach(function(item,index){total+=item.price*item.qty;lines.push((index+1)+'. '+item.name+' | الكمية: '+item.qty+' | سعر القطعة: '+money(item.price)+' | الإجمالي: '+money(item.price*item.qty));});lines.push('المجموع التقريبي: '+money(total));lines.push('الرجاء تأكيد التوفر والسعر النهائي وموعد التسليم/التركيب المناسب.');window.open('https://wa.me/'+PHONE+'?text='+encodeURIComponent(lines.join('\n')),'_blank','noopener');}function escapeHtml(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}function escapeAttr(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}function updateCartBadge(){var badge=document.getElementById('storeCartCount');if(!badge)return;var count=readCart().reduce(function(sum,item){return sum+item.qty;},0);badge.textContent=count;}function openCart(){var p=document.getElementById('storeCartPanel');if(p){renderCart();p.classList.add('active');}}function closeCart(){var p=document.getElementById('storeCartPanel');if(p){p.classList.remove('active');}}window.storeOpenCart=openCart;window.storeCloseCart=closeCart;window.storeCheckout=checkout;function initStore(){if(document.getElementById('storeCartPanel'))return;var float=document.createElement('button');float.type='button';float.className='store-cart-float';float.setAttribute('onclick','storeOpenCart()');float.innerHTML='<svg class="hq-svg-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 10h8l6 31h27l6-21H21" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="53" r="4" fill="currentColor"/><circle cx="48" cy="53" r="4" fill="currentColor"/></svg> السلة<span id="storeCartCount">0</span>';document.body.appendChild(float);var panel=document.createElement('div');panel.id='storeCartPanel';panel.className='store-cart-panel';panel.innerHTML='<div class="store-cart-box"><div class="store-cart-head"><h3>سلة الطلبات</h3><button type="button" class="store-close-btn" onclick="storeCloseCart()">إغلاق</button></div><div id="storeCartList" class="store-cart-list"></div><div class="store-cart-total"><span>المجموع</span><strong id="storeCartTotal">0 د.أ</strong></div><div class="store-cart-footer"><button type="button" class="store-whatsapp-checkout" onclick="storeCheckout()">اطلب الآن عبر واتساب</button><button type="button" class="store-clear-cart" onclick="storeClearCart()">تفريغ السلة</button></div></div>';panel.addEventListener('click',function(e){if(e.target===panel)closeCart();});document.body.appendChild(panel);document.querySelectorAll('#devices .device-card').forEach(function(card){var priceRow=card.querySelector('.price-row');if(!priceRow || card.querySelector('.store-add-btn'))return;var btn=document.createElement('button');btn.type='button';btn.className='store-add-btn';btn.textContent='أضف للسلة';btn.addEventListener('click',function(){addToCart(productFromCard(card));});priceRow.appendChild(btn);});updateCartBadge();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initStore);else initStore();})();

;

// Mobile navigation polish: keep the new bottom bar synced with the active page.
(function(){
  function currentPageId(){
    var active=document.querySelector('.page.active');
    return (active && active.id) || (window.location.hash || '#home').replace('#','') || 'home';
  }
  function syncMobileNav(){
    var id=currentPageId();
    document.querySelectorAll('.mobile-bottom-nav [data-nav-target]').forEach(function(btn){
      btn.classList.toggle('active',btn.getAttribute('data-nav-target')===id);
      if(btn.getAttribute('data-nav-target')===id){btn.setAttribute('aria-current','page');}
      else{btn.removeAttribute('aria-current');}
    });
    if(window.matchMedia && window.matchMedia('(max-width:699px)').matches){
      var active=document.querySelector('.mobile-bottom-nav .mobile-nav-item.active');
      if(active && active.scrollIntoView){
        try{active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}catch(e){active.scrollIntoView(false);}
      }
    }
  }
  var originalShowPage=window.showPage;
  if(typeof originalShowPage==='function' && !window.__mobileShowPageEnhanced){
    window.showPage=function(id,skipHistory){
      var result=originalShowPage.apply(this,arguments);
      setTimeout(syncMobileNav,0);
      return result;
    };
    window.__mobileShowPageEnhanced=true;
  }
  window.addEventListener('load',function(){setTimeout(syncMobileNav,60);});
  window.addEventListener('hashchange',function(){setTimeout(syncMobileNav,0);});
})();

;

(function(){
  function isMobileView(){
    return (window.matchMedia && (
      window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
    ));
  }
  function forceMaintenanceOnMobile(){
    if(!isMobileView()) return;
    var hash=(window.location.hash || '').replace('#','');
    if(!hash || hash === 'home'){
      try{ history.replaceState({page:'maintenance'}, '', '#maintenance'); }catch(e){}
      if(typeof window.showPage === 'function') window.showPage('maintenance', true);
      else {
        document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
        var m=document.getElementById('maintenance'); if(m) m.classList.add('active');
      }
    }
    document.querySelectorAll('.mobile-bottom-nav [data-nav-target="home"]').forEach(function(btn){ btn.remove(); });
    document.querySelectorAll('.mobile-bottom-nav [data-nav-target]').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-nav-target') === ((window.location.hash||'#maintenance').replace('#','')));
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', forceMaintenanceOnMobile);
  else forceMaintenanceOnMobile();
  window.addEventListener('load', function(){ setTimeout(forceMaintenanceOnMobile, 0); setTimeout(forceMaintenanceOnMobile, 120); });
  window.addEventListener('resize', function(){ setTimeout(forceMaintenanceOnMobile, 60); });
})();

;

(function(){
  function isMobileView(){
    return !!(window.matchMedia && (
      window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
    ));
  }
  function syncSoftwarePageClass(){
    var isSoftware = !!document.querySelector('#receiverSoftware.active');
    document.body.classList.toggle('software-page-open', isMobileView() && isSoftware);
  }
  var originalShowPage = window.showPage;
  if(typeof originalShowPage === 'function' && !window.__softwarePageShortHeightWrapped){
    window.showPage = function(id, skipHistory){
      var result = originalShowPage.apply(this, arguments);
      setTimeout(syncSoftwarePageClass, 0);
      setTimeout(syncSoftwarePageClass, 80);
      return result;
    };
    window.__softwarePageShortHeightWrapped = true;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncSoftwarePageClass);
  else syncSoftwarePageClass();
  window.addEventListener('load', function(){ setTimeout(syncSoftwarePageClass, 0); setTimeout(syncSoftwarePageClass, 160); });
  window.addEventListener('resize', function(){ setTimeout(syncSoftwarePageClass, 80); });
  window.addEventListener('hashchange', function(){ setTimeout(syncSoftwarePageClass, 0); });
})();

;

(function(){
  function removeMobileSectionLabels(){
    document.querySelectorAll('.mobile-section-index').forEach(function(el){el.remove();});
    document.querySelectorAll('[data-mobile-section-label]').forEach(function(el){el.removeAttribute('data-mobile-section-label');});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeMobileSectionLabels);
  else removeMobileSectionLabels();
  window.addEventListener('load', removeMobileSectionLabels);
})();

;

(function(){
  var markerClass='mobile-lang-in-topbar';
  var placeholder=null;
  function isMobileLangView(){
    return window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  function ensurePlaceholder(sw){
    if(!placeholder){
      placeholder=document.createComment('language-switcher-original-place');
      if(sw.parentNode){sw.parentNode.insertBefore(placeholder, sw);}
    }
  }
  function setMobileLabels(isMobile){
    var ar=document.getElementById('langArBtn');
    var en=document.getElementById('langEnBtn');
    if(ar){ar.textContent=isMobile ? 'ع' : 'العربية'; ar.setAttribute('aria-label','العربية'); ar.setAttribute('title','العربية');}
    if(en){en.textContent=isMobile ? 'E' : 'English'; en.setAttribute('aria-label','English'); en.setAttribute('title','English');}
  }
  function placeLanguageSwitcher(){
    var sw=document.querySelector('.language-switcher');
    var topbar=document.querySelector('.mobile-topbar');
    var brand=document.querySelector('.mobile-topbar-brand');
    var actions=document.querySelector('.mobile-topbar-actions');
    if(!sw) return;
    var mobile=isMobileLangView();
    setMobileLabels(mobile);
    if(mobile && topbar && brand){
      ensurePlaceholder(sw);
      if(sw.parentNode!==topbar || brand.nextElementSibling!==sw){
        topbar.insertBefore(sw, brand.nextSibling);
      }
      if(actions && actions.parentNode!==topbar){
        topbar.appendChild(actions);
      }
      document.body.classList.add(markerClass);
    } else {
      if(placeholder && placeholder.parentNode && sw.parentNode!==placeholder.parentNode){
        placeholder.parentNode.insertBefore(sw, placeholder.nextSibling);
      }
      document.body.classList.remove(markerClass);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', placeLanguageSwitcher);
  } else {
    placeLanguageSwitcher();
  }
  window.addEventListener('load', placeLanguageSwitcher);
  window.addEventListener('resize', function(){clearTimeout(window.__langTopbarResizeTimer); window.__langTopbarResizeTimer=setTimeout(placeLanguageSwitcher, 80);});
  window.addEventListener('orientationchange', function(){setTimeout(placeLanguageSwitcher, 120);});
})();

;

(function(){
  var PHONE='962788272988';
  var CART_KEY='maen_sat_store_cart_v1';
  var EXTRA_TRANSLATIONS = {
    "د.أ":"JOD","السلة":"Cart","🛒 السلة":"🛒 Cart","سلة الطلبات":"Order Cart","السلة فارغة حالياً":"Your cart is currently empty","السلة فارغة":"The cart is empty","المجموع":"Total","المجموع التقريبي":"Estimated total","أضف للسلة":"Add to Cart","اطلب الآن عبر واتساب":"Order Now via WhatsApp","تفريغ السلة":"Clear Cart","الكمية":"Qty","سعر القطعة":"Unit price","الإجمالي":"Subtotal","إغلاق":"Close","السعر":"Price","اطلب الآن":"Order Now","استفسار":"Ask","واتساب":"WhatsApp","اتصال":"Call","اتصال مباشر":"Direct Call","رجوع":"Back","مسح":"Clear","كل الشركات":"All brands","كل المنتجات":"All products","كل الأقمار":"All satellites","لا توجد نتائج مطابقة للبحث الحالي.":"No results match the current search.","ابحث عن جهاز...":"Search for a device...","ابحث عن منتج...":"Search for a product...","العربية":"Arabic",
    "مرحبا، أريد تأكيد طلب من موقع معن حنونة للستلايت:":"Hello, I would like to confirm an order from Maen Hanouneh Satellite:",
    "الرجاء تأكيد التوفر والسعر النهائي وموعد التسليم/التركيب المناسب.":"Please confirm availability, final price, and the suitable delivery/installation time.",
    "مرحبا معن حنونة للستلايت، أريد الاستفسار عن الأجهزة أو خدمات التركيب والصيانة.":"Hello Maen Hanouneh Satellite, I would like to ask about devices or installation and maintenance services.",
    "مرحبا، أريد طلب هذا الجهاز أو الاستفسار عنه:":"Hello, I would like to order this device or ask about it:",
    "مرحبا، أريد الاستفسار عن هذا المنتج من الستلايت:":"Hello, I would like to ask about this satellite product:",
    "مرحبا، أريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:":"Hello, I would like to request satellite installation or maintenance service. My location is:",
    "مرحبا، شاهدت أعمالكم وأريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:":"Hello, I saw your work and would like to request satellite installation or maintenance service. My location is:",
    "مرحبا، أريد التواصل معكم بخصوص خدمات الستلايت والرسيفرات.":"Hello, I would like to contact you about satellite and receiver services.",
    "معن حنونة للستلايت":"Maen Hanouneh Satellite",
    "بيع رسيفرات، لواقط وأطباق، تركيب وصيانة وبرمجة ستلايت في الفحيص وعمان الغربية والسلط والسرو.":"Receivers, LNBs and dishes, satellite installation, maintenance and programming in Fuheis, West Amman, Salt and Al-Saru.",
    "معن حنونة للستلايت | رسيفرات وتركيب وصيانة ستلايت":"Maen Hanouneh Satellite | Receivers, Satellite Installation & Maintenance",
    "بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت طوال أيام الأسبوع والأعياد":"Sales, maintenance, installation, and programming of all satellite systems all week and on holidays"
  };
  try { if (typeof translations !== 'undefined') Object.assign(translations, EXTRA_TRANSLATIONS); } catch(e) {}
  function currentLang(){return localStorage.getItem('siteLang') || document.documentElement.lang || 'ar';}
  function trText(text, lang){
    if(lang!=='en') return text;
    if(text == null) return text;
    var original=String(text);
    var trimmed=original.trim();
    var dictionary=(typeof translations !== 'undefined') ? translations : EXTRA_TRANSLATIONS;
    if(dictionary[trimmed]) return original.replace(trimmed, dictionary[trimmed]);
    if(EXTRA_TRANSLATIONS[trimmed]) return original.replace(trimmed, EXTRA_TRANSLATIONS[trimmed]);
    var out=original;
    var keys=Object.keys(dictionary).concat(Object.keys(EXTRA_TRANSLATIONS)).filter(function(k){return k && k.length>1;}).sort(function(a,b){return b.length-a.length;});
    keys.forEach(function(k){
      var v=dictionary[k] || EXTRA_TRANSLATIONS[k];
      if(out.indexOf(k)!==-1) out=out.split(k).join(v);
    });
    out=out.replace(/(\d+(?:\.\d+)?)\s*د\.أ/g,'$1 JOD').replace(/د\.أ/g,'JOD');
    out=out.replace(/الكمية\s*:/g,'Qty:').replace(/سعر القطعة\s*:/g,'Unit price:').replace(/الإجمالي\s*:/g,'Subtotal:').replace(/المجموع التقريبي\s*:/g,'Estimated total:');
    out=out.replace(/رقم\s*(\d+)/g,'#$1');
    out=out.replace(/صورة من أعمالنا #?(\d+)/g,'Our work photo #$1');
    return out;
  }
  function walkText(root, lang){
    if(!root) return;
    var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:function(node){
      if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var p=node.parentElement;
      if(!p || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','CODE','PRE'].indexOf(p.tagName)!==-1) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    var nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(node.__maenLangOriginal === undefined){ node.__maenLangOriginal = node.datasetOriginalText || node.nodeValue; }
      var original=node.__maenLangOriginal;
      node.nodeValue = lang==='en' ? trText(original,'en') : original;
    });
  }
  function translateAttrs(root, lang){
    var attrs=['alt','title','aria-label','placeholder','value'];
    (root || document).querySelectorAll('[alt],[title],[aria-label],[placeholder],input[value],button[value]').forEach(function(el){
      attrs.forEach(function(attr){
        if(!el.hasAttribute(attr)) return;
        var key='data-maen-original-'+attr;
        if(!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(attr) || '');
        var original=el.getAttribute(key) || '';
        el.setAttribute(attr, lang==='en' ? trText(original,'en') : original);
      });
    });
  }
  function fixLanguageButtons(){
    var isMobile=window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var ar=document.getElementById('langArBtn');
    var en=document.getElementById('langEnBtn');
    if(ar){ar.textContent=isMobile ? 'ع' : (currentLang()==='en' ? 'Arabic' : 'العربية'); ar.setAttribute('aria-label', currentLang()==='en' ? 'Arabic' : 'العربية');}
    if(en){en.textContent=isMobile ? 'E' : 'English'; en.setAttribute('aria-label','English');}
  }
  function applyEnhancedLanguage(lang){
    lang=lang || currentLang();
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='en' ? 'ltr' : 'rtl';
    document.body.classList.toggle('lang-en', lang==='en');
    document.body.classList.toggle('lang-ar', lang!=='en');
    walkText(document.body, lang);
    translateAttrs(document, lang);
    fixLanguageButtons();
    document.title = lang==='en' ? 'Maen Hanouneh Satellite | Receivers, Satellite Installation & Maintenance' : 'معن حنونة للستلايت';
    updateStaticLinks(lang);
    updateCartBadgeText(lang);
  }
  function updateStaticLinks(lang){
    setupWhatsAppMessages(lang);
  }
  function readCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]');}catch(e){return[];}}
  function money(n){return (Math.round(Number(n||0)*100)/100) + (currentLang()==='en' ? ' JOD' : ' د.أ');}
  function updateCartBadgeText(lang){
    var float=document.querySelector('.store-cart-float');
    var badge=document.getElementById('storeCartCount');
    if(float && badge){
      var count=badge.textContent || '0';
      var desired=(lang==='en' ? '🛒 Cart' : '🛒 السلة') + '<span id="storeCartCount">'+count+'</span>'; if(float.innerHTML!==desired) float.innerHTML=desired;
    }
  }
  window.setupWhatsAppMessages=function(lang){
    lang=lang || currentLang();
    var base='https://wa.me/'+PHONE+'?text=';
    document.querySelectorAll('a[href*="wa.me"]').forEach(function(link){
      var msg = lang==='en'
        ? 'Hello Maen Hanouneh Satellite, I would like to ask about devices or installation and maintenance services.'
        : 'مرحبا معن حنونة للستلايت، أريد الاستفسار عن الأجهزة أو خدمات التركيب والصيانة.';
      var card=link.closest('.device-card,.lnb-card,.contact-card,.store-card,.software-card,.work-card');
      if(link.closest('#devices')){
        var name=(card && card.querySelector('h3')) ? card.querySelector('h3').textContent.trim() : '';
        msg=(lang==='en' ? 'Hello, I would like to order this device or ask about it: ' : 'مرحبا، أريد طلب هذا الجهاز أو الاستفسار عنه: ')+name;
      }
      if(link.closest('#lnbs')){
        var name2=(card && card.querySelector('h3')) ? card.querySelector('h3').textContent.trim() : '';
        msg=(lang==='en' ? 'Hello, I would like to ask about this satellite product: ' : 'مرحبا، أريد الاستفسار عن هذا المنتج من الستلايت: ')+name2;
      }
      if(link.closest('#maintenance')) msg= lang==='en' ? 'Hello, I would like to request satellite installation or maintenance service. My location is:' : 'مرحبا، أريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:';
      if(link.closest('#works')) msg= lang==='en' ? 'Hello, I saw your work and would like to request satellite installation or maintenance service. My location is:' : 'مرحبا، شاهدت أعمالكم وأريد طلب خدمة تركيب أو صيانة ستلايت. موقعي هو:';
      if(link.closest('#contact')) msg= lang==='en' ? 'Hello, I would like to contact you about satellite and receiver services.' : 'مرحبا، أريد التواصل معكم بخصوص خدمات الستلايت والرسيفرات.';
      link.href=base+encodeURIComponent(msg);
    });
  };
  var originalSetLanguage = window.setLanguage;
  window.setLanguage=function(lang){
    localStorage.setItem('siteLang', lang);
    if(typeof originalSetLanguage==='function'){
      try { originalSetLanguage(lang); } catch(e) {}
    }
    applyEnhancedLanguage(lang);
    setTimeout(function(){applyEnhancedLanguage(lang);},0);
    setTimeout(function(){applyEnhancedLanguage(lang);},80);
    setTimeout(function(){applyEnhancedLanguage(lang);},220);
  };
  var originalOpenCart=window.storeOpenCart;
  if(typeof originalOpenCart==='function'){
    window.storeOpenCart=function(){
      originalOpenCart.apply(this, arguments);
      var lang=currentLang();
      setTimeout(function(){applyEnhancedLanguage(lang);},0);
      setTimeout(function(){applyEnhancedLanguage(lang);},80);
    };
  }
  ['storeChangeQty','storeClearCart'].forEach(function(fn){
    var old=window[fn];
    if(typeof old==='function'){
      window[fn]=function(){
        var result=old.apply(this, arguments);
        var lang=currentLang();
        setTimeout(function(){applyEnhancedLanguage(lang);},0);
        return result;
      };
    }
  });
  window.storeCheckout=function(){
    var cart=readCart();
    var lang=currentLang();
    if(!cart.length){alert(lang==='en' ? 'The cart is empty' : 'السلة فارغة');return;}
    var total=0;
    var lines=[];
    if(lang==='en'){
      lines.push('Hello, I would like to confirm an order from Maen Hanouneh Satellite:');
      cart.forEach(function(item,index){
        var lineTotal=Number(item.price||0)*Number(item.qty||0); total+=lineTotal;
        lines.push((index+1)+'. '+item.name+' | Qty: '+item.qty+' | Unit price: '+money(item.price)+' | Subtotal: '+money(lineTotal));
      });
      lines.push('Estimated total: '+money(total));
      lines.push('Please confirm availability, final price, and the suitable delivery/installation time.');
    } else {
      lines.push('مرحبا، أريد تأكيد طلب من موقع معن حنونة للستلايت:');
      cart.forEach(function(item,index){
        var lineTotal=Number(item.price||0)*Number(item.qty||0); total+=lineTotal;
        lines.push((index+1)+'. '+item.name+' | الكمية: '+item.qty+' | سعر القطعة: '+money(item.price)+' | الإجمالي: '+money(lineTotal));
      });
      lines.push('المجموع التقريبي: '+money(total));
      lines.push('الرجاء تأكيد التوفر والسعر النهائي وموعد التسليم/التركيب المناسب.');
    }
    window.open('https://wa.me/'+PHONE+'?text='+encodeURIComponent(lines.join('\n')),'_blank','noopener');
  };
  var originalShare=window.shareSite;
  window.shareSite=function(){
    var lang=currentLang();
    var shareData= lang==='en'
      ? {title:'Maen Hanouneh Satellite',text:'Maen Hanouneh Satellite website - receivers, satellite devices, LNBs, installation and maintenance.',url:window.location.href}
      : {title:'معن حنونة للستلايت',text:'موقع معن حنونة للستلايت-أجهزة رسيفرات، ستلايت ولواقط، تركيب وصيانة.',url:window.location.href};
    if(navigator.share){navigator.share(shareData).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(window.location.href).then(function(){alert(lang==='en' ? 'Website link copied' : 'تم نسخ رابط الموقع');});}else{alert(lang==='en' ? 'Copy the page link from your browser to share it' : 'انسخ رابط الصفحة من المتصفح لمشاركته');}
  };
  var originalOpenLightbox=window.openLightbox;
  if(typeof originalOpenLightbox==='function'){
    window.openLightbox=function(src,title){
      originalOpenLightbox(src, currentLang()==='en' ? trText(title || 'صورة','en') : (title || 'صورة'));
      setTimeout(function(){applyEnhancedLanguage(currentLang());},0);
    };
  }
  ['renderFrequencies','renderReceiverSoftware'].forEach(function(fn){
    var old=window[fn];
    if(typeof old==='function'){
      window[fn]=function(){
        var result=old.apply(this, arguments);
        var lang=currentLang();
        setTimeout(function(){applyEnhancedLanguage(lang);},0);
        setTimeout(function(){applyEnhancedLanguage(lang);},80);
        return result;
      };
    }
  });
  var observer=null;
  function startObserver(){
    if(observer) return;
    observer=new MutationObserver(function(mutations){
      if(currentLang()!=='en') return;
      var should=false;
      mutations.forEach(function(m){ if(m.addedNodes && m.addedNodes.length) should=true; });
      if(should){ clearTimeout(window.__maenLangMutationTimer); window.__maenLangMutationTimer=setTimeout(function(){applyEnhancedLanguage('en');},60); }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){window.setLanguage(currentLang());startObserver();});
  } else {
    window.setLanguage(currentLang());startObserver();
  }
  window.addEventListener('load',function(){window.setLanguage(currentLang());});
  window.addEventListener('resize',function(){setTimeout(fixLanguageButtons,100);});
})();

;

(function(){
  function isMobileFrequencyView(){
    return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  }
  function resetFrequencyTableEdge(){
    if(!isMobileFrequencyView()) return;
    var page=document.getElementById('frequencies');
    if(!page || !page.classList.contains('active')) return;
    var wrap=page.querySelector('.frequency-table-wrap');
    if(!wrap) return;
    wrap.setAttribute('dir','rtl');
    // In modern mobile browsers, 0 on an RTL scroller keeps the table on the
    // same starting edge as Arabic; the user can then drag to reveal channels.
    try{ wrap.scrollLeft = 0; }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(resetFrequencyTableEdge,60);
    var tbody=document.getElementById('frequencyTableBody');
    if(tbody && window.MutationObserver){
      new MutationObserver(function(){ setTimeout(resetFrequencyTableEdge,30); }).observe(tbody,{childList:true,subtree:false});
    }
    if(document.body && window.MutationObserver){
      new MutationObserver(function(){ setTimeout(resetFrequencyTableEdge,30); }).observe(document.body,{attributes:true,attributeFilter:['class']});
    }
  });
  window.addEventListener('resize',function(){ setTimeout(resetFrequencyTableEdge,80); });
  window.addEventListener('hashchange',function(){ setTimeout(resetFrequencyTableEdge,120); });
  var oldRender=window.renderFrequencies;
  if(typeof oldRender==='function' && !oldRender.__frequencyScrollPatched){
    var wrapped=function(){
      var result=oldRender.apply(this,arguments);
      setTimeout(resetFrequencyTableEdge,40);
      return result;
    };
    wrapped.__frequencyScrollPatched=true;
    window.renderFrequencies=wrapped;
  }
})();

;

(function(){
  var MAINTENANCE_TRANSLATIONS = {
    "الصيانة":"Maintenance",
    "التركيب":"Installation",
    "التركيب والصيانة":"Installation & Maintenance",
    "خدماتنا":"Our Services",
    "خدماتنا في التركيب والصيانة":"Our Installation & Maintenance Services",
    "تركيب ستلايت":"Satellite Installation",
    "صيانة أعطال":"Fault Repair",
    "ضبط إشارة":"Signal Tuning",
    "تركيب لواقط":"LNB Installation",
    "فحص تمديدات":"Cable Inspection",
    "برمجة رسيفرات":"Receiver Programming",
    "اطلب الخدمة عبر واتساب":"Request Service via WhatsApp",
    "شاهد من أعمالنا":"View Our Work",
    "المناطق التي نخدمها":"Areas We Serve",
    "يمكننا تقديم خدمة التركيب والصيانة في المناطق التالية:":"We can provide installation and maintenance service in the following areas:",
    "الفحيص":"Fuheis",
    "دابوق":"Dabouq",
    "الحمر":"Al-Hummar",
    "السرو":"Al-Saru",
    "صويلح":"Sweileh",
    "مرج الحمام":"Marj Al-Hamam",
    "عمان الغربية بجميع مناطقها":"West Amman, all areas",
    "أسئلة شائعة":"FAQ",
    "أسئلة قد تهمك":"Questions You May Have",
    "إجابات مختصرة تساعد الزبون قبل التواصل معنا.":"Short answers to help customers before contacting us.",
    "هل تعملون أيام الجمعة والأعياد؟":"Do you work on Fridays and holidays?",
    "هل تقدمون خدمة في عمان الغربية؟":"Do you provide service in West Amman?",
    "هل يمكن فحص ضعف الإشارة؟":"Can you check weak signal issues?",
    "هل يمكن طلب جهاز أو لاقط عبر واتساب؟":"Can I order a receiver or LNB through WhatsApp?",
    "تحتاج تركيب أو صيانة؟":"Need installation or maintenance?",
    "أرسل موقعك ونوع المشكلة على واتساب، أو اتصل مباشرة على نفس الرقم.":"Send your location and the issue on WhatsApp, or call the same number directly.",
    "نقدّم خدمات تركيب وصيانة وبرمجة أنظمة الستلايت، ضبط الإشارة، تركيب اللواقط، فحص التمديدات، وتجهيز الرسيفرات حسب الحاجة.":"We provide satellite installation, maintenance and programming services, signal tuning, LNB installation, cable inspection, and receiver setup as needed.",
    "نقدم خدمة ميدانية لتركيب وصيانة أنظمة الستلايت والرسيفرات، ضبط الإشارة، تركيب الأطباق واللواقط، فحص الأعطال، تبديل القطع المناسبة، وترتيب القنوات حسب طلب الزبون.":"We provide on-site service for installing and maintaining satellite and receiver systems, tuning the signal, installing dishes and LNBs, checking faults, replacing suitable parts, and arranging channels according to the customer’s request.",
    "نعم، نقدم خدمات بيع وصيانة وتركيب وبرمجة أنظمة الستلايت طوال أيام الأسبوع والأعياد حسب التوفر والموعد.":"Yes, we provide sales, maintenance, installation, and programming services for satellite systems throughout the week and on holidays, depending on availability and appointment time.",
    "نعم، نخدم عمان الغربية بجميع مناطقها، بالإضافة إلى الفحيص ودابوق والحمر والسرو وصويلح ومرج الحمام.":"Yes, we serve all areas of West Amman, in addition to Fuheis, Dabouq, Al-Hummar, Al-Saru, Sweileh, and Marj Al-Hamam.",
    "نعم، يمكن فحص الإشارة، اتجاه الطبق، اللواقط، التمديدات، والدايزك لمعرفة سبب المشكلة.":"Yes, we can check the signal, dish direction, LNBs, wiring, and DiSEqC switch to identify the cause of the problem.",
    "نعم، اضغط على زر واتساب الخاص بالمنتج، وستظهر رسالة جاهزة باسم المنتج المطلوب.":"Yes, press the product’s WhatsApp button and a ready message with the requested product name will appear.",
    "نخدمكم بالفحيص وعمان الغربية والسلط والسرو":"We serve Fuheis, West Amman, Salt, and Al-Saru",
    "نخدمكم بالفحيص وعمان الغربية والسلط":"We serve Fuheis, West Amman, and Salt",
    "نخدمكم بالفحيص وعمان الغربية والسلط السرو":"We serve Fuheis, West Amman, Salt, and Al-Saru",
    "بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت طوال أيام الأسبوع والأعياد":"Sales, maintenance, installation, and programming of all satellite systems throughout the week and on holidays",
    "صورة":"Image",
    "صورة أعمالنا":"Our Work Image",
    "شعار معن حنونة للستلايت":"Maen Hanouneh Satellite Logo",
    "طلب خدمة تركيب أو صيانة":"Request Installation or Maintenance Service",
    "فتح قسم أعمالنا":"Open Our Work Section",
    "واتساب الآن":"WhatsApp Now",
    "اتصال مباشر":"Direct Call"
  };
  function mergeMaintenanceTranslations(){
    try{ if(typeof translations !== 'undefined') Object.assign(translations, MAINTENANCE_TRANSLATIONS); }catch(e){}
    window.__MAEN_MAINTENANCE_TRANSLATIONS = MAINTENANCE_TRANSLATIONS;
  }
  mergeMaintenanceTranslations();
  var oldSetLanguage = window.setLanguage;
  if(typeof oldSetLanguage === 'function' && !oldSetLanguage.__maintenanceTranslationPatched){
    var wrapped = function(lang){
      mergeMaintenanceTranslations();
      var result = oldSetLanguage.apply(this, arguments);
      setTimeout(mergeMaintenanceTranslations, 0);
      return result;
    };
    wrapped.__maintenanceTranslationPatched = true;
    window.setLanguage = wrapped;
  }
  function reapply(){
    mergeMaintenanceTranslations();
    if(typeof window.setLanguage === 'function'){
      window.setLanguage(localStorage.getItem('siteLang') || document.documentElement.lang || 'ar');
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reapply);
  else reapply();
  window.addEventListener('load', function(){ setTimeout(reapply, 80); });
})();

;

(function(){
  var RAW_MAP = {
    "الصيانة":"Maintenance",
    "التركيب":"Installation",
    "التركيب والصيانة":"Installation & Maintenance",
    "خدماتنا":"Our Services",
    "خدماتنا في التركيب والصيانة":"Our Installation & Maintenance Services",
    "نقدّم خدمات تركيب وصيانة وبرمجة أنظمة الستلايت، ضبط الإشارة، تركيب اللواقط، فحص التمديدات، وتجهيز الرسيفرات حسب الحاجة.":"We provide satellite installation, maintenance and programming services, signal tuning, LNB installation, cable inspection, and receiver setup as needed.",
    "نقدم خدمة ميدانية لتركيب وصيانة أنظمة الستلايت والرسيفرات، ضبط الإشارة، تركيب الأطباق واللواقط، فحص الأعطال، تبديل القطع المناسبة، وترتيب القنوات حسب طلب الزبون.":"We provide on-site service for installing and maintaining satellite and receiver systems, tuning the signal, installing dishes and LNBs, checking faults, replacing suitable parts, and arranging channels according to the customer’s request.",
    "تركيب ستلايت":"Satellite Installation",
    "صيانة أعطال":"Fault Repair",
    "ضبط إشارة":"Signal Tuning",
    "تركيب لواقط":"LNB Installation",
    "فحص تمديدات":"Cable Inspection",
    "برمجة رسيفرات":"Receiver Programming",
    "اطلب الخدمة عبر واتساب":"Request Service via WhatsApp",
    "شاهد من أعمالنا":"View Our Work",
    "اتصال مباشر":"Direct Call",
    "المناطق التي نخدمها":"Areas We Serve",
    "يمكننا تقديم خدمة التركيب والصيانة في المناطق التالية:":"We can provide installation and maintenance service in the following areas:",
    "الفحيص":"Fuheis",
    "دابوق":"Dabouq",
    "الحمر":"Al-Hummar",
    "السرو":"Al-Saru",
    "صويلح":"Sweileh",
    "مرج الحمام":"Marj Al-Hamam",
    "عمان الغربية بجميع مناطقها":"West Amman, all areas",
    "أسئلة شائعة":"FAQ",
    "أسئلة قد تهمك":"Questions You May Have",
    "إجابات مختصرة تساعد الزبون قبل التواصل معنا.":"Short answers to help customers before contacting us.",
    "هل تعملون أيام الجمعة والأعياد؟":"Do you work on Fridays and holidays?",
    "نعم، نقدم خدمات بيع وصيانة وتركيب وبرمجة أنظمة الستلايت طوال أيام الأسبوع والأعياد حسب التوفر والموعد.":"Yes, we provide sales, maintenance, installation, and programming services for satellite systems throughout the week and on holidays, depending on availability and appointment time.",
    "هل تقدمون خدمة في عمان الغربية؟":"Do you provide service in West Amman?",
    "نعم، نخدم عمان الغربية بجميع مناطقها، بالإضافة إلى الفحيص ودابوق والحمر والسرو وصويلح ومرج الحمام.":"Yes, we serve all areas of West Amman, in addition to Fuheis, Dabouq, Al-Hummar, Al-Saru, Sweileh, and Marj Al-Hamam.",
    "هل يمكن فحص ضعف الإشارة؟":"Can you check weak signal issues?",
    "نعم، يمكن فحص الإشارة، اتجاه الطبق، اللواقط، التمديدات، والدايزك لمعرفة سبب المشكلة.":"Yes, we can check the signal, dish direction, LNBs, wiring, and DiSEqC switch to identify the cause of the problem.",
    "هل يمكن طلب جهاز أو لاقط عبر واتساب؟":"Can I order a receiver or LNB through WhatsApp?",
    "نعم، اضغط على زر واتساب الخاص بالمنتج، وستظهر رسالة جاهزة باسم المنتج المطلوب.":"Yes, press the product’s WhatsApp button and a ready message with the requested product name will appear.",
    "تحتاج تركيب أو صيانة؟":"Need installation or maintenance?",
    "أرسل موقعك ونوع المشكلة على واتساب، أو اتصل مباشرة على نفس الرقم.":"Send your location and the issue on WhatsApp, or call the same number directly.",
    "نخدمكم بالفحيص وعمان الغربية والسلط والسرو":"We serve Fuheis, West Amman, Salt, and Al-Saru",
    "نخدمكم بالفحيص وعمان الغربية والسلط":"We serve Fuheis, West Amman, and Salt",
    "بيع وصيانة وتركيب وبرمجة جميع أنظمة الستلايت طوال أيام الأسبوع والأعياد":"Sales, maintenance, installation, and programming of all satellite systems throughout the week and on holidays",
    "معن حنونة للستلايت":"Maen Hanouneh Satellite"
  };
  function norm(value){
    return String(value || '')
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/\s+/g,'')
      .replace(/[،,\.\u061F؟:؛!\-–—_|\/\\()\[\]{}"'`]+/g,'')
      .trim();
  }
  var MAP = {};
  Object.keys(RAW_MAP).forEach(function(ar){ MAP[norm(ar)] = {ar: ar, en: RAW_MAP[ar]}; });
  function lang(){ return localStorage.getItem('siteLang') || document.documentElement.lang || 'ar'; }
  function textNodes(root){
    var out=[];
    if(!root) return out;
    var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:function(node){
      if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      var parent=node.parentElement;
      if(!parent || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','CODE','PRE'].indexOf(parent.tagName)!==-1) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    while(walker.nextNode()) out.push(walker.currentNode);
    return out;
  }
  function applyMaintenanceVisibleTranslation(targetLang){
    targetLang = targetLang || lang();
    var root=document.getElementById('maintenance');
    if(!root) return;
    textNodes(root).forEach(function(node){
      var source = node.__maintenanceArOriginal || node.__maenLangOriginal || node.nodeValue;
      var hit = MAP[norm(source)] || MAP[norm(node.nodeValue)];
      if(!hit) return;
      node.__maintenanceArOriginal = hit.ar;
      node.__maenLangOriginal = hit.ar;
      node.nodeValue = targetLang === 'en' ? hit.en : hit.ar;
    });
    var attrs=['alt','title','aria-label'];
    root.querySelectorAll('[alt],[title],[aria-label]').forEach(function(el){
      attrs.forEach(function(attr){
        if(!el.hasAttribute(attr)) return;
        var key='data-maintenance-original-'+attr;
        if(!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(attr) || '');
        var original=el.getAttribute(key) || '';
        var hit=MAP[norm(original)] || MAP[norm(el.getAttribute(attr) || '')];
        if(hit) el.setAttribute(attr, targetLang==='en' ? hit.en : hit.ar);
      });
    });
  }
  window.__applyMaintenanceVisibleTranslation = applyMaintenanceVisibleTranslation;
  var oldSetLanguage = window.setLanguage;
  if(typeof oldSetLanguage === 'function' && !oldSetLanguage.__maintenanceVisibleTextPatched){
    var wrapped = function(selectedLang){
      var result = oldSetLanguage.apply(this, arguments);
      selectedLang = selectedLang || lang();
      applyMaintenanceVisibleTranslation(selectedLang);
      setTimeout(function(){ applyMaintenanceVisibleTranslation(selectedLang); }, 0);
      setTimeout(function(){ applyMaintenanceVisibleTranslation(selectedLang); }, 80);
      setTimeout(function(){ applyMaintenanceVisibleTranslation(selectedLang); }, 240);
      return result;
    };
    wrapped.__maintenanceVisibleTextPatched = true;
    window.setLanguage = wrapped;
  }
  function boot(){ applyMaintenanceVisibleTranslation(lang()); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ setTimeout(boot, 100); setTimeout(boot, 500); });
})();

;

(function () {
  "use strict";
  // Custom D1 page-view analytics is off by default to protect free Netlify/Cloudflare quotas.
  // Set window.MAEN_ANALYTICS_MODE = "session" before this script if you intentionally want one lightweight hit per session.
  var mode = window.MAEN_ANALYTICS_MODE || "off";
  if (mode === "off") return;
  var endpoint = window.MAEN_ANALYTICS_ENDPOINT || (location.hostname.indexOf('pages.dev') > -1 ? "/api/track-visit" : "https://maensat.pages.dev/api/track-visit");

  try {
    var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.msDoNotTrack === "1";
    if (dnt) return;
    var sessionSentKey = "maen_analytics_sent_" + location.pathname;
    if (mode === "session" && sessionStorage.getItem(sessionSentKey)) return;

    var visitorKey = "maen_anon_visitor_id";
    var visitorId = localStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId = "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 14);
      localStorage.setItem(visitorKey, visitorId);
    }

    var sessionKey = "maen_anon_session";
    var now = Date.now();
    var session;
    try { session = JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch (e) { session = null; }
    if (!session || !session.id || (now - (session.ts || 0)) > 30 * 60 * 1000) {
      session = { id: "s_" + now.toString(36) + "_" + Math.random().toString(36).slice(2, 12), ts: now };
    } else {
      session.ts = now;
    }
    sessionStorage.setItem(sessionKey, JSON.stringify(session));

    var payload = {
      visitorId: visitorId,
      sessionId: session.id,
      page: location.pathname + location.search + location.hash,
      title: document.title || "",
      device: window.matchMedia && window.matchMedia("(max-width: 900px)").matches ? "mobile" : "desktop",
      lang: document.documentElement.getAttribute("lang") || navigator.language || "ar",
      referrer: document.referrer || "",
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || ""),
      screen: (screen && screen.width && screen.height) ? (screen.width + "x" + screen.height) : "",
      ts: new Date().toISOString()
    };

    var body = JSON.stringify(payload);
    if (mode === "session") sessionStorage.setItem(sessionSentKey, "1");
    if (navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    else fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true, credentials: "omit" }).catch(function () {});
  } catch (e) {}
})();
