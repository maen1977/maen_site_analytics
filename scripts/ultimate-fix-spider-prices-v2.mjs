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

const KNOWN_TITLES = [
  'Spider T700 Elite 5G',
  'Spider V300 Pro Gold 5G',
  'Spider T777 Elite Master Plus',
  'Spider T666 Gold+ 5G',
  'Majestic M900 Plus 5G',
  'Majestic M880 Eagle',
  'Majestic M990 Black Edition 5G',
  'Gazal 66 Turbo',
  'Gazal 701 Titanium Forever',
  'Majestic M500 Gold',
  'Gazal 7100 M Royal 5G',
  'Gazal 8080 Turbo'
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function allIndexesOf(text, search) {
  const indexes = [];
  let from = 0;

  while (true) {
    const idx = text.indexOf(search, from);
    if (idx === -1) break;
    indexes.push(idx);
    from = idx + search.length;
  }

  return indexes;
}

function nextDeviceTitleIndex(html, fromIndex, sameTitle) {
  let best = -1;

  for (const title of KNOWN_TITLES) {
    const idx = html.indexOf(title, fromIndex + sameTitle.length);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
    }
  }

  return best;
}

function replaceNumberAfterLabel(block, price) {
  const labelIndex = block.indexOf('السعر');
  if (labelIndex === -1) return { block, changed: false, reason: 'price label not found' };

  const afterLabel = block.slice(labelIndex);
  const numberMatch = afterLabel.match(/\d+/);

  if (!numberMatch || numberMatch.index === undefined) {
    return { block, changed: false, reason: 'number after price label not found' };
  }

  const absoluteNumberIndex = labelIndex + numberMatch.index;
  const beforeNumber = block.slice(0, absoluteNumberIndex);
  const afterNumber = block.slice(absoluteNumberIndex + numberMatch[0].length);

  return {
    block: `${beforeNumber}${price}${afterNumber}`,
    changed: true,
    reason: 'changed'
  };
}

function fixVisiblePriceForTitle(html, item, relPath) {
  const titleIndexes = allIndexesOf(html, item.title);
  if (!titleIndexes.length) {
    console.warn(`[price-v2] ${relPath}: title not found: ${item.title}`);
    return { html, changes: 0 };
  }

  let next = html;
  let changes = 0;

  // Work backwards so indexes remain valid.
  for (const originalTitleIndex of titleIndexes.reverse()) {
    // Re-find this title from a nearby area in current text because previous replacements may alter length.
    const searchStart = Math.max(0, originalTitleIndex - 50);
    const titleIndex = next.indexOf(item.title, searchStart);
    if (titleIndex === -1) continue;

    const nextTitle = nextDeviceTitleIndex(next, titleIndex, item.title);
    const regionEnd = nextTitle !== -1
      ? Math.min(next.length, nextTitle)
      : Math.min(next.length, titleIndex + 12000);

    const regionStart = titleIndex;
    const before = next.slice(0, regionStart);
    const block = next.slice(regionStart, regionEnd);
    const after = next.slice(regionEnd);

    const result = replaceNumberAfterLabel(block, item.price);

    if (result.changed) {
      next = before + result.block + after;
      changes += 1;
      console.log(`[price-v2] ${relPath}: ${item.title} visible price => ${item.price}`);
      // Usually one real product card per page. Stop after the first successful card change.
      break;
    }
  }

  if (changes === 0) {
    console.warn(`[price-v2] ${relPath}: no visible price changed for ${item.title}`);
  }

  return { html: next, changes };
}

function fixStructuredPrices(html, item) {
  const price = String(item.price);
  const titleRe = escapeRegExp(item.title);
  const encodedTitleRe = escapeRegExp(item.encodedTitle);

  let next = html;

  // Plain WhatsApp text.
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

function reportSnippet(html, item) {
  const idx = html.indexOf(item.title);
  if (idx === -1) return 'title not found';
  return html.slice(idx, idx + 900).replace(/\s+/g, ' ').slice(0, 700);
}

let totalChangedPages = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    let after = before;
    let changes = 0;

    for (const item of FIXES) {
      const result = fixVisiblePriceForTitle(after, item, relPath);
      after = result.html;
      changes += result.changes;

      const beforeStructured = after;
      after = fixStructuredPrices(after, item);
      if (after !== beforeStructured) changes += 1;

      console.log(`[price-v2] ${relPath}: snippet for ${item.title}: ${reportSnippet(after, item)}`);
    }

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      totalChangedPages += 1;
      console.log(`[price-v2] Updated ${relPath}; changes=${changes}`);
    } else {
      console.log(`[price-v2] No changes needed for ${relPath}`);
    }
  } catch (error) {
    console.error(`[price-v2] Failed ${relPath}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`[price-v2] Done. Pages changed: ${totalChangedPages}`);
