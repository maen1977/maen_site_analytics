import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  'public/index.html',
  'public/index_phone.html'
];

const FIXES = [
  {
    title: 'Spider T777 Elite Master Plus',
    price: 20,
    encodedTitle: 'Spider%20T777%20Elite%20Master%20Plus'
  },
  {
    title: 'Spider T666 Gold+ 5G',
    price: 30,
    encodedTitle: 'Spider%20T666%20Gold%2B%205G'
  }
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findTitleIndex(html, title, from = 0) {
  return html.indexOf(title, from);
}

function findDeviceRegion(html, title) {
  const titleIndex = findTitleIndex(html, title);
  if (titleIndex === -1) return null;

  // Keep the edit local around the device card only.
  const start = Math.max(0, titleIndex - 2500);
  const end = Math.min(html.length, titleIndex + 3500);

  return { start, titleIndex, end };
}

function fixVisiblePriceNearTitle(html, title, price) {
  const region = findDeviceRegion(html, title);
  if (!region) {
    console.warn(`[price-fix] Title not found: ${title}`);
    return html;
  }

  const before = html.slice(0, region.start);
  let block = html.slice(region.start, region.end);
  const after = html.slice(region.end);

  const oldBlock = block;

  // Fix visible Arabic price inside the card.
  block = block.replace(/السعر\s*\d+\s*د\.?\s*[اأ]/, `السعر ${price} د.أ`);

  if (block === oldBlock) {
    console.warn(`[price-fix] Visible price not found near: ${title}`);
  } else {
    console.log(`[price-fix] Fixed visible price for ${title} => ${price} د.أ`);
  }

  return before + block + after;
}

function fixWhatsappText(html, title, encodedTitle, price) {
  const titleRe = escapeRegExp(title);
  const encodedTitleRe = escapeRegExp(encodedTitle);

  let next = html;

  // Plain Arabic WhatsApp text.
  next = next.replace(
    new RegExp(`(${titleRe}[^"'<>\n]*?بسعر\\s*)\\d+(\\s*دينار)`, 'g'),
    `$1${price}$2`
  );

  // URL-encoded WhatsApp text.
  next = next.replace(
    new RegExp(`(${encodedTitleRe}[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\\d+`, 'g'),
    `$1${price}`
  );

  return next;
}

function fixPage(html) {
  let next = html;

  for (const item of FIXES) {
    next = fixVisiblePriceNearTitle(next, item.title, item.price);
    next = fixWhatsappText(next, item.title, item.encodedTitle, item.price);
  }

  return next;
}

let changed = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    const after = fixPage(before);

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[price-fix] Updated ${relPath}`);
      changed += 1;
    } else {
      console.log(`[price-fix] No change needed for ${relPath}`);
    }
  } catch (error) {
    console.warn(`[price-fix] Skipped ${relPath}: ${error.message}`);
  }
}

console.log(`[price-fix] Done. Pages changed: ${changed}`);
