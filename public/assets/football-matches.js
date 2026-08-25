(function () {
  "use strict";

  var MATCHES_URL = "/data/football-matches.json";
  var MATCHES_VISIBLE_STEP = 20;
  var state = {
    loaded: false,
    loading: false,
    matches: [],
    matchesWindow: "today",
    matchesQuery: "",
    matchesVisibleCount: MATCHES_VISIBLE_STEP,
    matchesGeneratedAt: "",
    renderedLanguage: "",
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
    matchNoBroadcast: { ar: "لم تُحدد القناة الناقلة بعد.", en: "Broadcaster not listed yet." },
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

  function filteredMatches() {
    var today = scheduleTodayKey();
    var tomorrow = addDateKey(today, 1);
    var lastDate = addDateKey(today, 7);
    var query = cleanText(state.matchesQuery, 100).toLowerCase();
    return state.matches.filter(function (match) {
      var dateMatch = state.matchesWindow === "today"
        ? match.date === today
        : state.matchesWindow === "tomorrow"
          ? match.date === tomorrow
          : match.date >= today && match.date <= lastDate;
      if (!dateMatch) return false;
      if (!query) return true;
      var broadcasterText = (Array.isArray(match.broadcasters) ? match.broadcasters : []).map(function (entry) {
        return [entry.name, entry.nameAr, entry.nameEn].join(" ");
      }).join(" ");
      return [match.homeTeam, match.awayTeam, broadcasterText].join(" ").toLowerCase().indexOf(query) !== -1;
    }).sort(function (a, b) {
      var aHasBroadcaster = Array.isArray(a.broadcasters) && a.broadcasters.length ? 1 : 0;
      var bHasBroadcaster = Array.isArray(b.broadcasters) && b.broadcasters.length ? 1 : 0;
      if (aHasBroadcaster !== bHasBroadcaster) return bHasBroadcaster - aHasBroadcaster;
      return String(a.date + "T" + a.time).localeCompare(String(b.date + "T" + b.time)) || String(a.homeTeam).localeCompare(String(b.homeTeam));
    });
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

  function renderMatches() {
    var grid = document.getElementById("sportsMatchesGrid");
    var empty = document.getElementById("sportsMatchesEmpty");
    var more = document.getElementById("sportsMatchesShowMore");
    var count = document.getElementById("sportsMatchesCount");
    var updated = document.getElementById("sportsMatchesLastUpdated");
    if (!grid || !empty) return;
    renderControls();
    if (!state.loaded) return;
    var items = filteredMatches();
    grid.textContent = "";
    empty.hidden = items.length > 0;
    empty.textContent = items.length ? "" : languageText("matchesEmpty");
    items.slice(0, state.matchesVisibleCount).forEach(function (match) {
      grid.appendChild(renderMatchCard(match));
    });
    if (more) {
      more.hidden = items.length <= state.matchesVisibleCount;
      more.textContent = languageText("showMore");
    }
    if (count) {
      var withBroadcasters = items.filter(function (match) {
        return Array.isArray(match.broadcasters) && match.broadcasters.length > 0;
      }).length;
      count.textContent = String(items.length) + " " + languageText("matchesCount") + " · " + String(withBroadcasters) + " " + languageText("matchesWithBroadcasters");
    }
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
    document.querySelectorAll("[data-matches-window]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.matchesWindow = button.getAttribute("data-matches-window") || "today";
        state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
        renderMatches();
      });
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
