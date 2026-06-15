/*!
 * Spider devices additions for maensat.pages.dev
 * Adds:
 * - Spider T777 Elite Master Plus — 20 د.أ
 * - Spider T666 Gold+ 5G — 30 د.أ
 *
 * It clones an existing device card to preserve the current "قسم الأجهزة" design.
 */

(() => {
  "use strict";

  if (window.__SPIDER_NEW_DEVICES_20260615__) return;
  window.__SPIDER_NEW_DEVICES_20260615__ = true;

  const WHATSAPP = "962788272988";

  const DEVICES = [
    {
      id: "spider-t777-elite-master-plus",
      brand: "SPIDER",
      title: "Spider T777 Elite Master Plus",
      description: "رسيفر SPIDER اقتصادي ومميز مع خدمات IPTV متعددة، مناسب للمشاهدة اليومية والرياضية.",
      features: "IPFOX · Speed · Sport · Turbo · MyHD",
      price: "20 د.أ",
      image: "/assets/devices/spider-t777-elite-master-plus.jpg",
      message: "مرحبا، بدي أستفسر عن رسيفر Spider T777 Elite Master Plus بسعر 20 دينار"
    },
    {
      id: "spider-t666-gold-plus-5g",
      brand: "SPIDER",
      title: "Spider T666 Gold+ 5G",
      description: "رسيفر SPIDER 5G بخدمات IPTV متعددة وتصميم ذهبي مميز مع دعم تطبيقات المشاهدة.",
      features: "5G · IPTV · Speed · Sport · Mondial · MyHD",
      price: "30 د.أ",
      image: "/assets/devices/spider-t666-gold-plus-5g.jpg",
      message: "مرحبا، بدي أستفسر عن رسيفر Spider T666 Gold+ 5G بسعر 30 دينار"
    }
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

  function textOf(node) {
    return norm(node?.textContent || "");
  }

  function findDevicesRoot() {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,[role='heading']"));
    const heading = headings.find((h) => {
      const t = textOf(h);
      return t.includes("اجهزة الرسيفرات") || t.includes("أجهزة الرسيفرات");
    });

    if (!heading) {
      return document.body;
    }

    let current = heading;
    for (let i = 0; i < 8 && current; i += 1) {
      const txt = textOf(current);
      if (
        txt.includes("spider t700") &&
        txt.includes("السعر") &&
        txt.includes("اطلب")
      ) {
        return current;
      }
      current = current.parentElement;
    }

    return heading.closest("section, main, div") || document.body;
  }

  function findExistingCard(root) {
    const knownTitles = [
      "Spider T700 Elite 5G",
      "Spider V300 Pro Gold 5G",
      "Majestic M900 Plus 5G",
      "Gazal 8080 Turbo"
    ];

    for (const title of knownTitles) {
      const titleNorm = norm(title);
      const nodes = Array.from(root.querySelectorAll("*"))
        .filter((node) => textOf(node).includes(titleNorm));

      for (const node of nodes) {
        let current = node;

        for (let i = 0; i < 8 && current && current !== document.body; i += 1) {
          const currentText = textOf(current);
          const hasImage = Boolean(current.querySelector?.("img"));
          const hasPrice = currentText.includes("السعر");
          const hasOrder = currentText.includes("اطلب") || current.querySelector?.("a[href*='wa.me']");

          if (hasImage && hasPrice && hasOrder) {
            return current;
          }

          current = current.parentElement;
        }
      }
    }

    return null;
  }

  function getCardListParent(card) {
    if (!card) return null;

    let current = card.parentElement;
    while (current && current !== document.body) {
      const children = Array.from(current.children || []);
      const cardsWithImages = children.filter((child) => child.querySelector?.("img")).length;
      const text = textOf(current);

      if (cardsWithImages >= 2 && text.includes("السعر")) {
        return current;
      }

      current = current.parentElement;
    }

    return card.parentElement;
  }

  function replaceTextNodes(root, replacements) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      let value = node.nodeValue || "";
      for (const [pattern, replacement] of replacements) {
        value = value.replace(pattern, replacement);
      }
      node.nodeValue = value;
    }
  }

  function safeRemoveDuplicateIds(card, id) {
    card.querySelectorAll("[id]").forEach((node, index) => {
      node.id = `${id}-part-${index + 1}`;
    });
  }

  function updateAttributes(card, device) {
    card.dataset.deviceId = device.id;
    card.dataset.brand = device.brand;
    card.dataset.company = device.brand;
    card.dataset.category = device.brand;
    card.dataset.search = `${device.brand} ${device.title} ${device.description} ${device.features} ${device.price}`;

    for (const el of card.querySelectorAll("*")) {
      for (const attr of Array.from(el.attributes || [])) {
        let value = attr.value || "";

        value = value
          .replace(/Spider T700 Elite 5G/g, device.title)
          .replace(/Spider V300 Pro Gold 5G/g, device.title)
          .replace(/\/assets\/[^"']*spider[^"']*\.(?:jpg|jpeg|png|webp)/gi, device.image);

        if (attr.name.startsWith("data-")) {
          if (/spider|majestic|gazal/i.test(value) && ["data-brand", "data-company", "data-category"].includes(attr.name)) {
            value = device.brand;
          }
        }

        el.setAttribute(attr.name, value);
      }
    }
  }

  function updateImage(card, device) {
    const img = card.querySelector("img");
    if (!img) return;

    img.src = device.image;
    img.alt = device.title;
    img.loading = "lazy";
    img.decoding = "async";

    const imageLink = img.closest("a");
    if (imageLink) {
      imageLink.href = device.image;
      imageLink.setAttribute("aria-label", `تكبير صورة ${device.title}`);
    }
  }

  function updateWhatsapp(card, device) {
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(device.message)}`;
    const links = Array.from(card.querySelectorAll("a"));

    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const text = textOf(link);

      if (href.includes("wa.me") || text.includes("اطلب") || text.includes("واتساب")) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        if (text.includes("اطلب") || text.includes("استفسار")) {
          link.textContent = "اطلب الآن";
        }
      }
    }
  }

  function fillFallbackText(card, device) {
    const headings = Array.from(card.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const heading = headings.find((h) => textOf(h).includes("spider") || textOf(h).includes("majestic") || textOf(h).includes("gazal"));
    if (heading) heading.textContent = device.title;

    const paragraphs = Array.from(card.querySelectorAll("p, .description, [class*='desc']"));
    const desc = paragraphs.find((p) => {
      const t = textOf(p);
      return !t.includes("السعر") && !t.includes("د.ا") && !t.includes("د.أ") && t.length > 10;
    });
    if (desc) desc.textContent = device.description;

    const priceCandidates = Array.from(card.querySelectorAll("*")).filter((node) => {
      const t = textOf(node);
      return t.includes("السعر") && (t.includes("د.ا") || t.includes("د.أ") || /\d/.test(t));
    });

    const priceNode = priceCandidates.sort((a, b) => (a.children.length - b.children.length))[0];
    if (priceNode) priceNode.textContent = `السعر ${device.price}`;
  }

  function cloneCard(template, device) {
    const card = template.cloneNode(true);

    card.classList.add("spider-new-device-card");
    card.setAttribute("data-spider-added", "true");
    card.setAttribute("data-device-id", device.id);

    safeRemoveDuplicateIds(card, device.id);

    replaceTextNodes(card, [
      [/Spider T700 Elite 5G/g, device.title],
      [/Spider V300 Pro Gold 5G/g, device.title],
      [/جهاز SPIDER مميز مع خدمات متعددة وريموت بلوتوث\.?/g, device.description],
      [/رسيفر 5G يدعم WiFi Mobile وخدمات مشاهدة متعددة\.?/g, device.description],
      [/5G · Bluetooth · IPTV/g, device.features],
      [/5G · WiFi Mobile · PRO/g, device.features],
      [/السعر\s*\d+\s*د\.?\s*أ/g, `السعر ${device.price}`],
      [/السعر\s*\d+\s*د\.?\s*ا/g, `السعر ${device.price}`]
    ]);

    updateAttributes(card, device);
    updateImage(card, device);
    updateWhatsapp(card, device);
    fillFallbackText(card, device);

    return card;
  }

  function buildFallbackCard(device) {
    const card = document.createElement("article");
    card.className = "spider-new-device-card spider-device-fallback";
    card.dataset.spiderAdded = "true";
    card.dataset.deviceId = device.id;
    card.dataset.brand = device.brand;
    card.dir = "rtl";

    card.innerHTML = `
      <a class="spider-device-image-link" href="${device.image}" target="_blank" rel="noopener" aria-label="تكبير صورة ${device.title}">
        <img src="${device.image}" alt="${device.title}" loading="lazy" decoding="async">
      </a>
      <div class="spider-device-body">
        <div class="spider-device-meta"><span>${device.brand}</span><span>متوفر</span></div>
        <h3>${device.title}</h3>
        <p>${device.description}</p>
        <div class="spider-device-features">${device.features}</div>
        <strong class="spider-device-price">السعر ${device.price}</strong>
        <a class="spider-device-order" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(device.message)}">اطلب الآن</a>
      </div>
    `;

    return card;
  }

  function ensureStyle() {
    if (document.getElementById("spider-new-devices-style")) return;

    const style = document.createElement("style");
    style.id = "spider-new-devices-style";
    style.textContent = `
      .spider-new-device-card {
        animation: spiderDeviceFadeIn .35s ease both;
      }

      .spider-new-device-card img {
        width: 100%;
        height: auto;
      }

      .spider-device-fallback {
        background: rgba(255,255,255,.96);
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 16px 40px rgba(15,23,42,.10);
      }

      .spider-device-fallback .spider-device-image-link {
        display: block;
        background: #fff;
      }

      .spider-device-fallback .spider-device-body {
        padding: 16px;
        display: grid;
        gap: 10px;
      }

      .spider-device-meta {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: #0f172a;
        font-weight: 800;
        font-size: 13px;
      }

      .spider-device-fallback h3 {
        margin: 0;
        font-size: clamp(20px, 3vw, 26px);
        color: #0f172a;
      }

      .spider-device-fallback p {
        margin: 0;
        color: #334155;
        line-height: 1.7;
      }

      .spider-device-features {
        color: #475569;
        font-weight: 700;
      }

      .spider-device-price {
        display: inline-flex;
        width: fit-content;
        padding: 8px 12px;
        border-radius: 999px;
        background: #0f172a;
        color: #fff;
      }

      .spider-device-order {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        padding: 10px 16px;
        border-radius: 999px;
        background: #22c55e;
        color: #fff;
        font-weight: 900;
        text-decoration: none;
      }

      @keyframes spiderDeviceFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;

    document.head.appendChild(style);
  }

  function alreadyExists(root, device) {
    const text = textOf(root);
    return text.includes(norm(device.title)) || Boolean(root.querySelector(`[data-device-id="${device.id}"]`));
  }

  function installDevices() {
    const root = findDevicesRoot();
    if (!root) return false;

    ensureStyle();

    const template = findExistingCard(root);
    const parent = getCardListParent(template);

    if (!template || !parent) {
      const fallbackWrap = document.createElement("div");
      fallbackWrap.className = "spider-new-devices-grid";
      fallbackWrap.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin:22px 0;";

      for (const device of DEVICES) {
        if (!alreadyExists(root, device)) fallbackWrap.appendChild(buildFallbackCard(device));
      }

      const heading = Array.from(root.querySelectorAll("h1,h2,h3")).find((h) => textOf(h).includes("اجهزة الرسيفرات") || textOf(h).includes("أجهزة الرسيفرات"));
      if (fallbackWrap.children.length) (heading?.parentElement || root).appendChild(fallbackWrap);
      return fallbackWrap.children.length > 0;
    }

    const fragment = document.createDocumentFragment();

    for (const device of DEVICES) {
      if (!alreadyExists(root, device)) {
        fragment.appendChild(cloneCard(template, device));
      }
    }

    if (fragment.childNodes.length) {
      parent.insertBefore(fragment, template);
      return true;
    }

    return false;
  }

  function scheduleInstall() {
    const delays = [250, 800, 1500, 3000, 5500, 8500];
    for (const delay of delays) {
      setTimeout(() => {
        try {
          installDevices();
        } catch (error) {
          console.warn("[spider-new-devices]", error);
        }
      }, delay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInstall, { once: true });
  } else {
    scheduleInstall();
  }

  window.installSpiderNewDevices = installDevices;
})();
