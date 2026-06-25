/*
  MaenSat World Cup 2026 Today Fix
  ------------------------------------------------------------
  Safe client-side fix. No Cloudflare Worker. No site-wide routing change.
  - Opens World Cup tabs on "اليوم" by default.
  - Shows matches from start of current Jordan day until now + 24 hours.
  - Adds tournament running-day counter.
*/
(function () {
  'use strict';

  if (window.__MAENSAT_WC_TODAY_FIX__) return;
  window.__MAENSAT_WC_TODAY_FIX__ = true;

  var DATA_URL = '/worldcup-2026/matches.json';
  var AMMAN_TZ = 'Asia/Amman';
  var AMMAN_OFFSET = '+03:00';
  var TOURNAMENT_START = '2026-06-11';
  var PANEL_ID = 'maensat-wc-today-24h-panel';
  var STYLE_ID = 'maensat-wc-today-fix-style';
  var SCRIPT_VERSION = '2026-06-25-safe-v2';

  function textOf(el) {
    return (el && (el.textContent || el.innerText) || '').replace(/\s+/g, ' ').trim();
  }

  function hasText(el, s) {
    return textOf(el).indexOf(s) !== -1;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function ammanParts(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: AMMAN_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date || new Date());
    var out = {};
    parts.forEach(function (p) { if (p.type !== 'literal') out[p.type] = p.value; });
    if (out.hour === '24') out.hour = '00';
    return out;
  }

  function todayAmmanDateString() {
    var p = ammanParts(new Date());
    return p.year + '-' + p.month + '-' + p.day;
  }

  function ammanStartOfDayInstant(dateString) {
    return new Date(dateString + 'T00:00:00' + AMMAN_OFFSET);
  }

  function getTodayWindow() {
    var now = new Date();
    var today = todayAmmanDateString();
    return {
      today: today,
      start: ammanStartOfDayInstant(today),
      end: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      now: now
    };
  }

  function parsePlainTime(value) {
    if (value == null) return null;
    var s = String(value).trim();
    if (!s) return null;
    s = s.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
         .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });

    var m24 = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    if (m24) return pad(Math.min(23, parseInt(m24[1], 10))) + ':' + pad(parseInt(m24[2], 10));

    var m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|ص|م)$/);
    if (m12) {
      var h = parseInt(m12[1], 10);
      var min = parseInt(m12[2] || '0', 10);
      var suffix = m12[3];
      var isPM = /pm|PM|م/.test(suffix);
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return pad(h) + ':' + pad(min);
    }
    return null;
  }

  function firstValue(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
    }
    return null;
  }

  function getDateString(match) {
    return firstValue(match, [
      'date', 'match_date', 'local_date', 'localDate', 'day', 'matchDay',
      'kickoff_date', 'start_date', 'startDate'
    ]);
  }

  function getTimeString(match) {
    return firstValue(match, [
      'time', 'local_time', 'localTime', 'kickoff_time', 'start_time', 'startTime',
      'hour', 'amman_time', 'jordan_time', 'time_jordan'
    ]);
  }

  function parseMatchDate(match) {
    if (!match || typeof match !== 'object') return null;

    var directKeys = [
      'datetime', 'date_time', 'dateTime', 'kickoff', 'kickoff_at', 'kickoffAt',
      'start', 'start_at', 'startAt', 'utc_date', 'utcDate', 'iso', 'iso_date', 'isoDate'
    ];

    for (var i = 0; i < directKeys.length; i += 1) {
      var v = match[directKeys[i]];
      if (v == null || String(v).trim() === '') continue;
      var s = String(v).trim();
      var d = new Date(s);
      if (!isNaN(d.getTime())) return d;

      var dt = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
      if (dt) {
        d = new Date(dt[1] + 'T' + dt[2] + ':00' + AMMAN_OFFSET);
        if (!isNaN(d.getTime())) return d;
      }
    }

    var dateValue = getDateString(match);
    var timeValue = getTimeString(match);
    if (dateValue) {
      var ds = String(dateValue).trim();
      var dateOnly = (ds.match(/\d{4}-\d{2}-\d{2}/) || [null])[0];
      var timeOnly = parsePlainTime(timeValue) || (ds.match(/T(\d{2}:\d{2})/) || [null, null])[1] || '00:00';
      if (dateOnly) {
        var parsed = new Date(dateOnly + 'T' + timeOnly + ':00' + AMMAN_OFFSET);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return null;
  }

  function pickName(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      return firstValue(value, [
        'name_ar', 'arabic_name', 'nameAr', 'ar', 'name', 'team', 'title', 'short_name', 'code'
      ]) || '';
    }
    return '';
  }

  function getTeams(match) {
    var home = firstValue(match, ['home_team', 'homeTeam', 'home', 'team1', 'team_a', 'teamA', 'home_name', 'homeName']);
    var away = firstValue(match, ['away_team', 'awayTeam', 'away', 'team2', 'team_b', 'teamB', 'away_name', 'awayName']);

    if ((!home || !away) && Array.isArray(match.teams)) {
      home = home || match.teams[0];
      away = away || match.teams[1];
    }
    if ((!home || !away) && Array.isArray(match.competitors)) {
      home = home || match.competitors[0];
      away = away || match.competitors[1];
    }

    return {
      home: pickName(home) || 'الفريق الأول',
      away: pickName(away) || 'الفريق الثاني'
    };
  }

  function getMatchStatus(match) {
    var status = firstValue(match, ['status_ar', 'status', 'state', 'match_status', 'phase']);
    if (!status) return '';
    var s = String(status).trim();
    var map = {
      scheduled: 'قادمة',
      fixture: 'قادمة',
      upcoming: 'قادمة',
      pre: 'قادمة',
      live: 'مباشر الآن',
      in_progress: 'مباشر الآن',
      finished: 'انتهت',
      final: 'انتهت',
      completed: 'انتهت'
    };
    return map[s.toLowerCase()] || s;
  }

  function getScore(match) {
    var direct = firstValue(match, ['score', 'result', 'fulltime_score', 'fullTimeScore']);
    if (direct) return pickName(direct);
    var hs = firstValue(match, ['home_score', 'homeScore', 'score_home']);
    var as = firstValue(match, ['away_score', 'awayScore', 'score_away']);
    if (hs !== null && hs !== undefined && as !== null && as !== undefined) return hs + ' - ' + as;
    return '';
  }

  function getRound(match) {
    return firstValue(match, ['round_ar', 'round', 'stage_ar', 'stage', 'group', 'group_ar', 'phase']) || '';
  }

  function flattenMatches(input) {
    var output = [];
    var seen = new Set();

    function looksLikeMatch(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      var hasDate = !!(getDateString(obj) || firstValue(obj, ['datetime', 'date_time', 'kickoff', 'kickoff_at', 'start', 'start_at', 'utc_date', 'iso']));
      var hasTeams = !!(
        firstValue(obj, ['home_team', 'homeTeam', 'home', 'team1', 'team_a', 'home_name']) ||
        firstValue(obj, ['away_team', 'awayTeam', 'away', 'team2', 'team_b', 'away_name']) ||
        Array.isArray(obj.teams) || Array.isArray(obj.competitors)
      );
      return hasDate && hasTeams;
    }

    function visit(node) {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;

      if (looksLikeMatch(node)) {
        var id = firstValue(node, ['id', 'match_id', 'matchId']) || JSON.stringify(node).slice(0, 200);
        if (!seen.has(id)) {
          seen.add(id);
          output.push(node);
        }
        return;
      }

      Object.keys(node).forEach(function (key) {
        if (/metadata|source|sources|heartbeat|errors|version/i.test(key)) return;
        visit(node[key]);
      });
    }

    if (input && Array.isArray(input.matches)) visit(input.matches);
    else if (input && Array.isArray(input.fixtures)) visit(input.fixtures);
    else if (input && Array.isArray(input.games)) visit(input.games);
    else if (input && Array.isArray(input.data)) visit(input.data);
    else visit(input);

    return output;
  }

  function formatAmmanDateTime(date) {
    try {
      return new Intl.DateTimeFormat('ar-JO', {
        timeZone: AMMAN_TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } catch (e) {
      return date.toLocaleString('ar-JO');
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderCard(match) {
    var when = parseMatchDate(match);
    var teams = getTeams(match);
    var status = getMatchStatus(match);
    var score = getScore(match);
    var round = getRound(match);
    var channel = firstValue(match, ['channel', 'channels', 'broadcast', 'broadcast_ar', 'tv', 'broadcaster']);
    if (Array.isArray(channel)) channel = channel.map(pickName).filter(Boolean).join('، ');
    else channel = pickName(channel);

    return '' +
      '<article class="maensat-wc-match-card">' +
        '<div class="maensat-wc-match-top">' +
          '<span class="maensat-wc-time">' + escapeHtml(when ? formatAmmanDateTime(when) : 'موعد غير محدد') + '</span>' +
          (status ? '<span class="maensat-wc-status">' + escapeHtml(status) + '</span>' : '') +
        '</div>' +
        '<div class="maensat-wc-teams">' +
          '<strong>' + escapeHtml(teams.home) + '</strong>' +
          '<span>' + (score ? escapeHtml(score) : '×') + '</span>' +
          '<strong>' + escapeHtml(teams.away) + '</strong>' +
        '</div>' +
        '<div class="maensat-wc-meta">' +
          (round ? '<span>' + escapeHtml(round) + '</span>' : '') +
          (channel ? '<span>القنوات: ' + escapeHtml(channel) + '</span>' : '') +
        '</div>' +
      '</article>';
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '' +
      '#'+PANEL_ID+'{direction:rtl;text-align:right;margin:16px 0;padding:16px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.08);backdrop-filter:blur(8px)}' +
      '#'+PANEL_ID+' .maensat-wc-title{font-weight:800;font-size:1.15rem;margin-bottom:6px}' +
      '#'+PANEL_ID+' .maensat-wc-subtitle{opacity:.88;margin-bottom:14px;line-height:1.7}' +
      '#'+PANEL_ID+' .maensat-wc-list{display:grid;gap:12px}' +
      '.maensat-wc-match-card{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px;background:rgba(0,0,0,.16)}' +
      '.maensat-wc-match-top,.maensat-wc-meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between}' +
      '.maensat-wc-time{font-weight:700}' +
      '.maensat-wc-status{padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.20);font-size:.9rem}' +
      '.maensat-wc-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;text-align:center;margin:10px 0;font-size:1.05rem}' +
      '.maensat-wc-teams span{font-weight:800;opacity:.9}' +
      '.maensat-wc-meta{opacity:.86;font-size:.92rem;justify-content:flex-start}' +
      '.maensat-wc-empty,.maensat-wc-error{padding:14px;border-radius:14px;background:rgba(0,0,0,.12);line-height:1.8}' +
      '.maensat-wc-hidden-original{display:none!important}' +
      '[data-maensat-wc-counter="1"]{font-weight:800}';
    document.head.appendChild(style);
  }

  function findWorldCupRoot() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('section,main,div,article'));
    var best = null;
    var bestScore = -1;
    candidates.forEach(function (el) {
      var t = textOf(el);
      if (!t || t.length > 6000) return;
      var score = 0;
      if (t.indexOf('كأس العالم 2026') !== -1) score += 4;
      if (t.indexOf('مونديال 2026') !== -1) score += 4;
      if (t.indexOf('الأردن في قلب الحدث') !== -1) score += 3;
      if (t.indexOf('كل المباريات') !== -1) score += 2;
      if (t.indexOf('أفضل الثوالث') !== -1) score += 2;
      if (t.indexOf('الأدوار') !== -1) score += 2;
      if (score > bestScore) { bestScore = score; best = el; }
    });
    return bestScore >= 6 ? best : null;
  }

  function findTabs(root) {
    root = root || document;
    var clickable = Array.prototype.slice.call(root.querySelectorAll('button,a,[role="button"],[tabindex]'))
      .filter(function (el) { return /^(اليوم|الأردن|كل المباريات|المجموعات|أفضل الثوالث|الأدوار)$/.test(textOf(el)); });
    if (clickable.length >= 3) return clickable;

    clickable = Array.prototype.slice.call(document.querySelectorAll('button,a,[role="button"],[tabindex]'))
      .filter(function (el) { return /^(اليوم|الأردن|كل المباريات|المجموعات|أفضل الثوالث|الأدوار)$/.test(textOf(el)); });
    return clickable;
  }

  function findTabRow(tabs) {
    if (!tabs || !tabs.length) return null;
    var node = tabs[0];
    while (node && node !== document.body) {
      var t = textOf(node);
      if (t.indexOf('اليوم') !== -1 && t.indexOf('كل المباريات') !== -1 && t.indexOf('الأدوار') !== -1) return node;
      node = node.parentElement;
    }
    return tabs[0].parentElement || null;
  }

  function ensurePanel(tabRow) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.setAttribute('data-version', SCRIPT_VERSION);
      panel.innerHTML = '<div class="maensat-wc-title">مباريات اليوم والقادمة خلال 24 ساعة</div><div class="maensat-wc-subtitle">حسب توقيت الأردن — جاري تحميل المباريات...</div>';
      if (tabRow && tabRow.parentNode) tabRow.parentNode.insertBefore(panel, tabRow.nextSibling);
    }
    return panel;
  }

  function markOriginalContent(panel, hide) {
    var next = panel && panel.nextElementSibling;
    if (!next) return;
    if (hide) next.classList.add('maensat-wc-hidden-original');
    else next.classList.remove('maensat-wc-hidden-original');
  }

  function setPanelVisible(panel, visible) {
    if (!panel) return;
    panel.style.display = visible ? '' : 'none';
    markOriginalContent(panel, !!visible);
  }

  function renderToday(panel) {
    if (!panel) return;
    ensureStyle();
    panel.style.display = '';
    panel.innerHTML = '<div class="maensat-wc-title">مباريات اليوم والقادمة خلال 24 ساعة</div><div class="maensat-wc-subtitle">حسب توقيت الأردن — جاري تحميل المباريات...</div>';
    markOriginalContent(panel, true);

    fetch(DATA_URL, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var w = getTodayWindow();
        var matches = flattenMatches(data).map(function (m) {
          return { match: m, when: parseMatchDate(m) };
        }).filter(function (item) {
          return item.when && item.when >= w.start && item.when <= w.end;
        }).sort(function (a, b) { return a.when - b.when; });

        var fromText = formatAmmanDateTime(w.start);
        var toText = formatAmmanDateTime(w.end);
        var subtitle = 'حسب توقيت الأردن — من بداية اليوم (' + fromText + ') إلى وقت فتح الموقع + 24 ساعة (' + toText + ').';

        if (!matches.length) {
          panel.innerHTML = '' +
            '<div class="maensat-wc-title">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
            '<div class="maensat-wc-subtitle">' + escapeHtml(subtitle) + '</div>' +
            '<div class="maensat-wc-empty">لا توجد مباريات ضمن هذه الفترة حالياً. يمكنك فتح تبويب <strong>كل المباريات</strong> لمشاهدة الجدول الكامل.</div>';
          return;
        }

        panel.innerHTML = '' +
          '<div class="maensat-wc-title">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
          '<div class="maensat-wc-subtitle">' + escapeHtml(subtitle) + '</div>' +
          '<div class="maensat-wc-list">' + matches.map(function (x) { return renderCard(x.match); }).join('') + '</div>';
      })
      .catch(function () {
        panel.innerHTML = '' +
          '<div class="maensat-wc-title">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
          '<div class="maensat-wc-error">تعذر تحميل بيانات كأس العالم الآن. اترك تبويب كل المباريات كما هو أو جرّب تحديث الصفحة.</div>';
      });
  }

  function updateTournamentCounter() {
    var today = todayAmmanDateString();
    var start = ammanStartOfDayInstant(TOURNAMENT_START);
    var nowStart = ammanStartOfDayInstant(today);
    var diffDays = Math.floor((nowStart.getTime() - start.getTime()) / 86400000) + 1;
    var label = diffDays >= 1 ? ('انطلقت البطولة — اليوم ' + diffDays + ' من البطولة') : ('العدّ التنازلي لانطلاق كأس العالم — باقي ' + Math.abs(diffDays - 1) + ' يوم');

    var selectors = 'span,div,p,strong,b,h1,h2,h3,h4';
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selectors));
    var changed = false;
    nodes.forEach(function (el) {
      if (el.getAttribute('data-maensat-wc-counter') === '1') {
        el.textContent = label;
        changed = true;
        return;
      }
      var t = textOf(el);
      if (!changed && (t === 'انطلقت البطولة' || t === 'العدّ التنازلي لانطلاق كأس العالم' || t.indexOf('العدّ التنازلي لانطلاق كأس العالم') !== -1)) {
        el.textContent = label;
        el.setAttribute('data-maensat-wc-counter', '1');
        changed = true;
      }
    });
  }

  function isTodayTab(tab) {
    return textOf(tab) === 'اليوم';
  }

  function activateTodayOnce(tabs, panel) {
    var todayTab = tabs.filter(isTodayTab)[0];
    if (!todayTab) return;
    if (!window.__MAENSAT_WC_TODAY_DEFAULTED__) {
      window.__MAENSAT_WC_TODAY_DEFAULTED__ = true;
      try { todayTab.click(); } catch (e) {}
    }
    renderToday(panel);
  }

  function bindTabs(tabs, panel) {
    tabs.forEach(function (tab) {
      if (tab.__MAENSAT_WC_FIX_BOUND__) return;
      tab.__MAENSAT_WC_FIX_BOUND__ = true;
      tab.addEventListener('click', function () {
        setTimeout(function () {
          if (isTodayTab(tab)) renderToday(panel);
          else setPanelVisible(panel, false);
          updateTournamentCounter();
        }, 120);
      }, true);
    });
  }

  function boot() {
    ensureStyle();
    var root = findWorldCupRoot();
    if (!root) {
      updateTournamentCounter();
      return false;
    }
    var tabs = findTabs(root);
    if (!tabs.length) {
      updateTournamentCounter();
      return false;
    }
    var tabRow = findTabRow(tabs);
    var panel = ensurePanel(tabRow);
    bindTabs(tabs, panel);
    updateTournamentCounter();
    activateTodayOnce(tabs, panel);
    return true;
  }

  var attempts = 0;
  function retryBoot() {
    attempts += 1;
    var ok = boot();
    if (!ok && attempts < 30) setTimeout(retryBoot, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retryBoot);
  else retryBoot();

  window.addEventListener('hashchange', function () { setTimeout(retryBoot, 200); });

  var observer = new MutationObserver(function () {
    if (observer.__busy) return;
    observer.__busy = true;
    setTimeout(function () {
      observer.__busy = false;
      updateTournamentCounter();
      var panel = document.getElementById(PANEL_ID);
      if (panel && panel.style.display !== 'none') markOriginalContent(panel, true);
    }, 250);
  });
  try { observer.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();
