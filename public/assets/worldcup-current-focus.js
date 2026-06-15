/*!
 * World Cup 2026 Current Match Focus
 * Auto-focuses "كل المباريات" on the live/current/today/next match.
 */
(() => {
  "use strict";

  if (window.__WORLD_CUP_CURRENT_FOCUS_LOADED__) return;
  window.__WORLD_CUP_CURRENT_FOCUS_LOADED__ = true;

  const CONFIG = {
    dataUrl: "/worldcup-2026/matches.json",
    timezone: "Asia/Amman",
    liveWindowMinutes: 140,
    retryDelays: [250, 700, 1300, 2200, 3600, 5200, 7500],
    rootHints: [
      "#worldcup2026",
      "#worldcup-2026",
      "[data-section='worldcup']",
      "[data-page='worldcup']",
      ".worldcup-section",
      ".worldcup2026",
      ".wc-section"
    ],
    allMatchesWords: ["كل المباريات", "جميع المباريات", "All matches"]
  };

  let cachedBundle = null;
  let lastFocusKey = "";

  function normalizeText(value) {
    return String(value || "")
      .replace(/[أإآ]/g, "ا")
      .replace(/[ى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/[ـ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function toMs(value) {
    if (!value) return NaN;
    if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1000;

    const raw = String(value).trim();
    if (!raw) return NaN;

    const direct = Date.parse(raw);
    if (Number.isFinite(direct)) return direct;

    const cleaned = raw
      .replace(" بتوقيت الأردن", "")
      .replace("بتوقيت الاردن", "")
      .replace(/\//g, "-");

    const retry = Date.parse(cleaned);
    return Number.isFinite(retry) ? retry : NaN;
  }

  function jordanParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);

    const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
    let hour = pick("hour");
    if (hour === "24") hour = "00";

    return { year: pick("year"), month: pick("month"), day: pick("day"), hour };
  }

  function jordanDateKey(date = new Date()) {
    const p = jordanParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function kickoffMs(match) {
    const candidates = [
      match?.kickoff_utc,
      match?.kickoffUtc,
      match?.kickoffISO,
      match?.kickoff_iso,
      match?.kickoff,
      match?.kickoff_jordan,
      match?.kickoffJordan,
      match?.datetime,
      match?.date_time,
      match?.date
    ];

    for (const candidate of candidates) {
      const ms = toMs(candidate);
      if (Number.isFinite(ms)) return ms;
    }

    return NaN;
  }

  function matchDateKey(match) {
    const explicit = match?.date_jordan || match?.dateJordan || match?.local_date || match?.date_key;
    if (explicit && /^\d{4}-\d{2}-\d{2}/.test(String(explicit))) return String(explicit).slice(0, 10);

    const ms = kickoffMs(match);
    if (!Number.isFinite(ms)) return "";
    return jordanDateKey(new Date(ms));
  }

  function statusText(match) {
    return normalizeText([
      match?.status,
      match?.state,
      match?.live_status_detail,
      match?.score?.status_detail,
      match?.score?.state
    ].filter(Boolean).join(" "));
  }

  function hasScore(match) {
    const score = match?.score || {};
    return Boolean(
      Array.isArray(score.ft) ||
      Array.isArray(score.current) ||
      Array.isArray(score.live) ||
      Number.isFinite(Number(match?.home_score)) ||
      Number.isFinite(Number(match?.away_score))
    );
  }

  function isFinished(match) {
    const text = statusText(match);
    return (
      text.includes("finished") ||
      text.includes("complete") ||
      text.includes("full time") ||
      text === "ft" ||
      text.includes("انته") ||
      text.includes("نهائي") ||
      Boolean(match?.score?.ft)
    );
  }

  function isLive(match, nowMs) {
    const text = statusText(match);

    if (
      text.includes("live") ||
      text.includes("in progress") ||
      text.includes("playing") ||
      text.includes("مباشر") ||
      text.includes("الشوط") ||
      text.includes("استراحه")
    ) {
      return true;
    }

    if (isFinished(match)) return false;

    const start = kickoffMs(match);
    if (!Number.isFinite(start)) return false;

    return nowMs >= start && nowMs <= start + CONFIG.liveWindowMinutes * 60_000;
  }

  function teamNames(match) {
    const names = [
      match?.team1,
      match?.team2,
      match?.home_team,
      match?.away_team,
      match?.homeTeam,
      match?.awayTeam,
      match?.home?.name,
      match?.away?.name,
      match?.home?.short_name,
      match?.away?.short_name,
      match?.team1_ar,
      match?.team2_ar,
      match?.home_ar,
      match?.away_ar
    ];

    return names
      .filter(Boolean)
      .map((name) => String(name).trim())
      .filter((name, index, arr) => name && arr.indexOf(name) === index);
  }

  function matchId(match) {
    return String(match?.id || match?.match_id || match?.game_id || match?.fixture_id || "").trim();
  }

  function flattenMatches(bundle) {
    if (!bundle) return [];
    if (Array.isArray(bundle.matches)) return bundle.matches;

    const matches = [];
    const rounds = bundle.rounds || bundle.groups || [];

    if (Array.isArray(rounds)) {
      for (const round of rounds) {
        if (Array.isArray(round?.matches)) matches.push(...round.matches);
      }
    }

    return matches;
  }

  function pickTargetMatch(matches) {
    const now = new Date();
    const nowMs = now.getTime();
    const today = jordanDateKey(now);

    const valid = matches
      .map((match, index) => ({
        match,
        index,
        id: matchId(match),
        start: kickoffMs(match),
        dateKey: matchDateKey(match)
      }))
      .filter((item) => Number.isFinite(item.start));

    const byStartAsc = (a, b) => a.start - b.start || a.index - b.index;
    const byStartDesc = (a, b) => b.start - a.start || b.index - a.index;

    const live = valid
      .filter((item) => isLive(item.match, nowMs))
      .sort((a, b) => Math.abs(a.start - nowMs) - Math.abs(b.start - nowMs));

    if (live.length) return { ...live[0], reason: "live", badge: "أنت هنا · مباشر الآن" };

    const upcomingToday = valid
      .filter((item) => item.dateKey === today && item.start >= nowMs && !isFinished(item.match))
      .sort(byStartAsc);

    if (upcomingToday.length) return { ...upcomingToday[0], reason: "upcomingToday", badge: "أنت هنا · مباراة اليوم القادمة" };

    const pastToday = valid
      .filter((item) => item.dateKey === today && item.start <= nowMs)
      .sort(byStartDesc);

    if (pastToday.length) return { ...pastToday[0], reason: "pastToday", badge: "أنت هنا · آخر مباراة اليوم" };

    const upcoming = valid
      .filter((item) => item.start >= nowMs && !isFinished(item.match))
      .sort(byStartAsc);

    if (upcoming.length) return { ...upcoming[0], reason: "upcoming", badge: "أنت هنا · أقرب مباراة قادمة" };

    const past = valid
      .filter((item) => item.start <= nowMs || isFinished(item.match) || hasScore(item.match))
      .sort(byStartDesc);

    if (past.length) return { ...past[0], reason: "past", badge: "أنت هنا · آخر مباراة" };

    return null;
  }

  async function loadMatchesBundle() {
    const separator = CONFIG.dataUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${CONFIG.dataUrl}${separator}focus=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`matches.json HTTP ${response.status}`);

    cachedBundle = await response.json();
    return cachedBundle;
  }

  function findWorldCupRoot() {
    for (const selector of CONFIG.rootHints) {
      const found = document.querySelector(selector);
      if (found) return found;
    }

    const candidates = Array.from(document.querySelectorAll("section, main, div, article"));
    return candidates.find((node) => {
      const text = normalizeText(node.textContent || "");
      return text.includes("كاس العالم 2026") || text.includes("كأس العالم 2026") || text.includes("مونديال 2026");
    }) || document.body;
  }

  function isAllMatchesButton(node) {
    if (!node) return false;
    const text = normalizeText(node.textContent || node.getAttribute?.("aria-label") || "");
    return CONFIG.allMatchesWords.some((word) => text.includes(normalizeText(word)));
  }

  function clickAllMatchesIfPossible(root) {
    const buttons = Array.from(root.querySelectorAll("button, a, [role='tab'], [data-tab], [data-view]"));
    const button = buttons.find(isAllMatchesButton);
    if (!button) return false;

    const ariaSelected = button.getAttribute("aria-selected");
    const activeish =
      button.classList.contains("active") ||
      button.classList.contains("is-active") ||
      ariaSelected === "true";

    if (!activeish) {
      button.click();
      return true;
    }

    return false;
  }

  function visibleEnough(node) {
    if (!node || !(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function safeCssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function candidateCardSelectors(match) {
    const id = matchId(match);
    const selectors = [
      ".match-card",
      ".wc-match-card",
      ".worldcup-match",
      ".fixture-card",
      ".game-card",
      "[class*='match']",
      "[class*='fixture']",
      "[class*='game']",
      "article",
      "li",
      "tr",
      ".card"
    ];

    if (id) {
      selectors.unshift(
        `[data-match-id="${safeCssEscape(id)}"]`,
        `[data-game-id="${safeCssEscape(id)}"]`,
        `[data-fixture-id="${safeCssEscape(id)}"]`,
        `[id="${safeCssEscape(id)}"]`,
        `[id*="${safeCssEscape(id)}"]`
      );
    }

    return selectors.join(",");
  }

  function bestCardContainer(node, root) {
    let current = node;

    while (current && current !== root && current !== document.body) {
      const classText = String(current.className || "").toLowerCase();

      if (
        current.matches?.(".match-card, .wc-match-card, .worldcup-match, .fixture-card, .game-card, article, li, tr, .card") ||
        classText.includes("match") ||
        classText.includes("fixture") ||
        classText.includes("game")
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return node instanceof Element ? node : null;
  }

  function textContainsTeamPair(text, names) {
    const cleanText = normalizeText(text);
    const normalizedNames = names.map(normalizeText).filter((name) => name && name.length >= 2);

    for (let i = 0; i < normalizedNames.length; i += 1) {
      for (let j = i + 1; j < normalizedNames.length; j += 1) {
        if (cleanText.includes(normalizedNames[i]) && cleanText.includes(normalizedNames[j])) return true;
      }
    }

    return false;
  }

  function findRenderedMatchElement(root, match) {
    const id = matchId(match);

    if (id) {
      const byId = root.querySelector(
        `[data-match-id="${safeCssEscape(id)}"], [data-game-id="${safeCssEscape(id)}"], [data-fixture-id="${safeCssEscape(id)}"], [id="${safeCssEscape(id)}"], [id*="${safeCssEscape(id)}"]`
      );

      if (byId && visibleEnough(byId)) return bestCardContainer(byId, root);
    }

    const names = teamNames(match);
    if (names.length < 2) return null;

    const candidates = Array.from(root.querySelectorAll(candidateCardSelectors(match))).filter(visibleEnough);
    let best = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      const text = candidate.textContent || "";
      if (!textContainsTeamPair(text, names)) continue;

      let score = 10;
      const classText = String(candidate.className || "").toLowerCase();
      if (classText.includes("match") || classText.includes("fixture") || classText.includes("game")) score += 5;
      if (candidate.matches?.("article, li, tr, .card")) score += 2;

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (best) return bestCardContainer(best, root);

    const all = Array.from(root.querySelectorAll("div, article, li, tr, section")).filter(visibleEnough);
    return all.find((node) => textContainsTeamPair(node.textContent || "", names)) || null;
  }

  function injectStyles() {
    if (document.getElementById("worldcup-current-focus-style")) return;

    const style = document.createElement("style");
    style.id = "worldcup-current-focus-style";
    style.textContent = `
      .wc-current-focus-target {
        position: relative !important;
        outline: 3px solid rgba(250, 204, 21, 0.95) !important;
        box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.16), 0 18px 50px rgba(0, 0, 0, 0.18) !important;
        scroll-margin-top: 118px !important;
        border-radius: 18px !important;
      }
      .wc-current-focus-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: max-content;
        max-width: calc(100% - 16px);
        margin: 0 0 10px 0;
        padding: 7px 12px;
        border-radius: 999px;
        background: linear-gradient(135deg, #facc15, #f97316);
        color: #111827;
        font-weight: 900;
        font-size: 13px;
        line-height: 1.2;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        z-index: 2;
      }
      .wc-current-focus-badge::before { content: "⚽"; }
      @media (max-width: 640px) {
        .wc-current-focus-target { scroll-margin-top: 92px !important; }
        .wc-current-focus-badge { font-size: 12px; padding: 6px 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function addBadge(target, text) {
    target.querySelectorAll(":scope > .wc-current-focus-badge").forEach((badge) => badge.remove());

    const badge = document.createElement("div");
    badge.className = "wc-current-focus-badge";
    badge.textContent = text || "أنت هنا";
    target.prepend(badge);
  }

  function clearPreviousHighlights(root) {
    root.querySelectorAll(".wc-current-focus-target").forEach((node) => {
      node.classList.remove("wc-current-focus-target");
      node.removeAttribute("data-worldcup-current-focus");
      if (node.id === "worldcup-current-match") node.removeAttribute("id");
      node.querySelectorAll(":scope > .wc-current-focus-badge").forEach((badge) => badge.remove());
    });
  }

  function scrollToTarget(target) {
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    window.setTimeout(() => {
      const rect = target.getBoundingClientRect();
      if (rect.top < 95) window.scrollBy({ top: rect.top - 115, behavior: "smooth" });
    }, 450);
  }

  async function focusCurrentMatch(options = {}) {
    const { force = false, selectAllTab = false } = options;

    const root = findWorldCupRoot();
    if (!root) return false;

    if (selectAllTab) {
      const clicked = clickAllMatchesIfPossible(root);
      if (clicked) await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const bundle = await loadMatchesBundle();
    const matches = flattenMatches(bundle);
    const picked = pickTargetMatch(matches);
    if (!picked?.match) return false;

    const key = `${picked.id || picked.index}-${picked.start}-${picked.reason}`;
    if (!force && lastFocusKey === key) return true;

    const target = findRenderedMatchElement(root, picked.match);
    if (!target) return false;

    injectStyles();
    clearPreviousHighlights(root);

    target.classList.add("wc-current-focus-target");
    target.dataset.worldcupCurrentFocus = picked.reason || "current";
    target.id = "worldcup-current-match";
    addBadge(target, picked.badge);

    lastFocusKey = key;
    scrollToTarget(target);

    return true;
  }

  function scheduleFocus(options = {}) {
    for (const delay of CONFIG.retryDelays) {
      window.setTimeout(() => {
        focusCurrentMatch(options).catch((error) => console.warn("[worldcup-current-focus]", error));
      }, delay);
    }
  }

  function shouldAutoRunOnLoad() {
    const hash = normalizeText(location.hash);
    if (hash.includes("worldcup") || hash.includes("كاس") || hash.includes("كأس")) return true;

    const root = findWorldCupRoot();
    if (!root || root === document.body) return false;

    const rect = root.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.5 && rect.bottom > 0;
  }

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button, a, [role='tab'], [data-tab], [data-view]");
    if (!button) return;

    if (isAllMatchesButton(button)) scheduleFocus({ force: true, selectAllTab: false });

    const text = normalizeText(button.textContent || "");
    const href = button.getAttribute?.("href") || "";

    if (href.includes("worldcup") || text.includes("كاس العالم") || text.includes("كأس العالم")) {
      window.setTimeout(() => scheduleFocus({ force: true, selectAllTab: true }), 700);
    }
  }, true);

  window.addEventListener("hashchange", () => {
    if (normalizeText(location.hash).includes("worldcup")) {
      scheduleFocus({ force: true, selectAllTab: true });
    }
  });

  const observer = new MutationObserver(() => {
    if (!lastFocusKey && shouldAutoRunOnLoad()) scheduleFocus({ force: false, selectAllTab: false });
  });

  function start() {
    injectStyles();

    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}

    if (shouldAutoRunOnLoad()) scheduleFocus({ force: true, selectAllTab: true });

    window.focusWorldCupCurrentMatch = () => focusCurrentMatch({ force: true, selectAllTab: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
