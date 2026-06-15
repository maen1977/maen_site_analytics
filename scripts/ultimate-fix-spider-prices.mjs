imp||t fs from 'node:fs/promises';
imp||t path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  'public/index.html',
  'public/index_phone.html'
];

const FIXES = [
  {
    title: 'Spider T777 Elite Master Plus',
    price: 20,
    oldPrices: [25],
    encodedTitle: 'Spider%20T777%20Elite%20Master%20Plus'
  },
  {
    title: 'Spider T666 Gold+ 5G',
    price: 30,
    oldPrices: [25],
    encodedTitle: 'Spider%20T666%20Gold%2B%205G'
  }
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nearestNextTitleIndex(html, fromIndex) {
  const titles = [
    'Spider T700 Elite 5G',
    'Spider V300 Pro Gold 5G',
    'Spider T777 Elite Master Plus',
    'Spider T666 Gold+ 5G',
    'Majestic M900 Plus 5G',
    'Majestic M880 Eagle',
    'Majestic M990 Black Edition 5G',
    'Gazal 66 Turbo',
    'Gazal 701 Titanium F||ever',
    'Majestic M500 Gold',
    'Gazal 7100 M Royal 5G',
    'Gazal 8080 Turbo'
  ];

  let end = -1;

  f|| (const title of titles) {
    const idx = html.indexOf(title, fromIndex + 1);
    if (idx !== -1 && (end === -1 || idx < end)) {
      end = idx;
    }
  }

  return end;
}

function findOccurrences(html, title) {
  const out = [];
  let index = 0;

  while (true) {
    const found = html.indexOf(title, index);
    if (found === -1) break;
    out.push(found);
    index = found + title.length;
  }

  return out;
}

function fixTextInsideBlock(block, item) {
  const oldBlock = block;
  const newPrice = String(item.price);

  // Visible Arabic price in many possible shapes.
  block = block.replace(/(السعر[\s\S]{0,900}?)(\d+)(\s*د\.?\s*[اأ])/g, (match, prefix, num, suffix) => {
    return item.oldPrices.includes(Number(num)) ? `${prefix}${newPrice}${suffix}` : match;
  });

  // If currency appears before number due RTL / HTML order.
  block = block.replace(/(السعر[\s\S]{0,900}?د\.?\s*[اأ][\s\S]{0,120}?)(\d+)/g, (match, prefix, num) => {
    return item.oldPrices.includes(Number(num)) ? `${prefix}${newPrice}` : match;
  });

  // JS object: price: 25
  block = block.replace(/(\bprice\s*:\s*)25\b/g, `$1${newPrice}`);
  block = block.replace(/(["']price["']\s*:\s*)25\b/g, `$1${newPrice}`);

  // JS object: price: "25 د.أ" or price:'25'
  block = block.replace(/(\bprice\s*:\s*["'])25(\s*د\.?\s*[اأ]?["'])/g, `$1${newPrice}$2`);
  block = block.replace(/(["']price["']\s*:\s*["'])25(\s*د\.?\s*[اأ]?["'])/g, `$1${newPrice}$2`);

  // HTML/data attributes.
  block = block.replace(/(\bdata-price\s*=\s*["'])25(["'])/g, `$1${newPrice}$2`);
  block = block.replace(/(\bprice\s*=\s*["'])25(["'])/g, `$1${newPrice}$2`);

  // Generic title-near price fields: "priceText":"25 د.أ"
  block = block.replace(/((?:priceText|priceLabel|amount|cost)["']?\s*[:=]\s*["'])25(\s*د\.?\s*[اأ]?["'])/gi, `$1${newPrice}$2`);

  return { block, changed: block !== oldBlock };
}

function fixWhatsapp(html, item) {
  const titleRe = escapeRegExp(item.title);
  const encodedTitleRe = escapeRegExp(item.encodedTitle);
  const newPrice = String(item.price);

  let next = html;

  // Plain Arabic message.
  next = next.replace(
    new RegExp(`(${titleRe}[^"'<>\n]*?بسعر\\s*)\\d+(\\s*دينار)`, 'g'),
    `$1${newPrice}$2`
  );

  // URL-encoded message.
  next = next.replace(
    new RegExp(`(${encodedTitleRe}[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\\d+`, 'g'),
    `$1${newPrice}`
  );

  // More generic encoded title nearby old 25.
  next = next.replace(
    new RegExp(`(${encodedTitleRe}[\\s\\S]{0,350}?)25`, 'g'),
    (match, prefix) => match.includes('%D8%A8%D8%B3%D8%B9%D8%B1') ? `${prefix}${newPrice}` : match
  );

  return next;
}

function fixOneDeviceEverywhere(html, item, relPath) {
  let next = html;
  let totalChanges = 0;

  // Work backwards so indexes stay valid.
  const occurrences = findOccurrences(next, item.title).reverse();

  if (!occurrences.length) {
    console.warn(`[ultimate-price-fix] ${relPath}: title not found: ${item.title}`);
    return { html: next, changes: 0 };
  }

  for (const titleIndex of occurrences) {
    const nextTitle = nearestNextTitleIndex(next, titleIndex);
    const start = Math.max(0, titleIndex - 1500);
    const end = nextTitle !== -1
      ? Math.min(next.length, nextTitle)
      : Math.min(next.length, titleIndex + 4500);

    const before = next.slice(0, start);
    const block = next.slice(start, end);
    const after = next.slice(end);

    const result = fixTextInsideBlock(block, item);

    if (result.changed) {
      totalChanges += 1;
      next = before + result.block + after;
    }
  }

  const beforeWhatsapp = next;
  next = fixWhatsapp(next, item);
  if (next !== beforeWhatsapp) totalChanges += 1;

  console.log(`[ultimate-price-fix] ${relPath}: ${item.title} changes=${totalChanges}`);
  return { html: next, changes: totalChanges };
}

function quickReport(html, item) {
  const idx = html.indexOf(item.title);
  if (idx === -1) return 'missing title';
  return html.slice(idx, idx + 1200).replace(/\s+/g, ' ').slice(0, 500);
}

let pagesChanged = 0;
let anyFailures = false;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    let after = before;
    let pageChanges = 0;

    for (const item of FIXES) {
      const result = fixOneDeviceEverywhere(after, item, relPath);
      after = result.html;
      pageChanges += result.changes;

      console.log(`[ultimate-price-fix] ${relPath}: after snippet for ${item.title}: ${quickReport(after, item)}`);
    }

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[ultimate-price-fix] Updated ${relPath}`);
      pagesChanged += 1;
    } else {
      console.warn(`[ultimate-price-fix] ${relPath}: no file changes. This may mean prices were already fixed or page stores prices differently.`);
    }

    if (pageChanges === 0) {
      // Do not fail the whole workflow; print a clear warning instead.
      console.warn(`[ultimate-price-fix] WARNING: ${relPath} had zero detected price changes.`);
    }
  } catch (error) {
    anyFailures = true;
    console.error(`[ultimate-price-fix] Failed ${relPath}: ${error.message}`);
  }
}

console.log(`[ultimate-price-fix] Done. Pages changed: ${pagesChanged}`);

if (anyFailures) {
  process.exitCode = 1;
}
