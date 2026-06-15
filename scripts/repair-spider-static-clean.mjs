import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  'public/index.html',
  'public/index_phone.html'
];

const OLD_CLIENT_SCRIPTS = [
  'spider-new-devices.js',
  'spider-devices-final-guard.js',
  'spider-devices-safe-view-fix.js'
];

const DEVICES = [
  {
    title: 'Spider T777 Elite Master Plus',
    price: 20,
    image: '/assets/devices/spider-t777-elite-master-plus.jpg',
    whatsAppName: 'Spider T777 Elite Master Plus'
  },
  {
    title: 'Spider T666 Gold+ 5G',
    price: 30,
    image: '/assets/devices/spider-t666-gold-plus-5g.jpg',
    whatsAppName: 'Spider T666 Gold+ 5G'
  }
];

const T700_TITLE = 'Spider T700 Elite 5G';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return String(value || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function removeOldClientScripts(html) {
  let next = html;

  for (const scriptName of OLD_CLIENT_SCRIPTS) {
    const escaped = escapeRegExp(scriptName);
    const re = new RegExp(`<script\\b[^>]*src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'gi');
    next = next.replace(re, '');
  }

  return next;
}

function findTitleIndex(html, title, from = 0) {
  const plain = html.indexOf(title, from);
  if (plain !== -1) return plain;

  const loose = new RegExp(escapeRegExp(title).replace(/\\ /g, '\\s+'), 'i');
  const slice = html.slice(from);
  const match = slice.match(loose);
  return match ? from + match.index : -1;
}

function findRegion(html, title, from = 0) {
  const titleIndex = findTitleIndex(html, title, from);
  if (titleIndex === -1) return null;

  const afterTitle = titleIndex + title.length;
  const candidates = [
    html.indexOf('<h3', afterTitle),
    html.indexOf('</article>', afterTitle),
    html.indexOf('</li>', afterTitle),
    html.indexOf('### ', afterTitle),
    html.indexOf('<article', afterTitle)
  ].filter((index) => index !== -1 && index > afterTitle);

  let end = candidates.length ? Math.min(...candidates) : Math.min(html.length, titleIndex + 5000);
  if (end <= titleIndex) end = Math.min(html.length, titleIndex + 5000);

  return { start: titleIndex, end };
}

function replaceFirstPriceInRegion(html, title, price) {
  const region = findRegion(html, title);
  if (!region) return html;

  const before = html.slice(0, region.start);
  let block = html.slice(region.start, region.end);
  const after = html.slice(region.end);

  block = block.replace(/السعر\s*\d+\s*د\.?\s*[اأ]/, `السعر ${price} د.أ`);
  return before + block + after;
}

function fixWhatsAppPrices(html) {
  let next = html;

  next = next
    .replace(/(Spider T777 Elite Master Plus[^"'<>\n]*?بسعر\s*)\d+(\s*دينار)/g, '$120$2')
    .replace(/(Spider T666 Gold\+ 5G[^"'<>\n]*?بسعر\s*)\d+(\s*دينار)/g, '$130$2');

  next = next
    .replace(/(Spider%20T777%20Elite%20Master%20Plus[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g, '$120')
    .replace(/(Spider%20T666%20Gold%2B%205G[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g, '$130');

  return next;
}

function getImageTagBeforeTitle(html, title, maxLookBack = 6500) {
  const titleIndex = findTitleIndex(html, title);
  if (titleIndex === -1) return null;

  const start = Math.max(0, titleIndex - maxLookBack);
  const before = html.slice(start, titleIndex);

  const imgMatches = Array.from(before.matchAll(/<img\b[^>]*>/gi));
  if (!imgMatches.length) return null;

  const match = imgMatches[imgMatches.length - 1];
  return {
    absoluteStart: start + match.index,
    absoluteEnd: start + match.index + match[0].length,
    tag: match[0]
  };
}

function getSrcFromImgTag(tag) {
  const match = String(tag || '').match(/\bsrc=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

function isBadT700Src(src) {
  const s = normalize(src);
  return (
    !s ||
    s.includes('spider-t666') ||
    s.includes('spider-t777') ||
    s.includes('t666') ||
    s.includes('t777')
  );
}

function readGitFile(commit, relPath) {
  try {
    return execFileSync('git', ['show', `${commit}:${relPath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 30 * 1024 * 1024
    });
  } catch (_) {
    return '';
  }
}

function getGitCommitsForFile(relPath) {
  try {
    const out = execFileSync('git', ['log', '--format=%H', '--', relPath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function findOriginalT700Src(relPath, currentHtml) {
  const currentTag = getImageTagBeforeTitle(currentHtml, T700_TITLE);
  const currentSrc = getSrcFromImgTag(currentTag?.tag);

  if (currentSrc && !isBadT700Src(currentSrc)) {
    return currentSrc;
  }

  const commits = getGitCommitsForFile(relPath);

  for (const commit of commits) {
    const oldHtml = readGitFile(commit, relPath);
    if (!oldHtml) continue;

    const oldTag = getImageTagBeforeTitle(oldHtml, T700_TITLE);
    const oldSrc = getSrcFromImgTag(oldTag?.tag);

    if (oldSrc && !isBadT700Src(oldSrc)) {
      console.log(`[static-clean] Found original T700 image from history for ${relPath}: ${oldSrc}`);
      return oldSrc;
    }
  }

  console.warn(`[static-clean] Could not find a clean original image for ${T700_TITLE} in ${relPath}. Leaving current T700 image as-is.`);
  return currentSrc || '';
}

function replaceImgSrcInTag(tag, src) {
  if (!tag || !src) return tag;

  if (/\bsrc=["'][^"']*["']/i.test(tag)) {
    return tag.replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`);
  }

  return tag.replace(/^<img\b/i, `<img src="${src}"`);
}

function fixImageBeforeTitle(html, title, src) {
  if (!src) return html;

  const found = getImageTagBeforeTitle(html, title);
  if (!found) return html;

  const nextTag = replaceImgSrcInTag(found.tag, src);
  if (nextTag === found.tag) return html;

  return html.slice(0, found.absoluteStart) + nextTag + html.slice(found.absoluteEnd);
}

function fixStaticDeviceImages(html) {
  let next = html;

  for (const device of DEVICES) {
    next = fixImageBeforeTitle(next, device.title, device.image);
  }

  return next;
}

function removeDuplicateOldInjectedTags(html) {
  // Only removes our old client-side helper scripts, not cards or content.
  return removeOldClientScripts(html);
}

function repairHtml(html, relPath) {
  let next = html;

  next = removeDuplicateOldInjectedTags(next);

  for (const device of DEVICES) {
    next = replaceFirstPriceInRegion(next, device.title, device.price);
  }

  next = fixWhatsAppPrices(next);
  next = fixStaticDeviceImages(next);

  const originalT700Src = findOriginalT700Src(relPath, next);
  if (originalT700Src) {
    next = fixImageBeforeTitle(next, T700_TITLE, originalT700Src);
  }

  return next;
}

let changed = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    const after = repairHtml(before, relPath);

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[static-clean] Updated ${relPath}`);
      changed += 1;
    } else {
      console.log(`[static-clean] No change needed for ${relPath}`);
    }
  } catch (error) {
    console.warn(`[static-clean] Skipped ${relPath}: ${error.message}`);
  }
}

console.log(`[static-clean] Done. Pages changed: ${changed}`);
