(function () {
  "use strict";

  var MATCHES_URL = "/data/football-matches.json";
  var MATCHES_VISIBLE_STEP = 20;
  var state = {
    loaded: false,
    loading: false,
    matches: [],
    matchesWindow: "week",
    matchesQuery: "",
    matchesVisibleCount: MATCHES_VISIBLE_STEP,
    competitionVisibleCounts: {},
    competitionWindows: {},
    openCompetitions: {},
    // LaLiga is the default landing competition for the MENA audience.
    // renderMatches falls back to the first available competition if its data is absent.
    activeCompetition: "la-liga",
    matchesGeneratedAt: "",
    renderedLanguage: "",
  };

  var COMPETITIONS = {
    "jordan-pro-league": { ar: "الدوري الأردني للمحترفين", en: "Jordanian Pro League", order: 0 },
    "premier-league": { ar: "الدوري الإنجليزي الممتاز", en: "English Premier League", order: 1 },
    "la-liga": { ar: "الدوري الإسباني", en: "Spanish LaLiga", order: 2 },
    "serie-a": { ar: "الدوري الإيطالي", en: "Italian Serie A", order: 3 },
    "bundesliga": { ar: "الدوري الألماني", en: "German Bundesliga", order: 4 },
    "ligue-1": { ar: "الدوري الفرنسي", en: "French Ligue 1", order: 5 },
    "champions-league": { ar: "دوري أبطال أوروبا", en: "UEFA Champions League", order: 6 },
    "europa-league": { ar: "الدوري الأوروبي", en: "UEFA Europa League", order: 7 },
    "eredivisie": { ar: "الدوري الهولندي", en: "Dutch Eredivisie", order: 8 },
    "primeira-liga": { ar: "الدوري البرتغالي", en: "Portuguese Primeira Liga", order: 9 },
    "scottish-premiership": { ar: "الدوري الإسكتلندي الممتاز", en: "Scottish Premiership", order: 10 },
  };

  var TEXT = {
    nav: { ar: "المباريات", en: "Matches" },
    eyebrow: { ar: "مواعيد المباريات", en: "Match schedules" },
    title: { ar: "مواعيد المباريات والقنوات", en: "Match times and broadcasters" },
    intro: { ar: "نعرض موعد المباراة والقناة الناقلة فقط، لتعرف أين ومتى تشاهدها.", en: "See the match time and broadcaster only, so you know where and when to watch." },
    daily: { ar: "تحديث القنوات", en: "Channel updates" },
    today: { ar: "مباريات اليوم", en: "Today" },
    tomorrow: { ar: "مباريات غداً", en: "Tomorrow" },
    week: { ar: "الأيام السبعة القادمة", en: "Next 7 days" },
    matchesSearch: { ar: "ابحث عن فريق أو قناة...", en: "Search for a team or channel..." },
    matchesRefresh: { ar: "تحديث المواعيد", en: "Refresh schedule" },
    matchesLoading: { ar: "جاري تحميل المواعيد...", en: "Loading schedule..." },
    matchesUnavailable: { ar: "تعذر تحميل المواعيد حالياً. سنحاول مجدداً لاحقاً.", en: "The schedule is temporarily unavailable. We will try again later." },
    matchesEmpty: { ar: "لا توجد مباريات متاحة لهذه الفترة أو البحث.", en: "No matches are available for this period or search." },
    matchesCount: { ar: "مباراة", en: "matches" },
    matchesWithBroadcasters: { ar: "لها قناة", en: "with broadcaster" },
    matchTime: { ar: "الساعة", en: "Time" },
    matchBroadcast: { ar: "تُعرض على", en: "Shown on" },
    matchNoBroadcast: { ar: "لم يُعلن رقم المحطة بعد.", en: "The exact channel number has not been announced yet." },
    broadcastFta: { ar: "مجاني / FTA", en: "FTA / Free" },
    broadcastEncrypted: { ar: "مشفر / مدفوع", en: "Encrypted / subscription" },
    broadcastUnknown: { ar: "نوع البث غير مؤكد", en: "Access type unverified" },
    updated: { ar: "آخر تحديث للقنوات", en: "Last channel update" },
    scheduleNote: { ar: "دليل مواعيد وقنوات فقط، من دون متابعة النتائج.", en: "A schedule of match times and broadcasters only; results are not tracked." },
    showMore: { ar: "عرض المزيد", en: "Show more" },
  };

  function selectedLanguage() {
    try {
      var stored = typeof window.maenStorageGet === "function"
        ? window.maenStorageGet("siteLang")
        : window.localStorage.getItem("siteLang");
      return stored === "en" ? "en" : "ar";
    } catch (error) {
      return document.documentElement.lang === "en" ? "en" : "ar";
    }
  }

  function isEnglish() {
    return selectedLanguage() === "en";
  }

  function languageText(key) {
    var item = TEXT[key] || { ar: key, en: key };
    return isEnglish() ? item.en : item.ar;
  }

  function syncDocumentLanguage() {
    var lang = selectedLanguage();
    var direction = lang === "en" ? "ltr" : "rtl";
    var root = document.documentElement;
    if (root.lang !== lang) root.lang = lang;
    if (root.dir !== direction) root.dir = direction;
    if (document.body) {
      var wantsEnglish = lang === "en";
      if (document.body.classList.contains("lang-en") !== wantsEnglish) {
        document.body.classList.toggle("lang-en", wantsEnglish);
      }
      if (document.body.classList.contains("lang-ar") === wantsEnglish) {
        document.body.classList.toggle("lang-ar", !wantsEnglish);
      }
    }
    return lang;
  }

  function displayDirection() {
    return isEnglish() ? "ltr" : "rtl";
  }

  function cleanText(value, maxLength) {
    var text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (maxLength && text.length > maxLength) return text.slice(0, maxLength - 1).trim() + "…";
    return text;
  }

  function scheduleTodayKey() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Amman",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) {
      if (part.type !== "literal") values[part.type] = part.value;
    });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function addDateKey(dateKey, days) {
    var date = new Date(dateKey + "T12:00:00Z");
    if (!Number.isFinite(date.getTime())) return dateKey;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat(isEnglish() ? "en" : "ar", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function formatMatchDate(value) {
    var date = new Date(String(value || "") + "T12:00:00Z");
    if (!Number.isFinite(date.getTime())) return String(value || "");
    try {
      return new Intl.DateTimeFormat(isEnglish() ? "en" : "ar", {
        timeZone: "Asia/Amman",
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch (error) {
      return String(value || "");
    }
  }

  function competitionDisplayName(match) {
    var key = cleanText(match && match.competitionKey, 80);
    var item = COMPETITIONS[key];
    if (item) return isEnglish() ? item.en : item.ar;
    return cleanText(match && match.competition, 140) || (isEnglish() ? "Selected competition" : "بطولة مختارة");
  }

  function competitionOrder(match) {
    var key = cleanText(match && match.competitionKey, 80);
    return COMPETITIONS[key] ? COMPETITIONS[key].order : 99;
  }

  function broadcasterAccessText(entry) {
    if (entry && entry.accessType === "fta") return languageText("broadcastFta");
    if (entry && entry.accessType === "encrypted") return languageText("broadcastEncrypted");
    return languageText("broadcastUnknown");
  }

  function broadcasterDisplayName(entry) {
    if (!entry) return "";
    var field = isEnglish() ? "nameEn" : "nameAr";
    return cleanText(entry[field] || entry.name, 120);
  }

  function renderBroadcasterEntry(entry) {
    var listItem = document.createElement("li");
    listItem.className = "sports-match-broadcaster";
    var row = document.createElement("div");
    row.className = "sports-match-broadcaster-row";
    var name = document.createElement("strong");
    name.className = "sports-match-broadcaster-name";
    name.textContent = broadcasterDisplayName(entry);
    row.appendChild(name);
    var badge = document.createElement("span");
    badge.className = "sports-match-access sports-match-access-" + cleanText(entry && entry.accessType, 20);
    badge.textContent = broadcasterAccessText(entry);
    row.appendChild(badge);
    listItem.appendChild(row);
    return listItem;
  }

  function matchesDateWindow(match, windowName) {
    var today = scheduleTodayKey();
    var tomorrow = addDateKey(today, 1);
    var lastDate = addDateKey(today, 7);
    return windowName === "today"
      ? match.date === today
      : windowName === "tomorrow"
        ? match.date === tomorrow
        : match.date >= today && match.date <= lastDate;
  }

  function matchesSearchQuery(match) {
    var query = cleanText(state.matchesQuery, 100).toLowerCase();
    if (!query) return true;
    var broadcasterText = (Array.isArray(match.broadcasters) ? match.broadcasters : []).map(function (entry) {
      return [entry.name, entry.nameAr, entry.nameEn].join(" ");
    }).join(" ");
    return [match.homeTeam, match.awayTeam, broadcasterText].join(" ").toLowerCase().indexOf(query) !== -1;
  }

  function sortedMatches(items) {
    return items.slice().sort(function (a, b) {
      // Chronological order is authoritative: date first, then Jordan time.
      // Broadcaster availability must never move a later match ahead of an earlier one.
      var aDateTime = String(a.date || "9999-12-31") + "T" + String(a.time || "99:99");
      var bDateTime = String(b.date || "9999-12-31") + "T" + String(b.time || "99:99");
      return aDateTime.localeCompare(bDateTime)
        || String(a.homeTeam || "").localeCompare(String(b.homeTeam || ""))
        || String(a.awayTeam || "").localeCompare(String(b.awayTeam || ""));
    });
  }

  function filteredMatchesForCompetition(competitionKey, windowName) {
    return sortedMatches(state.matches.filter(function (match) {
      return String(match.competitionKey || "") === competitionKey && matchesDateWindow(match, windowName) && matchesSearchQuery(match);
    }));
  }

  function allMatchesForCompetition(competitionKey) {
    return state.matches.filter(function (match) { return String(match.competitionKey || "") === competitionKey; });
  }

  function renderMatchCard(match) {
    var card = document.createElement("article");
    card.className = "sports-match-card";
    card.setAttribute("dir", displayDirection());
    card.setAttribute("lang", isEnglish() ? "en" : "ar");

    var top = document.createElement("div");
    top.className = "sports-match-top";
    var date = document.createElement("span");
    date.className = "sports-match-date";
    date.textContent = formatMatchDate(match.date);
    top.appendChild(date);
    card.appendChild(top);

    var teams = document.createElement("div");
    teams.className = "sports-match-teams";
    var home = document.createElement("strong");
    home.textContent = cleanText(match.homeTeam, 100);
    teams.appendChild(home);
    var versus = document.createElement("span");
    versus.className = "sports-match-versus";
    versus.textContent = "vs";
    teams.appendChild(versus);
    var away = document.createElement("strong");
    away.textContent = cleanText(match.awayTeam, 100);
    teams.appendChild(away);
    card.appendChild(teams);

    var time = document.createElement("p");
    time.className = "sports-match-time";
    time.textContent = languageText("matchTime") + ": " + cleanText(match.time || "—", 20) + " · Asia/Amman";
    card.appendChild(time);

    var broadcast = document.createElement("div");
    broadcast.className = "sports-match-broadcast";
    var broadcastTitle = document.createElement("strong");
    broadcastTitle.textContent = languageText("matchBroadcast");
    broadcast.appendChild(broadcastTitle);
    if (Array.isArray(match.broadcasters) && match.broadcasters.length) {
      var list = document.createElement("ul");
      match.broadcasters.slice(0, 8).forEach(function (entry) {
        list.appendChild(renderBroadcasterEntry(entry));
      });
      broadcast.appendChild(list);
    } else {
      var noBroadcast = document.createElement("p");
      noBroadcast.className = "sports-match-no-broadcast";
      noBroadcast.textContent = languageText("matchNoBroadcast");
      broadcast.appendChild(noBroadcast);
    }
    card.appendChild(broadcast);

    return card;
  }

  function renderControls() {
    document.querySelectorAll("[data-matches-window]").forEach(function (button) {
      var active = button.getAttribute("data-matches-window") === state.matchesWindow;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var search = document.getElementById("matchesSearch");
    if (search) {
      search.placeholder = languageText("matchesSearch");
      search.setAttribute("aria-label", languageText("matchesSearch"));
    }
    var refresh = document.getElementById("matchesRefresh");
    if (refresh) refresh.setAttribute("aria-label", languageText("matchesRefresh"));
  }

  function renderCompetitionWindowButtons(card, competitionKey, selectedWindow) {
    var controls = document.createElement("div");
    controls.className = "sports-competition-windows";
    ["today", "tomorrow", "week"].forEach(function (windowName) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sports-competition-window" + (selectedWindow === windowName ? " active" : "");
      button.setAttribute("data-competition-window", windowName);
      button.setAttribute("data-competition-key", competitionKey);
      button.setAttribute("aria-pressed", selectedWindow === windowName ? "true" : "false");
      button.textContent = languageText(windowName);
      controls.appendChild(button);
    });
    card.appendChild(controls);
  }

  function renderMatches() {
    var grid = document.getElementById("sportsMatchesGrid");
    var empty = document.getElementById("sportsMatchesEmpty");
    var more = document.getElementById("sportsMatchesShowMore");
    var count = document.getElementById("sportsMatchesCount");
    var updated = document.getElementById("sportsMatchesLastUpdated");
    if (!grid || !empty || !state.loaded) return;
    var keys = Object.keys(COMPETITIONS).sort(function (a, b) { return COMPETITIONS[a].order - COMPETITIONS[b].order; }).filter(function (key) {
      return allMatchesForCompetition(key).length > 0;
    });
    if (!state.activeCompetition || keys.indexOf(state.activeCompetition) === -1) {
      state.activeCompetition = keys.indexOf("la-liga") !== -1 ? "la-liga" : (keys[0] || "");
    }
    grid.textContent = "";
    var picker = document.createElement("div");
    picker.className = "sports-competition-picker";
    picker.setAttribute("role", "tablist");
    picker.setAttribute("aria-label", isEnglish() ? "Choose a competition" : "اختر البطولة");
    keys.forEach(function (competitionKey) {
      var button = document.createElement("button");
      var selected = competitionKey === state.activeCompetition;
      button.type = "button";
      button.className = "sports-competition-tile" + (selected ? " active" : "");
      button.setAttribute("data-competition-select", competitionKey);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", selected ? "true" : "false");
      var title = document.createElement("strong");
      title.textContent = competitionDisplayName({ competitionKey: competitionKey });
      button.appendChild(title);
      var tileMeta = document.createElement("span");
      tileMeta.textContent = String(allMatchesForCompetition(competitionKey).length) + " " + languageText("matchesCount");
      button.appendChild(tileMeta);
      picker.appendChild(button);
    });
    grid.appendChild(picker);
    var selectedKey = state.activeCompetition;
    var selectedMatches = allMatchesForCompetition(selectedKey);
    var selectedWindow = state.competitionWindows[selectedKey] || "week";
    var items = filteredMatchesForCompetition(selectedKey, selectedWindow);
    var panel = document.createElement("section");
    panel.className = "sports-selected-competition";
    panel.setAttribute("data-selected-competition", selectedKey);
    panel.setAttribute("dir", displayDirection());
    var panelTitle = document.createElement("h3");
    panelTitle.className = "sports-selected-competition-title";
    panelTitle.textContent = competitionDisplayName({ competitionKey: selectedKey });
    panel.appendChild(panelTitle);
    renderCompetitionWindowButtons(panel, selectedKey, selectedWindow);
    var body = document.createElement("div");
    body.className = "sports-competition-matches";
    var visibleCount = state.competitionVisibleCounts[selectedKey] || MATCHES_VISIBLE_STEP;
    items.slice(0, visibleCount).forEach(function (match) { body.appendChild(renderMatchCard(match)); });
    if (!items.length) {
      var panelEmpty = document.createElement("p");
      panelEmpty.className = "sports-competition-empty";
      panelEmpty.textContent = languageText("matchesEmpty");
      body.appendChild(panelEmpty);
    }
    panel.appendChild(body);
    if (items.length > visibleCount) {
      var panelMore = document.createElement("button");
      panelMore.type = "button";
      panelMore.className = "sports-competition-more";
      panelMore.setAttribute("data-competition-more", selectedKey);
      panelMore.textContent = languageText("showMore");
      panel.appendChild(panelMore);
    }
    grid.appendChild(panel);
    empty.hidden = items.length > 0;
    empty.textContent = items.length ? "" : languageText("matchesEmpty");
    if (more) more.hidden = true;
    var allVisible = keys.reduce(function (sum, key) { return sum + filteredMatchesForCompetition(key, "week").length; }, 0);
    var allWithBroadcasters = state.matches.filter(function (match) { return matchesDateWindow(match, "week") && Array.isArray(match.broadcasters) && match.broadcasters.length > 0; }).length;
    if (count) count.textContent = String(allVisible) + " " + languageText("matchesCount") + " · " + String(allWithBroadcasters) + " " + languageText("matchesWithBroadcasters");
    if (updated) updated.textContent = state.matchesGeneratedAt ? formatDate(state.matchesGeneratedAt) : "—";
  }

  async function loadMatches(force) {
    if (state.loading) return;
    if (state.loaded && !force) {
      renderMatches();
      return;
    }
    state.loading = true;
    var status = document.getElementById("sportsMatchesStatus");
    if (status) {
      status.hidden = false;
      status.classList.remove("sports-status-error");
      status.textContent = languageText("matchesLoading");
    }
    try {
      var response = await fetch(MATCHES_URL, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      if (!payload || !Array.isArray(payload.items)) throw new Error("Invalid matches payload");
      state.matches = payload.items.filter(function (match) {
        return match && match.homeTeam && match.awayTeam && /^\d{4}-\d{2}-\d{2}$/.test(match.date);
      });
      state.matchesGeneratedAt = cleanText(payload.generatedAt, 60);
      state.loaded = true;
      state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
      if (status) {
        status.hidden = true;
        status.textContent = "";
      }
      renderMatches();
    } catch (error) {
      state.matches = [];
      state.matchesGeneratedAt = "";
      state.loaded = true;
      if (status) {
        status.hidden = false;
        status.classList.add("sports-status-error");
        status.textContent = languageText("matchesUnavailable");
      }
      renderMatches();
    } finally {
      state.loading = false;
    }
  }

  function setLanguageFields(force) {
    var lang = syncDocumentLanguage();
    if (!force && state.renderedLanguage === lang) return;
    state.renderedLanguage = lang;
    document.querySelectorAll("[data-sports-key]").forEach(function (element) {
      var key = element.getAttribute("data-sports-key");
      element.textContent = languageText(key);
    });
    renderControls();
    renderMatches();
  }

  function bindControls() {
    document.addEventListener("click", function (event) {
      var selectButton = event.target && event.target.closest ? event.target.closest("[data-competition-select]") : null;
      if (selectButton) {
        state.activeCompetition = selectButton.getAttribute("data-competition-select") || "";
        state.competitionVisibleCounts[state.activeCompetition] = MATCHES_VISIBLE_STEP;
        renderMatches();
        return;
      }
      var toggleButton = event.target && event.target.closest ? event.target.closest("[data-competition-toggle]") : null;
      if (toggleButton) {
        var toggleKey = toggleButton.getAttribute("data-competition-toggle") || "";
        state.openCompetitions[toggleKey] = state.openCompetitions[toggleKey] !== true;
        renderMatches();
        return;
      }
      var windowButton = event.target && event.target.closest ? event.target.closest("[data-competition-window]") : null;
      if (windowButton) {
        var competitionKey = windowButton.getAttribute("data-competition-key") || "";
        state.competitionWindows[competitionKey] = windowButton.getAttribute("data-competition-window") || "week";
        state.competitionVisibleCounts[competitionKey] = MATCHES_VISIBLE_STEP;
        renderMatches();
        return;
      }
      var moreButton = event.target && event.target.closest ? event.target.closest("[data-competition-more]") : null;
      if (moreButton) {
        var moreKey = moreButton.getAttribute("data-competition-more") || "";
        state.competitionVisibleCounts[moreKey] = (state.competitionVisibleCounts[moreKey] || MATCHES_VISIBLE_STEP) + MATCHES_VISIBLE_STEP;
        renderMatches();
      }
    });
    var search = document.getElementById("matchesSearch");
    if (search) search.addEventListener("input", function () {
      state.matchesQuery = search.value;
      state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
      renderMatches();
    });
    var refresh = document.getElementById("matchesRefresh");
    if (refresh) refresh.addEventListener("click", function () {
      loadMatches(true);
    });
    var more = document.getElementById("sportsMatchesShowMore");
    if (more) more.addEventListener("click", function () {
      state.matchesVisibleCount += MATCHES_VISIBLE_STEP;
      renderMatches();
    });
  }

  function init() {
    bindControls();
    setLanguageFields();
    window.addEventListener("hashchange", function () {
      if ((window.location.hash || "").replace(/^#/, "") === "sports") loadMatches(false);
    });
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("#langArBtn, #langEnBtn") : null;
      if (target) window.setTimeout(function () { setLanguageFields(true); }, 0);
    }, true);
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var lang = selectedLanguage();
        if (state.renderedLanguage !== lang) setLanguageFields();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
      if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    if ((window.location.hash || "").replace(/^#/, "") === "sports") loadMatches(false);
  }

  window.loadFootballMatches = loadMatches;
  window.refreshFootballMatches = function () { loadMatches(true); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
