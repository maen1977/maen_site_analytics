(function () {
  'use strict';

  var ROOT = '/worldcup-2026/';
  var ACTIVE_TAB = 'groups';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function fetchJson(name) {
    return fetch(ROOT + name + '?v=' + Date.now(), { cache: 'no-store', credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error(name + ' HTTP ' + res.status);
      return res.json();
    });
  }

  function arTeam(match, side) {
    return match[side + '_ar'] || match[side] || '';
  }

  function matchStatusText(match) {
    var status = String(match.status || '').toLowerCase();
    if (status === 'finished') return 'انتهت';
    if (status === 'live') return 'مباشر الآن';
    return 'قادمة';
  }

  function scoreText(match) {
    var status = String(match.status || '').toLowerCase();
    if (status === 'finished' || status === 'live') return esc(match.home_score || 0) + ' - ' + esc(match.away_score || 0);
    return 'vs';
  }

  function dateText(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 16);
    try {
      return new Intl.DateTimeFormat('ar-JO', { timeZone: 'Asia/Amman', dateStyle: 'medium', timeStyle: 'short' }).format(d);
    } catch (e) {
      return d.toLocaleString('ar-JO');
    }
  }

  function matchDateKey(match) {
    var raw = match.kickoff_utc || match.kickoff_jordan || match.date;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return String(match.date || '').slice(0, 10);
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      var pick = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
      return pick('year') + '-' + pick('month') + '-' + pick('day');
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function todayKey() {
    return matchDateKey({ kickoff_utc: new Date().toISOString() });
  }

  function findMount() {
    var direct = document.getElementById('worldcupDynamic') || document.getElementById('worldCupDynamic') || document.getElementById('worldcupContent') || document.getElementById('worldCupContent');
    if (direct) return direct;
    var nodes = Array.prototype.slice.call(document.querySelectorAll('div,section,main,article,p'));
    var loading = nodes
      .filter(function (el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return /جاري تحميل بيانات كأس العالم|جاري تحميل.*كأس العالم|Loading.*World Cup/i.test(text) && text.length < 180;
      })
      .sort(function (a, b) { return (a.textContent || '').length - (b.textContent || '').length; })[0];
    return loading || null;
  }

  function tabButton(id, label) {
    return '<button type="button" class="maen-wc-tab ' + (ACTIVE_TAB === id ? 'active' : '') + '" data-wc-tab="' + id + '">' + esc(label) + '</button>';
  }

  function renderMatch(match) {
    return '<div class="maen-wc-match">' +
      '<div class="maen-wc-match-status">' + esc(matchStatusText(match)) + '</div>' +
      '<div class="maen-wc-teams"><span>' + esc(arTeam(match, 'team1')) + '</span><strong>' + scoreText(match) + '</strong><span>' + esc(arTeam(match, 'team2')) + '</span></div>' +
      '<div class="maen-wc-meta">' + esc(dateText(match.kickoff_utc || match.kickoff_jordan || match.date)) + (match.group ? ' · المجموعة ' + esc(match.group) : '') + '</div>' +
    '</div>';
  }

  function renderGroups(standings) {
    var groups = standings.standings || [];
    if (!groups.length) return '<div class="maen-wc-empty">لا توجد بيانات مجموعات حالياً.</div>';
    return '<div class="maen-wc-groups">' + groups.map(function (group) {
      var rows = group.rows || [];
      return '<div class="maen-wc-group-card"><h3>المجموعة ' + esc(group.group) + '</h3>' +
        '<table><thead><tr><th>الترتيب</th><th>المنتخب</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>فارق</th><th>نقاط</th></tr></thead><tbody>' +
        rows.map(function (row) {
          var cls = row.qualified || row.current_qualifying ? ' class="qualifying"' : '';
          return '<tr' + cls + '><td>' + esc(row.rank) + '</td><td>' + esc(row.team_ar || row.team) + '</td><td>' + esc(row.played) + '</td><td>' + esc(row.wins) + '</td><td>' + esc(row.draws) + '</td><td>' + esc(row.losses) + '</td><td>' + esc(row.goals_for) + '</td><td>' + esc(row.goals_against) + '</td><td>' + esc(row.goal_diff) + '</td><td><strong>' + esc(row.points) + '</strong></td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('') + '</div>';
  }

  function renderBestThirds(standings) {
    var rows = standings.best_thirds || [];
    if (!rows.length) return '<div class="maen-wc-empty">لا توجد بيانات أفضل الثوالث حالياً.</div>';
    return '<div class="maen-wc-group-card"><h3>أفضل الثوالث</h3><table><thead><tr><th>#</th><th>المنتخب</th><th>المجموعة</th><th>لعب</th><th>فارق</th><th>نقاط</th></tr></thead><tbody>' + rows.map(function (row, index) {
      var cls = row.qualified || row.current_best_third_qualifying ? ' class="qualifying"' : '';
      return '<tr' + cls + '><td>' + esc(row.best_third_rank || index + 1) + '</td><td>' + esc(row.team_ar || row.team) + '</td><td>' + esc(row.group) + '</td><td>' + esc(row.played) + '</td><td>' + esc(row.goal_diff) + '</td><td><strong>' + esc(row.points) + '</strong></td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function renderToday(matches) {
    var today = todayKey();
    var list = (matches.matches || matches || []).filter(function (m) { return matchDateKey(m) === today; });
    if (!list.length) {
      list = (matches.matches || matches || []).filter(function (m) { return String(m.status || '').toLowerCase() === 'live'; });
    }
    if (!list.length) return '<div class="maen-wc-empty">لا توجد مباريات اليوم بتوقيت الأردن.</div>';
    return '<div class="maen-wc-match-list">' + list.map(renderMatch).join('') + '</div>';
  }

  function renderAllMatches(matches) {
    var list = (matches.matches || matches || []).slice().sort(function (a, b) {
      return new Date(a.kickoff_utc || a.kickoff_jordan || a.date || 0) - new Date(b.kickoff_utc || b.kickoff_jordan || b.date || 0);
    });
    return '<div class="maen-wc-match-list">' + list.map(renderMatch).join('') + '</div>';
  }

  function viewHtml(matches, standings) {
    if (ACTIVE_TAB === 'today') return renderToday(matches);
    if (ACTIVE_TAB === 'thirds') return renderBestThirds(standings);
    if (ACTIVE_TAB === 'matches') return renderAllMatches(matches);
    return renderGroups(standings);
  }

  function injectStyles() {
    if (document.getElementById('maen-wc-fallback-style')) return;
    var style = document.createElement('style');
    style.id = 'maen-wc-fallback-style';
    style.textContent = '.maen-wc-fallback{direction:rtl;text-align:right;margin:18px 0}.maen-wc-note{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.08);margin-bottom:12px}.maen-wc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.maen-wc-tab{border:0;border-radius:999px;padding:9px 14px;cursor:pointer}.maen-wc-tab.active{font-weight:700;outline:2px solid currentColor}.maen-wc-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.maen-wc-group-card{overflow:auto;border-radius:16px;padding:12px;background:rgba(255,255,255,.07)}.maen-wc-group-card table{width:100%;border-collapse:collapse;min-width:520px}.maen-wc-group-card th,.maen-wc-group-card td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.12);white-space:nowrap}.maen-wc-group-card tr.qualifying{background:rgba(32,201,151,.14)}.maen-wc-match-list{display:grid;gap:10px}.maen-wc-match{border-radius:16px;padding:12px;background:rgba(255,255,255,.08)}.maen-wc-match-status{font-size:12px;opacity:.85}.maen-wc-teams{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center}.maen-wc-teams span:last-child{text-align:left}.maen-wc-teams strong{font-size:20px}.maen-wc-meta,.maen-wc-empty{opacity:.85;margin-top:8px}.maen-wc-refresh{font-size:12px;opacity:.75;margin-top:10px}';
    document.head.appendChild(style);
  }

  function render(mount, matches, standings) {
    injectStyles();
    mount.dataset.maenWorldcupFallback = '1';
    var updated = (standings.metadata && (standings.metadata.last_updated || standings.metadata.last_checked_at)) || (matches.metadata && matches.metadata.last_updated) || '';
    mount.innerHTML = '<div class="maen-wc-fallback">' +
      '<div class="maen-wc-note"><strong>تحديث كأس العالم يعمل الآن</strong><br>هذه واجهة احتياطية تعرض بيانات المجموعات مباشرة من ملفات JSON بدون كاش.</div>' +
      '<div class="maen-wc-tabs">' + tabButton('today', 'اليوم') + tabButton('matches', 'كل المباريات') + tabButton('groups', 'المجموعات') + tabButton('thirds', 'أفضل الثوالث') + '</div>' +
      '<div class="maen-wc-view">' + viewHtml(matches, standings) + '</div>' +
      '<div class="maen-wc-refresh">آخر تحديث: ' + esc(updated || 'غير معروف') + '</div>' +
    '</div>';
    Array.prototype.slice.call(mount.querySelectorAll('[data-wc-tab]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        ACTIVE_TAB = btn.getAttribute('data-wc-tab') || 'groups';
        render(mount, matches, standings);
      });
    });
  }

  function start() {
    var hash = String(location.hash || '').toLowerCase();
    var pageLooksWorldCup = hash.indexOf('worldcup') >= 0 || /كأس العالم|مونديال 2026|جاري تحميل بيانات كأس العالم/.test(document.body.textContent || '');
    if (!pageLooksWorldCup) return;
    var mount = findMount();
    if (!mount || mount.dataset.maenWorldcupFallback === '1') return;
    Promise.all([fetchJson('matches.json'), fetchJson('standings.json')])
      .then(function (result) { render(mount, result[0], result[1]); })
      .catch(function (err) { console.warn('MaenSat World Cup fallback failed:', err); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('hashchange', function () { setTimeout(start, 60); });
})();
