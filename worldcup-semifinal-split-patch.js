/* MAENSAT_WORLDCUP_STAGE_SPLIT_FIX_START_20260712 */
(() => {
  "use strict";

  const PATCH_VERSION = "20260712.1";
  const PANEL_ID = "wc-stage-split-panel";
  const OLD_PANEL_ID = "wc-knockout-live-cards-panel";
  const DATA_URLS = [
    "/worldcup-2026/knockout-live.json",
    "worldcup-2026/knockout-live.json"
  ];

  if (window.__MAENSAT_WORLDCUP_STAGE_SPLIT_FIX__ === PATCH_VERSION) return;
  window.__MAENSAT_WORLDCUP_STAGE_SPLIT_FIX__ = PATCH_VERSION;

  const STAGES = [
    { key: "round32", label: "دور الـ32", min: 73, max: 88 },
    { key: "round16", label: "دور الـ16", min: 89, max: 96 },
    { key: "quarterfinal", label: "ربع النهائي", min: 97, max: 100 },
    { key: "semifinal", label: "نصف النهائي", min: 101, max: 102 },
    { key: "thirdplace", label: "المركز الثالث", min: 103, max: 103 },
    { key: "final", label: "النهائي", min: 104, max: 104 }
  ];

  const LIVE_OVERRIDES = {
    101: {
      match_number: 101,
      stage_key: "semifinal",
      stage_ar: "نصف النهائي",
      home_name_ar: "فرنسا",
      home_code: "FRA",
      away_name_ar: "إسبانيا",
      away_code: "ESP",
      kickoff_at: "2026-07-14T22:00:00+03:00",
      venue_ar: "ملعب دالاس",
      status: "scheduled"
    },
    102: {
      match_number: 102,
      stage_key: "semifinal",
      stage_ar: "نصف النهائي",
      home_name_ar: "إنجلترا",
      home_code: "ENG",
      away_name_ar: "الأرجنتين",
      away_code: "ARG",
      kickoff_at: "2026-07-15T22:00:00+03:00",
      venue_ar: "ملعب أتلانتا",
      status: "scheduled"
    }
  };

  const FLAGS = {
    FRA: "🇫🇷",
    ESP: "🇪🇸",
    ENG: "🏴",
    ARG: "🇦🇷"
  };

  let cachedData = null;
  let activeStage = "semifinal";
  let bootAttempts = 0;

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function findWorldCupRoot() {
    const direct = document.querySelector(
      "#worldcup2026, [data-page='worldcup2026'], [data-section='worldcup2026'], .worldcup-2026"
    );
    if (direct) return direct;

    const headings = [...document.querySelectorAll("h1,h2,h3,[role='heading']")];
    const heading = headings.find((el) =>
      normalizeText(el.textContent).includes("الأردن في قلب الحدث")
    );
    return heading?.closest("section,main,article,div") || document.body;
  }

  function findRoundsTab(root) {
    const candidates = [
      ...root.querySelectorAll("button,[role='tab'],a,[data-tab]")
    ];
    return candidates.find((el) => normalizeText(el.textContent) === "الأدوار");
  }

  function findTabsContainer(tab) {
    return (
      tab?.closest("[role='tablist'],.tabs,.worldcup-tabs,.wc-tabs,nav") ||
      tab?.parentElement
    );
  }

  function injectStyles() {
    if (document.getElementById("wc-stage-split-style")) return;

    const style = document.createElement("style");
    style.id = "wc-stage-split-style";
    style.textContent = `
      #${PANEL_ID} {
        direction: rtl;
        margin: 18px 0 0;
        color: inherit;
      }
      #${PANEL_ID}[hidden] { display: none !important; }
      #${PANEL_ID} .wc-split-shell {
        border: 1px solid rgba(148,163,184,.28);
        border-radius: 22px;
        padding: 18px;
        background:
          radial-gradient(circle at top right, rgba(34,197,94,.10), transparent 38%),
          rgba(15,23,42,.72);
        box-shadow: 0 18px 48px rgba(2,6,23,.22);
        backdrop-filter: blur(8px);
      }
      #${PANEL_ID} .wc-split-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      #${PANEL_ID} .wc-split-title {
        margin: 0;
        font-size: clamp(1.18rem, 2.5vw, 1.55rem);
        font-weight: 900;
      }
      #${PANEL_ID} .wc-split-note {
        margin: 5px 0 0;
        color: #cbd5e1;
        font-size: .9rem;
      }
      #${PANEL_ID} .wc-stage-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 3px 0 12px;
        scrollbar-width: thin;
      }
      #${PANEL_ID} .wc-stage-tab {
        flex: 0 0 auto;
        border: 1px solid rgba(148,163,184,.34);
        border-radius: 999px;
        padding: 9px 14px;
        background: rgba(15,23,42,.65);
        color: #e2e8f0;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform .15s ease, border-color .15s ease, background .15s ease;
      }
      #${PANEL_ID} .wc-stage-tab:hover {
        transform: translateY(-1px);
        border-color: rgba(34,197,94,.70);
      }
      #${PANEL_ID} .wc-stage-tab[aria-selected="true"] {
        color: #052e16;
        border-color: #4ade80;
        background: linear-gradient(135deg, #86efac, #4ade80);
        box-shadow: 0 8px 22px rgba(34,197,94,.20);
      }
      #${PANEL_ID} .wc-stage-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 2px 0 12px;
      }
      #${PANEL_ID} .wc-stage-summary strong {
        font-size: 1.05rem;
      }
      #${PANEL_ID} .wc-stage-count {
        color: #cbd5e1;
        font-size: .85rem;
      }
      #${PANEL_ID} .wc-match-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      #${PANEL_ID} .wc-match-card {
        border: 1px solid rgba(148,163,184,.27);
        border-radius: 18px;
        padding: 15px;
        background: rgba(2,6,23,.54);
      }
      #${PANEL_ID} .wc-match-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        color: #cbd5e1;
        font-size: .82rem;
      }
      #${PANEL_ID} .wc-match-number {
        font-weight: 800;
      }
      #${PANEL_ID} .wc-status {
        border-radius: 999px;
        padding: 4px 9px;
        font-weight: 800;
        background: rgba(59,130,246,.17);
        color: #bfdbfe;
      }
      #${PANEL_ID} .wc-status.finished {
        background: rgba(34,197,94,.16);
        color: #bbf7d0;
      }
      #${PANEL_ID} .wc-team-row {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      #${PANEL_ID} .wc-team-name {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        font-weight: 900;
        font-size: 1.02rem;
      }
      #${PANEL_ID} .wc-team-name span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${PANEL_ID} .wc-flag {
        font-size: 1.25rem;
        line-height: 1;
      }
      #${PANEL_ID} .wc-score {
        min-width: 28px;
        text-align: center;
        font-size: 1.28rem;
        font-weight: 950;
      }
      #${PANEL_ID} .wc-match-meta {
        border-top: 1px solid rgba(148,163,184,.18);
        margin-top: 9px;
        padding-top: 10px;
        color: #cbd5e1;
        font-size: .86rem;
        line-height: 1.65;
      }
      #${PANEL_ID} .wc-empty,
      #${PANEL_ID} .wc-loading,
      #${PANEL_ID} .wc-error {
        padding: 22px 14px;
        border: 1px dashed rgba(148,163,184,.35);
        border-radius: 16px;
        text-align: center;
        color: #cbd5e1;
      }
      #${PANEL_ID} .wc-error { color: #fecaca; }
      @media (max-width: 760px) {
        #${PANEL_ID} .wc-split-shell { padding: 14px; border-radius: 18px; }
        #${PANEL_ID} .wc-match-grid { grid-template-columns: 1fr; }
        #${PANEL_ID} .wc-split-heading { display: block; }
      }
      @media (prefers-color-scheme: light) {
        #${PANEL_ID} .wc-split-shell {
          background:
            radial-gradient(circle at top right, rgba(34,197,94,.12), transparent 38%),
            rgba(255,255,255,.92);
        }
        #${PANEL_ID} .wc-stage-tab {
          background: #fff;
          color: #0f172a;
        }
        #${PANEL_ID} .wc-match-card { background: rgba(248,250,252,.96); }
        #${PANEL_ID} .wc-split-note,
        #${PANEL_ID} .wc-stage-count,
        #${PANEL_ID} .wc-match-top,
        #${PANEL_ID} .wc-match-meta,
        #${PANEL_ID} .wc-empty,
        #${PANEL_ID} .wc-loading { color: #475569; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel(root, roundsTab) {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <div class="wc-split-shell">
        <div class="wc-split-heading">
          <div>
            <h3 class="wc-split-title">الأدوار الإقصائية</h3>
            <p class="wc-split-note">كل دور في قسم مستقل — المواعيد بتوقيت الأردن</p>
          </div>
        </div>
        <div class="wc-stage-tabs" role="tablist" aria-label="أدوار كأس العالم"></div>
        <div class="wc-stage-content">
          <div class="wc-loading">جاري تحميل مباريات الأدوار…</div>
        </div>
      </div>
    `;

    const oldPanel = document.getElementById(OLD_PANEL_ID);
    const tabsContainer = findTabsContainer(roundsTab);

    if (oldPanel?.parentNode) {
      oldPanel.insertAdjacentElement("afterend", panel);
    } else if (tabsContainer?.parentNode) {
      tabsContainer.insertAdjacentElement("afterend", panel);
    } else {
      root.appendChild(panel);
    }
    return panel;
  }

  async function fetchJson() {
    let lastError = null;
    for (const baseUrl of DATA_URLS) {
      try {
        const joiner = baseUrl.includes("?") ? "&" : "?";
        const response = await fetch(
          `${baseUrl}${joiner}stageSplit=${encodeURIComponent(PATCH_VERSION)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("تعذّر تحميل بيانات المباريات");
  }

  function matchNumber(match) {
    const values = [
      match?.match_number,
      match?.matchNumber,
      match?.number,
      match?.match_no,
      match?.matchNo,
      match?.id,
      match?.code,
      match?.name
    ];
    for (const value of values) {
      const found = String(value ?? "").match(/(?:M|MATCH\s*)?(\d{2,3})/i);
      if (found) return Number(found[1]);
    }
    return null;
  }

  function collectMatches(data) {
    const found = [];
    const seenObjects = new WeakSet();

    function walk(value, inheritedRound = null) {
      if (!value || typeof value !== "object") return;
      if (seenObjects.has(value)) return;
      seenObjects.add(value);

      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, inheritedRound));
        return;
      }

      const ownNumber = matchNumber(value);
      const looksLikeMatch =
        ownNumber !== null &&
        (
          "home_team" in value ||
          "away_team" in value ||
          "home" in value ||
          "away" in value ||
          "team1" in value ||
          "team2" in value ||
          "kickoff_at" in value ||
          "start_time" in value
        );

      if (looksLikeMatch) {
        found.push({ ...value, __round: inheritedRound });
        return;
      }

      const roundLabel =
        value.title_ar ||
        value.stage_ar ||
        value.round_name_ar ||
        value.label_ar ||
        inheritedRound;

      for (const child of Object.values(value)) {
        walk(child, roundLabel);
      }
    }

    walk(data);

    const byNumber = new Map();
    found.forEach((match) => {
      const number = matchNumber(match);
      if (number !== null && !byNumber.has(number)) byNumber.set(number, match);
    });

    return [...byNumber.values()].sort(
      (a, b) => (matchNumber(a) || 999) - (matchNumber(b) || 999)
    );
  }

  function stageForNumber(number) {
    return STAGES.find((stage) => number >= stage.min && number <= stage.max)?.key || null;
  }

  function getNested(obj, paths) {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => acc?.[key], obj);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  }

  function teamInfo(match, side) {
    const isHome = side === "home";
    const objectPaths = isHome
      ? ["home_team", "home", "team1", "homeTeam"]
      : ["away_team", "away", "team2", "awayTeam"];
    const raw = getNested(match, objectPaths);

    const fallbackName = getNested(match, isHome
      ? ["home_name_ar", "home_team_name_ar", "home_name", "team1_name"]
      : ["away_name_ar", "away_team_name_ar", "away_name", "team2_name"]
    );

    const fallbackCode = getNested(match, isHome
      ? ["home_code", "home_team_code", "team1_code"]
      : ["away_code", "away_team_code", "team2_code"]
    );

    if (typeof raw === "string") {
      return { name: raw, code: fallbackCode || "" };
    }

    return {
      name:
        getNested(raw || {}, ["name_ar", "arabic_name", "name", "short_name", "display_name"]) ||
        fallbackName ||
        "يتحدد لاحقًا",
      code:
        getNested(raw || {}, ["code", "fifa_code", "short_code", "id"]) ||
        fallbackCode ||
        ""
    };
  }

  function scoreValue(match, side) {
    const paths = side === "home"
      ? ["home_score", "score.home", "scores.home", "result.home", "team1_score"]
      : ["away_score", "score.away", "scores.away", "result.away", "team2_score"];
    const value = getNested(match, paths);
    if (value === null || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function statusInfo(match) {
    const raw = normalizeText(
      getNested(match, ["status", "match_status", "state", "status_key", "status_ar"])
    );
    const finished = /finished|complete|ended|ft|انته/.test(raw);
    const live = /live|playing|in_progress|مباشر|جارية/.test(raw);

    if (finished) return { label: "انتهت", className: "finished" };
    if (live) return { label: "مباشر", className: "live" };
    return { label: "قادمة", className: "" };
  }

  function dateValue(match) {
    return getNested(match, [
      "kickoff_at",
      "kickoff",
      "datetime",
      "date_time",
      "start_time",
      "utc_date",
      "date"
    ]);
  }

  function venueValue(match) {
    const venue = getNested(match, ["venue_ar", "stadium_ar", "venue.name_ar", "venue.name", "stadium"]);
    return venue || "الملعب يُحدّث لاحقًا";
  }

  function formatJordanDate(value) {
    if (!value) return "الموعد يُحدّث لاحقًا";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    try {
      return new Intl.DateTimeFormat("ar-JO", {
        timeZone: "Asia/Amman",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
    } catch {
      return date.toLocaleString("ar-JO");
    }
  }

  function mergeOverride(match) {
    const number = matchNumber(match);
    const override = LIVE_OVERRIDES[number];
    return override ? { ...match, ...override } : match;
  }

  function matchesForStage(allMatches, stageKey) {
    const merged = allMatches.map(mergeOverride);
    const byNumber = new Map(
      merged
        .map((match) => [matchNumber(match), match])
        .filter(([number]) => number !== null)
    );

    Object.values(LIVE_OVERRIDES).forEach((override) => {
      if (!byNumber.has(override.match_number)) {
        byNumber.set(override.match_number, override);
      }
    });

    return [...byNumber.values()]
      .filter((match) => stageForNumber(matchNumber(match)) === stageKey)
      .sort((a, b) => matchNumber(a) - matchNumber(b));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderCard(match) {
    const number = matchNumber(match);
    const home = teamInfo(match, "home");
    const away = teamInfo(match, "away");
    const homeScore = scoreValue(match, "home");
    const awayScore = scoreValue(match, "away");
    const status = statusInfo(match);
    const showScore =
      status.className === "finished" ||
      status.className === "live" ||
      homeScore !== null ||
      awayScore !== null;

    const homeFlag = FLAGS[String(home.code).toUpperCase()] || "⚽";
    const awayFlag = FLAGS[String(away.code).toUpperCase()] || "⚽";

    return `
      <article class="wc-match-card" data-match-number="${escapeHtml(number)}">
        <div class="wc-match-top">
          <span class="wc-match-number">المباراة ${escapeHtml(number)}</span>
          <span class="wc-status ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
        </div>

        <div class="wc-team-row">
          <div class="wc-team-name">
            <span class="wc-flag" aria-hidden="true">${homeFlag}</span>
            <span>${escapeHtml(home.name)}</span>
          </div>
          <div class="wc-score">${showScore ? escapeHtml(homeScore ?? "—") : "—"}</div>
        </div>

        <div class="wc-team-row">
          <div class="wc-team-name">
            <span class="wc-flag" aria-hidden="true">${awayFlag}</span>
            <span>${escapeHtml(away.name)}</span>
          </div>
          <div class="wc-score">${showScore ? escapeHtml(awayScore ?? "—") : "—"}</div>
        </div>

        <div class="wc-match-meta">
          <div>🗓️ ${escapeHtml(formatJordanDate(dateValue(match)))}</div>
          <div>🏟️ ${escapeHtml(venueValue(match))}</div>
        </div>
      </article>
    `;
  }

  function renderStage(panel, allMatches) {
    const tabs = panel.querySelector(".wc-stage-tabs");
    const content = panel.querySelector(".wc-stage-content");
    const stage = STAGES.find((item) => item.key === activeStage) || STAGES[3];
    const matches = matchesForStage(allMatches, stage.key);

    tabs.innerHTML = STAGES.map((item) => {
      const count = matchesForStage(allMatches, item.key).length;
      return `
        <button
          type="button"
          class="wc-stage-tab"
          role="tab"
          data-stage="${item.key}"
          aria-selected="${item.key === stage.key ? "true" : "false"}"
        >${escapeHtml(item.label)}${count ? ` (${count})` : ""}</button>
      `;
    }).join("");

    content.innerHTML = `
      <div class="wc-stage-summary">
        <strong>${escapeHtml(stage.label)}</strong>
        <span class="wc-stage-count">${matches.length} ${matches.length === 1 ? "مباراة" : "مباريات"}</span>
      </div>
      ${
        matches.length
          ? `<div class="wc-match-grid">${matches.map(renderCard).join("")}</div>`
          : `<div class="wc-empty">لا توجد مباريات متاحة لهذا الدور حاليًا.</div>`
      }
    `;

    tabs.querySelectorAll(".wc-stage-tab").forEach((button) => {
      button.addEventListener("click", () => {
        activeStage = button.dataset.stage || "semifinal";
        renderStage(panel, allMatches);
      });
    });

    const selected = tabs.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  async function showSplitPanel(root, roundsTab) {
    injectStyles();
    const panel = ensurePanel(root, roundsTab);
    panel.hidden = false;

    const oldPanel = document.getElementById(OLD_PANEL_ID);
    if (oldPanel && oldPanel !== panel) {
      oldPanel.hidden = true;
      oldPanel.style.display = "none";
    }

    if (cachedData) {
      renderStage(panel, cachedData);
      return;
    }

    panel.querySelector(".wc-stage-content").innerHTML =
      '<div class="wc-loading">جاري تحميل مباريات الأدوار…</div>';

    try {
      const raw = await fetchJson();
      cachedData = collectMatches(raw);
      renderStage(panel, cachedData);
    } catch (error) {
      cachedData = Object.values(LIVE_OVERRIDES);
      renderStage(panel, cachedData);
      const note = document.createElement("div");
      note.className = "wc-error";
      note.style.marginTop = "12px";
      note.textContent =
        "تم عرض نصف النهائي، لكن تعذّر تحميل بقية بيانات الأدوار من الملف الحالي.";
      panel.querySelector(".wc-stage-content").appendChild(note);
      console.error("[World Cup stage split]", error);
    }
  }

  function hideSplitPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.hidden = true;
  }

  function wireTabs(root, roundsTab) {
    if (roundsTab.dataset.wcStageSplitWired === PATCH_VERSION) return;
    roundsTab.dataset.wcStageSplitWired = PATCH_VERSION;

    roundsTab.addEventListener("click", () => {
      window.setTimeout(() => showSplitPanel(root, roundsTab), 80);
    });

    const container = findTabsContainer(roundsTab);
    const candidates = [
      ...(container || root).querySelectorAll("button,[role='tab'],a,[data-tab]")
    ];

    candidates.forEach((tab) => {
      if (tab === roundsTab) return;
      tab.addEventListener("click", hideSplitPanel);
    });
  }

  function isWorldCupHashActive() {
    return !location.hash || normalizeText(location.hash).includes("worldcup2026");
  }

  function boot() {
    const root = findWorldCupRoot();
    const roundsTab = findRoundsTab(root);

    if (!roundsTab) {
      bootAttempts += 1;
      if (bootAttempts < 40) window.setTimeout(boot, 250);
      return;
    }

    wireTabs(root, roundsTab);

    if (
      isWorldCupHashActive() &&
      (
        roundsTab.getAttribute("aria-selected") === "true" ||
        roundsTab.classList.contains("active") ||
        normalizeText(roundsTab.dataset.active) === "true"
      )
    ) {
      showSplitPanel(root, roundsTab);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("hashchange", () => {
    bootAttempts = 0;
    window.setTimeout(boot, 80);
  });

  const observer = new MutationObserver(() => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      bootAttempts = 0;
      boot();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
/* MAENSAT_WORLDCUP_STAGE_SPLIT_FIX_END_20260712 */
