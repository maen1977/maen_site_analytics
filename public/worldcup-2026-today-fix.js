/*
  Maen Sat - World Cup 2026 Today Hotfix
  المطلوب:
  1) عند فتح قسم كأس العالم يكون التبويب الافتراضي هو "اليوم".
  2) تبويب اليوم يعرض من بداية اليوم بتوقيت الأردن حتى وقت فتح الموقع + 24 ساعة.
  3) تحديث خانة "انطلقت البطولة" بعدد أيام البطولة لغاية اليوم.
*/
(function () {
  'use strict';

  const AMMAN_TZ = 'Asia/Amman';
  const AMMAN_FIXED_OFFSET = '+03:00';
  const TOURNAMENT_START_AMMAN = '2026-06-11T00:00:00+03:00';
  const DATA_URL = '/worldcup-2026/matches.json?v=' + Date.now();
  const OVERRIDE_ID = 'maen-wc-today-override';
  const HIDDEN_ATTR = 'data-maen-wc-hidden-by-today-hotfix';

  const TAB_LABELS = ['اليوم', 'الأردن', 'كل المباريات', 'المجموعات', 'أفضل الثوالث', 'الأدوار'];

  function normalizeText(value) {
    return String(value || '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ammanParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: AMMAN_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const out = {};
    for (const part of parts) out[part.type] = part.value;
    return out;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ammanDateKey(date) {
    const p = ammanParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function startOfTodayAmman(now) {
    return new Date(`${ammanDateKey(now)}T00:00:00${AMMAN_FIXED_OFFSET}`);
  }

  function tournamentDayNumber(now) {
    const todayStart = startOfTodayAmman(now);
    const start = new Date(TOURNAMENT_START_AMMAN);
    const diff = Math.floor((todayStart.getTime() - start.getTime()) / 86400000) + 1;
    return Math.max(0, diff);
  }

  function formatDateAmman(date) {
    return new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
      timeZone: AMMAN_TZ,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  function formatTimeAmman(date) {
    return new Intl.DateTimeFormat('ar-JO-u-nu-latn', {
      timeZone: AMMAN_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  function findFirstValue(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
        return obj[key];
      }
    }
    return '';
  }

  function valueToName(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      return String(
        value.name_ar || value.arabic_name || value.ar || value.name || value.short_name ||
        value.english_name || value.en || value.team || value.country || ''
      );
    }
    return '';
  }

  function getTeamNames(match) {
    const home = findFirstValue(match, [
      'home_ar', 'team1_ar', 'homeTeam_ar', 'home_team_ar', 'home_name_ar',
      'home', 'team1', 'homeTeam', 'home_team', 'home_name', 'team_a', 'teamA', 'localteam',
    ]);
    const away = findFirstValue(match, [
      'away_ar', 'team2_ar', 'awayTeam_ar', 'away_team_ar', 'away_name_ar',
      'away', 'team2', 'awayTeam', 'away_team', 'away_name', 'team_b', 'teamB', 'visitorteam',
    ]);

    let homeName = valueToName(home);
    let awayName = valueToName(away);

    // دعم صيغة teams: [home, away]
    if ((!homeName || !awayName) && Array.isArray(match.teams) && match.teams.length >= 2) {
      homeName = homeName || valueToName(match.teams[0]);
      awayName = awayName || valueToName(match.teams[1]);
    }

    // دعم صيغ nested شائعة
    if (!homeName) homeName = valueToName(match.home_team || match.homeTeam || match.team1);
    if (!awayName) awayName = valueToName(match.away_team || match.awayTeam || match.team2);

    return {
      home: homeName || 'الفريق الأول',
      away: awayName || 'الفريق الثاني',
    };
  }

  function parseDateTimeCandidate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number') {
      const d = new Date(value > 10000000000 ? value : value * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value !== 'string') return null;

    let s = value.trim();
    if (!s) return null;

    // ISO مع Z أو offset
    if (/T/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // ISO بدون offset: اعتبره بتوقيت الأردن
    if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(s)) {
      s = s.replace(/T(\d):/, 'T0$1:');
      const d = new Date(s + AMMAN_FIXED_OFFSET);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // تاريخ فقط
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00' + AMMAN_FIXED_OFFSET);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function parseKickoff(match) {
    const direct = findFirstValue(match, [
      'kickoff_local', 'local_kickoff', 'local_datetime', 'datetime_local',
      'kickoff', 'kickoff_at', 'kickoffAt', 'date_time', 'datetime',
      'start_time', 'startTime', 'start', 'time_utc', 'utc_time', 'utc',
      'iso', 'timestamp', 'dateTime', 'match_datetime', 'matchDateTime',
    ]);
    let parsed = parseDateTimeCandidate(direct);
    if (parsed) return parsed;

    const dateValue = findFirstValue(match, ['date_local', 'local_date', 'match_date', 'date', 'day']);
    const timeValue = findFirstValue(match, ['time_local', 'local_time', 'match_time', 'time', 'hour']);

    if (dateValue && timeValue) {
      const dateText = String(dateValue).trim();
      let timeText = String(timeValue).trim();
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateText) && timeMatch) {
        const h = pad2(timeMatch[1]);
        const m = timeMatch[2];
        parsed = new Date(`${dateText}T${h}:${m}:00${AMMAN_FIXED_OFFSET}`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }

    return null;
  }

  function getStatus(match, kickoff) {
    const raw = normalizeText(findFirstValue(match, ['status_ar', 'status', 'state', 'match_status', 'game_status']));
    const now = new Date();
    if (/انته|final|finished|ft|completed/i.test(raw)) return 'انتهت';
    if (/live|in.?progress|جارية|مباشر/i.test(raw)) return 'مباشرة الآن';
    if (kickoff && kickoff.getTime() < now.getTime()) return 'محتملة/بانتظار التحديث';
    return 'قادمة';
  }

  function getScore(match) {
    const h = findFirstValue(match, ['home_score', 'score_home', 'homeScore', 'score1', 'team1_score', 'goals_home']);
    const a = findFirstValue(match, ['away_score', 'score_away', 'awayScore', 'score2', 'team2_score', 'goals_away']);
    if (h !== '' && a !== '') return `${h} - ${a}`;
    const score = findFirstValue(match, ['score', 'result', 'final_score']);
    return score ? String(score) : '';
  }

  function getMeta(match) {
    const group = findFirstValue(match, ['group_ar', 'group', 'stage_ar', 'stage', 'round_ar', 'round']);
    const stadium = findFirstValue(match, ['stadium_ar', 'stadium', 'venue_ar', 'venue']);
    const city = findFirstValue(match, ['city_ar', 'city']);
    return [group, stadium, city].map(valueToName).filter(Boolean).join(' · ');
  }

  function looksLikeMatchObject(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const kickoff = parseKickoff(item);
    const teams = getTeamNames(item);
    const hasTeams = teams.home !== 'الفريق الأول' || teams.away !== 'الفريق الثاني';
    return !!kickoff && hasTeams;
  }

  function collectMatches(root) {
    const found = [];
    const seen = new WeakSet();

    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);

      if (Array.isArray(value)) {
        for (const item of value) {
          if (looksLikeMatchObject(item)) found.push(item);
          else walk(item);
        }
        return;
      }

      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }

    walk(root);

    // إزالة التكرار حسب رقم المباراة أو الفرق والوقت
    const unique = new Map();
    for (const match of found) {
      const kickoff = parseKickoff(match);
      const teams = getTeamNames(match);
      const id = findFirstValue(match, ['id', 'match_id', 'matchId', 'number', 'match_number', 'matchNumber']) ||
        `${kickoff ? kickoff.toISOString() : ''}|${teams.home}|${teams.away}`;
      unique.set(String(id), match);
    }

    return Array.from(unique.values());
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
    });
  }

  function commonAncestor(nodes) {
    if (!nodes.length) return null;
    let parent = nodes[0];
    while (parent) {
      if (nodes.every(node => parent.contains(node))) return parent;
      parent = parent.parentElement;
    }
    return null;
  }

  function findTabButtons() {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [data-tab], .tab, .wc-tab'));
    return candidates.filter(el => TAB_LABELS.includes(normalizeText(el.textContent)));
  }

  function findTabsRow() {
    const buttons = findTabButtons();
    if (!buttons.length) return null;
    const foundLabels = new Set(buttons.map(btn => normalizeText(btn.textContent)));
    if (!foundLabels.has('اليوم')) return null;
    return commonAncestor(buttons.slice(0, Math.min(buttons.length, 6))) || buttons[0].parentElement;
  }

  function findWorldCupSection(tabsRow) {
    if (!tabsRow) return null;
    let node = tabsRow;
    while (node && node !== document.body) {
      const txt = normalizeText(node.textContent);
      if (
        txt.includes('مونديال 2026') ||
        txt.includes('الأردن في قلب الحدث') ||
        (txt.includes('كأس العالم 2026') && txt.includes('كل المباريات'))
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return tabsRow.parentElement || document.body;
  }

  function ensureOverrideBox(section, tabsRow) {
    let box = document.getElementById(OVERRIDE_ID);
    if (box) return box;

    box = document.createElement('div');
    box.id = OVERRIDE_ID;
    box.dir = 'rtl';
    box.style.marginTop = '18px';
    box.style.display = 'none';

    if (tabsRow && tabsRow.parentElement) {
      tabsRow.insertAdjacentElement('afterend', box);
    } else if (section) {
      section.appendChild(box);
    } else {
      document.body.appendChild(box);
    }

    return box;
  }

  function setOriginalWorldCupContentVisible(section, tabsRow, visible) {
    if (!section || !tabsRow) return;
    const box = document.getElementById(OVERRIDE_ID);
    let node = tabsRow.nextElementSibling;
    while (node) {
      const next = node.nextElementSibling;
      if (node !== box) {
        if (!visible) {
          if (!node.hasAttribute(HIDDEN_ATTR)) {
            node.setAttribute(HIDDEN_ATTR, node.style.display || '');
          }
          node.style.display = 'none';
        } else if (node.hasAttribute(HIDDEN_ATTR)) {
          node.style.display = node.getAttribute(HIDDEN_ATTR) || '';
          node.removeAttribute(HIDDEN_ATTR);
        }
      }
      node = next;
    }
  }

  function markTodayTabActive() {
    const buttons = findTabButtons();
    for (const btn of buttons) {
      const isToday = normalizeText(btn.textContent) === 'اليوم';
      btn.classList.toggle('active', isToday);
      btn.classList.toggle('is-active', isToday);
      btn.setAttribute('aria-selected', isToday ? 'true' : 'false');
      if (isToday && typeof btn.click === 'function' && !btn.dataset.maenTodayClicked) {
        btn.dataset.maenTodayClicked = '1';
        try { btn.click(); } catch (_) { /* no-op */ }
      }
    }
  }

  function updateTournamentDayBadge(now) {
    const dayNo = tournamentDayNumber(now);
    if (!dayNo) return;

    const text = `انطلقت البطولة — اليوم ${dayNo} من البطولة`;
    const all = Array.from(document.querySelectorAll('body *'));
    const targets = all.filter(el => {
      const t = normalizeText(el.textContent);
      return t.length <= 120 && (
        t.includes('انطلقت البطولة') ||
        t.includes('العد التنازلي لانطلاق كأس العالم') ||
        t.includes('العدّ التنازلي لانطلاق كأس العالم')
      );
    });

    const target = targets[0];
    if (target) {
      target.textContent = text;
    }
  }

  function renderMatchCard(match) {
    const kickoff = parseKickoff(match);
    const teams = getTeamNames(match);
    const status = getStatus(match, kickoff);
    const score = getScore(match);
    const meta = getMeta(match);

    return `
      <article style="border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);border-radius:18px;padding:14px 16px;margin:10px 0;box-shadow:0 8px 24px rgba(0,0,0,.12);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <strong style="font-size:15px;">${escapeHtml(formatDateAmman(kickoff))}</strong>
          <span style="font-weight:800;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 10px;">${escapeHtml(formatTimeAmman(kickoff))}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;text-align:center;font-weight:900;font-size:17px;">
          <div>${escapeHtml(teams.home)}</div>
          <div style="min-width:64px;border-radius:12px;background:rgba(255,255,255,.10);padding:8px 10px;">${escapeHtml(score || 'VS')}</div>
          <div>${escapeHtml(teams.away)}</div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.92;">
          <span>${escapeHtml(status)}</span>
          ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
        </div>
      </article>
    `;
  }

  function renderToday(matches, box, start, end, now) {
    const filtered = matches
      .map(match => ({ match, kickoff: parseKickoff(match) }))
      .filter(item => item.kickoff && item.kickoff.getTime() >= start.getTime() && item.kickoff.getTime() <= end.getTime())
      .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())
      .map(item => item.match);

    const title = 'مباريات اليوم والقادمة خلال 24 ساعة';
    const range = `من ${formatDateAmman(start)} ${formatTimeAmman(start)} إلى ${formatDateAmman(end)} ${formatTimeAmman(end)} — حسب توقيت الأردن`;

    box.innerHTML = `
      <section style="border:1px solid rgba(255,255,255,.20);border-radius:22px;padding:16px;background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.04));">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <div>
            <h3 style="margin:0 0 6px;font-size:21px;">${title}</h3>
            <p style="margin:0;opacity:.86;font-size:14px;">${range}</p>
          </div>
          <span style="font-weight:900;border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.16);">${filtered.length} مباراة</span>
        </div>
        ${filtered.length ? filtered.map(renderMatchCard).join('') : `
          <div style="border:1px dashed rgba(255,255,255,.24);border-radius:16px;padding:18px;text-align:center;opacity:.92;">
            لا توجد مباريات ضمن نطاق اليوم + 24 ساعة حالياً.
          </div>
        `}
      </section>
    `;
  }

  async function loadMatches() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('تعذر تحميل matches.json');
    const json = await response.json();
    return collectMatches(json);
  }

  async function activateTodayView() {
    const tabsRow = findTabsRow();
    const section = findWorldCupSection(tabsRow);
    if (!tabsRow || !section) return false;

    const box = ensureOverrideBox(section, tabsRow);
    const now = new Date();
    const start = startOfTodayAmman(now);
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    updateTournamentDayBadge(now);
    markTodayTabActive();
    setOriginalWorldCupContentVisible(section, tabsRow, false);
    box.style.display = '';
    box.innerHTML = '<div dir="rtl" style="padding:16px;border-radius:16px;background:rgba(255,255,255,.08);">جاري تحميل مباريات اليوم...</div>';

    try {
      const matches = await loadMatches();
      renderToday(matches, box, start, end, now);
    } catch (error) {
      box.innerHTML = `<div dir="rtl" style="padding:16px;border-radius:16px;background:rgba(255,80,80,.12);border:1px solid rgba(255,80,80,.25);">تعذر تحميل مباريات اليوم. الرجاء تحديث الصفحة.</div>`;
      console.error('[WorldCupTodayHotfix]', error);
    }

    return true;
  }

  function restoreOriginalIfNotToday(clicked) {
    const label = normalizeText(clicked && clicked.textContent);
    if (!TAB_LABELS.includes(label)) return;

    const tabsRow = findTabsRow();
    const section = findWorldCupSection(tabsRow);
    const box = document.getElementById(OVERRIDE_ID);

    if (label === 'اليوم') {
      setTimeout(activateTodayView, 50);
    } else {
      if (box) box.style.display = 'none';
      setOriginalWorldCupContentVisible(section, tabsRow, true);
    }
  }

  function bindTabClicks() {
    document.addEventListener('click', function (event) {
      const clicked = event.target && event.target.closest && event.target.closest('button, a, [role="button"], [data-tab], .tab, .wc-tab');
      if (clicked) restoreOriginalIfNotToday(clicked);
    }, true);
  }

  function start() {
    bindTabClicks();

    // نحاول أكثر من مرة لأن بيانات كأس العالم قد تُرسم بعد تحميل الصفحة.
    const attempts = [0, 400, 1000, 1800, 3000, 5000];
    attempts.forEach(delay => setTimeout(activateTodayView, delay));

    const observer = new MutationObserver(function () {
      updateTournamentDayBadge(new Date());
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
