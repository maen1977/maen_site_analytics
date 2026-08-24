(function () {
  "use strict";

  var DATA_URL = "/data/sports-news.json";
  var VISIBLE_STEP = 12;
  var state = {
    loaded: false,
    loading: false,
    items: [],
    filter: "all",
    query: "",
    visibleCount: VISIBLE_STEP,
    generatedAt: "",
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
    articles: { ar: "خبر كرة قدم", en: "football stories" },
    articleLabel: { ar: "خبر كرة القدم", en: "Football story" },
    articleInternal: { ar: "قراءة داخل الموقع", en: "Internal reader" },
    backToSports: { ar: "رجوع إلى كرة القدم", en: "Back to football" },
    articleLoading: { ar: "جاري فتح الخبر داخل الموقع...", en: "Opening the internal story..." },
    articleMissing: { ar: "هذا الخبر غير متاح حالياً ضمن آخر تحديث.", en: "This story is not available in the latest update." },
    articleAttribution: { ar: "المصدر والحقوق محفوظة للناشر الأصلي:", en: "Source and rights remain with the original publisher:" },
    articleExcerpt: { ar: "النص المتاح داخل الموقع", en: "Text available inside this site" },
    sourceOriginal: { ar: "المصدر الأصلي", en: "Original source" },
  };

  function isEnglish() {
    return document.documentElement.lang === "en" || (document.body && document.body.classList.contains("lang-en"));
  }

  function languageText(key) {
    var item = TEXT[key] || { ar: key, en: key };
    return isEnglish() ? item.en : item.ar;
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

  function setLanguageFields() {
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
    render();
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
    image.alt = cleanText(item.title, 160);
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
    article.setAttribute("dir", item.language === "ar" ? "rtl" : "ltr");
    article.setAttribute("lang", item.language === "ar" ? "ar" : "en");

    var meta = document.createElement("div");
    meta.className = "sports-article-meta";
    meta.textContent = cleanText(item.sourceName, 100) + " · " + formatDate(item.publishedAt);
    article.appendChild(meta);

    var title = document.createElement("h1");
    title.textContent = cleanText(item.title, 180);
    article.appendChild(title);

    var imageUrl = validUrl(item.image);
    if (imageUrl) {
      var image = document.createElement("img");
      image.className = "sports-article-image";
      image.src = imageUrl;
      image.alt = cleanText(item.title, 160);
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
    content.textContent = cleanText(item.content || item.summary, 1800);
    article.appendChild(content);

    var attribution = document.createElement("p");
    attribution.className = "sports-article-attribution";
    attribution.textContent = languageText("articleAttribution") + " " + cleanText(item.sourceName, 100);
    article.appendChild(attribution);

    var sourceLink = document.createElement("a");
    sourceLink.className = "sports-article-source-link";
    sourceLink.href = validUrl(item.url) || "#sports";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = languageText("sourceOriginal");
    sourceLink.setAttribute("aria-label", languageText("sourceOriginal") + ": " + cleanText(item.title, 120));
    article.appendChild(sourceLink);
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
    var itemLanguage = item.language === "ar" ? "ar" : "en";
    article.setAttribute("dir", itemLanguage === "ar" ? "rtl" : "ltr");
    article.setAttribute("lang", itemLanguage);
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
    title.textContent = cleanText(item.title, 180);
    body.appendChild(title);
    var summary = document.createElement("p");
    summary.textContent = cleanText(item.summary, featured ? 420 : 260);
    body.appendChild(summary);

    var footer = document.createElement("div");
    footer.className = "sports-card-footer";
    var source = document.createElement("span");
    source.textContent = cleanText(item.sourceName, 80) + " · " + formatDate(item.publishedAt);
    footer.appendChild(source);
    var link = document.createElement("a");
    link.href = item.id ? "#sports-news/" + item.id : "#sports";
    link.textContent = languageText("read");
    link.setAttribute("aria-label", languageText("read") + ": " + cleanText(item.title, 120));
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
      var haystack = [item.title, item.summary, item.sourceName, item.sport, item.category].join(" ").toLowerCase();
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
        category: ["global", "europe", "jordan"].indexOf(item.category) >= 0 ? item.category : "global",
        sport: cleanText(item.sport, 40) || "other",
        publishedAt: cleanText(item.publishedAt, 60),
        language: item.language === "ar" ? "ar" : "en",
      };
    }).filter(Boolean);
  }

  async function loadSportsFeature(force) {
    if (state.loading || (state.loaded && !force)) {
      render();
      return;
    }
    state.loading = true;
    setStatus(languageText("loading"), false);
    try {
      var response = await fetch(DATA_URL, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var payload = await response.json();
      var items = normalizeItems(payload);
      if (items.length < 1) throw new Error("No valid items");
      state.items = items;
      state.generatedAt = cleanText(payload.generatedAt, 60);
      state.loaded = true;
      state.visibleCount = VISIBLE_STEP;
      setStatus("", false);
      render();
      var articleId = articleIdFromHash();
      if (articleId) renderArticle(items.find(function (item) { return item.id === articleId; }));
    } catch (error) {
      state.loaded = true;
      setStatus(languageText("unavailable"), true);
      render();
    } finally {
      state.loading = false;
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
  }

  function init() {
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
      var observer = new MutationObserver(function () { setLanguageFields(); });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
      if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
    if ((window.location.hash || "").replace(/^#/, "") === "sports") loadSportsFeature(false);
    else if (articleIdFromHash()) openArticleFromHash();
  }

  window.loadSportsFeature = loadSportsFeature;
  window.refreshSportsNews = function () { loadSportsFeature(true); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
