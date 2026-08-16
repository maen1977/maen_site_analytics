/* MaenSat maintainability and conversion enhancements. */
(function () {
  "use strict";

  var VALID_PAGES = [
    "home", "devices", "softwares", "maintenance", "works",
    "receiverSoftware", "frequencies", "worldcup2026", "contact"
  ];
  var eventTimers = {};

  function safeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function slugify(value) {
    return safeText(value).toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Private browsing or blocked storage should not break navigation.
    }
  }

  function hashPage() {
    var value = safeText(window.location.hash).replace(/^#/, "");
    return VALID_PAGES.indexOf(value) >= 0 ? value : "";
  }

  function currentPage() {
    var active = document.querySelector(".page.active");
    return (active && active.id) || hashPage() || "maintenance";
  }

  function setPageFallback(id) {
    var pages = document.querySelectorAll(".page");
    var target = document.getElementById(id) || document.getElementById("maintenance");
    pages.forEach(function (page) {
      page.classList.toggle("active", page === target);
    });
    if (target && target.id && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + target.id);
    }
  }

  function stabilizeInitialPage() {
    if (window.__MAENSAT_INITIAL_PAGE_STABILIZED__) return;
    window.__MAENSAT_INITIAL_PAGE_STABILIZED__ = true;
    var requested = "maintenance";
    var useExistingShowPage = typeof window.showPage === "function";
    var apply = function () {
      if (useExistingShowPage) {
        try {
          window.showPage(requested, true);
        } catch (error) {
          setPageFallback(requested);
        }
      } else {
        setPageFallback(requested);
      }
      storageSet("maen_last_page", requested);
      storageSet("maen_last_page_at", String(Date.now()));
      document.documentElement.setAttribute("data-maen-page", requested);
    };
    window.setTimeout(apply, 0);
    window.setTimeout(apply, 240);
  }

  function syncPageState() {
    var page = currentPage();
    document.documentElement.setAttribute("data-maen-page", page);
    storageSet("maen_last_page", page);
    storageSet("maen_last_page_at", String(Date.now()));
  }

  function applyProductCatalog() {
    if (window.__MAENSAT_CATALOG_LOADING__) return;
    window.__MAENSAT_CATALOG_LOADING__ = true;
    window.fetch("/data/products.json", { credentials: "same-origin", cache: "no-cache" })
      .then(function (response) { return response.ok ? response.json() : []; })
      .then(function (products) {
        var byId = {};
        (Array.isArray(products) ? products : []).forEach(function (item) {
          if (item && item.id) byId[item.id] = item;
        });
        document.querySelectorAll(".device-card, .satellite-card").forEach(function (card) {
          var titleNode = card.querySelector("h3");
          if (!titleNode) return;
          var id = slugify(titleNode.textContent);
          var item = byId[id];
          if (!item) return;
          card.setAttribute("data-product-key", item.id);
          if (item.brand) card.setAttribute("data-brand", item.brand);
          var price = card.querySelector(".price-row strong");
          if (price && item.price) price.textContent = item.price;
          var available = card.querySelector(".available");
          if (available && item.available) available.textContent = item.available;
          var description = card.querySelector(".desc");
          if (description && item.description) description.textContent = item.description;
          var features = card.querySelector(".features");
          if (features && item.features) features.textContent = item.features;
        });
        window.dispatchEvent(new CustomEvent("maensat:catalog-ready", { detail: products }));
      })
      .catch(function () {
        window.__MAENSAT_CATALOG_LOADING__ = false;
      });
  }

  function resetFrequencySearchDefaults() {
    var satellite = document.getElementById("frequencySatellite");
    var service = document.getElementById("frequencyServiceFilter");
    if (satellite) satellite.value = "Nilesat";
    if (service) service.value = "free";
  }

  function installFrequencyEntryDefaults() {
    if (window.__MAENSAT_FREQUENCY_ENTRY_DEFAULTS__) return;
    var original = window.showPage;
    if (typeof original !== "function") {
      window.setTimeout(installFrequencyEntryDefaults, 0);
      return;
    }
    window.showPage = function (id) {
      var previous = window.__MAENSAT_LAST_SHOWN_PAGE__ || "";
      var result = original.apply(this, arguments);
      window.__MAENSAT_LAST_SHOWN_PAGE__ = id;
      if (id === "frequencies" && previous !== "frequencies") {
        resetFrequencySearchDefaults();
        var input = document.getElementById("frequencySearch");
        if (input) input.value = "";
        if (typeof window.renderFrequencies === "function") {
          window.setTimeout(window.renderFrequencies, 0);
        }
      }
      return result;
    };
    window.__MAENSAT_FREQUENCY_ENTRY_DEFAULTS__ = true;
  }

  function installFrequencySearchScope() {
    if (window.__MAENSAT_FREQUENCY_SEARCH_SCOPE__) return;
    var search = document.getElementById("frequencySearch");
    if (!search) return;
    // لا نغيّر القمر أو نوع الخدمة عند الكتابة. محرك البحث الأساسي
    // يحترم الفلاتر الحالية، ويجب على المستخدم اختيار All Sat/All Services
    // يدوياً إذا أراد البحث في النطاق الكامل.
    window.__MAENSAT_FREQUENCY_SEARCH_SCOPE__ = true;
  }

  function installFrequencyAliases() {
    if (window.__MAENSAT_FREQUENCY_ALIASES__) return;
    var original = window.channelAliases;
    if (typeof original !== "function") return;
    window.channelAliases = function (name) {
      var aliases = original.apply(this, arguments) || [];
      var normalized = safeText(name).toLowerCase();
      if (/thmanyah|thamanya|thamania|الثماني/.test(normalized)) {
        aliases = aliases.concat([
          "الثمانية", "الثمانيه", "ثمانية", "ثمانيه", "قنوات الثمانية",
          "Thmanyah", "Thamanya", "Thamania", "Thmanyah 1", "Thmanyah 2",
          "Thmanyah 3", "Thmanyah 4"
        ]);
      }
      return aliases;
    };
    window.__MAENSAT_FREQUENCY_ALIASES__ = true;
  }

  function debounceFrequencySearch() {
    if (typeof window.loadFrequencyFeature !== "function" || window.__MAENSAT_FREQUENCY_DEBOUNCED__) return;
    var original = window.loadFrequencyFeature;
    window.loadFrequencyFeature = function () {
      var args = arguments;
      window.clearTimeout(window.__MAENSAT_FREQUENCY_TIMER__);
      var query = safeText((document.getElementById("frequencySearch") || {}).value);
      var delay = query.length > 0 ? 220 : 0;
      window.__MAENSAT_FREQUENCY_TIMER__ = window.setTimeout(function () {
        original.apply(window, args);
      }, delay);
    };
    window.__MAENSAT_FREQUENCY_DEBOUNCED__ = true;
  }

  function improveImages() {
    document.querySelectorAll("img").forEach(function (image, index) {
      if (!image.getAttribute("decoding")) image.setAttribute("decoding", "async");
      if (!image.getAttribute("loading") && index > 2) image.setAttribute("loading", "lazy");
      image.addEventListener("error", function () {
        image.classList.add("maen-image-error");
        image.setAttribute("aria-label", "الصورة غير متاحة حالياً");
      }, { once: true });
    });
  }

  function visitorId() {
    var value = storageGet("maen_visitor_id");
    if (value) return value;
    value = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    storageSet("maen_visitor_id", value);
    return value;
  }

  function sendEvent(eventType, data) {
    var payload = {
      eventType: eventType,
      data: data || {},
      page: window.location.pathname + window.location.search + window.location.hash,
      title: document.title,
      visitorId: visitorId(),
      sessionId: storageGet("maen_session_id") || visitorId(),
      lang: document.body && document.body.classList.contains("lang-en") ? "en" : "ar",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen: window.innerWidth + "x" + window.innerHeight
    };
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/track-event", blob)) return;
      }
      window.fetch("/api/track-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body,
        keepalive: true,
        credentials: "same-origin"
      }).catch(function () {});
    } catch (error) {}
  }

  function scheduleEvent(eventType, data, wait) {
    window.clearTimeout(eventTimers[eventType]);
    eventTimers[eventType] = window.setTimeout(function () {
      sendEvent(eventType, data);
    }, wait || 120);
  }

  function setupConversionTracking() {
    document.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("a,button") : null;
      if (!target) return;
      var href = safeText(target.getAttribute("href"));
      var card = target.closest(".device-card, .satellite-card, .software-card, .work-card");
      var product = card && card.querySelector("h3") ? safeText(card.querySelector("h3").textContent) : "";
      if (/^https:\/\/wa\.me\//i.test(href)) {
        sendEvent("whatsapp_click", { product: product, section: currentPage() });
      } else if (/^tel:/i.test(href)) {
        sendEvent("call_click", { product: product, section: currentPage() });
      } else if (/facebook\.com/i.test(href)) {
        sendEvent("facebook_click", { section: currentPage() });
      } else if (/^mailto:/i.test(href)) {
        sendEvent("email_click", { section: currentPage() });
      } else if (target.closest("#receiverSoftware") && /^https?:/i.test(href)) {
        sendEvent("software_link_click", { href: href, section: currentPage() });
      }
    }, true);

    var search = document.getElementById("frequencySearch");
    if (search) {
      search.addEventListener("input", function () {
        scheduleEvent("frequency_search", {
          query: safeText(search.value).slice(0, 80),
          satellite: safeText((document.getElementById("frequencySatellite") || {}).value)
        }, 600);
      });
    }
  }

  function init() {
    stabilizeInitialPage();
    resetFrequencySearchDefaults();
    installFrequencyEntryDefaults();
    installFrequencySearchScope();
    installFrequencyAliases();
    applyProductCatalog();
    debounceFrequencySearch();
    improveImages();
    setupConversionTracking();
    syncPageState();
    window.addEventListener("hashchange", syncPageState, { passive: true });
    window.addEventListener("load", function () {
      debounceFrequencySearch();
      syncPageState();
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
