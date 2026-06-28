/* MaenSat World Cup 2026 - You are here focus
   يعمل داخل قسم كأس العالم فقط: يميز المباراة الحالية/الأقرب برسالة "أنت هنا"،
   وينزل عليها تلقائياً مرة واحدة عند فتح الصفحة، بدون لمس تحديث الـ 15 دقيقة. */
(function(){
  'use strict';
  if (window.__MAENSAT_WC_YOU_ARE_HERE_FOCUS__) return;
  window.__MAENSAT_WC_YOU_ARE_HERE_FOCUS__ = true;

  var DATA_URL = '/worldcup-2026/matches.json';
  var TZ = 'Asia/Amman';
  var didAutoScroll = false;
  var lastKey = '';
  var pending = false;
  var observerStarted = false;
  var retryTimes = [250, 700, 1200, 2200, 3800, 6000, 9000];

  function norm(v){
    return String(v || '')
      .replace(/[أإآ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/ـ/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

  function escSel(v){
    if (window.CSS && CSS.escape) return CSS.escape(String(v));
    return String(v).replace(/(["'\\#.;?+*~\':!^$[\]()=>|/@])/g,'\\$1');
  }

  function parseTime(v){
    if (!v) return NaN;
    if (typeof v === 'number') return v > 1e10 ? v : v * 1000;
    var ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : NaN;
  }

  function startMs(m){
    var fields = [m && m.kickoff_jordan, m && m.kickoff_utc, m && m.kickoff, m && m.datetime, m && m.date_time, m && m.date];
    for (var i=0;i<fields.length;i++){
      var ms = parseTime(fields[i]);
      if (Number.isFinite(ms)) return ms;
    }
    return NaN;
  }

  function matchNum(m){
    var raw = m && (m.num || m.match_number || m.matchNo || m.match_id || m.id);
    var n = parseInt(String(raw || '').replace(/[^\d]/g,''),10);
    return Number.isFinite(n) ? n : 999999;
  }

  function matchKey(m){
    var raw = m && (m.id || m.match_id || m.matchId || m.num || m.match_number || m.matchNo);
    var n = matchNum(m);
    if (!raw && n !== 999999) raw = 'M' + String(n).padStart(3,'0');
    return String(raw || '').trim();
  }

  function isFinished(m){
    var s = norm(m && m.status);
    var sc = m && m.score;
    return !!(sc && (sc.ft || sc.et || sc.p)) || /finished|complete|full.?time|final|ended|ft|aet|penalties|انته/.test(s);
  }

  function isLiveStatus(m){
    var s = norm(m && m.status);
    return /live|in.?play|playing|first.?half|second.?half|halftime|مباشر|الشوط/.test(s);
  }

  function estimatedEnd(m){
    var st = startMs(m);
    if (!Number.isFinite(st)) return NaN;
    var n = matchNum(m);
    var stage = norm([m && m.stage, m && m.round, m && m.stage_ar].join(' '));
    var knockout = (n >= 73) || (stage && stage.indexOf('group') < 0 && stage.indexOf('مجموع') < 0);
    var minutes = knockout ? 240 : 150;
    return st + minutes * 60000;
  }

  function isKnockoutMatch(m){
    var n = matchNum(m);
    var stage = norm([m && m.stage, m && m.round, m && m.stage_ar].join(' '));
    return (n >= 73) || /round|knockout|quarter|semi|final|دور|ربع|نصف|نهائي/.test(stage);
  }

  function isCurrent(m, now){
    if (!m || isFinished(m)) return false;
    if (isLiveStatus(m)) return true;
    var st = startMs(m);
    var en = estimatedEnd(m);
    return Number.isFinite(st) && Number.isFinite(en) && now >= st && now <= en;
  }

  function ammanDay(ms){
    if (!Number.isFinite(ms)) return '';
    try{
      var parts = new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
      var y = parts.find(function(p){return p.type==='year';});
      var m = parts.find(function(p){return p.type==='month';});
      var d = parts.find(function(p){return p.type==='day';});
      return (y&&y.value)+'-'+(m&&m.value)+'-'+(d&&d.value);
    }catch(e){
      return new Date(ms).toISOString().slice(0,10);
    }
  }

  function flatten(data){
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.matches)) return data.matches;
    if (data && data.groups && typeof data.groups === 'object'){
      var out=[];
      Object.keys(data.groups).forEach(function(k){
        var g=data.groups[k];
        if (Array.isArray(g)) out=out.concat(g);
        else if (g && Array.isArray(g.matches)) out=out.concat(g.matches);
      });
      return out;
    }
    return [];
  }

  function loadMatches(){
    return fetch(DATA_URL + '?v=' + Date.now(), {cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('matches '+r.status); return r.json(); })
      .then(flatten);
  }

  function choose(matches){
    var now = Date.now();
    var today = ammanDay(now);
    var list = (matches || []).map(function(m,i){ return {m:m, i:i, start:startMs(m), num:matchNum(m), key:matchKey(m)}; })
      .filter(function(x){ return Number.isFinite(x.start); })
      .sort(function(a,b){ return a.start - b.start || a.num - b.num || a.i - b.i; });

    /*
      داخل تبويب الأدوار: إذا لا توجد مباراة مباشرة الآن، نختار أول مباراة إقصائية
      غير منتهية حسب رقم المباراة، وليس حسب وقت البداية فقط. هذا يجعل المؤشر ينتقل
      بعد مباراة 73 إلى مباراة 74، ثم 75... بنفس ترتيب الأدوار الظاهر للمستخدم.
    */
    var current = list.filter(function(x){ return isCurrent(x.m, now); });
    if (current.length) return Object.assign({badge:'أنت هنا', kind:'live'}, current[current.length-1]);

    var knockoutQueue = list.filter(function(x){ return isKnockoutMatch(x.m) && !isFinished(x.m); })
      .sort(function(a,b){ return a.num - b.num || a.start - b.start || a.i - b.i; });
    if (knockoutQueue.length) return Object.assign({badge:'أنت هنا', kind:'next-knockout'}, knockoutQueue[0]);

    var todayItems = list.filter(function(x){ return ammanDay(x.start) === today; });
    var upcomingToday = todayItems.filter(function(x){ return x.start >= now && !isFinished(x.m); });
    if (upcomingToday.length) return Object.assign({badge:'أنت هنا', kind:'next'}, upcomingToday[0]);

    var pastToday = todayItems.filter(function(x){ return x.start < now; });
    if (pastToday.length) return Object.assign({badge:'أنت هنا', kind:'last'}, pastToday[pastToday.length-1]);

    var upcoming = list.filter(function(x){ return x.start >= now && !isFinished(x.m); });
    if (upcoming.length) return Object.assign({badge:'أنت هنا', kind:'next'}, upcoming[0]);

    return list.length ? Object.assign({badge:'أنت هنا', kind:'last'}, list[list.length-1]) : null;
  }

  function style(){
    if (document.getElementById('maensat-wc-you-are-here-style')) return;
    var s = document.createElement('style');
    s.id = 'maensat-wc-you-are-here-style';
    s.textContent = [
      '#worldcup2026 .wc-match-card.wc-you-are-here{position:relative;outline:3px solid #ffd23f;box-shadow:0 0 0 5px rgba(255,210,63,.20),0 24px 60px rgba(0,0,0,.18);transform:translateY(-2px);}',
      '#worldcup2026 .wc-you-here-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 11px;background:#ffd23f;color:#111;font-weight:1000;font-size:12px;line-height:1;border:1px solid rgba(0,0,0,.12);box-shadow:0 8px 20px rgba(0,0,0,.12);white-space:nowrap;}',
      '#worldcup2026 .wc-you-here-badge::before{content:"📍";}',
      '@media(max-width:720px){#worldcup2026 .wc-you-here-badge{font-size:11px;padding:6px 9px;}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function clearBadges(){
    document.querySelectorAll('#worldcup2026 .wc-match-card.wc-you-are-here').forEach(function(el){ el.classList.remove('wc-you-are-here'); });
    document.querySelectorAll('#worldcup2026 .wc-you-here-badge').forEach(function(el){ el.remove(); });
  }

  function findCard(picked){
    var root = document.getElementById('worldcup2026') || document;
    var selectors = [];
    if (picked.key) selectors.push('[data-wc-match-key="'+escSel(picked.key)+'"]');
    if (picked.num && picked.num !== 999999) selectors.push('[data-wc-match-num="'+escSel(String(picked.num))+'"]');
    for (var i=0;i<selectors.length;i++){
      var el = root.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function ensureBracketTab(){
    var section = document.getElementById('worldcup2026');
    if (!section) return;
    var btn = section.querySelector('.wc-tabs [data-wc-filter="bracket"]');
    if (btn && !btn.classList.contains('active')){
      if (typeof window.setWorldCupFilter === 'function') window.setWorldCupFilter('bracket', btn);
      else btn.click();
    }
  }

  function markCard(card, picked, shouldScroll){
    if (!card) return false;
    style();
    clearBadges();
    card.classList.add('wc-you-are-here');
    var top = card.querySelector('.wc-match-top') || card;
    var badge = document.createElement('span');
    badge.className = 'wc-you-here-badge';
    badge.textContent = picked.badge || 'أنت هنا';
    top.appendChild(badge);
    lastKey = picked.key || String(picked.num || '');
    if (shouldScroll){
      didAutoScroll = true;
      setTimeout(function(){
        try { card.scrollIntoView({behavior:'smooth', block:'center'}); }
        catch(e){ card.scrollIntoView(true); }
      }, 180);
    }
    return true;
  }

  function run(forceScroll){
    if (pending) return;
    pending = true;
    Promise.resolve().then(function(){
      ensureBracketTab();
      return loadMatches();
    }).then(function(matches){
      var picked = choose(matches);
      if (!picked) { clearBadges(); return; }
      var card = findCard(picked);
      if (!card) return;
      var shouldScroll = !!forceScroll || !didAutoScroll;
      markCard(card, picked, shouldScroll);
    }).catch(function(e){
      if (window.console && console.warn) console.warn('World Cup current focus:', e);
    }).finally(function(){ pending=false; });
  }

  function scheduleFirstRun(){
    retryTimes.forEach(function(t){ setTimeout(function(){ run(false); }, t); });
  }

  function observeOutput(){
    if (observerStarted) return;
    var out = document.getElementById('wcMainOutput');
    if (!out) return;
    observerStarted = true;
    var timer = null;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(function(){ run(false); }, 180);
    }).observe(out, {childList:true, subtree:true});
  }

  document.addEventListener('DOMContentLoaded', function(){
    observeOutput();
    scheduleFirstRun();
  });
  window.addEventListener('load', function(){
    observeOutput();
    scheduleFirstRun();
  });
  window.addEventListener('hashchange', function(){
    if ((location.hash || '').replace('#','') === 'worldcup2026') setTimeout(function(){ run(false); }, 500);
  });

  window.focusWorldCupCurrentMatch = function(forceScroll){ run(forceScroll !== false); };
})();
