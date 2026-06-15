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

function findTitleIndex(html, title) {
  return html.indexOf(title);
}

function findRegionAroundTitle(html, title) {
  const titleIndex = findTitleIndex(html, title);

  if (titleIndex === -1) {
    throw new Error(`Title not found: ${title}`);
  }

  // Keep a wide local region around this specific device card.
  // This handles HTML where the image/card starts before the title and price is after the title.
  return {
    start: Math.max(0, titleIndex - 3000),
    titleIndex,
    end: Math.min(html.length, titleIndex + 5000)
  };
}

function replaceFirstPriceAfterTitleInRegion(section, title, price) {
  const localTitleIndex = section.indexOf(title);
  if (localTitleIndex === -1) return { section, changed: false, reason: 'title not inside section' };

  const beforeTitle = section.slice(0, localTitleIndex);
  let afterTitle = section.slice(localTitleIndex);

  // Stop at the next product title/card if possible, so we don't touch another item.
  const stopMarkers = [
    '<h3',
    '### ',
    'Spider V300',
    'Spider T777 Elite Master Plus',
    'Spider T666 Gold+ 5G',
    'Majestic ',
    'Gazal '
  ];

  let stop = afterTitle.length;
  for (const marker of stopMarkers) {
    const idx = afterTitle.indexOf(marker, title.length + 1);
    if (idx !== -1 && idx < stop) stop = idx;
  }

  let deviceChunk = afterTitle.slice(0, stop);
  const rest = afterTitle.slice(stop);

  const oldChunk = deviceChunk;

  // Case 1: visible text is plain: السعر 25 د.أ
  deviceChunk = deviceChunk.replace(
    /(السعر\s*)\d+(\s*د\.?\s*[اأ])/,
    `$1${price}$2`
  );

  // Case 2: HTML between label and number:
  // السعر</span><strong>25 د.أ</strong>
  if (deviceChunk === oldChunk) {
    deviceChunk = deviceChunk.replace(
      /(السعر[\s\S]{0,500}?)(\d+)(\s*د\.?\s*[اأ])/,
      `$1${price}$3`
    );
  }

  // Case 3: number is in its own element and currency elsewhere nearby:
  // السعر ... <span>25</span> ... د.أ
  if (deviceChunk === oldChunk) {
    deviceChunk = deviceChunk.replace(
      /(السعر[\s\S]{0,700}?)(\d+)([\s\S]{0,120}?د\.?\s*[اأ])/,
      `$1${price}$3`
    );
  }

  return {
    section: beforeTitle + deviceChunk + rest,
    changed: deviceChunk !== oldChunk,
    reason: deviceChunk !== oldChunk ? 'changed' : 'price pattern not found'
  };
}

function fixVisiblePrice(html, title, price) {
  const region = findRegionAroundTitle(html, title);
  const before = html.slice(0, region.start);
  const section = html.slice(region.start, region.end);
  const after = html.slice(region.end);

  const result = replaceFirstPriceAfterTitleInRegion(section, title, price);

  if (!result.changed) {
    throw new Error(`${title}: visible price was not found near title (${result.reason})`);
  }

  console.log(`[html-aware-price-fix] ${title} visible price => ${price} د.أ`);
  return before + result.section + after;
}

function fixWhatsapp(html, title, encodedTitle, price) {
  const titleRe = escapeRegExp(title);
  const encodedTitleRe = escapeRegExp(encodedTitle);

  let next = html;

  next = next.replace(
    new RegExp(`(${titleRe}[^"'<>\n]*?بسعر\\s*)\\d+(\\s*دينار)`, 'g'),
    `$1${price}$2`
  );

  next = next.replace(
    new RegExp(`(${encodedTitleRe}[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\\d+`, 'g'),
    `$1${price}`
  );

  return next;
}

function verify(html, title, price) {
  const region = findRegionAroundTitle(html, title);
  const section = html.slice(region.titleIndex, region.end);

  const plainGood = section.includes(`السعر ${price} د.أ`) || section.includes(`السعر ${price} د.ا`);
  const htmlGood = new RegExp(`السعر[\\s\\S]{0,700}${price}\\s*د\\.?\\s*[اأ]`).test(section);

  if (!plainGood && !htmlGood) {
    throw new Error(`${title}: verification failed; expected ${price} د.أ after title`);
  }
}

let changed = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    let after = before;

    for (const item of FIXES) {
      after = fixVisiblePrice(after, item.title, item.price);
      after = fixWhatsapp(after, item.title, item.encodedTitle, item.price);
      verify(after, item.title, item.price);
    }

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[html-aware-price-fix] Updated ${relPath}`);
      changed += 1;
    } else {
      console.log(`[html-aware-price-fix] No change needed for ${relPath}`);
    }
  } catch (error) {
    console.error(`[html-aware-price-fix] Failed ${relPath}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`[html-aware-price-fix] Done. Pages changed: ${changed}`);
