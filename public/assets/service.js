(() => {
  const state = { index: null, articles: [], messages: [], lastContext: [], loadedShards: new Set(), loadedCategories: new Set(), allShardsLoaded: false, memory: { deviceType: '', brand: '', brandAr: '', app: '', intent: '', osHint: '', models: [], storeHint: '', connection: '', symptom: '', severity: '', tried: [], signals: [] }, internalMisses: 0, lastDiagnosis: null };
  const $ = (s) => document.querySelector(s);

  function normalizeArabic(value = '') {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/گ/g, 'ك')
      .replace(/ڤ/g, 'ف')
      .replace(/چ/g, 'ج')
      .replace(/[^\u0600-\u06FFa-z0-9\s+._/-]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(q) {
    return normalizeArabic(q).split(' ').filter(t => t.length > 1);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1400);
  }

  function formatPlainText(text) {
    const escaped = esc(text || '').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return `<p>${escaped}</p>`;
  }

  function unique(list) {
    const out = [];
    const seen = new Set();
    for (const x of list || []) {
      const v = String(x || '').trim();
      if (!v) continue;
      const k = normalizeArabic(v);
      if (!seen.has(k)) { seen.add(k); out.push(v); }
    }
    return out;
  }

  const INTENT_LABELS = {
    connect_wifi: 'توصيل واي فاي', connect_lan: 'توصيل كابل LAN', hotspot: 'هوتسبوت الهاتف', hotspot_setup: 'هوتسبوت الهاتف',
    internet_connected_no_service: 'متصل والإنترنت/الخدمة لا تعمل', dns: 'DNS / شبكة', dns_setup: 'DNS / شبكة', date_time: 'تاريخ ووقت', wifi_not_visible: 'الشبكة لا تظهر', weak_wifi: 'واي فاي ضعيف',
    install_app: 'تنزيل تطبيق', install_youtube: 'YouTube', install_shahid: 'Shahid', install_netflix: 'Netflix', install_tod_osn: 'TOD / OSN+',
    app_freeze: 'تطبيق يعلق', app_not_found: 'تطبيق غير موجود', update_app: 'تحديث تطبيق', clear_cache: 'مسح كاش', login_problem: 'تسجيل دخول', storage_full: 'الذاكرة ممتلئة', country_region_tv: 'البلد/المنطقة',
    iptv_buffering: 'IPTV يقطع', playlist_setup_official: 'قائمة IPTV قانونية', official_subscription_activation: 'اشتراك رسمي', encrypted_channel_message: 'قناة مشفرة / اشتراك رسمي',
    no_signal: 'لا توجد إشارة', weak_signal: 'ضعف الإشارة', channel_scan: 'بحث القنوات', transponder_add: 'إضافة تردد', diseqc_setup: 'DiSEqC', lnb_setup: 'LNB', motor_setup_safe: 'موتور / USALS',
    update_firmware: 'تحديث / سوفتوير', software_update_safe: 'تحديث / سوفتوير', factory_reset: 'ضبط مصنع', backup_channels: 'نسخة قنوات', boot_logo_stuck: 'عالق على الشعار', restart_loop_tv: 'إعادة تشغيل مستمرة',
    remote_not_working: 'مشكلة ريموت', bluetooth: 'Bluetooth', bluetooth_remote_pairing: 'إقران ريموت', forgotten_pin: 'رمز/قفل منسي', parental_lock: 'قفل أبوي',
    identify_model_os: 'تحديد الموديل والنظام', hdmi: 'HDMI / مصدر الصورة', hdmi_no_signal: 'HDMI لا يظهر', hdmi_resolution: 'دقة HDMI', arc_earc_sound: 'ARC/eARC صوت', sound: 'الصوت', screen_cast: 'ربط الهاتف',
    black_screen: 'شاشة سوداء', power_issue: 'مشكلة كهرباء', no_power_tv: 'لا تعمل نهائيًا', picture_settings: 'الصورة والألوان', usb_playback: 'USB / تشغيل ملفات', unknown: 'تشخيص عام'
  };
  function buildAliasBank() {
    const aliases = state.index?.dictionaries?.aliases || [];
    return aliases.map(item => ({
      canonical: item.canonical || item.brand || item.name || '',
      nameAr: item.nameAr || '',
      deviceType: item.deviceType || item.category || '',
      aliases: unique([item.canonical, item.nameAr, ...(item.aliases || [])]).filter(v => normalizeArabic(v).length >= 2)
    })).filter(x => x.canonical && x.aliases.length);
  }

  function detectFromAliases(nq, deviceType = '') {
    const bank = buildAliasBank();
    const matches = [];
    for (const item of bank) {
      if (deviceType && item.deviceType && item.deviceType !== deviceType) continue;
      let best = 0;
      for (const alias of item.aliases) {
        const na = normalizeArabic(alias);
        if (!na || na.length < 2) continue;
        if (nq === na) best = Math.max(best, 80 + na.length);
        else if (nq.includes(na)) best = Math.max(best, 50 + Math.min(na.length, 25));
        else if (na.includes(nq) && nq.length >= 4) best = Math.max(best, 25);
      }
      if (best > 0) matches.push({ ...item, score: best });
    }
    return matches.sort((a, b) => b.score - a.score);
  }

  function detectIntent(nq) {
    const rules = [
      ['wifi_not_visible', /(شبكه.*لا تظهر|الشبكة.*لا تظهر|wifi.*not.*show|مش لاقي.*واي|لا تظهر.*واي)/],
      ['connect_wifi', /(واي فاي|wifi|wireless|شبك.*نت|الاتصال.*شبكه|اتصل.*انترنت)/],
      ['connect_lan', /(lan|ethernet|كابل نت|سلك نت|ايثرنت)/],
      ['hotspot_setup', /(هوتسبوت|hotspot|نقطه اتصال|نقطة اتصال|مشاركة الانترنت)/],
      ['internet_connected_no_service', /(متصل.*لا يعمل|متصل.*بدون|connected.*no|server.*not|الخدمه.*لا تعمل|الخدمة.*لا تعمل|سيرفر.*لا يعمل)/],
      ['dns_setup', /(dns|دي ان اس)/],
      ['date_time', /(تاريخ|وقت|ساعه|ساعة|date|time|epg|دليل البرامج)/],
      ['install_youtube', /(يوتيوب|يوتوب|youtube).*(نزل|تنزيل|ثبت|تثبيت|مش موجود|لا يظهر|علق|يعلق)|(?:نزل|ثبت|تنزيل).*(يوتيوب|youtube)/],
      ['install_shahid', /(شاهد|shahid).*(نزل|تنزيل|ثبت|تثبيت|مش موجود|لا يظهر|علق|يعلق)|(?:نزل|ثبت|تنزيل).*(شاهد|shahid)/],
      ['install_netflix', /(netflix|نتفليكس|نتفلكس).*(نزل|تنزيل|ثبت|تثبيت|مش موجود|لا يظهر|كود|خطأ|علق)|(?:نزل|ثبت|تنزيل).*(netflix|نتفليكس|نتفلكس)/],
      ['install_tod_osn', /(tod|تود|osn|او اس ان|أو إس إن|بي ان|bein).*(نزل|تنزيل|ثبت|تثبيت|مش موجود|لا يظهر)|(?:نزل|ثبت|تنزيل).*(tod|تود|osn|بي ان)/],
      ['app_not_found', /(تطبيق.*مش موجود|تطبيق.*غير موجود|لا يظهر|مش لاقي|not found|المتجر.*ما فيه|ما فيه.*متجر|لا يوجد.*google play|جوجل بلاي.*مش موجود)/],
      ['clear_cache', /(كاش|cache|clear cache|مسح بيانات|مسح ذاكره|مسح ذاكرة)/],
      ['update_app', /(حدث.*تطبيق|تحديث.*تطبيق|update.*app|تطبيق.*قديم)/],
      ['app_freeze', /(يعلق|تعليق|يفصل|ما يفتح|crash|freeze|بطيء|بطئ|شاشه سوداء داخل التطبيق|شاشة سوداء داخل التطبيق)/],
      ['login_problem', /(تسجيل دخول|login|حساب|كود|رمز|password|كلمه مرور|كلمة مرور)/],
      ['country_region_tv', /(بلد|منطقه|منطقة|region|country|الدوله|الدولة)/],
      ['storage_full', /(ذاكره|ذاكرة|مساحه|مساحة|storage|لا يثبت|ممتلئ)/],
      ['iptv_buffering', /(iptv|اي بي|m3u|xtream|تقطيع|يقطع|buffering|قنوات.*تقطع)/],
      ['playlist_setup_official', /(playlist|m3u|xtream|قائمه|قائمة).*(iptv|رسمي|اشتراك)/],
      ['official_subscription_activation', /(تفعيل|اشتراك|باقه|باقة|باقات|activation|subscription|server)/],
      ['encrypted_channel_message', /(مشفر|مشفرة|scrambled|encrypted|قناة مشفرة)/],
      ['no_signal', /(no signal|لا توجد اشاره|لا توجد إشارة|سنكل|signal)/],
      ['weak_signal', /(ضعف.*اشاره|ضعف.*إشارة|quality|جوده الاشاره|جودة الإشارة|تقطيع.*دش)/],
      ['channel_scan', /(بحث قنوات|بحث.*قناه|scan|blind scan|القنوات اختفت|اختفت القنوات)/],
      ['transponder_add', /(اضافه تردد|إضافة تردد|تردد يدوي|transponder|frequency)/],
      ['diseqc_setup', /(diseqc|دايسك|دايزك|عدة اقمار|اكثر من قمر)/],
      ['lnb_setup', /(lnb|ال ان بي|الان بي|لاقط|lnb power)/],
      ['motor_setup_safe', /(motor|usals|موتور|محرك الطبق)/],
      ['software_update_safe', /(تحديث|سوفت|سوفتوير|firmware|فلاشه|فلاشة|usb update|system update)/],
      ['backup_channels', /(نسخه قنوات|نسخة قنوات|backup|dump|db)/],
      ['factory_reset', /(ضبط مصنع|اعاده ضبط|إعادة ضبط|factory reset|reset|تهيئه|تهيئة)/],
      ['boot_logo_stuck', /(واقف على الشعار|عالق على الشعار|boot|logo|لا يقلع)/],
      ['restart_loop_tv', /(يعيد التشغيل|ريستارت|restart loop|restart|يطفي ويشتغل)/],
      ['remote_not_working', /(ريموت|remote|تحكم|اقتران|pair|ازرار|أزرار)/],
      ['forgotten_pin', /(pin|رمز|قفل|كلمه سر|كلمة سر|نسيت الرمز)/],
      ['identify_model_os', /(موديل|model|نظام التشغيل|حول الجهاز|about tv|stb info|معلومات الجهاز)/],
      ['hdmi_no_signal', /(hdmi).*(لا يظهر|no signal|ما يطلع|شاشه سوداء|شاشة سوداء)/],
      ['hdmi_resolution', /(دقه|دقة|resolution|4k|1080|refresh|hz)/],
      ['hdmi', /(hdmi|مدخل|source|مصدر)/],
      ['arc_earc_sound', /(arc|earc|soundbar|ساوند بار|مسرح منزلي)/],
      ['sound', /(الصوت|صوت|audio|no sound|سماعه|سماعة)/],
      ['screen_cast', /(cast|chromecast|airplay|screen mirroring|ربط الهاتف|مشاركة الشاشة|انعكاس|اعكس)/],
      ['bluetooth_remote_pairing', /(bluetooth|بلوتوث).*(ريموت|اقتران|pair)/],
      ['bluetooth', /(bluetooth|بلوتوث)/],
      ['picture_settings', /(الوان|ألوان|سطوع|صوره|صورة|hdr|brightness|باهته|باهتة)/],
      ['black_screen', /(شاشه سوداء|شاشة سوداء|الصوره سوداء|الصورة سوداء|black screen)/],
      ['no_power_tv', /(لا يعمل نهائيا|لا تعمل نهائيا|no power|كهرباء|لمبه|لمبة|رائحه حرق|رائحة حرق)/]
    ];
    for (const [intent, re] of rules) if (re.test(nq)) return intent;
    if (/(نزل|تنزيل|ثبت|تثبيت|متجر|install|apps?)/.test(nq)) return 'install_app';
    return 'unknown';
  }

  function detectDeviceType(nq) {
    if (/(ريسيفر|رسيفر|receiver|ستلايت|stb|دش)/.test(nq)) return 'receiver';
    if (/(شاشه|شاشة|تلفزيون|tv|smart tv)/.test(nq)) return 'tv';
    if (/(اندرويد بوكس|android box|tv box|iptv box|fire stick|chromecast|roku|mag box|formuler|بوكس)/.test(nq)) return 'android-receiver-iptv-box';
    return '';
  }

  function detectApp(nq) {
    const direct = [
      ['YouTube', /(يوتيوب|يوتوب|youtube)/], ['Shahid', /(شاهد|shahid)/], ['Netflix', /(netflix|نتفليكس|نتفلكس)/],
      ['TOD', /(tod|تود)/], ['OSN+', /(osn|او اس ان|أو إس إن)/], ['StarzPlay', /(starz|ستارز)/],
      ['Amazon Prime Video', /(prime video|amazon prime|برايم)/], ['Disney+', /(disney|ديزني)/], ['Apple TV', /(apple tv|ابل تي في|آبل تي في)/],
      ['IPTV Player', /(iptv|m3u|xtream|tivimate|ott navigator|xciptv|smart iptv)/], ['TiviMate', /(tivimate|تيفي ميت)/], ['OTT Navigator', /(ott navigator)/], ['XCIPTV', /(xciptv)/],
      ['VLC', /(vlc|في ال سي)/], ['Kodi', /(kodi|كودي)/], ['Google Play Store', /(google play|play store|جوجل بلاي|متجر بلاي)/],
      ['Samsung Smart Hub', /(smart hub|سامسونج ابس|samsung apps)/], ['LG Content Store', /(lg content store|متجر lg|متجر ال جي)/], ['VIDAA Store', /(vidaa store|متجر vidaa|متجر فايدا)/],
      ['Screen Mirroring', /(screen mirroring|airplay|cast|chromecast|مشاركة الشاشة|انعكاس)/], ['Browser', /(browser|متصفح)/], ['Spotify', /(spotify|سبوتيفاي)/], ['Anghami', /(anghami|انغامي|أنغامي)/]
    ];
    for (const [app, re] of direct) if (re.test(nq)) return app;
    const found = detectFromAliases(nq, 'app')[0];
    return found?.canonical || '';
  }

  function detectOsHint(nq) {
    const hints = [
      ['Google TV', /(google tv|جوجل تي في)/], ['Android TV', /(android tv|اندرويد tv|اندرويد تي في|google play|جوجل بلاي)/],
      ['Tizen', /(tizen|تايزن|smart hub|سامسونج ابس|samsung apps)/], ['webOS', /(webos|web os|lg content store|متجر lg|متجر ال جي)/],
      ['VIDAA', /(vidaa|فايدا|فيدا)/], ['Roku TV', /(roku|روكو)/], ['Fire TV', /(fire tv|fire stick|فاير ستيك|amazon appstore)/],
      ['tvOS', /(apple tv|appletv|tvos)/], ['Smart OS خاص', /(smart os|متجر خاص|متجر مدمج|نظام خاص)/]
    ];
    return hints.find(([, re]) => re.test(nq))?.[0] || '';
  }

  function detectModel(nq) {
    const raw = String(nq || '');
    const matches = raw.match(/\b[a-z]{1,8}[\s._/-]?\d{1,5}[a-z0-9._/-]{0,12}\b|\b\d{2,3}[a-z]{1,5}\d{0,5}\b|\b(?:gg|gv|mg|ua|ue|qn|oled|qned|nano|uq|ur|cu|du|sr|gn|mj|sx|nt)[\s._/-]?\d{1,6}[a-z0-9._/-]*\b/gi) || [];
    return unique(matches).slice(0, 3);
  }


  function detectSignals(nq) {
    const signals = [];
    const add = (label, re) => { if (re.test(nq)) signals.push(label); };
    add('يوجد Google Play', /(google play|جوجل بلاي|play store)/);
    add('لا يوجد Google Play', /(لا يوجد.*google play|جوجل بلاي.*مش موجود|ما في.*جوجل بلاي)/);
    add('يوجد Smart Hub', /(smart hub|سامسونج ابس)/);
    add('يوجد LG Content Store', /(lg content store|متجر lg|متجر ال جي)/);
    add('يوجد VIDAA', /(vidaa|فايدا|فيدا)/);
    add('اتصال Wi‑Fi', /(واي فاي|wifi|wireless)/);
    add('اتصال LAN', /(lan|ethernet|كابل نت)/);
    add('هوتسبوت', /(hotspot|هوتسبوت|نقطة اتصال)/);
    add('ظهرت رسالة خطأ', /(خطا|خطأ|error|كود|code)/);
    add('بدأت بعد تحديث', /(بعد تحديث|بعد السوفت|بعد فلاشه|بعد فلاشة)/);
    add('احتمال صيانة فنية', /(حرق|دخان|لا يعمل نهائيا|صوت بدون صورة|شاشة سوداء|بوردة|كهرباء)/);
    return unique(signals);
  }

  function detectStoreHint(nq) {
    if (/(google play|جوجل بلاي|play store)/.test(nq)) return 'Google Play';
    if (/(smart hub|سامسونج ابس|samsung apps)/.test(nq)) return 'Samsung Smart Hub';
    if (/(lg content store|متجر lg|متجر ال جي)/.test(nq)) return 'LG Content Store';
    if (/(vidaa|فايدا|فيدا)/.test(nq)) return 'VIDAA Store';
    if (/(amazon appstore|فاير)/.test(nq)) return 'Amazon Appstore';
    return '';
  }

  function detectConnection(nq) {
    if (/(lan|ethernet|كابل نت)/.test(nq)) return 'LAN';
    if (/(hotspot|هوتسبوت|نقطة اتصال)/.test(nq)) return 'Hotspot';
    if (/(واي فاي|wifi|wireless)/.test(nq)) return 'Wi‑Fi';
    return '';
  }

  function detectSeverity(nq) {
    if (/(حرق|دخان|كهرباء|لا يعمل نهائيا|no power)/.test(nq)) return 'خطر/صيانة';
    if (/(بعد تحديث|واقف على الشعار|boot|logo|restart loop)/.test(nq)) return 'مرتفع';
    if (/(يعلق|تقطيع|بطيء|لا يظهر)/.test(nq)) return 'متوسط';
    return 'عادي';
  }

  function detectModelProfile(analysis) {
    const models = state.index?.dictionaries?.models || [];
    const nq = normalizeArabic(`${analysis.brand || ''} ${analysis.brandAr || ''} ${(analysis.models || []).join(' ')} ${analysis.nq || ''}`);
    let best = null;
    let bestScore = 0;
    for (const row of models) {
      const parts = [row.brand, row.nameAr, row.modelPattern, ...(row.aliases || [])].map(normalizeArabic).filter(Boolean);
      let score = 0;
      for (const part of parts) {
        if (part.length >= 2 && nq.includes(part)) score += Math.min(50, 10 + part.length);
      }
      if (row.category && analysis.deviceType && row.category === analysis.deviceType) score += 15;
      if (score > bestScore) { bestScore = score; best = row; }
    }
    return bestScore >= 28 ? { ...best, score: bestScore } : null;
  }

  function analyzeQuestion(question) {
    const historyText = state.messages.slice(-5).map(m => m.text).join(' ');
    const nq = normalizeArabic(`${historyText} ${question}`);
    const currentNq = normalizeArabic(question);
    const deviceType = detectDeviceType(nq);
    const brandMatches = detectFromAliases(nq).filter(x => !x.deviceType || x.deviceType !== 'app');
    const preferredBrand = brandMatches.find(x => deviceType ? x.deviceType === deviceType : true) || brandMatches[0] || null;
    return rememberAndMerge({
      nq,
      currentNq,
      deviceType,
      brand: preferredBrand?.canonical || '',
      brandAr: preferredBrand?.nameAr || '',
      brandDeviceType: preferredBrand?.deviceType || '',
      app: detectApp(nq),
      intent: detectIntent(nq),
      osHint: detectOsHint(nq),
      models: detectModel(question),
      storeHint: detectStoreHint(nq),
      connection: detectConnection(nq),
      severity: detectSeverity(nq),
      signals: detectSignals(nq),
      hasModel: detectModel(question).length > 0 || /(موديل\s*[:：]?[\s\w\-./]+)/i.test(question)
    });
  }

  function rememberAndMerge(analysis) {
    const mem = state.memory || {};
    const merged = { ...analysis };
    for (const key of ['deviceType', 'brand', 'brandAr', 'app', 'intent', 'osHint', 'storeHint', 'connection', 'symptom', 'severity']) {
      if (!merged[key] && mem[key]) merged[key] = mem[key];
    }
    if ((!merged.models || !merged.models.length) && mem.models?.length) merged.models = mem.models;
    merged.hasModel = merged.hasModel || (merged.models || []).length > 0;
    for (const key of ['deviceType', 'brand', 'brandAr', 'app', 'intent', 'osHint', 'storeHint', 'connection', 'symptom', 'severity']) {
      if (analysis[key]) mem[key] = analysis[key];
    }
    if (analysis.models?.length) mem.models = unique([...(mem.models || []), ...analysis.models]).slice(0, 4);
    if (analysis.signals?.length) mem.signals = unique([...(mem.signals || []), ...analysis.signals]).slice(0, 10);
    merged.signals = unique([...(merged.signals || []), ...(mem.signals || [])]).slice(0, 10);
    state.memory = mem;
    return merged;
  }

  function inferLikelyOs(analysis, articles = []) {
    if (analysis.osHint) return { os: analysis.osHint, certainty: 'مذكور في السؤال', needsModel: false };
    const modelProfile = detectModelProfile(analysis);
    if (modelProfile?.likelyOs) return { os: modelProfile.likelyOs, certainty: 'مستنتج من خريطة الموديلات الداخلية', needsModel: false, profile: modelProfile };
    const brand = normalizeArabic(analysis.brand || analysis.brandAr || '');
    const model = normalizeArabic((analysis.models || []).join(' '));
    const storeText = normalizeArabic(analysis.nq || '');
    if (/google play|جوجل بلاي|play store/.test(storeText)) return { os: 'Android TV / Google TV', certainty: 'مستنتج من وجود Google Play', needsModel: false };
    if (/smart hub|سمارت هب/.test(storeText)) return { os: 'Samsung Tizen', certainty: 'مستنتج من Smart Hub', needsModel: false };
    if (/lg content|متجر lg|متجر ال جي/.test(storeText)) return { os: 'LG webOS', certainty: 'مستنتج من متجر LG', needsModel: false };
    if (/vidaa|فايدا|فيدا/.test(storeText)) return { os: 'VIDAA', certainty: 'مستنتج من VIDAA', needsModel: false };
    const rules = [
      [/samsung|سامسونج|سمسونج/, 'Samsung Tizen', false],
      [/\blg\b|ال جي|إل جي|الجى|الجى/, 'LG webOS', false],
      [/sony|سوني|xiaomi|شاومي|skyworth|سكاي|tcl|تي سي|philips|فيليبس|nokia|نوكيا/, 'Google TV / Android TV', true],
      [/hisense|هايسنس|توشيبا|toshiba/, 'VIDAA أو Google TV حسب الموديل', true],
      [/g guard|g-guard|جي جارد|magic|ماجيك|general view|جنرال فيو|star-x|ستار|tiger|تايجر|national|ناشيونال|samix|سامكس|رووا|rowa/, 'Android TV / Google TV أو Smart OS حسب الموديل', true]
    ];
    for (const [re, os, needs] of rules) if (re.test(brand) || re.test(model)) return { os, certainty: needs ? 'تقدير داخلي يحتاج موديل للتأكيد' : 'تقدير قوي من الماركة', needsModel: needs && !analysis.hasModel };
    const osFromArticle = articles.map(r => r.article || r).flatMap(a => a?.operatingSystems || []).find(Boolean);
    if (osFromArticle) return { os: osFromArticle, certainty: 'مستنتج من أقرب مادة داخلية', needsModel: !analysis.hasModel };
    return { os: '', certainty: '', needsModel: analysis.deviceType === 'tv' && !analysis.hasModel };
  }

  function profileSentence(analysis, results = []) {
    const bits = [];
    if (analysis.deviceType) bits.push(analysis.deviceType === 'tv' ? 'شاشة/تلفزيون' : analysis.deviceType === 'receiver' ? 'ريسيفر' : 'Android/IPTV Box');
    if (analysis.brand || analysis.brandAr) bits.push(analysis.brandAr || analysis.brand);
    if (analysis.models?.length) bits.push(`موديل ${analysis.models.join(' / ')}`);
    if (analysis.app) bits.push(`تطبيق ${analysis.app}`);
    const os = inferLikelyOs(analysis, results);
    if (os.os) bits.push(`النظام المتوقع: ${os.os}`);
    return { text: bits.length ? `فهمت من كلامك أن المشكلة تخص ${bits.join(' · ')}.` : 'فهمت السؤال، وسأشخصه من الداتا الداخلية خطوة بخطوة.', os };
  }

  function buildInternalPlan(analysis, results = []) {
    const intent = analysis.intent || 'unknown';
    const plans = {
      install_youtube: [`أحدد نظام الشاشة أو المتجر أولًا لأن طريقة YouTube تختلف حسب النظام.`, `أفرق بين: التطبيق غير موجود، التطبيق موجود ويعلق، أو الجهاز قديم لا يدعم.`, `أقترح طريقًا رسميًا فقط: متجر النظام أو جهاز خارجي مدعوم.`],
      install_shahid: [`أفحص دعم Shahid حسب النظام والبلد.`, `أراجع المتجر الرسمي والحساب والمنطقة.`, `إذا التطبيق غير مدعوم أعطي بديلًا رسميًا بجهاز خارجي.`],
      install_netflix: [`أفحص دعم Netflix واعتماد الجهاز.`, `أطلب كود الخطأ إذا ظهر.`, `أميز بين مشكلة حساب، شبكة، أو موديل قديم.`],
      install_tod_osn: [`أفحص البلد والدعم الرسمي للتطبيق.`, `أراجع المتجر والحساب والمنطقة.`, `أعطي بديلًا رسميًا عند عدم الدعم.`],
      app_not_found: [`أحدد المتجر الموجود فعلًا.`, `أربط المتجر بنظام التشغيل.`, `إذا النظام محدود أطلب الموديل وأقترح جهازًا خارجيًا رسميًا.`],
      app_freeze: [`أفصل بين مشكلة التطبيق ومشكلة الإنترنت.`, `أبدأ بإغلاق التطبيق ومسح الكاش والتحديث.`, `إذا المشكلة بكل التطبيقات أراجع الذاكرة والنظام.`],
      clear_cache: [`أبدأ بمسح الكاش أو إعادة التثبيت حسب النظام.`, `أحافظ على الحسابات قدر الإمكان.`, `إذا لا يوجد خيار كاش أعطي بديلًا آمنًا.`],
      connect_wifi: [`أفحص الشبكة والتردد 2.4GHz/5GHz.`, `أعزل المشكلة بتجربة هوتسبوت الهاتف.`, `أراجع التاريخ والوقت وDNS عند الاتصال بدون خدمة.`],
      wifi_not_visible: [`أفحص هل الشبكة 5GHz فقط أو مخفية.`, `أطلب تجربة 2.4GHz.`, `أراجع قرب الجهاز من الراوتر وقطعة Wi‑Fi إن كان ريسيفر.`],
      connect_lan: [`أفحص الكابل ومنفذ الراوتر.`, `أراجع DHCP/IP التلقائي.`, `أقارن LAN مع Wi‑Fi لعزل المشكلة.`],
      internet_connected_no_service: [`أصحح الوقت والتاريخ أولًا.`, `أجرب DNS/إعادة تشغيل الراوتر.`, `أفصل بين الإنترنت وبين انتهاء اشتراك رسمي.`],
      iptv_buffering: [`أقارن بين Wi‑Fi وLAN.`, `أفحص سرعة الشبكة والتقطيع على تطبيق واحد أو كل التطبيقات.`, `ألتزم بمزود IPTV رسمي وقانوني فقط.`],
      no_signal: [`أحدد هل No Signal من التلفزيون HDMI أم من الريسيفر/الدش.`, `أفحص Input/HDMI أولًا.`, `ثم أفحص LNB والكابل والقمر وجودة الإشارة.`],
      weak_signal: [`أركز على جودة الإشارة Quality وليس القوة فقط.`, `أفحص الكابل والكونكتور وLNB.`, `أقترح فني دش عند الحاجة لضبط الطبق.`],
      transponder_add: [`أطلب التردد والاستقطاب ومعدل الترميز.`, `أتحقق من القمر قبل البحث.`, `أميز بين خطأ بيانات وخطأ إشارة.`],
      diseqc_setup: [`أربط كل قمر بمنفذ DiSEqC الصحيح.`, `أجرب المنافذ بالترتيب.`, `أراقب الجودة بعد كل تغيير.`],
      software_update_safe: [`لا أعطي خطوة سوفتوير بدون موديل كامل.`, `أسمح بالتحديث الرسمي المطابق فقط.`, `أمنع الملفات العشوائية لأنها قد توقف الجهاز.`],
      boot_logo_stuck: [`أعزل USB/HDMI وأفصل الكهرباء.`, `أتحقق هل المشكلة بعد تحديث.`, `إذا عالق بعد سوفتوير أوجه لفني أو ملف رسمي مطابق.`],
      remote_not_working: [`أميز بين ريموت IR وBluetooth/RF.`, `أبدأ بالبطاريات واختبار كاميرا الهاتف.`, `ثم أجرب الاقتران إذا كان ريموت ذكي.`],
      hdmi: [`أفحص المصدر والكابل والمنفذ.`, `أخفض الدقة إذا الشاشة لا تعرض الصورة.`, `أعزل المشكلة بتجربة جهاز أو شاشة ثانية.`],
      hdmi_no_signal: [`أتحقق من اختيار المصدر الصحيح.`, `أجرب كابل ومنفذ آخر.`, `أخفض دقة الجهاز إذا الشاشة لا تدعمها.`],
      arc_earc_sound: [`أستخدم منفذ ARC/eARC الصحيح.`, `أفعّل HDMI-CEC.`, `أحدد إخراج الصوت من الشاشة.`],
      screen_cast: [`أتأكد أن الهاتف والشاشة على نفس الشبكة.`, `أفحص دعم Chromecast/AirPlay/Mirroring.`, `أوقف VPN وأعيد تشغيل الراوتر.`],
      black_screen: [`أفرق بين شاشة سوداء داخل تطبيق وبين عطل صورة عام.`, `أفحص HDMI والسطوع وتوفير الطاقة.`, `إذا الصوت موجود والصورة سوداء دائمًا أوجه لفني.`],
      no_power_tv: [`أبدأ بمقبس وكابل كهرباء.`, `لا أطلب فتح الشاشة.`, `إذا لا توجد لمبة أو رائحة حرق أوجه لفني فورًا.`],
      unknown: [`أحدد نوع الجهاز أولًا.`, `أستخرج الماركة والموديل والتطبيق من كلامك.`, `أعطي خطوات آمنة وأسأل متابعة إذا يلزم.`]
    };
    return plans[intent] || plans.unknown;
  }

  function internalBrainBox(analysis, results = []) {
    const prof = profileSentence(analysis, results);
    const plan = buildInternalPlan(analysis, results);
    const missing = [];
    if ((analysis.deviceType === 'tv' || /tv/.test(analysis.brandDeviceType || '')) && !analysis.hasModel) missing.push('موديل الشاشة');
    if ((analysis.deviceType === 'receiver' || /receiver/.test(analysis.brandDeviceType || '')) && /software|update|سوفت|تحديث|واي|wifi/.test(`${analysis.intent} ${analysis.nq}`) && !analysis.hasModel) missing.push('موديل الريسيفر');
    if (analysis.deviceType === 'tv' && !analysis.osHint && !analysis.storeHint) missing.push('اسم المتجر الظاهر');
    const signals = unique([...(analysis.signals || []), ...(state.memory?.signals || [])]).slice(0, 6);
    let html = `<div class="internal-box"><strong>تشخيص المساعد الداخلي المتقدم</strong><p>${esc(prof.text)}</p>`;
    if (prof.os.os) html += `<p>النظام/المسار الأقرب: <strong>${esc(prof.os.os)}</strong> <span class="muted-inline">(${esc(prof.os.certainty)})</span></p>`;
    if (signals.length) html += `<p><strong>إشارات فهمتها:</strong> ${signals.map(x => `<span class="route-chip">${esc(x)}</span>`).join(' ')}</p>`;
    html += `<ul>${plan.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    if (missing.length) html += `<div class="missing-box"><strong>ناقص للتأكيد:</strong> ${missing.map(esc).join('، ')}</div>`;
    html += `</div>`;
    return html;
  }

  function smartFollowup(analysis, topArticle) {
    const qs = [];
    if ((analysis.deviceType === 'tv' || topArticle?.deviceType === 'tv') && !analysis.hasModel) qs.push('اكتب موديل الشاشة الكامل، أو قل لي اسم المتجر الظاهر: Google Play / Smart Hub / LG Content Store / VIDAA / متجر آخر.');
    if ((analysis.deviceType === 'receiver' || topArticle?.deviceType === 'receiver') && !analysis.hasModel && /تحديث|سوفت|firmware|update|wifi|واي|server|سيرفر/.test(analysis.nq)) qs.push('اكتب موديل الريسيفر من Menu ← Information / STB Info، واذكر هل الاتصال Wi‑Fi أم LAN.');
    if (analysis.intent === 'app_freeze' || analysis.intent === 'app_not_found') qs.push('هل التطبيق غير موجود في المتجر، أم موجود لكنه يفتح ويعلق؟');
    if (analysis.intent === 'iptv_buffering') qs.push('هل التقطيع على Wi‑Fi فقط أم حتى مع كابل LAN، وهل يحصل على كل التطبيقات أم تطبيق واحد؟');
    if (analysis.intent === 'no_signal') qs.push('هل الرسالة تظهر من التلفزيون كمدخل HDMI، أم داخل شاشة الريسيفر على القناة؟');
    if (analysis.intent === 'software_update_safe') qs.push('لا ترسل أي ملف تحديث قبل ما تكتب الموديل الكامل وإصدار الهاردوير إن ظهر.');
    if (analysis.intent === 'login_problem') qs.push('اكتب نص كود الخطأ أو الرسالة كما تظهر، بدون إرسال كلمة المرور.');
    if (!qs.length) qs.push('اكتب لي آخر رسالة ظهرت أو ماذا حدث بعد أول خطوة، وبكمل معك بنفس التشخيص.');
    return unique(qs).slice(0, 3);
  }


  function articleMatchesIntent(intent, article) {
    const hay = `${article.intent || ''} ${article.category || ''} ${article.title || ''} ${(article.keywords || []).join(' ')}`.toLowerCase();
    const map = {
      connect_wifi: ['wifi', 'connect_wifi', 'wireless', 'واي'], connect_lan: ['lan', 'ethernet'], hotspot: ['hotspot', 'هوتسبوت'],
      install_app: ['install', 'app', 'تطبيق', 'تنزيل'], install_youtube: ['youtube', 'يوتيوب'], install_shahid: ['shahid', 'شاهد'], install_netflix: ['netflix', 'نتفليكس'], install_tod_osn: ['tod', 'osn', 'install_tod_osn'],
      app_freeze: ['freeze', 'crash', 'يعلق', 'تعليق'], app_not_found: ['not_found', 'غير موجود', 'لا يظهر'], login_problem: ['login', 'account', 'تسجيل'],
      iptv_buffering: ['iptv', 'buffer', 'تقطيع'], no_signal: ['signal', 'اشاره', 'إشارة'], update_firmware: ['update', 'firmware', 'سوفت'],
      factory_reset: ['factory', 'reset', 'ضبط'], remote_not_working: ['remote', 'ريموت', 'pair'], identify_model_os: ['model', 'os', 'موديل', 'نظام'],
      hdmi: ['hdmi', 'source', 'resolution'], sound: ['audio', 'sound', 'صوت', 'arc'], screen_cast: ['cast', 'mirroring', 'airplay'],
      storage_full: ['storage', 'ذاكره', 'مساحه'], official_subscription_activation: ['subscription', 'activation', 'اشتراك', 'تفعيل'], date_time: ['date', 'time', 'تاريخ'],
      dns: ['dns'], black_screen: ['black', 'سوداء'], power_issue: ['power', 'كهرباء'], bluetooth: ['bluetooth', 'بلوتوث']
    };
    return (map[intent] || []).some(term => hay.includes(term.toLowerCase()));
  }

  function scoreArticle(question, article, analysis = analyzeQuestion(question)) {
    const ts = tokens(question);
    if (!ts.length) return 0;
    let score = 0;
    const text = article.normalizedText || normalizeArabic([article.title, article.summary, (article.steps || []).join(' '), (article.keywords || []).join(' ')].join(' '));
    const at = new Set(article.tokens || []);
    for (const t of ts) {
      if (at.has(t)) score += 8;
      else if (text.includes(t)) score += 4;
      for (const kw of (article.keywords || [])) {
        const nkw = normalizeArabic(kw);
        if (nkw === t) score += 7;
        else if (nkw.includes(t) && t.length >= 3) score += 3;
      }
    }
    const nq = analysis.nq;
    const articleBrand = normalizeArabic(article.brand || '');
    const articleNameAr = normalizeArabic(article.nameAr || '');
    if (analysis.brand) {
      const b = normalizeArabic(analysis.brand);
      if (articleBrand === b || articleNameAr === normalizeArabic(analysis.brandAr)) score += 55;
      else if (articleBrand && articleBrand !== b && (article.deviceType || '').includes(analysis.deviceType || analysis.brandDeviceType)) score -= 10;
    }
    if (analysis.app) {
      const app = normalizeArabic(analysis.app);
      if (articleBrand === app || text.includes(app)) score += 45;
    }
    for (const kw of (article.keywords || [])) {
      const na = normalizeArabic(kw);
      if (na.length >= 3 && nq.includes(na)) score += Math.min(28, 8 + na.length / 2);
    }
    const type = String(article.deviceType || article.category || '').toLowerCase();
    if (analysis.deviceType) {
      if (type.includes(analysis.deviceType)) score += 35;
      else if (/receiver|tv|android-receiver-iptv-box/.test(type)) score -= 16;
    }
    if (analysis.brandDeviceType && type.includes(analysis.brandDeviceType)) score += 14;
    if (analysis.intent !== 'unknown') {
      if (articleMatchesIntent(analysis.intent, article)) score += 42;
      else if (article.intent && !articleMatchesIntent(analysis.intent, article)) score -= 2;
    }
    if (analysis.osHint && (article.operatingSystems || []).some(os => normalizeArabic(os).includes(normalizeArabic(analysis.osHint)))) score += 24;
    for (const model of analysis.models) {
      const m = normalizeArabic(model);
      if ((article.knownModels || []).some(k => normalizeArabic(k).includes(m) || m.includes(normalizeArabic(k)))) score += 35;
      if (text.includes(m)) score += 20;
    }
    score += safeSpecificityBoost(article, analysis);
    return Math.round(score);
  }

  function safeSpecificityBoost(article, analysis) {
    let boost = 0;
    const title = normalizeArabic(article.title || '');
    if (analysis.intent === 'install_youtube' && /يوتيوب|youtube/.test(title)) boost += 18;
    if (analysis.intent === 'install_shahid' && /شاهد|shahid/.test(title)) boost += 18;
    if (analysis.intent === 'iptv_buffering' && /iptv|تقطيع|يقطع/.test(title)) boost += 18;
    if (analysis.intent === 'no_signal' && /اشاره|إشارة|signal/.test(title)) boost += 18;
    if (analysis.intent === 'identify_model_os' && /موديل|نظام/.test(title)) boost += 18;
    if (/diagnostic-flow/.test(article.category || '') && boost === 0) boost += 3;
    return boost;
  }

  function shardCategoriesForAnalysis(analysis = {}) {
    const cats = new Set(['diagnostic-flow', 'common-error', 'network', 'safe-repair', 'support', 'signal', 'approved-answer']);
    if (analysis.deviceType === 'receiver') cats.add('receiver');
    if (analysis.deviceType === 'tv') { cats.add('tv'); cats.add('os-system'); cats.add('app'); }
    if (analysis.deviceType === 'android-receiver-iptv-box') { cats.add('android-receiver-iptv-box'); cats.add('app'); cats.add('network'); }
    if (analysis.app || /^install_|app_|clear_cache|update_app|login_problem|storage_full|country_region_tv|screen_cast/.test(analysis.intent || '')) { cats.add('app'); cats.add('os-system'); cats.add('tv'); }
    if (/wifi|lan|hotspot|internet|dns|date_time/.test(analysis.intent || '')) cats.add('network');
    if (/no_signal|weak_signal|channel_scan|transponder|diseqc|lnb|motor/.test(analysis.intent || '')) { cats.add('receiver'); cats.add('signal'); }
    if (/hdmi|arc|sound|bluetooth|remote|black_screen|power|firmware|factory|boot|restart/.test(analysis.intent || '')) { cats.add('common-error'); cats.add('safe-repair'); cats.add('tv'); cats.add('receiver'); }
    if (!analysis.deviceType && !analysis.app && (!analysis.intent || analysis.intent === 'unknown')) {
      ['receiver', 'tv', 'android-receiver-iptv-box', 'app', 'os-system'].forEach(c => cats.add(c));
    }
    return [...cats];
  }

  function shardFilesForCategories(categories = []) {
    const wanted = new Set(categories);
    return (state.index?.shards || []).filter(s => wanted.has(s.category)).map(s => s.file);
  }

  async function loadShardFiles(files = []) {
    const needed = files.filter(Boolean).filter(file => !state.loadedShards.has(file));
    if (!needed.length) return;
    const loaded = await Promise.all(needed.map(async file => {
      const res = await fetch(`/service/index/${file}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`تعذر تحميل جزء من قاعدة المعرفة: ${file}`);
      return { file, payload: await res.json() };
    }));
    const byId = new Map(state.articles.map(a => [a.id, a]));
    for (const { file, payload } of loaded) {
      for (const article of (payload.articles || [])) byId.set(article.id, article);
      state.loadedShards.add(file);
      if (payload.category) state.loadedCategories.add(payload.category);
    }
    state.articles = [...byId.values()];
  }

  async function ensureArticlesForQuestion(question, options = {}) {
    if (!state.index) await loadIndex();
    if (!state.index?.sharded) return;
    if (options.all) {
      await loadShardFiles((state.index.shards || []).map(s => s.file));
      state.allShardsLoaded = true;
      return;
    }
    const analysis = analyzeQuestion(question);
    const files = shardFilesForCategories(shardCategoriesForAnalysis(analysis));
    await loadShardFiles(files);
  }

  async function loadIndex() {
    let res = await fetch('/service/index/service-index-manifest.json', { cache: 'no-store' });
    if (!res.ok) res = await fetch('/service/index/service-search-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل قاعدة المعرفة');
    state.index = await res.json();
    state.articles = state.index.articles || [];
    state.loadedShards = new Set();
    state.loadedCategories = new Set();
    state.allShardsLoaded = !state.index.sharded;
    $('#statArticles').textContent = state.index.count || state.articles.length;
    $('#statBrands').textContent = Object.keys(state.index.brandCounts || {}).length;
    $('#statCats').textContent = Object.keys(state.index.categoryCounts || {}).length;
  }

  function buildConversationQuestion(q) {
    const tail = state.messages.slice(-6).map(m => `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.text}`).join('\n');
    return `${tail}\nالمستخدم الآن: ${q}`.trim();
  }

  function preferDeviceSpecific(results, question, analysis) {
    if (!results.length) return results;
    const top = results[0];
    const preferred = results.find(x => {
      const a = x.article || {};
      const type = String(a.deviceType || a.category || '').toLowerCase();
      if (x.score < top.score - 36) return false;
      if (analysis.brand && normalizeArabic(a.brand || '') === normalizeArabic(analysis.brand)) return true;
      if (analysis.deviceType && type.includes(analysis.deviceType) && articleMatchesIntent(analysis.intent, a)) return true;
      if (analysis.app && normalizeArabic(a.brand || '') === normalizeArabic(analysis.app)) return true;
      return false;
    });
    if (preferred && preferred !== top) return [preferred, ...results.filter(x => x !== preferred)];
    return results;
  }

  function bestResults(q, limit = 8) {
    const full = buildConversationQuestion(q);
    const analysis = analyzeQuestion(q);
    const results = state.articles
      .map(a => ({ article: a, score: Math.max(scoreArticle(q, a, analysis), scoreArticle(full, a, analysis) - 6) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(limit * 4, 32));
    return preferDeviceSpecific(results, q, analysis).slice(0, limit);
  }

  function appendMessage(role, html, options = {}) {
    const log = $('#chatLog');
    const msg = document.createElement('div');
    msg.className = `msg ${role === 'user' ? 'user-msg' : 'assistant-msg'} ${options.typing ? 'typing' : ''}`;
    if (options.id) msg.id = options.id;
    msg.innerHTML = `<div class="avatar">${role === 'user' ? '👤' : '🛠️'}</div><div class="bubble">${html}</div>`;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function appendTextMessage(role, text) {
    appendMessage(role, formatPlainText(text));
    state.messages.push({ role, text: String(text || '').slice(0, 1400) });
  }

  function setTyping(isTyping) {
    const old = document.getElementById('typingMessage');
    if (old) old.remove();
    if (isTyping) appendMessage('assistant', 'جاري التفكير <span class="typing-dots"><span></span><span></span><span></span></span>', { typing: true, id: 'typingMessage' });
  }

  function setMode(source) {
    const mode = $('#assistantMode');
    if (!mode) return;
    mode.classList.toggle('ai', source === 'ai');
    mode.textContent = source === 'ai' ? 'AI خارجي احتياطي' : source === 'unanswered' ? 'بحاجة لتفاصيل' : source === 'clarify' ? 'يسأل متابعة' : 'مساعد داخلي فائق';
  }

  function shouldAskModel(article, analysis) {
    const needs = article?.needsModelWhen || [];
    const text = `${article?.title || ''} ${article?.summary || ''} ${(article?.keywords || []).join(' ')}`;
    if (analysis.hasModel) return false;
    return needs.length > 0 || analysis.deviceType === 'tv' || /موديل|نظام|شاشة|G-Guard|Magic|General View|سامسونج|LG|webOS|Tizen|VIDAA/i.test(text);
  }

  function needsSafety(article, analysis) {
    const text = `${article?.title || ''} ${article?.summary || ''} ${(article?.steps || []).join(' ')} ${analysis.intent}`;
    return /صيانة|كهرباء|شاشة سوداء|سوفتوير|تحديث|الشعار|بوردة|لحام|حرق|power|firmware|black_screen|power_issue/i.test(text);
  }

  function diagnosisIntro(analysis, source, topScore) {
    const bits = [];
    if (analysis.brand || analysis.brandAr) bits.push(`الجهاز الأقرب: <strong>${esc(analysis.brandAr || analysis.brand)}</strong>`);
    if (analysis.app) bits.push(`التطبيق: <strong>${esc(analysis.app)}</strong>`);
    if (analysis.intent && analysis.intent !== 'unknown') bits.push(`الموضوع: <strong>${esc(INTENT_LABELS[analysis.intent] || analysis.intent)}</strong>`);
    if (analysis.osHint) bits.push(`النظام المذكور: <strong>${esc(analysis.osHint)}</strong>`);
    const src = source === 'ai' ? 'استخدمت AI احتياطي مع الداتا القريبة' : 'اعتمدت على الداتا الداخلية';
    return `<p class="context-note">${src}${topScore ? ` · درجة المطابقة الداخلية: ${topScore}` : ''}${bits.length ? `<br>${bits.join(' · ')}` : ''}</p>`;
  }

  function mergeSteps(articles, max = 10) {
    const steps = [];
    for (const a of articles) {
      for (const step of (a?.steps || [])) {
        const clean = String(step || '').trim();
        if (!clean) continue;
        const k = normalizeArabic(clean).slice(0, 90);
        if (!steps.some(s => normalizeArabic(s).slice(0, 90) === k)) steps.push(clean);
        if (steps.length >= max) return steps;
      }
    }
    return steps;
  }

  function findSupportingArticles(results, analysis, topArticle) {
    const out = [topArticle].filter(Boolean);
    if (analysis.app) {
      const appArticle = results.map(r => r.article).find(a => a !== topArticle && normalizeArabic(a.brand || '') === normalizeArabic(analysis.app));
      if (appArticle) out.push(appArticle);
    }
    if (analysis.deviceType === 'tv') {
      const osArticle = results.map(r => r.article).find(a => a !== topArticle && /identify_model_os|install_tv_apps|app_not_found/.test(a.intent || ''));
      if (osArticle) out.push(osArticle);
    }
    const diag = results.map(r => r.article).find(a => a !== topArticle && a.category === 'diagnostic-flow');
    if (diag) out.push(diag);
    return uniqueArticles(out).slice(0, 3);
  }

  function uniqueArticles(articles) {
    const out = [];
    const seen = new Set();
    for (const a of articles || []) {
      if (!a) continue;
      const id = a.id || `${a.title}|${a.brand}`;
      if (!seen.has(id)) { seen.add(id); out.push(a); }
    }
    return out;
  }


  function expertSummaryBox(analysis, results = []) {
    const top = results?.[0]?.article;
    const causes = [];
    if (/app_not_found|install_/.test(analysis.intent || '')) causes.push('السبب الأقرب عادة يكون اختلاف نظام التشغيل أو عدم دعم التطبيق للموديل/البلد.');
    if (/app_freeze|iptv_buffering/.test(analysis.intent || '')) causes.push('السبب الأقرب قد يكون كاش التطبيق أو الإنترنت أو إصدار التطبيق.');
    if (/no_signal|weak_signal|lnb|diseqc/.test(analysis.intent || '')) causes.push('السبب الأقرب يكون بين المصدر/HDMI أو إعداد الدش والكابل حسب مكان ظهور الرسالة.');
    if (/software|boot_logo|restart/.test(analysis.intent || '')) causes.push('السبب حساس: تحديث غير مطابق أو خلل نظام، لذلك يلزم موديل دقيق قبل أي خطوة.');
    if (/black_screen|no_power|power/.test(analysis.intent || '')) causes.push('قد تكون صيانة فنية، لذلك نبدأ فقط بخطوات آمنة دون فتح الجهاز.');
    if (!causes.length && top?.summary) causes.push(top.summary);
    return `<div class="expert-box"><strong>الخلاصة الفنية:</strong><p>${esc(causes[0] || 'سأتعامل معها كتشخيص تدريجي آمن حسب الجهاز والموديل.')}</p></div>`;
  }

  function articleToSmartReply(question, results, source = 'internal') {
    const analysis = analyzeQuestion(question);
    const top = results?.[0]?.article || null;
    const topScore = results?.[0]?.score || 0;
    if (!top || topScore < 7) return clarificationReply(question, analysis, results);
    const support = findSupportingArticles(results || [], analysis, top);
    const title = top.title || 'حل مقترح';
    let html = `<strong>${esc(title)}</strong>`;
    html += diagnosisIntro(analysis, source, topScore);
    html += internalBrainBox(analysis, results || []);
    html += expertSummaryBox(analysis, results || []);
    if (top.summary) html += `<p>${esc(top.summary)}</p>`;
    const steps = mergeSteps(support, 11);
    if (steps.length) html += `<ol>${steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>`;
    if (support.length > 1) {
      html += `<span class="small-note"><strong>ربط ذكي:</strong> جمعت لك الحل من ${support.length} مواد داخلية لأن سؤالك فيه جهاز/تطبيق/نظام معًا، مش جواب محفوظ واحد فقط.</span>`;
    }
    if (shouldAskModel(top, analysis)) {
      html += `<span class="small-note"><strong>حتى أعطيك جواب أدق:</strong> اكتب الموديل الكامل. للتلفزيون عادة تجده من الإعدادات ← الدعم/النظام ← حول التلفزيون، أو على الملصق الخلفي. للريسيفر: Menu ← Information / STB Info.</span>`;
    }
    if (needsSafety(top, analysis)) {
      html += `<span class="safety-note"><strong>تنبيه أمان:</strong> لا تفتح الشاشة أو الريسيفر ولا تركّب سوفتوير مجهول. إذا في رائحة حرق، فصل كهرباء، أو الجهاز عالق بعد تحديث، الأفضل فني مختص.</span>`;
    }
    const followups = smartFollowup(analysis, top);
    html += `<div class="followup-box"><strong>الخطوة التالية:</strong><ul>${followups.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    state.lastDiagnosis = { analysis, article: top, score: topScore, at: Date.now() };
    return { source, html, article: top };
  }

  function clarificationReply(question, analysis, results = []) {
    const lines = [];
    if (analysis.deviceType === 'tv' || /شاشه|شاشة|تلفزيون/.test(analysis.nq)) {
      lines.push('نوع الشاشة والموديل الكامل.');
      lines.push('اسم المتجر الظاهر عندك: Google Play، Smart Hub، LG Content Store، VIDAA، أو متجر آخر؟');
      if (analysis.app) lines.push(`هل تطبيق ${analysis.app} غير موجود، أم موجود لكنه يعلق؟`);
    } else if (analysis.deviceType === 'receiver' || /ريسيفر|رسيفر/.test(analysis.nq)) {
      lines.push('ماركة وموديل الريسيفر من Menu ← Information / STB Info.');
      lines.push('هل الاتصال Wi‑Fi أم LAN أم هوتسبوت؟');
      lines.push('اكتب نص رسالة الخطأ إذا ظهرت.');
    } else if (analysis.deviceType === 'android-receiver-iptv-box') {
      lines.push('نوع الجهاز: Android Box / MAG / Formuler / Fire Stick / Chromecast؟');
      lines.push('هل المشكلة في التطبيق، الإنترنت، أو الصورة/الصوت؟');
    } else {
      lines.push('هل الجهاز شاشة، ريسيفر، Android Box، أو تطبيق؟');
      lines.push('اكتب الماركة والموديل إن وجد.');
      lines.push('اكتب المشكلة بكلمتين: يوتيوب، نت، IPTV، No Signal، ريموت، تحديث...');
    }
    const related = (results || []).slice(0, 3).map(r => r.article?.title).filter(Boolean);
    let text = `أقدر أساعدك، بس حتى ما أعطيك طريقة غلط بدي معلومتين:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
    if (related.length) text += `\n\nلقيت مواد قريبة في الداتا: ${related.join('، ')}. اكتب التفصيل الناقص وبربطها لك مباشرة.`;
    return { source: 'clarify', html: formatPlainText(text), article: results?.[0]?.article || null };
  }

  async function askApi(question, context, allowAi = false) {
    const history = state.messages.slice(-8).map(m => ({ role: m.role, content: m.text }));
    try {
      const res = await fetch('/api/service-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, history, context: context.slice(0, 5), page: location.pathname, mode: 'chat', allowAi })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function logQuestion(question, source, article) {
    try {
      await fetch('/api/service-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, context: [article].filter(Boolean), logOnly: true, page: location.pathname, answerSource: source })
      });
    } catch {}
  }

  async function ask() {
    const input = $('#question');
    const q = input.value.trim();
    if (q.length < 3) { alert('اكتب الرسالة أولًا.'); return; }
    input.value = '';
    appendTextMessage('user', q);
    $('#askBtn').disabled = true;
    $('#askBtn').textContent = 'جاري الرد...';
    setTyping(true);

    try {
      await ensureArticlesForQuestion(q);
      let results = bestResults(q, 10);
      let topScore = results[0]?.score || 0;
      if (topScore < 5 && state.index?.sharded && !state.allShardsLoaded) {
        await ensureArticlesForQuestion(q, { all: true });
        results = bestResults(q, 10);
        topScore = results[0]?.score || 0;
      }
      state.lastContext = results.map(x => x.article);
      let reply;
      if (topScore >= 8) {
        state.internalMisses = 0;
        reply = articleToSmartReply(q, results, 'internal');
        logQuestion(q, reply.source, reply.article).catch(() => {});
      } else if (topScore >= 3) {
        state.internalMisses += 1;
        reply = clarificationReply(q, analyzeQuestion(q), results);
        logQuestion(q, 'clarify-internal', reply.article).catch(() => {});
      } else {
        state.internalMisses += 1;
        const allowExternalAi = state.internalMisses >= 2 && /(?:ما عرفت|مش واضح|مش موجود|استخدم الذكاء|حل خارجي|external|ai)/i.test(q);
        const api = allowExternalAi ? await askApi(q, state.lastContext, true) : null;
        if (api && api.ok && api.source === 'ai') {
          reply = { source: 'ai', html: api.article ? articleToSmartReply(q, [{ article: api.article, score: 1 }, ...results], 'ai').html : formatPlainText(api.reply || 'أعطني تفاصيل أكثر.'), article: api.article || null };
        } else if (api && api.ok && api.article) {
          reply = articleToSmartReply(q, [{ article: api.article, score: api.score || topScore }, ...results], api.source || 'internal');
        } else {
          reply = clarificationReply(q, analyzeQuestion(q), results);
          logQuestion(q, 'unanswered-internal', reply.article).catch(() => {});
        }
      }
      setTyping(false);
      appendMessage('assistant', reply.html);
      state.messages.push({ role: 'assistant', text: stripHtml(reply.html) });
      setMode(reply.source);
    } catch (err) {
      setTyping(false);
      const text = 'صار عندي مشكلة مؤقتة بالرد. اكتب نوع الجهاز والموديل، أو جرّب السؤال مرة ثانية.';
      appendTextMessage('assistant', text);
      setMode('unanswered');
    } finally {
      $('#askBtn').disabled = false;
      $('#askBtn').textContent = 'إرسال للمساعد';
      input.focus();
    }
  }

  function resetChat() {
    state.messages = [];
    $('#chatLog').innerHTML = `<div class="msg assistant-msg"><div class="avatar">🛠️</div><div class="bubble"><strong>بدأنا محادثة جديدة.</strong><p>اكتب نوع الجهاز والمشكلة، وإذا احتجت الموديل بسألك عنه.</p></div></div>`;
    $('#question').value = '';
    setMode('internal');
    $('#question').focus();
  }

  function setExample(q) {
    $('#question').value = q;
    $('#question').focus();
    ask();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('#askBtn').addEventListener('click', ask);
    $('#clearBtn').addEventListener('click', resetChat);
    document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => setExample(b.dataset.example)));
    $('#question').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });
    try { await loadIndex(); }
    catch (e) {
      appendTextMessage('assistant', `تعذر تحميل الداتا الداخلية: ${e.message}`);
      setMode('unanswered');
    }
  });
})();
