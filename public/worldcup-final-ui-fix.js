/*
  MaenSat World Cup 2026 Final UI Fix
  ------------------------------------------------------------
  - Fixes World Cup tab rendering in the browser.
  - Covers: اليوم، الأردن، كل المباريات، المجموعات، أفضل الثوالث، الأدوار.
  - Reads the existing JSON files from /worldcup-2026 with cache-busting.
  - Does not change routing, Cloudflare Workers, or the rest of the site.
*/
(function () {
  'use strict';

  if (window.__MAENSAT_WC_FINAL_UI_FIX__) return;
  window.__MAENSAT_WC_FINAL_UI_FIX__ = true;

  var VERSION = '2026-06-28-final-ui-v2';
  var TZ = 'Asia/Amman';
  var PANEL_ID = 'maensat-worldcup-final-ui-panel';
  var STYLE_ID = 'maensat-worldcup-final-ui-style';
  var ACTIVE_ATTR = 'data-maensat-wc-final-active';
  var lastTab = 'المجموعات';
  var cache = null;
  var cachePromise = null;

  var labels = ['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث', 'الأدوار'];

  var urls = {
    groups: '/worldcup-2026/groups.json',
    standings: '/worldcup-2026/standings.json',
    matches: '/worldcup-2026/matches.json',
    bracket: '/worldcup-2026/bracket.json',
    update: '/worldcup-2026/update-check.json',
    version: '/worldcup-2026/version.json'
  };

  function clean(s) {
    return String(s || '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function pick(obj, keys) {
    if (!obj || typeof obj !== 'object') return undefined;
    for (var i = 0; i < keys.length; i += 1) {
      var v = obj[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  }

  function deepName(v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map(deepName).filter(Boolean).join(' / ');
    if (typeof v === 'object') {
      return pick(v, ['team_ar', 'name_ar', 'arabic_name', 'nameArabic', 'ar', 'displayName', 'shortDisplayName', 'name', 'short_name', 'shortName', 'team', 'country', 'code']) || '';
    }
    return '';
  }

  function teamA(m) {
    return pick(m, ['home_team_ar', 'home_ar', 'team1_ar', 'homeNameAr', 'homeTeamArabic'])
      || deepName(pick(m, ['home_team', 'homeTeam', 'home', 'team1', 'team_a', 'teamA', 'competitor1']))
      || (Array.isArray(m.teams) ? deepName(m.teams[0]) : '')
      || (Array.isArray(m.competitors) ? deepName(m.competitors[0]) : '')
      || 'الفريق الأول';
  }

  function teamB(m) {
    return pick(m, ['away_team_ar', 'away_ar', 'team2_ar', 'awayNameAr', 'awayTeamArabic'])
      || deepName(pick(m, ['away_team', 'awayTeam', 'away', 'team2', 'team_b', 'teamB', 'competitor2']))
      || (Array.isArray(m.teams) ? deepName(m.teams[1]) : '')
      || (Array.isArray(m.competitors) ? deepName(m.competitors[1]) : '')
      || 'الفريق الثاني';
  }

  function scoreText(m) {
    var score = pick(m, ['score_text', 'scoreText', 'result_text', 'resultText']);
    if (score) return deepName(score);
    var s = pick(m, ['score', 'result', 'fulltime_score', 'fullTimeScore']);
    if (s && typeof s !== 'object') return deepName(s);
    if (s && typeof s === 'object') {
      var ft = s.ft || s.fulltime || s.full_time;
      if (Array.isArray(ft) && ft.length >= 2) return ft[0] + ' - ' + ft[1];
    }
    var hs = pick(m, ['home_score', 'homeScore', 'score_home', 'homeScoreFullTime']);
    var as = pick(m, ['away_score', 'awayScore', 'score_away', 'awayScoreFullTime']);
    if (hs !== undefined && as !== undefined) return hs + ' - ' + as;
    return '×';
  }

  function stageText(m) {
    var v = pick(m, ['stage_ar', 'round_ar', 'phase_ar', 'stage', 'round', 'phase', 'group_ar', 'group', 'matchday']);
    return deepName(v) || '';
  }

  function venueText(m) {
    var v = pick(m, ['venue_ar', 'stadium_ar', 'venue', 'stadium', 'city_ar', 'city']);
    return deepName(v) || '';
  }

  function statusText(m) {
    var s = String(pick(m, ['status_ar', 'status', 'state', 'match_status', 'phase']) || '').trim();
    var k = s.toLowerCase();
    var map = {
      scheduled: 'قادمة', fixture: 'قادمة', upcoming: 'قادمة', pre: 'قادمة',
      live: 'مباشر الآن', in_progress: 'مباشر الآن', halftime: 'استراحة',
      finished: 'انتهت', final: 'انتهت', completed: 'انتهت', post: 'انتهت'
    };
    return map[k] || s;
  }

  function parsePlainTime(value) {
    if (value == null) return null;
    var s = String(value).trim();
    if (!s) return null;
    s = s.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
         .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    var m24 = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    if (m24) {
      var h24 = Math.max(0, Math.min(23, parseInt(m24[1], 10)));
      return String(h24).padStart(2, '0') + ':' + String(parseInt(m24[2], 10)).padStart(2, '0');
    }
    var m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|ص|م)$/);
    if (m12) {
      var h = parseInt(m12[1], 10);
      var min = parseInt(m12[2] || '0', 10);
      var pm = /pm|PM|م/.test(m12[3]);
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
      return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    }
    return null;
  }

  function parseDate(m) {
    if (!m || typeof m !== 'object') return null;
    var directKeys = ['local_datetime', 'localDateTime', 'datetime', 'dateTime', 'date_time', 'kickoff', 'kickoff_at', 'kickoffAt', 'start', 'start_at', 'startAt', 'utc_date', 'utcDate', 'iso', 'iso_date', 'isoDate'];
    for (var i = 0; i < directKeys.length; i += 1) {
      var raw = m[directKeys[i]];
      if (raw == null || String(raw).trim() === '') continue;
      var s = String(raw).trim();
      var d = new Date(s);
      if (!isNaN(d.getTime())) return d;
      var dt = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
      if (dt) {
        d = new Date(dt[1] + 'T' + dt[2] + ':00+03:00');
        if (!isNaN(d.getTime())) return d;
      }
    }
    var date = pick(m, ['local_date', 'localDate', 'date', 'match_date', 'matchDate', 'day', 'start_date', 'startDate']);
    var time = pick(m, ['local_time', 'localTime', 'time', 'hour', 'kickoff_time', 'kickoffTime', 'start_time', 'startTime', 'amman_time', 'jordan_time']);
    if (date) {
      var dateStr = String(date).trim();
      var dateOnly = (dateStr.match(/\d{4}-\d{2}-\d{2}/) || [null])[0];
      var timeOnly = parsePlainTime(time) || (dateStr.match(/T(\d{2}:\d{2})/) || [null, null])[1] || '00:00';
      if (dateOnly) {
        var parsed = new Date(dateOnly + 'T' + timeOnly + ':00+03:00');
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return null;
  }

  function formatDate(d) {
    if (!d) return 'موعد غير محدد';
    try {
      return new Intl.DateTimeFormat('ar-JO', {
        timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(d);
    } catch (e) {
      return d.toLocaleString('ar-JO');
    }
  }

  function formatDay(d) {
    if (!d) return 'بدون تاريخ';
    try {
      return new Intl.DateTimeFormat('ar-JO', { timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    } catch (e) { return d.toLocaleDateString('ar-JO'); }
  }

  function fetchJSON(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return fetch(url + sep + 'v=' + encodeURIComponent(VERSION + '-' + Date.now()), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
        return r.json();
      });
  }

  function safeFetch(url) {
    return fetchJSON(url).catch(function () { return null; });
  }

  function loadAll() {
    if (cache) return Promise.resolve(cache);
    if (cachePromise) return cachePromise;
    cachePromise = Promise.all([
      safeFetch(urls.groups), safeFetch(urls.standings), safeFetch(urls.matches), safeFetch(urls.bracket), safeFetch(urls.update), safeFetch(urls.version)
    ]).then(function (items) {
      cache = {
        groups: items[0], standings: items[1], matches: items[2], bracket: items[3], update: items[4], version: items[5]
      };
      return cache;
    });
    return cachePromise;
  }

  function flattenMatches(input) {
    var out = [];
    var seen = Object.create(null);

    function looksLikeMatch(o) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
      var hasTeam = pick(o, ['home_team', 'homeTeam', 'home', 'team1', 'team_a', 'teamA', 'away_team', 'awayTeam', 'away', 'team2', 'team_b', 'teamB']) || Array.isArray(o.teams) || Array.isArray(o.competitors);
      var hasDate = parseDate(o) || pick(o, ['date', 'match_date', 'matchDate', 'day', 'datetime', 'kickoff', 'start']);
      var hasRound = pick(o, ['round', 'round_ar', 'stage', 'stage_ar', 'phase', 'match_number', 'matchNumber']);
      return !!(hasTeam && (hasDate || hasRound));
    }

    function visit(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (typeof node !== 'object') return;
      if (looksLikeMatch(node)) {
        var id = pick(node, ['id', 'match_id', 'matchId', 'match_number', 'matchNumber']) || [teamA(node), teamB(node), stageText(node), parseDate(node)].join('|');
        if (!seen[id]) { seen[id] = true; out.push(node); }
        return;
      }
      Object.keys(node).forEach(function (k) {
        if (/metadata|source|sources|version|heartbeat|errors|note/i.test(k)) return;
        visit(node[k]);
      });
    }

    if (input && Array.isArray(input.matches)) visit(input.matches);
    else if (input && Array.isArray(input.fixtures)) visit(input.fixtures);
    else if (input && Array.isArray(input.games)) visit(input.games);
    else if (input && Array.isArray(input.data)) visit(input.data);
    else visit(input);
    return out;
  }

  function getStandings(data) {
    var candidates = [];
    if (data.groups && Array.isArray(data.groups.standings)) candidates = data.groups.standings;
    else if (data.standings && Array.isArray(data.standings.standings)) candidates = data.standings.standings;
    else if (Array.isArray(data.standings)) candidates = data.standings;
    else if (data.groups && data.groups.groups && typeof data.groups.groups === 'object') {
      candidates = Object.keys(data.groups.groups).sort().map(function (g) {
        return { group: g, rows: (data.groups.groups[g] || []).map(function (t, idx) { return { group: g, rank: idx + 1, team: t, team_ar: t, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0 }; }) };
      });
    }
    return candidates.map(function (g) {
      var rows = Array.isArray(g.rows) ? g.rows : (Array.isArray(g.teams) ? g.teams : []);
      rows = rows.slice().sort(function (a, b) {
        return num(a.rank, 999) - num(b.rank, 999) || num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff) || num(b.goals_for) - num(a.goals_for);
      });
      return { group: g.group || g.name || g.group_name || '', rows: rows };
    }).filter(function (g) { return g.group && g.rows.length; });
  }

  function metadataText(data) {
    var md = (data.groups && data.groups.metadata) || (data.standings && data.standings.metadata) || (data.matches && data.matches.metadata) || {};
    var t = md.last_updated || md.last_checked_at || (data.update && (data.update.last_updated || data.update.checked_at)) || '';
    return t ? 'آخر تحديث: ' + esc(t) + ' — الإصلاح: ' + VERSION : 'الإصلاح: ' + VERSION;
  }

  function rowTeam(row) {
    return row.team_ar || row.name_ar || row.ar || row.team || row.name || 'منتخب';
  }

  function rowHtml(row, index) {
    var qualified = row.qualified ? '<span class="wcfix-chip wcfix-ok">متأهل</span>' : '';
    return '<tr>' +
      '<td class="wcfix-rank">' + esc(row.rank || index + 1) + '</td>' +
      '<td class="wcfix-team">' + esc(rowTeam(row)) + ' ' + qualified + '</td>' +
      '<td>' + esc(num(row.played)) + '</td>' +
      '<td>' + esc(num(row.wins)) + '</td>' +
      '<td>' + esc(num(row.draws)) + '</td>' +
      '<td>' + esc(num(row.losses)) + '</td>' +
      '<td>' + esc(num(row.goals_for)) + '</td>' +
      '<td>' + esc(num(row.goals_against)) + '</td>' +
      '<td>' + esc(num(row.goal_diff)) + '</td>' +
      '<td class="wcfix-points">' + esc(num(row.points)) + '</td>' +
    '</tr>';
  }

  function standingsTable(rows) {
    return '<div class="wcfix-table-wrap"><table class="wcfix-table">' +
      '<thead><tr><th>#</th><th>المنتخب</th><th>لعب</th><th>فاز</th><th>تعادل</th><th>خسر</th><th>له</th><th>عليه</th><th>فرق</th><th>نقاط</th></tr></thead>' +
      '<tbody>' + rows.map(rowHtml).join('') + '</tbody></table></div>';
  }

  function renderGroups(data) {
    var groups = getStandings(data);
    if (!groups.length) return errorHtml('لم أستطع قراءة ترتيب المجموعات من ملفات JSON الحالية.');
    return headerHtml('ترتيب المجموعات', 'يعرض كل مجموعات كأس العالم من ملف groups/standings الحالي مع كسر الكاش.') +
      '<div class="wcfix-groups-grid">' + groups.map(function (g) {
        return '<section class="wcfix-card"><h3>المجموعة ' + esc(g.group) + '</h3>' + standingsTable(g.rows) + '</section>';
      }).join('') + '</div>' + footerHtml(data);
  }

  function renderThirds(data) {
    var groups = getStandings(data);
    var thirds = [];
    groups.forEach(function (g) {
      var third = g.rows.find(function (r) { return num(r.rank) === 3; }) || g.rows[2];
      if (third) thirds.push(Object.assign({}, third, { group: g.group }));
    });
    thirds.sort(function (a, b) {
      return num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff) || num(b.goals_for) - num(a.goals_for) || clean(rowTeam(a)).localeCompare(clean(rowTeam(b)), 'ar');
    });
    thirds = thirds.map(function (r, i) { return Object.assign({}, r, { rank: i + 1, qualified: i < 8 }); });
    return headerHtml('أفضل الثوالث', 'حسب نظام 2026 يتأهل أفضل 8 منتخبات من أصحاب المركز الثالث إلى دور الـ32.') +
      '<section class="wcfix-card">' + standingsTable(thirds) + '</section>' + footerHtml(data);
  }

  function matchCard(m) {
    var d = parseDate(m);
    var st = stageText(m);
    var venue = venueText(m);
    var status = statusText(m);
    return '<article class="wcfix-match">' +
      '<div class="wcfix-match-top"><span>' + esc(formatDate(d)) + '</span>' + (status ? '<span class="wcfix-chip">' + esc(status) + '</span>' : '') + '</div>' +
      '<div class="wcfix-match-teams"><b>' + esc(teamA(m)) + '</b><strong>' + esc(scoreText(m)) + '</strong><b>' + esc(teamB(m)) + '</b></div>' +
      '<div class="wcfix-match-meta">' + (st ? '<span>' + esc(st) + '</span>' : '') + (venue ? '<span>' + esc(venue) + '</span>' : '') + '</div>' +
    '</article>';
  }

  function groupByDay(matches) {
    var out = [];
    var map = Object.create(null);
    matches.forEach(function (m) {
      var d = parseDate(m);
      var key = d ? d.toISOString().slice(0, 10) : 'unknown';
      if (!map[key]) { map[key] = { day: d, matches: [] }; out.push(map[key]); }
      map[key].matches.push(m);
    });
    out.sort(function (a, b) { return (a.day ? a.day.getTime() : 9999999999999) - (b.day ? b.day.getTime() : 9999999999999); });
    return out;
  }

  function getMatches(data) {
    var list = flattenMatches(data.matches).concat(flattenMatches(data.bracket));
    var seen = Object.create(null);
    return list.filter(function (m) {
      var id = pick(m, ['id', 'match_id', 'matchId', 'match_number', 'matchNumber']) || [teamA(m), teamB(m), stageText(m), parseDate(m)].join('|');
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    }).sort(function (a, b) {
      var da = parseDate(a); var db = parseDate(b);
      return (da ? da.getTime() : 9999999999999) - (db ? db.getTime() : 9999999999999);
    });
  }

  function renderAllMatches(data) {
    var matches = getMatches(data);
    if (!matches.length) return errorHtml('لم أستطع قراءة جدول المباريات من matches.json.');
    return headerHtml('كل المباريات', 'الجدول الكامل حسب توقيت الأردن.') +
      groupByDay(matches).map(function (g) {
        return '<section class="wcfix-card"><h3>' + esc(formatDay(g.day)) + '</h3><div class="wcfix-match-list">' + g.matches.map(matchCard).join('') + '</div></section>';
      }).join('') + footerHtml(data);
  }

  function ammanTodayStart() {
    var now = new Date();
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).reduce(function (a, x) { if (x.type !== 'literal') a[x.type] = x.value; return a; }, {});
    return new Date(p.year + '-' + p.month + '-' + p.day + 'T00:00:00+03:00');
  }

  function renderToday(data) {
    var from = ammanTodayStart();
    var to = new Date(Date.now() + 24 * 60 * 60 * 1000);
    var matches = getMatches(data).filter(function (m) {
      var d = parseDate(m);
      return d && d >= from && d <= to;
    });
    return headerHtml('مباريات اليوم والقادمة خلال 24 ساعة', 'من بداية اليوم بتوقيت الأردن إلى وقت فتح الموقع + 24 ساعة.') +
      (matches.length ? '<div class="wcfix-match-list">' + matches.map(matchCard).join('') + '</div>' : emptyHtml('لا توجد مباريات ضمن هذا النطاق حالياً. افتح تبويب كل المباريات للجدول الكامل.')) + footerHtml(data);
  }

  function renderJordan(data) {
    var matches = getMatches(data).filter(function (m) {
      var txt = clean([teamA(m), teamB(m), JSON.stringify(m)].join(' ')).toLowerCase();
      return txt.indexOf('الأردن') !== -1 || txt.indexOf('الاردن') !== -1 || txt.indexOf('jordan') !== -1;
    });
    return headerHtml('مباريات الأردن', 'فلترة تلقائية لأي مباراة يظهر فيها منتخب الأردن.') +
      (matches.length ? '<div class="wcfix-match-list">' + matches.map(matchCard).join('') + '</div>' : emptyHtml('لا توجد مباريات للأردن في جدول المباريات الحالي.')) + footerHtml(data);
  }

  function isKnockout(m) {
    var st = clean(stageText(m)).toLowerCase();
    if (!st) return false;
    if (/group|matchday|المجموعة|مجموعات/.test(st)) return false;
    return /32|16|quarter|semi|final|knockout|round of|ربع|نصف|نهائي|النهائي|ثمن|دور/.test(st);
  }

  function stageRank(s) {
    s = clean(s).toLowerCase();
    if (/32/.test(s) || /دور ال?32/.test(s)) return 1;
    if (/16/.test(s) || /ثمن/.test(s)) return 2;
    if (/quarter|ربع/.test(s)) return 3;
    if (/semi|نصف/.test(s)) return 4;
    if (/third|ثالث/.test(s)) return 5;
    if (/final|نهائي/.test(s)) return 6;
    return 9;
  }

  function renderRounds(data) {
    var matches = getMatches(data).filter(isKnockout);
    if (matches.length) {
      var stages = Object.create(null);
      matches.forEach(function (m) {
        var st = stageText(m) || 'الأدوار الإقصائية';
        if (!stages[st]) stages[st] = [];
        stages[st].push(m);
      });
      var keys = Object.keys(stages).sort(function (a, b) { return stageRank(a) - stageRank(b) || a.localeCompare(b, 'ar'); });
      return headerHtml('الأدوار الإقصائية', 'المواجهات من ملف bracket/matches الحالي مع كسر الكاش.') +
        keys.map(function (k) {
          return '<section class="wcfix-card"><h3>' + esc(k) + '</h3><div class="wcfix-match-list">' + stages[k].map(matchCard).join('') + '</div></section>';
        }).join('') + footerHtml(data);
    }

    var groups = getStandings(data);
    var qualified = [];
    var third = [];
    groups.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (num(r.rank) <= 2) qualified.push(Object.assign({}, r, { group: g.group }));
        else if (num(r.rank) === 3) third.push(Object.assign({}, r, { group: g.group }));
      });
    });
    third.sort(function (a, b) { return num(b.points) - num(a.points) || num(b.goal_diff) - num(a.goal_diff) || num(b.goals_for) - num(a.goals_for); });
    qualified = qualified.concat(third.slice(0, 8));
    return headerHtml('الأدوار الإقصائية', 'لم تظهر مواجهات الأدوار في ملف bracket بعد، لذلك يعرض هذا التصليح المنتخبات المتأهلة المحسوبة من ترتيب المجموعات.') +
      '<section class="wcfix-card"><h3>المنتخبات المتأهلة لدور الـ32</h3><div class="wcfix-qualified">' +
      qualified.map(function (r) { return '<span class="wcfix-chip wcfix-ok">' + esc(rowTeam(r)) + ' — مجموعة ' + esc(r.group) + '</span>'; }).join('') +
      '</div></section>' + footerHtml(data);
  }

  function headerHtml(title, sub) {
    return '<div class="wcfix-head"><h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>';
  }

  function footerHtml(data) {
    return '<div class="wcfix-foot">' + metadataText(data) + '</div>';
  }

  function emptyHtml(msg) {
    return '<div class="wcfix-empty">' + esc(msg) + '</div>';
  }

  function errorHtml(msg) {
    return '<div class="wcfix-error">' + esc(msg) + '</div>';
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + PANEL_ID + '{direction:rtl;text-align:right;margin:18px 0;padding:18px;border-radius:22px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.20);backdrop-filter:blur(8px);color:inherit;line-height:1.7}',
      '#' + PANEL_ID + ' *{box-sizing:border-box}',
      '#' + PANEL_ID + ' .wcfix-head h2{margin:0 0 6px;font-size:1.35rem;font-weight:900}',
      '#' + PANEL_ID + ' .wcfix-head p{margin:0 0 14px;opacity:.86}',
      '#' + PANEL_ID + ' .wcfix-groups-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}',
      '#' + PANEL_ID + ' .wcfix-card{margin:0 0 14px;padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);overflow:hidden}',
      '#' + PANEL_ID + ' .wcfix-card h3{margin:0 0 10px;font-size:1.05rem;font-weight:900}',
      '#' + PANEL_ID + ' .wcfix-table-wrap{width:100%;overflow:auto;border-radius:14px}',
      '#' + PANEL_ID + ' .wcfix-table{width:100%;border-collapse:collapse;min-width:520px;font-size:.92rem}',
      '#' + PANEL_ID + ' .wcfix-table th,#' + PANEL_ID + ' .wcfix-table td{padding:8px;border-bottom:1px solid rgba(255,255,255,.12);white-space:nowrap;text-align:center}',
      '#' + PANEL_ID + ' .wcfix-table th{font-weight:900;background:rgba(0,0,0,.16)}',
      '#' + PANEL_ID + ' .wcfix-table .wcfix-team{text-align:right;font-weight:800}',
      '#' + PANEL_ID + ' .wcfix-points,#' + PANEL_ID + ' .wcfix-rank{font-weight:900}',
      '#' + PANEL_ID + ' .wcfix-chip{display:inline-flex;align-items:center;gap:4px;margin:2px;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.14);font-size:.82rem;white-space:nowrap}',
      '#' + PANEL_ID + ' .wcfix-ok{background:rgba(0,180,90,.20)}',
      '#' + PANEL_ID + ' .wcfix-match-list{display:grid;gap:10px}',
      '#' + PANEL_ID + ' .wcfix-match{padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.14)}',
      '#' + PANEL_ID + ' .wcfix-match-top,#' + PANEL_ID + ' .wcfix-match-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;opacity:.9}',
      '#' + PANEL_ID + ' .wcfix-match-teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin:9px 0;text-align:center}',
      '#' + PANEL_ID + ' .wcfix-match-teams strong{font-weight:900;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.12)}',
      '#' + PANEL_ID + ' .wcfix-qualified{display:flex;flex-wrap:wrap;gap:6px}',
      '#' + PANEL_ID + ' .wcfix-empty,#' + PANEL_ID + ' .wcfix-error{padding:14px;border-radius:16px;background:rgba(0,0,0,.16)}',
      '#' + PANEL_ID + ' .wcfix-error{border:1px solid rgba(255,90,90,.35)}',
      '#' + PANEL_ID + ' .wcfix-foot{margin-top:12px;font-size:.86rem;opacity:.74}',
      '[data-maensat-wc-final-hidden="1"]{display:none!important}',
      '[data-maensat-wc-final-active="1"]{outline:2px solid rgba(255,255,255,.35)!important;outline-offset:2px!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function findWorldCupRoot() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('section, main, article, div'));
    var best = null;
    var score = -1;
    candidates.forEach(function (el) {
      var t = clean(el.textContent);
      if (!t || t.length > 120000) return;
      var s = 0;
      if (t.indexOf('كأس العالم 2026') !== -1) s += 5;
      if (t.indexOf('مونديال 2026') !== -1) s += 5;
      if (t.indexOf('الأردن في قلب الحدث') !== -1) s += 3;
      if (t.indexOf('كل المباريات') !== -1) s += 2;
      if (t.indexOf('المجموعات') !== -1) s += 2;
      if (t.indexOf('أفضل الثوالث') !== -1) s += 2;
      if (t.indexOf('الأدوار') !== -1) s += 2;
      if (s > score) { score = s; best = el; }
    });
    return score >= 7 ? best : null;
  }

  function getTabElements(root) {
    var selector = 'button,a,[role="button"],[role="tab"],[tabindex],.tab,[class*="tab"]';
    var base = root || document;
    var els = Array.prototype.slice.call(base.querySelectorAll(selector));
    if (els.length < 3) els = Array.prototype.slice.call(document.querySelectorAll(selector));
    return els.filter(function (el) { return labels.indexOf(clean(el.textContent)) !== -1; });
  }

  function tabRowFromTabs(tabs) {
    if (!tabs || !tabs.length) return null;
    var node = tabs[0];
    while (node && node !== document.body) {
      var t = clean(node.textContent);
      if (t.indexOf('اليوم') !== -1 && t.indexOf('كل المباريات') !== -1 && t.indexOf('الأدوار') !== -1) return node;
      node = node.parentElement;
    }
    return tabs[0].parentElement || null;
  }

  function ensurePanel() {
    ensureStyle();
    var panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    var root = findWorldCupRoot();
    if (!root) return null;
    var tabs = getTabElements(root);
    var row = tabRowFromTabs(tabs);
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('data-version', VERSION);
    panel.innerHTML = headerHtml('كأس العالم 2026', 'جاري تحميل البيانات...');
    if (row && row.parentNode) row.parentNode.insertBefore(panel, row.nextSibling);
    else root.appendChild(panel);
    return panel;
  }

  function hideLoadingText() {
    var root = findWorldCupRoot() || document;
    Array.prototype.slice.call(root.querySelectorAll('p,div,span,strong,b')).forEach(function (el) {
      if (el.id === PANEL_ID || el.closest('#' + PANEL_ID)) return;
      var t = clean(el.textContent);
      if ((t === 'جاري تحميل بيانات كأس العالم 2026...' || t === 'جاري تحميل بيانات كأس العالم 2026' || t === 'جاري تحميل بيانات كأس العالم') && el.children.length < 2) {
        el.setAttribute('data-maensat-wc-final-hidden', '1');
      }
    });
  }

  function setActive(label) {
    var root = findWorldCupRoot() || document;
    getTabElements(root).forEach(function (el) {
      var is = clean(el.textContent) === label;
      if (is) el.setAttribute(ACTIVE_ATTR, '1');
      else el.removeAttribute(ACTIVE_ATTR);
      try { el.setAttribute('aria-selected', is ? 'true' : 'false'); } catch (e) {}
    });
  }

  function render(label) {
    label = labels.indexOf(label) !== -1 ? label : lastTab;
    lastTab = label;
    var panel = ensurePanel();
    if (!panel) return false;
    panel.style.display = '';
    setActive(label);
    hideLoadingText();
    panel.innerHTML = headerHtml(label, 'جاري تحميل بيانات كأس العالم...');
    loadAll().then(function (data) {
      if (label === 'المجموعات') panel.innerHTML = renderGroups(data);
      else if (label === 'أفضل الثوالث') panel.innerHTML = renderThirds(data);
      else if (label === 'الأدوار') panel.innerHTML = renderRounds(data);
      else if (label === 'كل المباريات') panel.innerHTML = renderAllMatches(data);
      else if (label === 'الأردن') panel.innerHTML = renderJordan(data);
      else panel.innerHTML = renderToday(data);
      hideLoadingText();
      setActive(label);
    }).catch(function (e) {
      panel.innerHTML = errorHtml('تعذر تحميل ملفات كأس العالم: ' + (e && e.message ? e.message : e));
    });
    return true;
  }

  function inferCurrentTab() {
    var root = findWorldCupRoot() || document;
    var tabs = getTabElements(root);
    for (var i = 0; i < tabs.length; i += 1) {
      var el = tabs[i];
      var active = el.getAttribute('aria-selected') === 'true' || /active|selected|current|is-active/.test(el.className || '');
      if (active && labels.indexOf(clean(el.textContent)) !== -1) return clean(el.textContent);
    }
    var hash = clean(decodeURIComponent(location.hash || ''));
    if (/group|groups|المجموعات/.test(hash)) return 'المجموعات';
    if (/third|الثوالث/.test(hash)) return 'أفضل الثوالث';
    if (/round|bracket|ادوار|الأدوار/.test(hash)) return 'الأدوار';
    return 'المجموعات';
  }

  function bindClicks() {
    if (document.__maensatWcFinalClickBound) return;
    document.__maensatWcFinalClickBound = true;
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('button,a,[role="button"],[role="tab"],[tabindex],.tab,[class*="tab"]') : null;
      if (!el) return;
      var label = clean(el.textContent);
      if (labels.indexOf(label) === -1) return;
      setTimeout(function () { render(label); }, 80);
      setTimeout(function () { render(label); }, 450);
    }, true);
  }

  function boot() {
    bindClicks();
    var ok = render(inferCurrentTab());
    return ok;
  }

  var attempts = 0;
  function retry() {
    attempts += 1;
    var ok = boot();
    if (!ok && attempts < 40) setTimeout(retry, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry);
  else retry();

  window.addEventListener('hashchange', function () { setTimeout(function () { render(inferCurrentTab()); }, 150); });

  try {
    var observer = new MutationObserver(function () {
      if (observer.__busy) return;
      observer.__busy = true;
      setTimeout(function () {
        observer.__busy = false;
        bindClicks();
        var panel = document.getElementById(PANEL_ID);
        if (!panel || !document.documentElement.contains(panel)) render(lastTab);
        else { hideLoadingText(); setActive(lastTab); }
      }, 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
