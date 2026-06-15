import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  'public/index.html',
  'public/index_phone.html'
];

function replaceNthInSection(html, title, newPrice) {
  const titleIndex = html.indexOf(title);
  if (titleIndex === -1) {
    console.warn(`[hard-price-fix] Title not found: ${title}`);
    return html;
  }

  // The price is after the title. Stop before the next product title/card.
  const afterTitle = titleIndex + title.length;
  const nextMarkers = [
    '\n### ',
    '<h3',
    'SPIDER متوفر',
    'Majestic متوفر',
    'Gazal متوفر'
  ];

  let end = html.length;
  for (const marker of nextMarkers) {
    const idx = html.indexOf(marker, afterTitle + 10);
    if (idx !== -1 && idx < end) end = idx;
  }

  // Keep a safe maximum range too.
  end = Math.min(end, titleIndex + 2500);

  const before = html.slice(0, titleIndex);
  let section = html.slice(titleIndex, end);
  const after = html.slice(end);

  const oldSection = section;

  section = section.replace(/السعر\s*\d+\s*د\.أ/g, `السعر ${newPrice} د.أ`);
  section = section.replace(/السعر\s*\d+\s*د\.ا/g, `السعر ${newPrice} د.أ`);

  if (section === oldSection) {
    console.warn(`[hard-price-fix] Price not found after ${title}`);
  } else {
    console.log(`[hard-price-fix] ${title} => ${newPrice} د.أ`);
  }

  return before + section + after;
}

function replaceWhatsapp(html) {
  return html
    .replace(/(Spider T777 Elite Master Plus[^"'<>\n]*?بسعر\s*)25(\s*دينار)/g, '$120$2')
    .replace(/(Spider T666 Gold\+ 5G[^"'<>\n]*?بسعر\s*)25(\s*دينار)/g, '$130$2')
    .replace(/(Spider%20T777%20Elite%20Master%20Plus[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)25/g, '$120')
    .replace(/(Spider%20T666%20Gold%2B%205G[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)25/g, '$130');
}

function verify(html, relPath) {
  const checks = [
    ['Spider T777 Elite Master Plus', 'السعر 20 د.أ'],
    ['Spider T666 Gold+ 5G', 'السعر 30 د.أ']
  ];

  for (const [title, expected] of checks) {
    const idx = html.indexOf(title);
    if (idx === -1) throw new Error(`${relPath}: missing ${title}`);

    const chunk = html.slice(idx, idx + 1600);
    if (!chunk.includes(expected)) {
      throw new Error(`${relPath}: ${title} was not changed to ${expected}`);
    }
  }
}

let changed = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    let after = before;

    after = replaceNthInSection(after, 'Spider T777 Elite Master Plus', 20);
    after = replaceNthInSection(after, 'Spider T666 Gold+ 5G', 30);
    after = replaceWhatsapp(after);

    verify(after, relPath);

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[hard-price-fix] Updated ${relPath}`);
      changed += 1;
    } else {
      console.log(`[hard-price-fix] No change needed for ${relPath}`);
    }
  } catch (error) {
    console.error(`[hard-price-fix] Failed ${relPath}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`[hard-price-fix] Done. Pages changed: ${changed}`);
