(function () {
  "use strict";

  var DATA_URLS = {
    ar: "/data/sports-news-ar.json",
    en: "/data/sports-news-en.json",
  };
  var MATCHES_URL = "/data/football-matches.json";
  var VISIBLE_STEP = 12;
  var MATCHES_VISIBLE_STEP = 20;
  var state = {
    loaded: false,
    loading: false,
    items: [],
    filter: "all",
    query: "",
    visibleCount: VISIBLE_STEP,
    generatedAt: "",
    renderedLanguage: "",
    loadedLanguage: "",
    loadingLanguage: "",
    sportsMode: "news",
    matchesLoaded: false,
    matchesLoading: false,
    matches: [],
    matchesWindow: "today",
    matchesQuery: "",
    matchesVisibleCount: MATCHES_VISIBLE_STEP,
    matchesGeneratedAt: "",
    matchesStartDate: "",
    matchesLoadedLanguage: "",
  };

  var TEXT = {
    nav: { ar: "كرة القدم", en: "Football" },
    eyebrow: { ar: "أخبار كرة القدم", en: "Football News" },
    title: { ar: "القسم الرياضي لكرة القدم", en: "Football Desk" },
    intro: { ar: "أخبار كرة القدم العالمية والأوروبية والأردنية في مكان واحد.", en: "Global, European, and Jordanian football news in one place." },
    daily: { ar: "تحديث يومي", en: "Daily update" },
    heroTitle: { ar: "آخر أخبار كرة القدم", en: "Latest football news" },
    heroIntro: { ar: "ننتقي أخبار كرة القدم من مصادر موثوقة، وتفتح كل بطاقة قارئاً داخلياً داخل الموقع.", en: "Curated football news from trusted sources; every card opens an internal reader." },
    all: { ar: "الكل", en: "All" },
    global: { ar: "عالمي", en: "Global" },
    europe: { ar: "أوروبا", en: "Europe" },
    jordan: { ar: "الأردن", en: "Jordan" },
    football: { ar: "كرة القدم", en: "Football" },
    basketball: { ar: "كرة السلة", en: "Basketball" },
    other: { ar: "رياضات أخرى", en: "Other sports" },
    search: { ar: "ابحث في أخبار كرة القدم...", en: "Search football news..." },
    refresh: { ar: "تحديث الأخبار", en: "Refresh news" },
    loading: { ar: "جاري تحميل أخبار كرة القدم...", en: "Loading football news..." },
    updated: { ar: "آخر تحديث", en: "Last updated" },
    read: { ar: "فتح الخبر داخل الموقع", en: "Open internal story" },
    showMore: { ar: "عرض المزيد", en: "Show more" },
    noResults: { ar: "لا توجد أخبار مطابقة لهذا التصنيف أو البحث.", en: "No news matches this category or search." },
    unavailable: { ar: "تعذر تحميل أخبار كرة القدم حالياً. سنحاول مجدداً لاحقاً.", en: "Football news is temporarily unavailable. We will try again later." },
    source: { ar: "المصدر", en: "Source" },
    sourceNote: { ar: "يعرض القارئ الداخلي النص المتاح من الناشر مع ذكر المصدر؛ لا ننسخ المقالات الكاملة بلا ترخيص.", en: "The internal reader shows the publisher-provided text with attribution; full articles are not mirrored without permission." },
    translationPending: { ar: "الترجمة الإنجليزية غير متاحة لهذا الخبر حالياً.", en: "The English translation is not available for this story yet." },
    articles: { ar: "خبر كرة قدم", en: "football stories" },
    articleLabel: { ar: "خبر كرة القدم", en: "Football story" },
    articleInternal: { ar: "قراءة داخل الموقع", en: "Internal reader" },
    backToSports: { ar: "رجوع إلى كرة القدم", en: "Back to football" },
    articleLoading: { ar: "جاري فتح الخبر داخل الموقع...", en: "Opening the internal story..." },
    articleMissing: { ar: "هذا الخبر غير متاح حالياً ضمن آخر تحديث.", en: "This story is not available in the latest update." },
    articleAttribution: { ar: "المصدر والحقوق محفوظة للناشر الأصلي:", en: "Source and rights remain with the original publisher:" },
    articleExcerpt: { ar: "النص المتاح داخل الموقع", en: "Text available inside this site" },
    sourceOriginal: { ar: "المصدر الأصلي", en: "Original source" },
    newsTab: { ar: "أخبار كرة القدم", en: "Football news" },
    matchesTab: { ar: "المباريات", en: "Matches" },
    today: { ar: "مباريات اليوم", en: "Today" },
    tomorrow: { ar: "مباريات غداً", en: "Tomorrow" },
    week: { ar: "هذا الأسبوع", en: "This week" },
    matchesSearch: { ar: "ابحث عن فريق أو بطولة...", en: "Search a team or competition..." },
    matchesRefresh: { ar: "تحديث المباريات", en: "Refresh matches" },
    matchesLoading: { ar: "جاري تحميل المباريات...", en: "Loading matches..." },
    matchesUnavailable: { ar: "تعذر تحميل المباريات حالياً. سنحاول مجدداً لاحقاً.", en: "Matches are temporarily unavailable. We will try again later." },
    matchesEmpty: { ar: "لا توجد مباريات متاحة لهذه الفترة أو البحث.", en: "No matches are available for this period or search." },
    matchesCount: { ar: "مباراة", en: "matches" },
    matchTime: { ar: "الوقت", en: "Time" },
    matchBroadcast: { ar: "القنوات الناقلة حسب الدليل", en: "Broadcasters with evidence" },
    matchNoBroadcast: { ar: "لم يتم التحقق من قناة ناقلة في الأردن وفلسطين ولبنان وسوريا والعراق ومصر.", en: "No broadcaster was verified in Jordan, Palestine, Lebanon, Syria, Iraq, or Egypt." },
    broadcastFta: { ar: "مجاني / FTA", en: "FTA / Free" },
    broadcastEncrypted: { ar: "مشفر / مدفوع", en: "Encrypted / subscription" },
    broadcastUnknown: { ar: "نوع البث غير مؤكد", en: "Access type unverified" },
    broadcastEvidence: { ar: "الدليل", en: "Evidence" },
    matchSource: { ar: "مصدر الموعد", en: "Fixture source" },
    matchScheduleNote: { ar: "المواعيد من جداول عامة مجانية. نعرض القناة فقط عند التحقق منها في الدول المحددة، ولا نخمن حقوق البث أو نوع الوصول.", en: "Fixtures come from free public schedules. A channel is shown only when verified in the selected countries; broadcast rights and access type are never guessed." },
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

  function languageText(key) {
    var item = TEXT[key] || { ar: key, en: key };
    return isEnglish() ? item.en : item.ar;
  }

  function localizedField(item, field, fallback) {
    return item && item[field] ? item[field] : (fallback || "");
  }

  function localizedSourceName(item) {
    return localizedField(item, "sourceName", languageText("source"));
  }

  function displayDirection() {
    return isEnglish() ? "ltr" : "rtl";
  }

  function cleanText(value, maxLength) {
    var text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    if (maxLength && text.length > maxLength) return text.slice(0, maxLength - 1).trim() + "…";
    return text;
  }

  function validUrl(value) {
    try {
      var url = new URL(String(value || ""), window.location.origin);
      return url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function categoryLabel(category) {
    return languageText(category === "jordan" ? "jordan" : category === "europe" ? "europe" : "global");
  }

  function sportLabel(sport) {
    if (sport === "basketball") return languageText("basketball");
    if (sport === "football") return languageText("football");
    return languageText("other");
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

  function scheduleTodayKey() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Amman",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== "literal") values[part.type] = part.value; });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function addDateKey(dateKey, days) {
    var date = new Date(dateKey + "T12:00:00Z");
    if (!Number.isFinite(date.getTime())) return dateKey;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
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

  function matchStatusText(status) {
    var labels = {
      scheduled: { ar: "لم تبدأ", en: "Scheduled" },
      live: { ar: "مباشرة", en: "Live" },
      completed: { ar: "انتهت", en: "Completed" },
      postponed: { ar: "مؤجلة", en: "Postponed" },
      cancelled: { ar: "ألغيت", en: "Cancelled" },
    };
    var item = labels[status] || labels.scheduled;
    return isEnglish() ? item.en : item.ar;
  }

  function matchSourceText(match) {
    var ids = Array.isArray(match.sourceIds) ? match.sourceIds : [];
    var names = ids.map(function (id) {
      if (id === "espn-public-soccer") return "ESPN";
      if (id === "thesportsdb-free") return "TheSportsDB";
      if (id === "filgoal-matches") return "FilGoal";
      return id;
    }).filter(Boolean);
    return names.join(" + ") || "—";
  }

  function filteredMatches() {
    var today = state.matchesStartDate || scheduleTodayKey();
    var tomorrow = addDateKey(today, 1);
    var query = cleanText(state.matchesQuery, 100).toLowerCase();
    return state.matches.filter(function (match) {
      var dateMatch = state.matchesWindow === "today"
        ? match.date === today
        : state.matchesWindow === "tomorrow"
          ? match.date === tomorrow
          : match.date >= today && match.date <= addDateKey(today, 7);
      if (!dateMatch) return false;
      if (!query) return true;
      var broadcasterText = (Array.isArray(match.broadcasters) ? match.broadcasters : []).map(function (entry) {
        return [entry.name, entry.nameAr, entry.nameEn, entry.sourceName, entry.country, entry.region].join(" ");
      }).join(" ");
      return [match.homeTeam, match.awayTeam, match.competition, match.country, broadcasterText].join(" ").toLowerCase().indexOf(query) !== -1;
    });
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
    var meta = document.createElement("span");
    meta.className = "sports-match-broadcaster-meta";
    meta.textContent = cleanText(entry && (entry.region || entry.country), 60);
    listItem.appendChild(meta);
    var sourceUrl = validUrl(entry && entry.sourceUrl);
    if (sourceUrl) {
      var link = document.createElement("a");
      link.className = "sports-match-broadcaster-source";
      link.href = sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = languageText("broadcastEvidence") + ": " + cleanText(entry.sourceName || "", 100);
      listItem.appendChild(link);
    }
    return listItem;
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
    var status = document.createElement("span");
    status.className = "sports-match-status sports-match-status-" + cleanText(match.status, 20);
    status.textContent = matchStatusText(match.status);
    top.appendChild(status);
    card.appendChild(top);

    var competition = document.createElement("p");
    competition.className = "sports-match-competition";
    competition.textContent = cleanText(match.competition || "Football", 140);
    card.appendChild(competition);

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

    var footer = document.createElement("div");
    footer.className = "sports-match-footer";
    footer.textContent = languageText("matchSource") + ": " + matchSourceText(match);
    card.appendChild(footer);
    return card;
  }

  function renderMatches() {
    var grid = document.getElementById("sportsMatchesGrid");
    var empty = document.getElementById("sportsMatchesEmpty");
    var more = document.getElementById("sportsMatchesShowMore");
    var count = document.getElementById("sportsMatchesCount");
    var updated = document.getElementById("sportsMatchesLastUpdated");
    if (!grid || !empty) return;
    renderMatchControls();
    if (!state.matchesLoaded) return;
    var items = filteredMatches();
    grid.textContent = "";
    empty.hidden = items.length > 0;
    empty.textContent = items.length ? "" : languageText("matchesEmpty");
    items.slice(0, state.matchesVisibleCount).forEach(function (match) { grid.appendChild(renderMatchCard(match)); });
    if (more) {
      more.hidden = items.length <= state.matchesVisibleCount;
      more.textContent = languageText("showMore");
    }
    if (count) count.textContent = String(items.length) + " " + languageText("matchesCount");
    if (updated) updated.textContent = state.matchesGeneratedAt ? formatDate(state.matchesGeneratedAt) : "—";
  }

  function renderMatchControls() {
    document.querySelectorAll("[data-sports-mode]").forEach(function (button) {
      var active = button.getAttribute("data-sports-mode") === state.sportsMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
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

  function setSportsMode(mode) {
    state.sportsMode = mode === "matches" ? "matches" : "news";
    var newsPanel = document.getElementById("sportsNewsPanel");
    var matchesPanel = document.getElementById("sportsMatchesPanel");
    if (newsPanel) newsPanel.hidden = state.sportsMode !== "news";
    if (matchesPanel) matchesPanel.hidden = state.sportsMode !== "matches";
    renderMatchControls();
    if (state.sportsMode === "matches") loadMatches(false);
  }

  async function loadMatches(force) {
    if (state.matchesLoading) return;
    if (state.matchesLoaded && !force) {
      renderMatches();
      return;
    }
    state.matchesLoading = true;
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
      state.matchesStartDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.window && payload.window.startDate) ? payload.window.startDate : scheduleTodayKey();
      state.matchesLoaded = true;
      state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
      if (status) { status.hidden = true; status.textContent = ""; }
      renderMatches();
    } catch (error) {
      state.matches = [];
      state.matchesGeneratedAt = "";
      state.matchesStartDate = "";
      state.matchesLoaded = true;
      if (status) {
        status.hidden = false;
        status.classList.add("sports-status-error");
        status.textContent = languageText("matchesUnavailable");
      }
      renderMatches();
    } finally {
      state.matchesLoading = false;
    }
  }

  function setLanguageFields(force) {
    var lang = syncDocumentLanguage();
    if (!force && state.renderedLanguage === lang && state.loadedLanguage === lang) return;
    state.renderedLanguage = lang;
    document.querySelectorAll("[data-sports-key]").forEach(function (element) {
      var key = element.getAttribute("data-sports-key");
      element.textContent = languageText(key);
    });
    var search = document.getElementById("sportsSearch");
    if (search) {
      search.placeholder = languageText("search");
      search.setAttribute("aria-label", languageText("search"));
    }
    var refresh = document.getElementById("sportsRefresh");
    if (refresh) refresh.setAttribute("aria-label", languageText("refresh"));
    if (state.loaded && state.loadedLanguage !== lang) {
      renderMatchControls();
      renderMatches();
      loadSportsFeature(true);
      return;
    }
    render();
    renderMatches();
  }

  function setStatus(message, isError) {
    var status = document.getElementById("sportsStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("sports-status-error", !!isError);
    status.hidden = !message;
  }

  function createImage(item, featured) {
    var media = document.createElement("div");
    media.className = featured ? "sports-card-media sports-card-media-featured" : "sports-card-media";
    var imageUrl = validUrl(item.image);
    if (!imageUrl) {
      media.classList.add("sports-card-media-placeholder");
      media.textContent = "SPORT";
      return media;
    }
    var image = document.createElement("img");
    image.src = imageUrl;
    image.alt = cleanText(localizedField(item, "title", languageText("football")), 160);
    image.loading = featured ? "eager" : "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", function () {
      media.classList.add("sports-card-media-placeholder");
      media.textContent = "SPORT";
      image.remove();
    }, { once: true });
    media.appendChild(image);
    return media;
  }

  function createBadge(item) {
    var badge = document.createElement("span");
    badge.className = "sports-card-badge";
    badge.textContent = categoryLabel(item.category);
    return badge;
  }

  function articleIdFromHash() {
    var match = (window.location.hash || "").match(/^#sports-news\/([a-f0-9]{8,80})$/i);
    return match ? match[1] : "";
  }

  function setArticleStatus(message, isError) {
    var status = document.getElementById("sportsArticleStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("sports-status-error", !!isError);
    status.hidden = !message;
  }

  function renderArticle(item) {
    var root = document.getElementById("sportsArticleContent");
    if (!root) return;
    root.textContent = "";
    if (!item) {
      setArticleStatus(languageText("articleMissing"), true);
      return;
    }
    setArticleStatus("", false);
    var article = document.createElement("article");
    article.className = "sports-article-card";
    article.setAttribute("dir", displayDirection());
    article.setAttribute("lang", isEnglish() ? "en" : "ar");

    var meta = document.createElement("div");
    meta.className = "sports-article-meta";
    meta.textContent = cleanText(localizedSourceName(item), 120) + " · " + formatDate(item.publishedAt);
    article.appendChild(meta);

    var title = document.createElement("h1");
    title.textContent = cleanText(localizedField(item, "title", languageText("translationPending")), 180);
    article.appendChild(title);

    var imageUrl = validUrl(item.image);
    if (imageUrl) {
      var image = document.createElement("img");
      image.className = "sports-article-image";
      image.src = imageUrl;
      image.alt = cleanText(localizedField(item, "title", languageText("football")), 160);
      image.loading = "eager";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", function () { image.remove(); }, { once: true });
      article.appendChild(image);
    }

    var label = document.createElement("h2");
    label.textContent = languageText("articleExcerpt");
    article.appendChild(label);
    var content = document.createElement("p");
    content.className = "sports-article-body";
    content.textContent = cleanText(localizedField(item, "content", localizedField(item, "summary", "")), 1800);
    article.appendChild(content);

    var attribution = document.createElement("p");
    attribution.className = "sports-article-attribution";
    attribution.textContent = languageText("articleAttribution") + " " + cleanText(localizedSourceName(item), 120);
    article.appendChild(attribution);

    var sourceLink = document.createElement("a");
    sourceLink.className = "sports-article-source-link";
    sourceLink.href = validUrl(item.url) || "#sports";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = languageText("sourceOriginal");
    sourceLink.setAttribute("aria-label", languageText("sourceOriginal") + ": " + cleanText(localizedField(item, "title", ""), 120));
    article.appendChild(sourceLink);

    var backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "sports-article-back";
    backButton.textContent = languageText("backToSports");
    backButton.setAttribute("aria-label", languageText("backToSports"));
    backButton.addEventListener("click", function () {
      if (window.history && window.history.pushState) {
        window.history.pushState({ page: "sports" }, "", "#sports");
      }
      if (typeof window.showPage === "function") window.showPage("sports", true);
      loadSportsFeature(false);
    });
    article.appendChild(backButton);
    root.appendChild(article);
  }

  function openArticle(itemId, replaceHistory) {
    if (!state.loaded) {
      setArticleStatus(languageText("articleLoading"), false);
      loadSportsFeature(false).then(function () { openArticle(itemId, replaceHistory); });
      return;
    }
    var item = state.items.find(function (entry) { return entry.id === itemId; });
    if (!replaceHistory && item && window.history && window.history.pushState) {
      window.history.pushState({ page: "sportsArticle", articleId: item.id }, "", "#sports-news/" + item.id);
    }
    if (typeof window.showPage === "function") window.showPage("sportsArticle", true);
    renderArticle(item);
  }

  function openArticleFromHash() {
    var itemId = articleIdFromHash();
    if (!itemId) return false;
    openArticle(itemId, true);
    return true;
  }

  function createCard(item, featured) {
    var article = document.createElement("article");
    article.className = featured ? "sports-card sports-card-featured" : "sports-card";
    article.setAttribute("dir", displayDirection());
    article.setAttribute("lang", isEnglish() ? "en" : "ar");
    article.appendChild(createImage(item, featured));

    var body = document.createElement("div");
    body.className = "sports-card-body";
    var meta = document.createElement("div");
    meta.className = "sports-card-meta";
    meta.appendChild(createBadge(item));
    var sport = document.createElement("span");
    sport.textContent = sportLabel(item.sport);
    meta.appendChild(sport);
    body.appendChild(meta);

    var title = document.createElement("h3");
    title.textContent = cleanText(localizedField(item, "title", languageText("translationPending")), 180);
    body.appendChild(title);
    var summary = document.createElement("p");
    summary.textContent = cleanText(localizedField(item, "summary", ""), featured ? 420 : 260);
    body.appendChild(summary);

    var footer = document.createElement("div");
    footer.className = "sports-card-footer";
    var source = document.createElement("span");
    source.textContent = cleanText(localizedSourceName(item), 120) + " · " + formatDate(item.publishedAt);
    footer.appendChild(source);
    var link = document.createElement("a");
    link.href = item.id ? "#sports-news/" + item.id : "#sports";
    link.textContent = languageText("read");
    link.setAttribute("aria-label", languageText("read") + ": " + cleanText(localizedField(item, "title", ""), 120));
    link.addEventListener("click", function (event) {
      if (!item.id) return;
      event.preventDefault();
      openArticle(item.id, false);
    });
    footer.appendChild(link);
    body.appendChild(footer);
    article.appendChild(body);
    return article;
  }

  function filteredItems() {
    var query = cleanText(state.query, 100).toLowerCase();
    return state.items.filter(function (item) {
      var categoryMatch = state.filter === "all" || item.category === state.filter;
      if (!categoryMatch) return false;
      if (!query) return true;
      var haystack = [item.title, item.summary, item.content, item.sourceName, item.sport, item.category].join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  function renderFilters() {
    document.querySelectorAll("[data-sports-filter]").forEach(function (button) {
      var active = button.getAttribute("data-sports-filter") === state.filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function render() {
    if (!state.loaded) return;
    renderFilters();
    var items = filteredItems();
    var featured = document.getElementById("sportsFeatured");
    var grid = document.getElementById("sportsGrid");
    var empty = document.getElementById("sportsEmpty");
    var more = document.getElementById("sportsShowMore");
    if (!featured || !grid || !empty) return;
    featured.textContent = "";
    grid.textContent = "";
    empty.hidden = items.length > 0;
    if (!items.length) {
      empty.textContent = languageText("noResults");
    } else {
      featured.appendChild(createCard(items[0], true));
      items.slice(1, state.visibleCount).forEach(function (item) {
        grid.appendChild(createCard(item, false));
      });
    }
    if (more) {
      more.hidden = items.length <= state.visibleCount;
      more.textContent = languageText("showMore");
    }
    var count = document.getElementById("sportsCount");
    if (count) count.textContent = String(items.length) + " " + languageText("articles");
    var updated = document.getElementById("sportsLastUpdated");
    if (updated) updated.textContent = state.generatedAt ? formatDate(state.generatedAt) : "—";
  }

  function normalizeItems(payload) {
    if (!payload || !Array.isArray(payload.items)) return [];
    return payload.items.map(function (item) {
      if (!item || !validUrl(item.url)) return null;
      var title = cleanText(item.title, 180);
      var summary = cleanText(item.summary, 360);
      if (!title || !summary) return null;
      return {
        id: cleanText(item.id, 80),
        title: title,
        summary: summary,
        content: cleanText(item.content || item.summary, 1800),
        contentType: cleanText(item.contentType, 40) || "rss-excerpt",
        url: validUrl(item.url),
        image: validUrl(item.image),
        sourceName: cleanText(item.sourceName, 100) || "Sports source",
        sourceNameEn: cleanText(item.sourceNameEn, 120) || "",
        category: ["global", "europe", "jordan"].indexOf(item.category) >= 0 ? item.category : "global",
        sport: cleanText(item.sport, 40) || "other",
        publishedAt: cleanText(item.publishedAt, 60),
        language: item.language === "en" ? "en" : "ar",
      };
    }).filter(Boolean);
  }

  async function loadSportsFeature(force) {
    var requestedLanguage = selectedLanguage();
    if (state.loading) return;
    if (state.loaded && !force && state.loadedLanguage === requestedLanguage) {
      render();
      return;
    }
    state.loading = true;
    state.loadingLanguage = requestedLanguage;
    state.loaded = false;
    setStatus(languageText("loading"), false);
    try {
      var response = await fetch(DATA_URLS[requestedLanguage] || DATA_URLS.ar, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      var items = normalizeItems(payload);
      if (items.length < 1) throw new Error("No valid items");
      state.items = items;
      state.generatedAt = cleanText(payload.generatedAt, 60);
      state.loadedLanguage = requestedLanguage;
      state.renderedLanguage = requestedLanguage;
      state.loaded = true;
      state.visibleCount = VISIBLE_STEP;
      setStatus("", false);
      render();
      var articleId = articleIdFromHash();
      if (articleId) renderArticle(items.find(function (item) { return item.id === articleId; }));
    } catch (error) {
      state.items = [];
      state.generatedAt = "";
      state.loadedLanguage = requestedLanguage;
      state.renderedLanguage = requestedLanguage;
      state.loaded = true;
      setStatus(languageText("unavailable"), true);
      render();
    } finally {
      state.loading = false;
      state.loadingLanguage = "";
      if (selectedLanguage() !== state.loadedLanguage) loadSportsFeature(true);
    }
  }

  function bindControls() {
    document.querySelectorAll("[data-sports-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.filter = button.getAttribute("data-sports-filter") || "all";
        state.visibleCount = VISIBLE_STEP;
        render();
      });
    });
    var search = document.getElementById("sportsSearch");
    if (search) search.addEventListener("input", function () {
      state.query = search.value;
      state.visibleCount = VISIBLE_STEP;
      render();
    });
    var more = document.getElementById("sportsShowMore");
    if (more) more.addEventListener("click", function () {
      state.visibleCount += VISIBLE_STEP;
      render();
    });
    var refresh = document.getElementById("sportsRefresh");
    if (refresh) refresh.addEventListener("click", function () {
      loadSportsFeature(true);
    });
    document.querySelectorAll("[data-sports-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        setSportsMode(button.getAttribute("data-sports-mode"));
      });
    });
    document.querySelectorAll("[data-matches-window]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.matchesWindow = button.getAttribute("data-matches-window") || "today";
        state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
        renderMatches();
      });
    });
    var matchesSearch = document.getElementById("matchesSearch");
    if (matchesSearch) matchesSearch.addEventListener("input", function () {
      state.matchesQuery = matchesSearch.value;
      state.matchesVisibleCount = MATCHES_VISIBLE_STEP;
      renderMatches();
    });
    var matchesRefresh = document.getElementById("matchesRefresh");
    if (matchesRefresh) matchesRefresh.addEventListener("click", function () {
      loadMatches(true);
    });
    var matchesMore = document.getElementById("sportsMatchesShowMore");
    if (matchesMore) matchesMore.addEventListener("click", function () {
      state.matchesVisibleCount += MATCHES_VISIBLE_STEP;
      renderMatches();
    });
  }

  function installLanguageBridge() {
    if (window.__sportsLanguageBridgeInstalled || typeof window.setLanguage !== "function") return;
    var originalSetLanguage = window.setLanguage;
    window.setLanguage = function (language) {
      var normalized = language === "en" ? "en" : "ar";
      try {
        if (typeof window.maenStorageSet === "function") window.maenStorageSet("siteLang", normalized);
        else window.localStorage.setItem("siteLang", normalized);
      } catch (error) {}
      var result = originalSetLanguage.apply(this, arguments);
      window.setTimeout(function () {
        setLanguageFields(true);
        var articleId = articleIdFromHash();
        if (articleId && state.loaded) renderArticle(state.items.find(function (item) { return item.id === articleId; }));
      }, 0);
      return result;
    };
    window.setLanguage.__sportsLanguageBridge = true;
    window.__sportsLanguageBridgeInstalled = true;
  }

  function init() {
    installLanguageBridge();
    bindControls();
    setLanguageFields();
    window.addEventListener("hashchange", function () {
      var hash = window.location.hash || "";
      if (hash.replace(/^#/, "") === "sports") loadSportsFeature(false);
      else if (articleIdFromHash()) openArticleFromHash();
    });
    window.addEventListener("popstate", function () {
      if (articleIdFromHash()) openArticleFromHash();
    });
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("#langArBtn, #langEnBtn") : null;
      if (target) window.setTimeout(function () {
        setLanguageFields();
        var articleId = articleIdFromHash();
        if (articleId && state.loaded) renderArticle(state.items.find(function (item) { return item.id === articleId; }));
      }, 0);
    }, true);
    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var lang = selectedLanguage();
        if (state.renderedLanguage !== lang) setLanguageFields();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
      if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    if ((window.location.hash || "").replace(/^#/, "") === "sports") loadSportsFeature(false);
    else if (articleIdFromHash()) openArticleFromHash();
  }

  window.loadSportsFeature = loadSportsFeature;
  window.loadFootballMatches = loadMatches;
  window.refreshSportsNews = function () { loadSportsFeature(true); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
