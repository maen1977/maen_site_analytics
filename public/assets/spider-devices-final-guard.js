/*!
 * Spider Devices Final Guard
 * Fixes duplicate Spider T777/T666 cards, prices, image paths, and removes broken old dynamic output.
 */
(() => {
  "use strict";

  if (window.__SPIDER_DEVICES_FINAL_GUARD__) return;
  window.__SPIDER_DEVICES_FINAL_GUARD__ = true;

  const DEVICES = [
    {
      id: "spider-t777-elite-master-plus",
      title: "Spider T777 Elite Master Plus",
      price: "20 د.أ",
      image: "/assets/devices/spider-t777-elite-master-plus.jpg",
      description: "رسيفر SPIDER اقتصادي ومميز مع خدمات IPTV متعددة، مناسب للمشاهدة اليومية والرياضية.",
      features: "IPFOX · Speed · Sport · Turbo · MyHD"
    },
    {
      id: "spider-t666-gold-plus-5g",
      title: "Spider T666 Gold+ 5G",
      price: "30 د.أ",
      image: "/assets/devices/spider-t666-gold-plus-5g.jpg",
      description: "رسيفر SPIDER 5G بخدمات IPTV متعددة وتصميم ذهبي مميز مع دعم تطبيقات المشاهدة.",
      features: "5G · IPTV · Speed · Sport · Mondial · MyHD"
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

  function text(node) {
    return norm(node?.textContent || "");
  }

  function visible(node) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function findDevicesRoot() {
    const sectionById = document.querySelector("#devices, #receivers, #devices-section, [data-section='devices']");
    if (sectionById) return sectionById;

    const headings = Array.from(document.querySelectorAll("h1,h2,h3,[role='heading']"));
    const heading = headings.find((h) => {
      const t = text(h);
      return t.includes("اجهزه الرسيفرات") || t.includes("أجهزة الرسيفرات") || t.includes("اجهزة الرسيفرات");
    });

    if (!heading) return document.body;

    let current = heading;
    for (let i = 0; i < 10 && current && current !== document.body; i += 1) {
      const t = text(current);
      if (t.includes("spider t700") && t.includes("gazal 8080")) return current;
      current = current.parentElement;
    }

    return heading.closest("section, main, div") || document.body;
  }

  function findTitleNodes(root, title) {
    const target = norm(title);
    return Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6,*"))
      .filter((node) => text(node) === target || text(node).includes(target))
      .filter(visible);
  }

  function cardFromTitleNode(node, root) {
    let current = node;
    let best = node;

    for (let i = 0; i < 10 && current && current !== root && current !== document.body; i += 1) {
      const t = text(current);
      const hasImage = Boolean(current.querySelector?.("img"));
      const hasPrice = t.includes("السعر") || /\d+\s*د\./.test(t);
      const hasOrder = t.includes("اطلب") || Boolean(current.querySelector?.("a[href*='wa.me']"));

      if (hasImage || hasPrice || hasOrder) best = current;
      if (hasImage && hasPrice && hasOrder) return current;

      current = current.parentElement;
    }

    return best;
  }

  function removeDuplicates(root, device) {
    const titleNodes = findTitleNodes(root, device.title);
    const cards = [];

    for (const node of titleNodes) {
      const card = cardFromTitleNode(node, root);
      if (card && !cards.includes(card)) cards.push(card);
    }

    if (cards.length <= 1) return cards[0] || null;

    cards.sort((a, b) => {
      const ai = a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      return ai;
    });

    const keep = cards[0];
    for (const card of cards.slice(1)) {
      card.remove();
    }

    return keep;
  }

  function findPriceNode(card) {
    const candidates = Array.from(card.querySelectorAll("*")).filter((node) => {
      const t = node.textContent || "";
      return /السعر\s*\d+\s*د\.?\s*[اأ]/.test(t) || /السعر/.test(t);
    });

    candidates.sort((a, b) => a.children.length - b.children.length);
    return candidates[0] || null;
  }

  function fixPrice(card, device) {
    if (!card) return;

    const priceNode = findPriceNode(card);
    if (priceNode) {
      priceNode.textContent = `السعر ${device.price}`;
    } else {
      const price = document.createElement("strong");
      price.textContent = `السعر ${device.price}`;
      price.style.cssText = "display:inline-flex;width:fit-content;padding:8px 12px;border-radius:999px;background:#0f172a;color:#fff;font-weight:900;margin-top:8px;";
      card.appendChild(price);
    }
  }

  function fixImage(card, device) {
    if (!card) return;

    const imgs = Array.from(card.querySelectorAll("img"));
    let img = imgs.find((candidate) => norm(candidate.alt).includes(norm(device.title))) || imgs[0];

    if (!img) {
      img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.style.cssText = "width:100%;height:auto;border-radius:16px;";
      card.prepend(img);
    }

    img.src = device.image;
    img.alt = device.title;
    img.loading = "lazy";
    img.decoding = "async";

    const link = img.closest("a");
    if (link) {
      link.href = device.image;
      link.target = "_blank";
      link.rel = "noopener";
    }
  }

  function fixWhatsapp(card, device) {
    if (!card) return;

    const message = `مرحبا، بدي أستفسر عن رسيفر ${device.title} بسعر ${device.price.replace(" د.أ", "")} دينار`;
    const url = `https://wa.me/962788272988?text=${encodeURIComponent(message)}`;

    for (const link of Array.from(card.querySelectorAll("a"))) {
      const href = link.getAttribute("href") || "";
      const t = text(link);
      if (href.includes("wa.me") || t.includes("اطلب")) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        if (t.includes("اطلب") || !link.textContent.trim()) link.textContent = "اطلب الآن";
      }
    }
  }

  function injectStyle() {
    if (document.getElementById("spider-final-guard-style")) return;

    const style = document.createElement("style");
    style.id = "spider-final-guard-style";
    style.textContent = `
      [data-spider-final-fixed="true"] {
        outline: none;
      }
      [data-spider-final-fixed="true"] img {
        max-width: 100%;
        object-fit: contain;
      }
    `;
    document.head.appendChild(style);
  }

  function fixAll() {
    const root = findDevicesRoot();
    if (!root) return false;

    injectStyle();

    let changed = false;

    for (const device of DEVICES) {
      const card = removeDuplicates(root, device);
      if (!card) continue;

      card.setAttribute("data-spider-final-fixed", "true");
      card.setAttribute("data-device-id", device.id);
      fixPrice(card, device);
      fixImage(card, device);
      fixWhatsapp(card, device);
      changed = true;
    }

    return changed;
  }

  function runForAWhile() {
    const delays = [0, 300, 900, 1800, 3500, 6000, 9000, 13000];
    for (const delay of delays) {
      window.setTimeout(() => {
        try {
          fixAll();
        } catch (error) {
          console.warn("[spider-final-guard]", error);
        }
      }, delay);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runForAWhile, { once: true });
  } else {
    runForAWhile();
  }

  window.fixSpiderDevicesNow = fixAll;
})();
