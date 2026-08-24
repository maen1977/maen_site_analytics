import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/data/sports-news.json");
const FETCH_TIMEOUT_MS = 45_000;
const NEWS_MAX_AGE_HOURS = 96;
const MAX_ITEMS = 90;
const MIN_ITEMS = 8;

const SOURCES = [
  {
    id: "bbc-sport",
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
    category: "global",
    language: "en",
  },
  {
    id: "guardian-sport",
    name: "The Guardian Sport",
    url: "https://www.theguardian.com/sport/rss",
    category: "global",
    language: "en",
  },
  {
    id: "guardian-football",
    name: "The Guardian Football",
    url: "https://www.theguardian.com/football/rss",
    category: "europe",
    language: "en",
  },
  {
    id: "jordan-news",
    name: "Jordan News",
    url: "https://www.jordannews.jo/rss",
    category: "jordan",
    language: "en",
    isJordanSports(item) {
      return /\/Section-\d+\/SPORTS\//i.test(item.url) || /sports|sport/i.test(item.categories.join(" "));
    },
  },
];

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function cleanText(value, maxLength = 500) {
  const text = decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function tagText(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function tagAttribute(block, tagName, attribute) {
  const match = block.match(new RegExp(`<${tagName}\\b([^>]*)>`, "i"));
  if (!match) return "";
  const attr = match[1].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return attr ? decodeEntities(attr[1]) : "";
}

function parseRss(xml, source) {
  const itemBlocks = xml.match(new RegExp(String.raw`<item\b[\s\S]*?<\/item>`, "gi")) || [];
  return itemBlocks.map((block) => {
    const categories = [...block.matchAll(new RegExp(String.raw`<category\b[^>]*>([\s\S]*?)<\/category>`, "gi"))]
      .map((match) => cleanText(match[1], 80))
      .filter(Boolean);
    const url = cleanText(tagText(block, "link"), 900);
    const title = cleanText(tagText(block, "title"), 220);
    const description = cleanText(tagText(block, "description"), 420);
    const publishedRaw = cleanText(tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated"), 120);
    const publishedMs = Date.parse(publishedRaw);
    const image = cleanText(
      tagAttribute(block, "media:content", "url") ||
        tagAttribute(block, "media:thumbnail", "url") ||
        tagAttribute(block, "enclosure", "url"),
      900,
    );
    return { source, url, title, description, categories, publishedRaw, publishedMs, image };
  });
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeKey(value) {
  return cleanText(value, 500).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function inferSport(item, source) {
  const text = `${item.title} ${item.categories.join(" ")}`.toLowerCase();
  if (/basketball|fiba|nba|wnba|كرة السلة/.test(text)) return "basketball";
  if (/tennis|wimbledon|atp|wta|تنس/.test(text)) return "tennis";
  if (/formula|f1|motorsport|indycar|فورمولا/.test(text)) return "motorsport";
  if (/cricket|كريكيت/.test(text)) return "cricket";
  if (/boxing|ufc|mma|ملاكمة/.test(text)) return "combat";
  if (/rugby|golf|athletics|olympic|cycling|سباق|غولف/.test(text)) return "other";
  if (/football|soccer|fifa|uefa|premier league|champions league|world cup|goalkeeper|striker|كرة القدم/.test(text)) return "football";
  return source.id === "guardian-football" ? "football" : "other";
}

function toNewsItem(raw, source) {
  const url = validHttpsUrl(raw.url);
  const title = cleanText(raw.title, 180);
  const summary = cleanText(raw.description, 360);
  const image = validHttpsUrl(raw.image);
  if (!url || !title || !summary || !Number.isFinite(raw.publishedMs) || raw.publishedMs <= 0) return null;
  if (/[<>]/.test(title) || /[<>]/.test(summary)) return null;
  const id = crypto.createHash("sha256").update(`${source.id}\n${url}\n${title}`).digest("hex").slice(0, 20);
  return {
    id,
    title,
    summary,
    url,
    image: image || null,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    sport: inferSport(raw, source),
    categories: raw.categories.slice(0, 8),
    publishedAt: new Date(raw.publishedMs).toISOString(),
    language: source.language,
  };
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { accept: "application/rss+xml, application/xml, text/xml;q=0.9, text/html;q=0.5", "user-agent": "MaenSat-Sports-Updater/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    if (!/<rss\b/i.test(body)) throw new Error("response is not RSS XML");
    const parsed = parseRss(body, source);
    const recent = parsed.filter((item) => Date.now() - item.publishedMs <= NEWS_MAX_AGE_HOURS * 60 * 60 * 1000);
    const filtered = source.isJordanSports ? recent.filter((item) => source.isJordanSports(item)) : recent;
    return { source, items: filtered.map((item) => toNewsItem(item, source)).filter(Boolean), error: null };
  } catch (error) {
    return { source, items: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function sortAndDedupe(items) {
  const seen = new Set();
  return items
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item) => {
      const key = validHttpsUrl(item.url) || normalizeKey(item.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);
}

async function atomicWrite(file, content) {
  const temporary = `${file}.tmp-${process.pid}`;
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, file);
}

const results = await Promise.all(SOURCES.map(fetchSource));
const items = sortAndDedupe(results.flatMap((result) => result.items));
const categories = new Set(items.map((item) => item.category));
const successfulSources = results.filter((result) => result.items.length > 0);
const failedSources = results.filter((result) => result.error).map((result) => ({ id: result.source.id, error: result.error }));

if (items.length < MIN_ITEMS || !categories.has("global") || !categories.has("europe") || !categories.has("jordan")) {
  const details = JSON.stringify({ itemCount: items.length, categories: [...categories], successfulSources: successfulSources.map((result) => result.source.id), failedSources }, null, 2);
  throw new Error(`Sports update guard rejected incomplete data: ${details}`);
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  freshnessWindowHours: NEWS_MAX_AGE_HOURS,
  itemCount: items.length,
  sources: results.map((result) => ({
    id: result.source.id,
    name: result.source.name,
    feedUrl: result.source.url,
    itemCount: result.items.length,
    ok: !result.error,
    error: result.error,
  })),
  items,
};

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await atomicWrite(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Sports news update wrote ${items.length} items from ${successfulSources.length}/${SOURCES.length} sources.`);
console.log(`Categories: ${[...categories].join(", ")}`);
if (failedSources.length) console.log(`Non-fatal source failures: ${JSON.stringify(failedSources)}`);
