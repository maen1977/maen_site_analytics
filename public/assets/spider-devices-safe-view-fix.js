/*!
 * Spider Devices Safe View Fix
 * Non-destructive: does not delete cards.
 * - Clears devices search/filter on load.
 * - Shows all existing device cards.
 * - Fixes T777/T666 prices and image paths if the cards exist.
 */
(() => {
  "use strict";

  if (window.__SPIDER_DEVICES_SAFE_VIEW_FIX__) return;
  window.__SPIDER_DEVICES_SAFE_VIEW_FIX__ = true;

  const DEVICES = [
    {
      title: "Spider T777 Elite Master Plus",
      price: "20 د.أ",
      image: "/assets/devices/spider-t777-elite-master-plus.jpg",
      message: "مرحبا، بدي أستفسر عن رسيفر Spider T777 Elite Master Plus بسعر 20 دينار"
    },
    {
      title: "Spider T666 Gold+ 5G",
      price: "30 د.أ",
      image: "/assets/devices/spider-t666-gold-plus-5g.jpg",
      message: "مرحبا، بدي أستفسر عن رسيفر Spider T666 Gold+ 5G بسعر 30 دينار"
    }
  ];

  const ALL_DEVICE_TITLES = [
    "Spider T700 Elite 5G",
    "Spider V300 Pro Gold 5G",
    "Spider T777 Elite Master Plus",
    "Spider T666 Gold+ 5G",
    "Majestic M900 Plus 5G",
    "Majestic M880 Eagle",
    "Majestic M990 Black Edition 5G",
    "Gazal 66 Turbo",
    "Gazal 701 Titanium Forever",
    "Majestic M500 Gold",
    "Gazal 7100 M Royal 5G",
    "Gazal 8080 Turbo"
  ];

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

  function txt(node) {
    return norm(node?.textContent || "");
  }

  function findDevicesRoot() {
    const direct = document.querySelector("#devices, #receivers, #devices-section, [data-section='devices']");
    if (direct) return direct;

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,[role='heading']"));
    const heading = headings.find((h) => {
      const t = txt(h);
      return t.includes("اجهزه الرسيفرات") || t.includes("اجهزة الرسيفرات") || t.includes("أجهزة الرسيفرات");
    });

    if (!heading) return document.body;

    let current = heading;
    for (let i = 0; i < 10 && current && current !== document.body; i += 1) {
      const t = txt(current);
      if (t.includes("spider t700") && t.includes("gazal 8080")) return current;
      current = current.parentElement;
    }

    return heading.closest("section, main, div") || document.body;
  }

  function cardFromTitleNode(node, root) {
    let current = node;

    for (let i = 0; i < 8 && current && current !== root && current !== document.body; i += 1) {
      const t = txt(current);
      const hasImage = Boolean(current.querySelector?.("img"));
      const hasPrice = t.includes("السعر") || /\d+\s*د\./.test(t);
      const hasOrder = t.includes("اطلب") || Boolean(current.querySelector?.("a[href*='wa.me']"));

      if (hasImage && (hasPrice || hasOrder)) return current;

      current = current.parentElement;
    }

    return node.closest?.("article, li, .card, [class*='card'], [class*='device'], [class*='product']") || node;
  }

  function findCards(root) {
    const cards = [];

    for (const title of ALL_DEVICE_TITLES) {
      const titleNorm = norm(title);
      const titleNodes = Array.from(root.querySelectorAll("*")).filter((node) => txt(node).includes(titleNorm));

      for (const node of titleNodes) {
        const card = cardFromTitleNode(node, root);
        if (card && !cards.includes(card)) cards.push(card);
      }
    }

    return cards;
  }

  function showElement(el) {
    if (!(el instanceof Element)) return;

    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute("aria-hidden");

    if (el.style) {
      el.style.display = "";
      el.style.visibility = "";
      el.style.opacity = "";
    }

    for (const cls of Array.from(el.classList || [])) {
      if (/hidden|hide|d-none|is-hidden|filtered|filter-hidden/i.test(cls)) {
        el.classList.remove(cls);
      }
    }
  }

  function clearFilters(root) {
    const inputs = Array.from(root.querySelectorAll("input[type='search'], input[type='text'], input:not([type])"));
    for (const input of inputs) {
      const label = norm(input.placeholder || input.getAttribute("aria-label") || input.name || "");
      if (label.includes("بحث") || label.includes("اكتب") || label.includes("search") || input.value) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    const buttons = Array.from(root.querySelectorAll("button, a, [role='button'], [data-filter], [data-brand], [data-category]"));
    const allButton = buttons.find((btn) => {
      const t = txt(btn);
      return t === "كل الشركات" || t.includes("كل الشركات") || t === "all" || t.includes("all");
    });

    if (allButton) {
      try {
        allButton.click();
      } catch (_) {}
    }
  }

  function findPriceNode(card) {
    const candidates = Array.from(card.querySelectorAll("*")).filter((node) => {
      const t = node.textContent || "";
      return /السعر\s*\d+\s*د\.?\s*[اأ]/.test(t) || /^السعر/.test(t.trim());
    });

    candidates.sort((a, b) => a.children.length - b.children.length);
    return candidates[0] || null;
  }

  function fixOneDevice(root, device) {
    const target = norm(device.title);
    const titleNode = Array.from(root.querySelectorAll("*")).find((node) => txt(node).includes(target));
    if (!titleNode) return false;

    const card = cardFromTitleNode(titleNode, root);
    if (!card) return false;

    showElement(card);

    const priceNode = findPriceNode(card);
    if (priceNode) priceNode.textContent = `السعر ${device.price}`;

    const img = card.querySelector("img");
    if (img) {
      img.src = device.image;
      img.alt = device.title;
      img.loading = "lazy";
      img.decoding = "async";
    }

    const url = `https://wa.me/962788272988?text=${encodeURIComponent(device.message)}`;
    for (const link of Array.from(card.querySelectorAll("a"))) {
      const href = link.getAttribute("href") || "";
      const t = txt(link);
      if (href.includes("wa.me") || t.includes("اطلب")) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        if (t.includes("اطلب")) link.textContent = "اطلب الآن";
      }
    }

    return true;
  }

  function fixDevices() {
    const root = findDevicesRoot();
    if (!root) return false;

    clearFilters(root);

    for (const card of findCards(root)) {
      showElement(card);
    }

    for (const device of DEVICES) {
      fixOneDevice(root, device);
    }

    return true;
  }

  function schedule() {
    const delays = [0, 250, 800, 1500, 3000, 6000, 10000, 15000];
    for (const delay of delays) {
      setTimeout(() => {
        try {
          fixDevices();
        } catch (error) {
          console.warn("[spider-safe-view-fix]", error);
        }
      }, delay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }

  window.fixSpiderDevicesSafe = fixDevices;
})();
