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
    var isMobileVersion = /index_phone\.html$/i.test(window.location.pathname) || (window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
    var requested = isMobileVersion ? "maintenance" : "home";
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
          "الثمانية", "الثمانيه", "ثمانية", "ثمانيه", "محطات الثمانية", "قنوات الثمانية",
          "Thmanyah", "Thamanya", "Thamania", "Thmanyah 1", "Thmanyah 2",
          "Thmanyah 3", "Thmanyah 4"
        ]);
      }
      if (/bein|be in|بي.?ن|بين سبورت|بي.?ان|sports news/.test(normalized)) {
        aliases = aliases.concat([
          "beIN", "beIN Sports", "beIN SPORTS", "beIN Sports News", "beIN SPORTS NEWS",
          "beIN News", "beIN المفتوحة", "بي ان", "بي إن", "بي أن", "بين سبورت",
          "بي ان سبورت", "بي إن سبورت", "بي ان نيوز", "بي إن نيوز", "قناة بي ان المفتوحة",
          "القناة المفتوحة"
        ]);
      }
      return Array.from(new Set(aliases));
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

  function installProfessionalFrequencyUi() {
    if (window.__MAENSAT_PRO_FREQUENCY_UI__) return;
    var input = document.getElementById("frequencySearch");
    if (!input) {
      window.setTimeout(installProfessionalFrequencyUi, 0);
      return;
    }

    // مسح البحث يجب ألا يلغي القمر أو نوع الخدمة اللذين اختارهما المستخدم.
    var originalClear = window.clearFrequencySearch;
    if (typeof originalClear === "function") {
      window.clearFrequencySearch = function () {
        var satellite = document.getElementById("frequencySatellite");
        var service = document.getElementById("frequencyServiceFilter");
        var satelliteValue = satellite ? satellite.value : "Nilesat";
        var serviceValue = service ? service.value : "free";
        originalClear.apply(this, arguments);
        if (satellite) satellite.value = satelliteValue || "Nilesat";
        if (service) service.value = serviceValue || "free";
        if (typeof window.renderFrequencies === "function") window.renderFrequencies();
      };
    }

    function updateStatus() {
      var status = document.getElementById("frequencyLiveStatus");
      var body = document.getElementById("frequencyTableBody");
      var empty = document.getElementById("frequencyEmpty");
      if (!status || !body) return;
      var rows = body.querySelectorAll("tr").length;
      var query = safeText(input.value);
      var satellite = document.getElementById("frequencySatellite");
      var service = document.getElementById("frequencyServiceFilter");
      var satelliteLabel = satellite && satellite.options[satellite.selectedIndex] ? satellite.options[satellite.selectedIndex].text : "";
      var serviceLabel = service && service.options[service.selectedIndex] ? service.options[service.selectedIndex].text : "";
      var scope = [satelliteLabel, serviceLabel].filter(Boolean).join(" · ");
      var english = document.body && document.body.classList.contains("lang-en");
      var prefix = query ? (english ? "Search results" : "نتائج البحث") : (english ? "Available frequencies" : "الترددات المتاحة");
      var countText = english ? (rows === 1 ? " result" : " results") : (rows === 1 ? " نتيجة" : " نتائج");
      status.textContent = prefix + ": " + rows + countText + (scope ? " · " + scope : "");
      status.hidden = false;
      status.setAttribute("aria-live", "polite");
      if (empty) {
        empty.setAttribute("aria-live", "polite");
        if (!rows && query) {
          renderGlobalFrequencyFallback(empty, query, satellite, service, english);
        } else {
          empty.innerHTML = "";
          empty.textContent = english ? "No matching frequency results." : "لا توجد نتائج مطابقة للبحث الحالي.";
        }
      }
    }

    function fallbackNormalize(value) {
      return safeText(value).toLowerCase()
        .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
        .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
        .replace(/[^\u0600-\u06ffa-z0-9]+/gi, " ").replace(/\s+/g, " ").trim();
    }

    function fallbackChannels(item) {
      if (Array.isArray(item && item.channels)) return item.channels.filter(Boolean).map(safeText);
      return safeText(item && item.channel).split(/[,،|]+/).map(safeText).filter(Boolean);
    }

    function fallbackChannelEncryptionStatus(name, item) {
      var meta = item && item.channelEncryption;
      if (!meta || typeof meta !== "object") return "unknown";
      var direct = meta[name];
      if (direct == null) {
        var wanted = fallbackNormalize(name);
        Object.keys(meta).some(function (key) {
          if (fallbackNormalize(key) === wanted) { direct = meta[key]; return true; }
          return false;
        });
      }
      var value = fallbackNormalize(direct || "");
      if (value === "free" || value === "fta" || value === "clear" || value === "مفتوحه" || value === "مفتوحة" || value === "غير مشفر" || value === "غير مشفرة") return "free";
      if (value === "encrypted" || value === "scrambled" || value === "coded" || value === "مشفر" || value === "مشفرة") return "encrypted";
      return "unknown";
    }

    function fallbackChannelIsRadio(name, item) {
      var categories = item && item.channelCategories;
      if (categories && typeof categories === "object") {
        var direct = categories[name];
        if (direct == null) {
          var wanted = fallbackNormalize(name);
          Object.keys(categories).some(function (key) {
            if (fallbackNormalize(key) === wanted) { direct = categories[key]; return true; }
            return false;
          });
        }
        var values = Array.isArray(direct) ? direct : [direct];
        if (values.some(function (value) { return fallbackNormalize(value) === "radio"; })) return true;
      }
      return /(^| )(radio|راديو|اذاعة|إذاعة|fm|am radio)( |$)/i.test(fallbackNormalize(name));
    }

    function fallbackChannelsForService(item, filter) {
      var f = filter || "all";
      return fallbackChannels(item).filter(function (name) {
        if (f === "all") return true;
        if (f === "radio") return fallbackChannelIsRadio(name, item);
        var status = fallbackChannelEncryptionStatus(name, item);
        if (f === "free") return status === "free";
        if (f === "encrypted") return status === "encrypted";
        return true;
      });
    }

    function fallbackSearchText(item) {
      var channels = fallbackChannels(item);
      var text = [channels.join(" "), item && item.searchAliases, item && item.category, item && item.package].filter(Boolean).join(" ");
      var normalized = fallbackNormalize(text);
      if (/thmanyah|thamanya|thamania|الثماني/.test(normalized)) text += " الثمانية الثمانيه ثمانية ثمانيه محطات الثمانية قنوات الثمانية Thmanyah Thamanya Thamania";
      if (/bein|be in|بي.?ن|بين سبورت|بي.?ان|sports news/.test(normalized)) text += " beIN beIN Sports beIN Sports News بي ان بي إن بي أن بين سبورت بي ان سبورت بي ان نيوز بي إن نيوز بي ان المفتوحة القناة المفتوحة";
      return fallbackNormalize(text);
    }

    function fallbackMatches(item, query) {
      var q = fallbackNormalize(query);
      var compact = q.replace(/\s+/g, "");
      var stop = {"محطات":1,"محطه":1,"قنوات":1,"قناه":1,"قناة":1,"تردد":1,"ترددات":1,"على":1,"في":1,"من":1,"ال":1,"و":1,"او":1,"أو":1,"كل":1,"جميع":1,"القنوات":1};
      var tokens = q.split(" ").filter(function (token) { return token.length > 1 && !stop[token]; });
      var blob = fallbackSearchText(item);
      var blobCompact = blob.replace(/\s+/g, "");
      if (!tokens.length) return false;
      return tokens.every(function (token) {
        var tokenCompact = token.replace(/\s+/g, "");
        if (blob.includes(token) || blobCompact.includes(tokenCompact)) return true;
        // Arabic/English brand equivalence for user input such as "بي ان المفتوحة".
        if (/^(بي|بين|ان|إن|أن)$/.test(token) && /bein|بي ان|بي ان/.test(blob)) return true;
        if (/^(الثمانيه|الثمانية|ثمانيه|ثمانية)$/.test(token) && /thmanyah|thamanya|thamania/.test(blob)) return true;
        return false;
      });
    }

    function renderGlobalFrequencyFallback(empty, query, satellite, service, english) {
      var initialData = Array.isArray(window.embeddedFrequencyBackup) ? window.embeddedFrequencyBackup : [];
      var serviceFilter = service && service.value ? service.value : "all";
      var renderMatches = function (data) {
        var matches = (Array.isArray(data) ? data : []).filter(function (item) {
          return fallbackMatches(item, query) && fallbackChannelsForService(item, serviceFilter).length;
        }).slice(0, 6);
        if (!matches.length) {
          empty.textContent = english
            ? "No matching frequency results in the complete database. Try the official channel name or frequency number."
            : "لم يعثر البحث على القناة حتى في قاعدة البيانات الكاملة. جرّب الاسم الرسمي أو رقم التردد.";
          return;
        }
        var satelliteLabel = satellite && satellite.options[satellite.selectedIndex] ? satellite.options[satellite.selectedIndex].text : "";
        var serviceLabel = service && service.options[service.selectedIndex] ? service.options[service.selectedIndex].text : "";
        empty.innerHTML = "";
        var title = document.createElement("strong");
        title.textContent = english ? "Found outside the selected filters:" : "وجدت مطابقة خارج الفلاتر المختارة:";
        empty.appendChild(title);
        var note = document.createElement("div");
        note.className = "maen-frequency-fallback-note";
        note.textContent = english ? "Current scope: " + satelliteLabel + " · " + serviceLabel : "النطاق الحالي: " + satelliteLabel + " · " + serviceLabel;
        empty.appendChild(note);
        matches.forEach(function (item) {
          var row = document.createElement("div");
          row.className = "maen-frequency-fallback-row";
          var channels = fallbackChannelsForService(item, serviceFilter).slice(0, 4).join("، ");
          row.textContent = (channels || "-") + " — " + (item.satelliteGroup || item.satellite || "") + " — " + (item.frequency || "") + " " + (item.pol || "");
          empty.appendChild(row);
        });
        var button = document.createElement("button");
        button.type = "button";
        button.className = "maen-frequency-expand";
        button.textContent = english ? "Show these results by expanding filters" : "عرض هذه النتائج بتوسيع الفلاتر";
        button.addEventListener("click", function () {
          if (satellite) satellite.value = "all";
          if (service) service.value = "all";
          if (typeof window.renderFrequencies === "function") window.renderFrequencies();
        });
        empty.appendChild(button);
      };
      var initialMatches = initialData.filter(function (item) {
        return fallbackMatches(item, query) && fallbackChannelsForService(item, serviceFilter).length;
      });
      if (initialMatches.length || window.__MAENSAT_FULL_FREQUENCY_FALLBACK__) {
        renderMatches(window.__MAENSAT_FULL_FREQUENCY_FALLBACK__ || initialData);
        return;
      }
      empty.textContent = english ? "Searching the complete frequency database…" : "يجري البحث في قاعدة الترددات الكاملة…";
      if (!window.__MAENSAT_FULL_FREQUENCY_FALLBACK_PROMISE__) {
        window.__MAENSAT_FULL_FREQUENCY_FALLBACK_PROMISE__ = window.fetch("/frequencies/search-index.json", { credentials: "same-origin", cache: "force-cache" })
          .then(function (response) { return response.ok ? response.json() : null; })
          .then(function (payload) {
            var data = payload && Array.isArray(payload.items) ? payload.items.filter(function (item) { return !item.isDeprecated && !item.hideFromNamedSearch; }) : [];
            window.__MAENSAT_FULL_FREQUENCY_FALLBACK__ = data;
            return data;
          })
          .catch(function () { return []; });
      }
      window.__MAENSAT_FULL_FREQUENCY_FALLBACK_PROMISE__.then(function (data) {
        if (safeText(input.value) === safeText(query)) renderMatches(data);
      });
    }

    var observer = window.MutationObserver ? new MutationObserver(function () {
      window.setTimeout(updateStatus, 0);
    }) : null;
    var body = document.getElementById("frequencyTableBody");
    if (observer && body) observer.observe(body, { childList: true });
    ["frequencySatellite", "frequencyServiceFilter"].forEach(function (id) {
      var control = document.getElementById(id);
      if (control) control.addEventListener("change", updateStatus, { passive: true });
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && input.value) {
        event.preventDefault();
        window.clearFrequencySearch();
      }
    });
    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      if (event.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        input.focus();
      }
    });
    var originalRender = window.renderFrequencies;
    if (typeof originalRender === "function" && !originalRender.__maensatProfessionalWrapped) {
      var wrappedRender = function () {
        var result = originalRender.apply(this, arguments);
        window.setTimeout(updateStatus, 0);
        return result;
      };
      wrappedRender.__maensatProfessionalWrapped = true;
      window.renderFrequencies = wrappedRender;
    } else if (typeof originalRender !== "function") {
      window.setTimeout(installProfessionalFrequencyUi, 0);
      return;
    }
    window.setTimeout(updateStatus, 0);
    window.__MAENSAT_PRO_FREQUENCY_UI__ = true;
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
    installProfessionalFrequencyUi();
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
