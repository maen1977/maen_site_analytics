import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_FILES = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html')
];

const START = '<!-- SPIDER_NEW_DEVICES_STATIC_START -->';
const END = '<!-- SPIDER_NEW_DEVICES_STATIC_END -->';

const DEVICES = [
  {
    id: 'spider-t777-elite-master-plus',
    brand: 'SPIDER',
    title: 'Spider T777 Elite Master Plus',
    description: 'رسيفر SPIDER اقتصادي ومميز مع خدمات IPTV متعددة، مناسب للمشاهدة اليومية والرياضية.',
    features: 'IPFOX · Speed · Sport · Turbo · MyHD',
    price: '20 د.أ',
    image: 'assets/devices/spider-t777-elite-master-plus.jpg',
    message: 'مرحبا، بدي أستفسر عن رسيفر Spider T777 Elite Master Plus بسعر 20 دينار'
  },
  {
    id: 'spider-t666-gold-plus-5g',
    brand: 'SPIDER',
    title: 'Spider T666 Gold+ 5G',
    description: 'رسيفر SPIDER 5G بخدمات IPTV متعددة وتصميم ذهبي مميز مع دعم تطبيقات المشاهدة.',
    features: '5G · IPTV · Speed · Sport · Mondial · MyHD',
    price: '30 د.أ',
    image: 'assets/devices/spider-t666-gold-plus-5g.jpg',
    message: 'مرحبا، بدي أستفسر عن رسيفر Spider T666 Gold+ 5G بسعر 30 دينار'
  }
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingClose(html, tag, start) {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let match;

  while ((match = re.exec(html))) {
    if (match[0][1] === '/') depth -= 1;
    else depth += 1;

    if (depth === 0) return re.lastIndex;
  }

  return -1;
}

function findElementBlock(html, needle) {
  const pos = html.indexOf(needle);
  if (pos < 0) return null;

  const tags = ['article', 'li', 'div'];
  const candidates = [];

  for (const tag of tags) {
    const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    let match;

    while ((match = re.exec(html))) {
      if (match.index > pos) break;
      const end = findMatchingClose(html, tag, match.index);
      if (end > pos) {
        const block = html.slice(match.index, end);
        const lower = block.toLowerCase();
        const score =
          (lower.includes('<img') ? 50 : 0) +
          (block.includes('السعر') ? 30 : 0) +
          (lower.includes('wa.me') ? 20 : 0) +
          (tag === 'article' ? 10 : 0) -
          Math.min(15, Math.floor(block.length / 1800));
        candidates.push({ tag, start: match.index, end, block, score, length: end - match.index });
      }
    }
  }

  const useful = candidates.filter((c) => c.block.includes(needle) && c.block.toLowerCase().includes('<img'));
  if (!useful.length) return null;

  useful.sort((a, b) => b.score - a.score || a.length - b.length);
  return useful[0];
}

function removeOldDynamicScript(html) {
  return html
    .replace(/<script\b[^>]*src=["'][^"']*spider-new-devices\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '')
    .replace(/<script\b[^>]*src=["'][^"']*install-spider-devices[^"']*["'][^>]*><\/script>\s*/gi, '');
}

function removeOldStaticBlock(html) {
  const re = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\s*`, 'g');
  return html.replace(re, '');
}

function cleanClone(block, id) {
  return block
    .replace(/\sdata-spider-added=["'][^"']*["']/gi, '')
    .replace(/\sdata-device-id=["'][^"']*["']/gi, '')
    .replace(/\sid=["']([^"']+)["']/gi, (_m, oldId) => ` id="${id}-${oldId}"`);
}

function setImage(block, device) {
  let updated = block.replace(/(<img\b[^>]*\bsrc=["'])[^"']+(["'][^>]*>)/i, `$1${device.image}$2`);
  updated = updated.replace(/(<img\b[^>]*\balt=["'])[^"']*(["'])/i, `$1${device.title}$2`);

  // If there is an image zoom link around the image, update the first local image href too.
  updated = updated.replace(/(<a\b[^>]*\bhref=["'])(?!https?:|tel:|mailto:|#|javascript:)[^"']+\.(?:jpg|jpeg|png|webp)(["'][^>]*>\s*<img\b)/i, `$1${device.image}$2`);

  return updated;
}

function setWhatsapp(block, device) {
  const url = `https://wa.me/962788272988?text=${encodeURIComponent(device.message)}`;
  return block.replace(/(<a\b[^>]*\bhref=["'])https?:\/\/wa\.me\/[^"']*(["'][^>]*>)/gi, `$1${url}$2`);
}

function makeDeviceCard(template, device) {
  let card = cleanClone(template, device.id);

  const replacements = [
    [/Spider T700 Elite 5G/g, device.title],
    [/Spider V300 Pro Gold 5G/g, device.title],
    [/جهاز SPIDER مميز مع خدمات متعددة وريموت بلوتوث\.?/g, device.description],
    [/رسيفر 5G يدعم WiFi Mobile وخدمات مشاهدة متعددة\.?/g, device.description],
    [/5G · Bluetooth · IPTV/g, device.features],
    [/5G · WiFi Mobile · PRO/g, device.features],
    [/السعر\s*\d+\s*د\.?\s*أ/g, `السعر ${device.price}`],
    [/السعر\s*\d+\s*د\.?\s*ا/g, `السعر ${device.price}`],
    [/>SPIDER</g, `>${device.brand}<`]
  ];

  for (const [pattern, replacement] of replacements) {
    card = card.replace(pattern, replacement);
  }

  card = setImage(card, device);
  card = setWhatsapp(card, device);

  // Mark the card so future runs replace it instead of duplicating it.
  card = card.replace(/<([a-z0-9-]+)\b/i, `<$1 data-spider-added="true" data-device-id="${device.id}"`);

  return card;
}

function fallbackCards() {
  return DEVICES.map((device) => `
<article data-spider-added="true" data-device-id="${device.id}" class="device-card product-card" data-brand="SPIDER" data-search="${device.title} ${device.features} ${device.price}" dir="rtl">
  <a href="${device.image}" target="_blank" rel="noopener" aria-label="تكبير صورة ${device.title}">
    <img src="${device.image}" alt="${device.title}" loading="lazy" decoding="async">
  </a>
  <div class="device-body product-body">
    <div class="device-meta product-meta"><span>SPIDER</span><span>متوفر</span></div>
    <h3>${device.title}</h3>
    <p>${device.description}</p>
    <p>${device.features}</p>
    <strong>السعر ${device.price}</strong>
    <a href="https://wa.me/962788272988?text=${encodeURIComponent(device.message)}" target="_blank" rel="noopener">اطلب الآن</a>
  </div>
</article>`).join('\n');
}

function buildStaticBlock(html) {
  const template =
    findElementBlock(html, 'Spider V300 Pro Gold 5G')?.block ||
    findElementBlock(html, 'Spider T700 Elite 5G')?.block;

  const cards = template
    ? DEVICES.map((device) => makeDeviceCard(template, device)).join('\n')
    : fallbackCards();

  return `\n${START}\n${cards}\n${END}\n`;
}

function insertCards(html, staticBlock) {
  const beforeMajestic = findElementBlock(html, 'Majestic M900 Plus 5G');
  if (beforeMajestic) {
    return html.slice(0, beforeMajestic.start) + staticBlock + html.slice(beforeMajestic.start);
  }

  const afterSpider = findElementBlock(html, 'Spider V300 Pro Gold 5G') || findElementBlock(html, 'Spider T700 Elite 5G');
  if (afterSpider) {
    return html.slice(0, afterSpider.end) + staticBlock + html.slice(afterSpider.end);
  }

  const sectionTitle = html.indexOf('أجهزة الرسيفرات');
  if (sectionTitle >= 0) {
    const nextH = html.indexOf('</h', sectionTitle);
    if (nextH >= 0) {
      const endTag = html.indexOf('>', nextH);
      if (endTag >= 0) return html.slice(0, endTag + 1) + staticBlock + html.slice(endTag + 1);
    }
  }

  throw new Error('Could not find a safe insertion point for Spider devices.');
}

function patchHtml(html) {
  let next = html;
  next = removeOldDynamicScript(next);
  next = removeOldStaticBlock(next);
  const staticBlock = buildStaticBlock(next);
  next = insertCards(next, staticBlock);
  return next;
}

let changed = 0;

for (const file of TARGET_FILES) {
  try {
    const before = await fs.readFile(file, 'utf8');
    const after = patchHtml(before);

    if (after !== before) {
      await fs.writeFile(file, after, 'utf8');
      console.log(`[spider-static-install] Updated ${path.relative(ROOT, file)}`);
      changed += 1;
    } else {
      console.log(`[spider-static-install] No changes needed for ${path.relative(ROOT, file)}`);
    }
  } catch (error) {
    console.warn(`[spider-static-install] Skipped ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

console.log(`[spider-static-install] Done. Files changed: ${changed}`);
