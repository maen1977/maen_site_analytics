/* MaenSat World Cup Today Fix - Final Direct Version
   - No Cloudflare Worker
   - Opens World Cup on Today tab
   - Shows matches from start of Jordan day until now + 24h
   - Shows tournament running day counter
*/
(function () {
  'use strict';

  var TZ = 'Asia/Amman';
  var START_ISO = '2026-06-11T00:00:00+03:00';
  var PANEL_ID = 'maensat-wc-today-panel-final';
  var BADGE_ID = 'maensat-wc-day-badge-final';
  var DATA_URLS = [
    '/worldcup-2026/matches.json',
    './worldcup-2026/matches.json',
    'worldcup-2026/matches.json'
  ];
  var state = { matches: null, loaded: false, loading: false };

  function normalizeText(s) {
    return String(s || '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ammanParts(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(date).reduce(function (acc, p) {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return parts;
  }

  function ammanTodayStart(now) {
    var p = ammanParts(now || new Date());
    return new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00+03:00');
  }

  function tournamentDayText() {
    var start = new Date(START_ISO);
    var todayStart = ammanTodayStart(new Date());
    var diff = Math.floor((todayStart - start) / 86400000) + 1;
    if (diff > 0) return 'انطلقت البطولة — اليوم ' + diff + ' من البطولة';
    return 'العدّ التنازلي لانطلاق كأس العالم — باقي ' + Math.abs(diff - 1) + ' يوم';
  }

  function getValue(obj, keys) {
    if (!obj || typeof obj !== 'object') return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && obj[keys[i]] !== '') return obj[keys[i]];
    }
    return undefined;
  }

  function deepName(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(deepName).filter(Boolean).join(' / ');
    if (typeof value === 'object') {
      return getValue(value, ['name_ar', 'arabic_name', 'nameArabic', 'ar', 'name', 'short_name', 'shortName', 'displayName', 'team', 'country']) || '';
    }
    return '';
  }

  function teamNames(m) {
    var home = getValue(m, ['home_team_ar', 'home_ar', 'team1_ar', 'homeTeamArabic', 'homeTeamNameAr']);
    var away = getValue(m, ['away_team_ar', 'away_ar', 'team2_ar', 'awayTeamArabic', 'awayTeamNameAr']);

    if (!home) home = deepName(getValue(m, ['home_team', 'homeTeam', 'home', 'team1', 'team_a', 'teamA', 'competitor1']));
    if (!away) away = deepName(getValue(m, ['away_team', 'awayTeam', 'away', 'team2', 'team_b', 'teamB', 'competitor2']));

    if ((!home || !away) && Array.isArray(m.teams) && m.teams.length >= 2) {
      home = home || deepName(m.teams[0]);
      away = away || deepName(m.teams[1]);
    }
    if ((!home || !away) && Array.isArray(m.competitors) && m.competitors.length >= 2) {
      home = home || deepName(m.competitors[0]);
      away = away || deepName(m.competitors[1]);
    }

    return {
      home: home || 'الفريق الأول',
      away: away || 'الفريق الثاني'
    };
  }

  function parseDateFromString(s) {
    if (!s || typeof s !== 'string') return null;
    var str = s.trim();
    if (!/\d{4}-\d{2}-\d{2}/.test(str)) return null;
    var d;
    if (/T/.test(str)) {
      d = new Date(str);
      if (!isNaN(d)) return d;
      if (!/(Z|[+-]\d\d:?\d\d)$/.test(str)) {
        d = new Date(str + '+03:00');
        if (!isNaN(d)) return d;
      }
    }
    return null;
  }

  function matchDate(m) {
    var directKeys = ['local_datetime', 'localDateTime', 'datetime', 'dateTime', 'kickoff', 'kickoff_time', 'kickoffTime', 'start_time', 'startTime', 'time_utc', 'utc_datetime', 'utcDateTime'];
    for (var i = 0; i < directKeys.length; i++) {
      var d1 = parseDateFromString(m[directKeys[i]]);
      if (d1) return d1;
    }

    var date = getValue(m, ['local_date', 'localDate', 'date', 'match_date', 'matchDate', 'day']);
    var time = getValue(m, ['local_time', 'localTime', 'time', 'hour', 'kickoff_hour', 'kickoffHour']);
    if (date && time) {
      var t = String(time).trim();
      if (/^\d{1,2}:\d{2}$/.test(t)) t += ':00';
      var d2 = new Date(String(date).trim() + 'T' + t + '+03:00');
      if (!isNaN(d2)) return d2;
    }
    if (date && /T/.test(String(date))) {
      var d3 = parseDateFromString(String(date));
      if (d3) return d3;
    }

    // Last-resort shallow scan for any ISO date-time string.
    for (var k in m) {
      if (Object.prototype.hasOwnProperty.call(m, k) && typeof m[k] === 'string') {
        var d4 = parseDateFromString(m[k]);
        if (d4) return d4;
      }
    }
    return null;
  }

  function extractMatches(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    var candidates = ['matches', 'fixtures', 'games', 'schedule', 'events', 'data'];
    for (var i = 0; i < candidates.length; i++) {
      var v = data[candidates[i]];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') {
        var nested = extractMatches(v);
        if (nested.length) return nested;
      }
    }
    return [];
  }

  function loadMatches() {
    if (state.loaded) return Promise.resolve(state.matches || []);
    if (state.loading) return new Promise(function (resolve) {
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (state.loaded || tries > 80) {
          clearInterval(timer);
          resolve(state.matches || []);
        }
      }, 100);
    });
    state.loading = true;

    var chain = Promise.reject();
    DATA_URLS.forEach(function (url) {
      chain = chain.catch(function () {
        return fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (json) {
            state.matches = extractMatches(json);
            state.loaded = true;
            state.loading = false;
            return state.matches;
          });
      });
    });
    return chain.catch(function () {
      state.matches = [];
      state.loaded = true;
      state.loading = false;
      return [];
    });
  }

  function formatTime(d) {
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: TZ,
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(d);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function inWindowMatches(matches) {
    var now = new Date();
    var from = ammanTodayStart(now);
    var to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return (matches || []).map(function (m) {
      return { raw: m, dt: matchDate(m) };
    }).filter(function (x) {
      return x.dt && x.dt >= from && x.dt <= to;
    }).sort(function (a, b) { return a.dt - b.dt; });
  }

  function findTabButtons() {
    var labels = ['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث', 'الأدوار'];
    return Array.prototype.slice.call(document.querySelectorAll('button, a, [role="tab"], .tab, [class*="tab"]')).filter(function (el) {
      var t = normalizeText(el.textContent);
      return labels.indexOf(t) !== -1;
    });
  }

  function findTodayButton() {
    return findTabButtons().find(function (el) { return normalizeText(el.textContent) === 'اليوم'; }) || null;
  }

  function findAllMatchesButton() {
    return findTabButtons().find(function (el) { return normalizeText(el.textContent) === 'كل المباريات'; }) || null;
  }

  function ensurePanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    var todayBtn = findTodayButton();
    if (!todayBtn) return null;
    var row = todayBtn.parentElement;
    for (var i = 0; i < 3 && row && row.parentElement; i++) {
      var txt = normalizeText(row.textContent);
      if (txt.indexOf('كل المباريات') !== -1 && txt.indexOf('المجموعات') !== -1) break;
      row = row.parentElement;
    }

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.dir = 'rtl';
    panel.style.margin = '16px 0';
    panel.style.padding = '16px';
    panel.style.border = '1px solid rgba(255,255,255,.22)';
    panel.style.borderRadius = '18px';
    panel.style.background = 'rgba(0,0,0,.20)';
    panel.style.backdropFilter = 'blur(6px)';
    panel.style.color = 'inherit';

    if (row && row.parentNode) row.parentNode.insertBefore(panel, row.nextSibling);
    return panel;
  }

  function updateTournamentBadge() {
    var text = tournamentDayText();
    var badge = document.getElementById(BADGE_ID);
    if (!badge) {
      var anchor = Array.prototype.slice.call(document.querySelectorAll('section, div, main')).find(function (el) {
        var t = normalizeText(el.textContent);
        return t.indexOf('الأردن في قلب الحدث') !== -1 || t.indexOf('مونديال 2026') !== -1;
      });
      badge = document.createElement('div');
      badge.id = BADGE_ID;
      badge.dir = 'rtl';
      badge.style.display = 'inline-block';
      badge.style.margin = '10px 0';
      badge.style.padding = '8px 14px';
      badge.style.borderRadius = '999px';
      badge.style.fontWeight = '700';
      badge.style.background = 'rgba(255,255,255,.16)';
      badge.style.border = '1px solid rgba(255,255,255,.24)';
      if (anchor) anchor.insertBefore(badge, anchor.firstChild);
    }
    badge.textContent = text;

    Array.prototype.slice.call(document.querySelectorAll('body *')).some(function (el) {
      var t = normalizeText(el.textContent);
      if (t === 'العد التنازلي لانطلاق كأس العالم' || t === 'العدّ التنازلي لانطلاق كأس العالم' || t.indexOf('العد التنازلي لانطلاق كأس العالم') !== -1 || t.indexOf('العدّ التنازلي لانطلاق كأس العالم') !== -1) {
        if (el.children.length < 5) el.textContent = text;
        return true;
      }
      return false;
    });
  }

  function renderTodayPanel() {
    var panel = ensurePanel();
    if (!panel) return;
    panel.style.display = '';
    panel.innerHTML = '<div style="font-weight:800;font-size:1.15rem;margin-bottom:8px">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
      '<div style="opacity:.85;margin-bottom:12px">من بداية اليوم بتوقيت الأردن إلى وقت فتح الموقع + 24 ساعة</div>' +
      '<div>جاري تحميل مباريات كأس العالم...</div>';

    loadMatches().then(function (matches) {
      var list = inWindowMatches(matches);
      if (!list.length) {
        panel.innerHTML = '<div style="font-weight:800;font-size:1.15rem;margin-bottom:8px">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
          '<div style="opacity:.85;margin-bottom:12px">حسب توقيت الأردن</div>' +
          '<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.10)">لا توجد مباريات ضمن هذا النطاق حالياً.</div>';
        return;
      }

      var html = '<div style="font-weight:800;font-size:1.15rem;margin-bottom:8px">مباريات اليوم والقادمة خلال 24 ساعة</div>' +
        '<div style="opacity:.85;margin-bottom:12px">حسب توقيت الأردن — مرتبة من الأقرب للأبعد</div>';
      html += '<div style="display:grid;gap:10px">';
      list.forEach(function (x) {
        var names = teamNames(x.raw);
        var stage = escapeHtml(getValue(x.raw, ['stage_ar', 'stage', 'round_ar', 'round', 'group_ar', 'group', 'venue_ar', 'venue']) || '');
        html += '<div style="padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12)">' +
          '<div style="font-weight:800;margin-bottom:6px">' + escapeHtml(names.home) + ' × ' + escapeHtml(names.away) + '</div>' +
          '<div style="opacity:.9">' + escapeHtml(formatTime(x.dt)) + '</div>' +
          (stage ? '<div style="opacity:.75;margin-top:4px;font-size:.92rem">' + stage + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
      panel.innerHTML = html;
    });
  }

  function activateTodayTab() {
    var today = findTodayButton();
    if (!today) return false;
    try { today.click(); } catch (e) {}
    var all = findAllMatchesButton();
    if (all) {
      all.classList.remove('active', 'is-active', 'selected');
      all.setAttribute('aria-selected', 'false');
    }
    today.classList.add('active', 'is-active', 'selected');
    today.setAttribute('aria-selected', 'true');
    renderTodayPanel();
    return true;
  }

  function wireTabClicks() {
    findTabButtons().forEach(function (btn) {
      if (btn.__maensatWired) return;
      btn.__maensatWired = true;
      btn.addEventListener('click', function () {
        var panel = document.getElementById(PANEL_ID);
        if (normalizeText(btn.textContent) === 'اليوم') {
          setTimeout(renderTodayPanel, 120);
        } else if (panel) {
          panel.style.display = 'none';
        }
      });
    });
  }

  function boot() {
    updateTournamentBadge();
    wireTabClicks();
    activateTodayTab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // The original site may render the World Cup section after our script. Retry safely.
  [300, 900, 1600, 3000, 5000].forEach(function (ms) {
    setTimeout(function () {
      updateTournamentBadge();
      wireTabClicks();
      activateTodayTab();
    }, ms);
  });
})();
