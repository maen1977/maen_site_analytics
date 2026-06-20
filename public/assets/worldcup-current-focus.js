/*!
 * FIXED World Cup 2026 Current Match Focus v3 (SORT + STABILITY FIX)
 */

(() => {
  "use strict";

  if (window.__WORLD_CUP_CURRENT_FOCUS_V3__) return;
  window.__WORLD_CUP_CURRENT_FOCUS_V3__ = true;

  const DATA_URL = "/worldcup-2026/matches.json";
  const TIMEZONE = "Asia/Amman";
  const RETRIES = [300, 800, 1500, 2600, 4200, 6500, 9000];
  const LIVE_WINDOW_MINUTES = 150;

  let lastKey = "";

  function norm(value) {
    return String(value || "")
      .replace(/[أإآ]/g, "ا")
      .replace(/[ى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/[ـ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function ammanDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false
    }).formatToParts(date);

    const get = (type) => parts.find(p => p.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function parseTime(value) {
    if (!value) return NaN;
    if (typeof value === "number") return value > 1e10 ? value : value * 1000;

    const direct = Date.parse(value);
    if (Number.isFinite(direct)) return direct;

    return NaN;
  }

  function kickoff(match) {
    const values = [
      match?.kickoff,
      match?.kickoffUtc,
      match?.kickoffISO,
      match?.datetime,
      match?.date
    ];

    for (const v of values) {
      const ms = parseTime(v);
      if (Number.isFinite(ms)) return ms;
    }
    return NaN;
  }

  function matchId(match) {
    return String(match?.id || match?.match_id || "").trim();
  }

  function matchDateKey(match) {
    const ms = kickoff(match);
    return Number.isFinite(ms) ? ammanDateKey(new Date(ms)) : "";
  }

  function isFinished(match) {
    const s = norm(match?.status);
    return s.includes("finish") || s.includes("ft") || s.includes("انته");
  }

  function isLive(match, now) {
    if (isFinished(match)) return false;
    const start = kickoff(match);
    return Number.isFinite(start) && now >= start && now <= start + LIVE_WINDOW_MINUTES * 60000;
  }

  function flatten(bundle) {
    if (Array.isArray(bundle?.matches)) return bundle.matches;
    return bundle?.groups?.flatMap(g => g.matches || []) || [];
  }

  async function loadMatches() {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed loading matches");
    return flatten(await res.json());
  }

  function chooseMatch(matches) {
    const now = Date.now();
    const today = ammanDateKey(new Date());

    const items = matches
      .map((m, i) => ({
        m,
        i,
        start: kickoff(m),
        day: matchDateKey(m),
        id: matchId(m)
      }))
      .filter(x => Number.isFinite(x.start))

      // 🔥 FIX الأساسي: ترتيب عالمي من البداية
      .sort((a, b) => a.start - b.start || a.i - b.i);

    const live = items.find(x => isLive(x.m, now));
    if (live) return { ...live, badge: "⚽ مباشر الآن" };

    const todayMatches = items.filter(x => x.day === today);

    const upcomingToday = todayMatches.filter(x => x.start >= now);
    if (upcomingToday.length)
      return { ...upcomingToday[0], badge: "مباراة اليوم القادمة" };

    const pastToday = todayMatches.filter(x => x.start <= now);
    if (pastToday.length)
      return { ...pastToday.at(-1), badge: "آخر مباراة اليوم" };

    const upcoming = items.filter(x => x.start >= now);
    if (upcoming.length)
      return { ...upcoming[0], badge: "أقرب مباراة قادمة" };

    return items.at(-1) || null;
  }

  function root() {
    return document.body;
  }

  function findCard(base, match) {
    const id = matchId(match);
    if (id) {
      const el = base.querySelector(`[data-match-id="${id}"]`);
      if (el) return el;
    }
    return null;
  }

  function style() {
    if (document.getElementById("wc-focus-style-v3")) return;
    const s = document.createElement("style");
    s.id = "wc-focus-style-v3";
    s.textContent = `
      .wc-focus {
        outline: 3px solid gold !important;
        transform: scale(1.01);
      }
    `;
    document.head.appendChild(s);
  }

  async function focus() {
    const base = root();
    const matches = await loadMatches();

    const picked = chooseMatch(matches);
    if (!picked) return;

    const card = findCard(base, picked.m);
    if (!card) return;

    style();

    base.querySelectorAll(".wc-focus").forEach(el => el.classList.remove("wc-focus"));
    card.classList.add("wc-focus");

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    lastKey = picked.id;
  }

  function schedule() {
    RETRIES.forEach(t => setTimeout(() => focus().catch(console.warn), t));
  }

  document.addEventListener("DOMContentLoaded", schedule);
  window.focusWorldCupCurrentMatch = focus;
})();
