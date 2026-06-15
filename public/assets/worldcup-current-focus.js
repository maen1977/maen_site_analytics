/*!
 * World Cup 2026 Current Match Focus v2
 * Opens "كل المباريات" near today's/live/next match instead of the first old match.
 */
(() => {
  "use strict";

  if (window.__WORLD_CUP_CURRENT_FOCUS_V2__) return;
  window.__WORLD_CUP_CURRENT_FOCUS_V2__ = true;

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

    const get = (type) => parts.find((part) => part.type === type)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function parseTime(value) {
    if (!value) return NaN;
    if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1000;

    const text = String(value).trim();
    const direct = Date.parse(text);
    if (Number.isFinite(direct)) return direct;

    const cleaned = text
      .replace("بتوقيت الأردن", "")
      .replace("بتوقيت الاردن", "")
      .replace(/\//g, "-")
      .trim();

    const retry = Date.parse(cleaned);
    return Number.isFinite(retry) ? retry : NaN;
  }

  function kickoff(match) {
    const values = [
      match?.kickoff_utc,
      match?.kickoffUtc,
      match?.kickoff_iso,
      match?.kickoffISO,
      match?.kickoff_jordan,
      match?.kickoffJordan,
      match?.kickoff,
      match?.datetime,
      match?.date_time,
      match?.date
    ];

    for (const value of values) {
      const ms = parseTime(value);
      if (Number.isFinite(ms)) return ms;
    }

    return NaN;
  }

  function matchId(match) {
    return String(match?.id || match?.match_id || match?.game_id || match?.fixture_id || "").trim();
  }

  function matchDateKey(match) {
    const explicit = match?.date_jordan || match?.dateJordan || match?.local_date || match?.date_key;
    if (/^\d{4}-\d{2}-\d{2}/.test(String(explicit || ""))) return String(explicit).slice(0, 10);

    const ms = kickoff(match);
    return Number.isFinite(ms) ? ammanDateKey(new Date(ms)) : "";
  }

  function statusText(match) {
    return norm([
      match?.status,
      match?.state,
      match?.live_status_detail,
      match?.score?.status_detail
    ].filter(Boolean).join(" "));
  }

  function isFinished(match) {
    const s = statusText(match);
    return (
      s.includes("finished") ||
      s.includes("complete") ||
      s.includes("full time") ||
      s === "ft" ||
      s.includes("انته") ||
      s.includes("نهائي") ||
      Boolean(match?.score?.ft)
    );
  }

  function isLive(match, nowMs) {
    const s = statusText(match);

    if (
      s.includes("live") ||
      s.includes("in progress") ||
      s.includes("مباشر") ||
      s.includes("الشوط")
    ) return true;

    if (isFinished(match)) return false;

    const start = kickoff(match);
    return Number.isFinite(start) && nowMs >= start && nowMs <= start + LIVE_WINDOW_MINUTES * 60_000;
  }

  function teamNames(match) {
    return [
      match?.team1,
      match?.team2,
      match?.home_team,
      match?.away_team,
      match?.homeTeam,
      match?.awayTeam,
      match?.home?.name,
      match?.away?.name,
      match?.team1_ar,
      match?.team2_ar,
      match?.home_ar,
      match?.away_ar
    ].filter(Boolean).map((name) => String(name).trim());
  }

  function flatten(bundle) {
    if (Array.isArray(bundle?.matches)) return bundle.matches;

    const out = [];
    for (const group of bundle?.groups || bundle?.rounds || []) {
      if (Array.isArray(group?.matches)) out.push(...group.matches);
    }
    return out;
  }

  async function loadMatches() {
    const sep = DATA_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${DATA_URL}${sep}focus=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load matches: ${response.status}`);
    return flatten(await response.json());
  }

  function chooseMatch(matches) {
    const now = Date.now();
    const today = ammanDateKey(new Date());

    const items = matches
      .map((match, index) => ({
        match,
        index,
        id: matchId(match),
        start: kickoff(match),
        day: matchDateKey(match)
      }))
      .filter((item) => Number.isFinite(item.start));

    const asc = (a, b) => a.start - b.start || a.index - b.index;
    const desc = (a, b) => b.start - a.start || b.index - a.index;

    const live = items.filter((item) => isLive(item.match, now)).sort(asc);
    if (live.length) return { ...live[0], badge: "أنت هنا · مباشر الآن" };

    const upcomingToday = items
      .filter((item) => item.day === today && item.start >= now && !isFinished(item.match))
      .sort(asc);
    if (upcomingToday.length) return { ...upcomingToday[0], badge: "أنت هنا · مباراة اليوم القادمة" };

    const pastToday = items.filter((item) => item.day === today && item.start <= now).sort(desc);
    if (pastToday.length) return { ...pastToday[0], badge: "أنت هنا · آخر مباراة اليوم" };

    const upcoming = items.filter((item) => item.start >= now && !isFinished(item.match)).sort(asc);
    if (upcoming.length) return { ...upcoming[0], badge: "أنت هنا · أقرب مباراة قادمة" };

    const past = items.filter((item) => item.start <= now || isFinished(item.match)).sort(desc);
    if (past.length) return { ...past[0], badge: "أنت هنا · آخر مباراة" };

    return null;
  }

  function root() {
    return document.querySelector("#worldcup2026, #worldcup-2026, [data-section='worldcup'], .worldcup-section")
      || Array.from(document.querySelectorAll("section, main, div")).find((node) => {
        const text = norm(node.textContent || "");
        return text.includes("كاس العالم 2026") || text.includes("كأس العالم 2026") || text.includes("مونديال 2026");
      })
      || document.body;
  }

  function allMatchesButton(base) {
    return Array.from(base.querySelectorAll("button, a, [role='tab'], [data-tab], [data-view]"))
      .find((node) => {
        const text = norm(node.textContent || node.getAttribute?.("aria-label") || "");
        return text.includes("كل المباريات") || text.includes("جميع المباريات") || text.includes("all matches");
      });
  }

  function openAllMatches(base) {
    const btn = allMatchesButton(base);
    if (!btn) return false;

    const selected = btn.getAttribute("aria-selected") === "true" || btn.classList.contains("active") || btn.classList.contains("is-active");
    if (!selected) btn.click();

    return true;
  }

  function esc(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function visible(node) {
    if (!(node instanceof Element)) return false;
    const r = node.getBoundingClientRect();
    const s = getComputedStyle(node);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  function containsTeamPair(text, names) {
    const clean = norm(text);
    const arr = names.map(norm).filter((name) => name.length > 1);

    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        if (clean.includes(arr[i]) && clean.includes(arr[j])) return true;
      }
    }

    return false;
  }

  function cardFor(base, match) {
    const id = matchId(match);

    if (id) {
      const direct = base.querySelector(
        `[data-match-id="${esc(id)}"], [data-game-id="${esc(id)}"], [data-fixture-id="${esc(id)}"], [id="${esc(id)}"], [id*="${esc(id)}"]`
      );
      if (direct && visible(direct)) return direct.closest(".match-card, .wc-match-card, .worldcup-match, .fixture-card, .game-card, article, li, tr, .card") || direct;
    }

    const names = teamNames(match);
    if (names.length < 2) return null;

    const candidates = Array.from(base.querySelectorAll(
      ".match-card, .wc-match-card, .worldcup-match, .fixture-card, .game-card, [class*='match'], [class*='fixture'], article, li, tr, .card, div"
    )).filter(visible);

    let best = null;
    let bestScore = -1;

    for (const node of candidates) {
      if (!containsTeamPair(node.textContent || "", names)) continue;

      let score = 1;
      const cls = String(node.className || "").toLowerCase();
      if (cls.includes("match") || cls.includes("fixture") || cls.includes("game")) score += 5;
      if (node.matches("article, li, tr, .card")) score += 2;

      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }

    return best;
  }

  function style() {
    if (document.getElementById("wc-current-focus-style-v2")) return;

    const s = document.createElement("style");
    s.id = "wc-current-focus-style-v2";
    s.textContent = `
      .wc-current-focus-target {
        position: relative !important;
        outline: 3px solid rgba(250, 204, 21, .95) !important;
        box-shadow: 0 0 0 6px rgba(250, 204, 21, .18), 0 18px 50px rgba(0,0,0,.20) !important;
        border-radius: 18px !important;
        scroll-margin-top: 115px !important;
      }
      .wc-current-focus-badge {
        display: inline-flex;
        width: max-content;
        max-width: calc(100% - 16px);
        margin: 0 0 10px 0;
        padding: 7px 12px;
        border-radius: 999px;
        background: linear-gradient(135deg, #facc15, #fb923c);
        color: #111827;
        font-weight: 900;
        font-size: 13px;
        line-height: 1.2;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
      }
      .wc-current-focus-badge::before { content: "⚽ "; }
    `;
    document.head.appendChild(s);
  }

  async function focus(force = false) {
    const base = root();
    openAllMatches(base);
    await new Promise((resolve) => setTimeout(resolve, 450));

    const picked = chooseMatch(await loadMatches());
    if (!picked) return false;

    const key = `${picked.id || picked.index}-${picked.start}`;
    if (!force && key === lastKey) return true;

    const card = cardFor(base, picked.match);
    if (!card) return false;

    style();

    base.querySelectorAll(".wc-current-focus-target").forEach((node) => {
      node.classList.remove("wc-current-focus-target");
      node.querySelectorAll(":scope > .wc-current-focus-badge").forEach((badge) => badge.remove());
    });

    const badge = document.createElement("div");
    badge.className = "wc-current-focus-badge";
    badge.textContent = picked.badge;

    card.prepend(badge);
    card.classList.add("wc-current-focus-target");
    card.id = "worldcup-current-match";
    lastKey = key;

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  function schedule(force = false) {
    for (const delay of RETRIES) {
      setTimeout(() => focus(force).catch((error) => console.warn("[worldcup-focus]", error)), delay);
    }
  }

  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("button, a, [role='tab'], [data-tab], [data-view]");
    if (!btn) return;

    const text = norm(btn.textContent || "");
    const href = btn.getAttribute?.("href") || "";

    if (
      text.includes("كل المباريات") ||
      text.includes("كاس العالم") ||
      text.includes("كأس العالم") ||
      href.includes("worldcup")
    ) {
      schedule(true);
    }
  }, true);

  window.addEventListener("hashchange", () => {
    if (norm(location.hash).includes("worldcup")) schedule(true);
  });

  window.focusWorldCupCurrentMatch = () => focus(true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => schedule(true), { once: true });
  } else {
    schedule(true);
  }
})();
