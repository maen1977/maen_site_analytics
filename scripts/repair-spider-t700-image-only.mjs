import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  'public/index.html',
  'public/index_phone.html'
];

const T700_TITLE = 'Spider T700 Elite 5G';

const BAD_SRC_PARTS = [
  'spider-t666',
  'spider-t777',
  't666',
  't777',
  'gold-plus-5g',
  'elite-master-plus'
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBadT700Src(src = '') {
  const s = String(src || '').toLowerCase();
  if (!s) return true;
  return BAD_SRC_PARTS.some((part) => s.includes(part));
}

function getSrc(tag = '') {
  const match = String(tag).match(/\bsrc=["']([^"']+)["']/i);
  return match ? match[1] : '';
}

function setSrc(tag = '', src = '') {
  if (!tag || !src) return tag;

  if (/\bsrc=["'][^"']*["']/i.test(tag)) {
    return tag.replace(/\bsrc=["'][^"']*["']/i, `src="${src}"`);
  }

  return tag.replace(/^<img\b/i, `<img src="${src}"`);
}

function findTitleIndex(html, title) {
  return html.indexOf(title);
}

function findDeviceBlock(html, title) {
  const titleIndex = findTitleIndex(html, title);
  if (titleIndex === -1) return null;

  // Most cards have the image before the title, then card body after.
  // This is intentionally generous so it works with the existing page layout.
  const start = Math.max(0, titleIndex - 8000);

  const nextTitles = [
    '<h3',
    '### Spider V300',
    'Spider V300 Pro Gold 5G',
    'Majestic M900',
    'Gazal 66'
  ];

  let end = html.length;
  for (const marker of nextTitles) {
    const idx = html.indexOf(marker, titleIndex + title.length);
    if (idx !== -1 && idx < end) end = idx;
  }

  if (end === html.length) end = Math.min(html.length, titleIndex + 8000);

  return { start, titleIndex, end };
}

function findT700ImageTag(html) {
  const block = findDeviceBlock(html, T700_TITLE);
  if (!block) return null;

  const beforeTitle = html.slice(block.start, block.titleIndex);
  const beforeMatches = Array.from(beforeTitle.matchAll(/<img\b[^>]*>/gi));

  if (beforeMatches.length) {
    const match = beforeMatches[beforeMatches.length - 1];
    return {
      start: block.start + match.index,
      end: block.start + match.index + match[0].length,
      tag: match[0],
      src: getSrc(match[0])
    };
  }

  const afterTitle = html.slice(block.titleIndex, block.end);
  const afterMatch = afterTitle.match(/<img\b[^>]*>/i);

  if (afterMatch) {
    return {
      start: block.titleIndex + afterMatch.index,
      end: block.titleIndex + afterMatch.index + afterMatch[0].length,
      tag: afterMatch[0],
      src: getSrc(afterMatch[0])
    };
  }

  return null;
}

function gitShow(commit, relPath) {
  try {
    return execFileSync('git', ['show', `${commit}:${relPath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 60 * 1024 * 1024
    });
  } catch {
    return '';
  }
}

function gitCommits(relPath) {
  try {
    const out = execFileSync('git', ['log', '--format=%H', '--', relPath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024
    });

    return out.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function findOriginalT700Src(relPath, currentHtml) {
  const current = findT700ImageTag(currentHtml);
  if (current?.src && !isBadT700Src(current.src)) {
    console.log(`[repair-t700] ${relPath}: current T700 image already looks correct: ${current.src}`);
    return current.src;
  }

  const commits = gitCommits(relPath);
  console.log(`[repair-t700] ${relPath}: scanning ${commits.length} commits for original T700 image...`);

  for (const commit of commits) {
    const oldHtml = gitShow(commit, relPath);
    if (!oldHtml) continue;

    const oldTag = findT700ImageTag(oldHtml);
    const oldSrc = oldTag?.src || '';

    if (oldSrc && !isBadT700Src(oldSrc)) {
      console.log(`[repair-t700] ${relPath}: found original T700 image from ${commit.slice(0, 8)} => ${oldSrc}`);
      return oldSrc;
    }
  }

  console.warn(`[repair-t700] ${relPath}: could not find a clean original T700 image in history.`);
  return '';
}

function removeOldSpiderRuntimeScripts(html) {
  // Remove only old helper scripts that can override images at runtime.
  // This does not remove any product card or device data.
  const names = [
    'spider-new-devices.js',
    'spider-devices-final-guard.js',
    'spider-devices-safe-view-fix.js'
  ];

  let next = html;

  for (const name of names) {
    const escaped = escapeRegExp(name);
    const re = new RegExp(`<script\\b[^>]*src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'gi');
    next = next.replace(re, '');
  }

  return next;
}

function repairT700Image(html, relPath) {
  const correctSrc = findOriginalT700Src(relPath, html);
  if (!correctSrc) return removeOldSpiderRuntimeScripts(html);

  const currentTag = findT700ImageTag(html);
  if (!currentTag) {
    console.warn(`[repair-t700] ${relPath}: T700 image tag not found.`);
    return removeOldSpiderRuntimeScripts(html);
  }

  const fixedTag = setSrc(currentTag.tag, correctSrc);
  let next = html.slice(0, currentTag.start) + fixedTag + html.slice(currentTag.end);

  next = removeOldSpiderRuntimeScripts(next);

  console.log(`[repair-t700] ${relPath}: T700 image set to ${correctSrc}`);
  return next;
}

let changed = 0;

for (const relPath of PAGES) {
  const filePath = path.join(ROOT, relPath);

  try {
    const before = await fs.readFile(filePath, 'utf8');
    const after = repairT700Image(before, relPath);

    if (after !== before) {
      await fs.writeFile(filePath, after, 'utf8');
      console.log(`[repair-t700] Updated ${relPath}`);
      changed += 1;
    } else {
      console.log(`[repair-t700] No change needed for ${relPath}`);
    }
  } catch (error) {
    console.warn(`[repair-t700] Skipped ${relPath}: ${error.message}`);
  }
}

console.log(`[repair-t700] Done. Pages changed: ${changed}`);
