/* MaenSat first-load safety guard
   يحمي الموقع كامل عند أول زيارة من فيسبوك/المتصفح المخفي: إذا تعطل سكربت فرعي أو كانت localStorage غير متاحة، يضمن ظهور صفحة صالحة بدل شاشة فارغة. */
(function(){
  'use strict';
  if (window.__MAENSAT_FIRST_LOAD_SAFE__) return;
  window.__MAENSAT_FIRST_LOAD_SAFE__ = true;

  var warned = false;
  var lastRequestedPage = '';

  function log(msg, err){
    if (warned) return;
    warned = true;
    try { console.warn('[MaenSat first-load-safe] ' + msg, err || ''); } catch(e) {}
  }

  function installMemoryStorageFallback(){
    try {
      var k = '__maensat_storage_test__' + Date.now();
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return;
    } catch(e) {
      log('localStorage غير متاح، سيتم استخدام تخزين مؤقت لهذه الزيارة فقط.', e);
    }
    var data = Object.create(null);
    var fallback = {
      getItem: function(k){ k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function(k, v){ data[String(k)] = String(v); },
      removeItem: function(k){ delete data[String(k)]; },
      clear: function(){ data = Object.create(null); },
      key: function(i){ return Object.keys(data)[i] || null; },
      get length(){ return Object.keys(data).length; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: fallback, configurable: true }); } catch(e2) {}
  }

  installMemoryStorageFallback();

  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isMobileView(){
    try {
      return !!(window.matchMedia && (
        window.matchMedia('(max-width: 900px)').matches ||
        window.matchMedia('(hover: none) and (pointer: coarse)').matches
      ));
    } catch(e) { return false; }
  }

  function visible(el){
    if (!el) return false;
    try {
      var cs = window.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    } catch(e) {
      return el.classList && el.classList.contains('active');
    }
  }

  function requestedPage(){
    var hash = String(window.location.hash || '').replace(/^#/, '').trim();
    if (hash) return hash;
    try {
      var params = new URLSearchParams(window.location.search || '');
      var section = params.get('section') || params.get('page') || '';
      if (section) return section;
    } catch(e) {}
    return '';
  }

  function pageExists(id){ return !!(id && document.getElementById(id) && document.getElementById(id).classList.contains('page')); }

  function chooseFallbackPage(){
    var requested = requestedPage();
    if (pageExists(requested)) return requested;
    if (lastRequestedPage && pageExists(lastRequestedPage)) return lastRequestedPage;
    if (isMobileView() && pageExists('maintenance')) return 'maintenance';
    if (pageExists('home')) return 'home';
    var first = qs('.page');
    return first ? first.id : '';
  }

  function manualShowPage(id, skipHistory){
    if (!pageExists(id)) id = chooseFallbackPage();
    if (!id) return;
    lastRequestedPage = id;
    qsa('.page').forEach(function(page){ page.classList.remove('active'); });
    var target = document.getElementById(id);
    if (target) target.classList.add('active');
    qsa('[data-nav-target]').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-nav-target') === id);
      if (btn.getAttribute('data-nav-target') === id) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    if (!skipHistory) {
      try {
        var newHash = '#' + id;
        if (window.location.hash !== newHash) history.pushState({page:id}, '', newHash);
      } catch(e) {}
    }
  }

  function ensureVisible(){
    var pages = qsa('.page');
    if (!pages.length) return;
    var active = qs('.page.active');
    if (active && visible(active)) return;
    manualShowPage(chooseFallbackPage(), true);
  }

  function wrapShowPage(){
    if (typeof window.showPage !== 'function' || window.__MAENSAT_SAFE_SHOWPAGE_WRAPPED__) return;
    var original = window.showPage;
    window.showPage = function(id, skipHistory){
      lastRequestedPage = id || lastRequestedPage;
      try {
        var result = original.apply(this, arguments);
        setTimeout(ensureVisible, 0);
        setTimeout(ensureVisible, 150);
        return result;
      } catch(e) {
        log('تم التقاط خطأ داخل showPage، وسيتم فتح القسم يدويًا بدل الشاشة الفارغة.', e);
        manualShowPage(id || chooseFallbackPage(), !!skipHistory);
        setTimeout(ensureVisible, 0);
      }
    };
    window.__MAENSAT_SAFE_SHOWPAGE_WRAPPED__ = true;
  }

  function boot(){
    wrapShowPage();
    ensureVisible();
    setTimeout(function(){ wrapShowPage(); ensureVisible(); }, 80);
    setTimeout(function(){ wrapShowPage(); ensureVisible(); }, 350);
    setTimeout(function(){ wrapShowPage(); ensureVisible(); }, 1200);
    setTimeout(function(){ wrapShowPage(); ensureVisible(); }, 2600);
  }

  window.maensatEnsureSiteVisible = ensureVisible;
  window.maensatManualShowPage = manualShowPage;

  window.addEventListener('error', function(ev){
    log('JavaScript error on first load', ev && (ev.error || ev.message));
    setTimeout(boot, 40);
  }, true);
  window.addEventListener('unhandledrejection', function(ev){
    log('Unhandled promise rejection on first load', ev && ev.reason);
    setTimeout(boot, 40);
  });
  window.addEventListener('hashchange', function(){ setTimeout(boot, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
})();
