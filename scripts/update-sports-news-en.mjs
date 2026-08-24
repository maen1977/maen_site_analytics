import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/data/sports-news-en.json");
const FETCH_TIMEOUT_MS = 45_000;
const NEWS_MAX_AGE_HOURS = 96;
const MAX_ITEMS = 60;
const MIN_ITEMS = 8;
const ARTICLE_CONTENT_MAX = 1800;

const NON_FOOTBALL_KEYWORDS = /basketball|tennis|boxing|wrestling|formula\s*1|motorsport|cricket|golf|rugby|athletics|olympic|esports|e-sports|volleyball|handball|baseball|hockey/i;
const FOOTBALL_KEYWORDS = /football|soccer|fifa|uefa|premier league|champions league|world cup|europa league|conference league|la liga|serie a|bundesliga|ligue 1|league cup|fa cup|efl|goalkeeper|striker|manager|coach|player|club|match|fixture|transfer|goal|league|cup|arsenal|chelsea|liverpool|manchester|newcastle|barcelona|madrid|bayern|milan|juventus|psg|tottenham|everton|brighton|bournemouth|villa|palace|fulham|brentford|hull/i;
const EUROPE_KEYWORDS = /premier league|champions league|europa league|conference league|la liga|serie a|bundesliga|ligue 1|fa cup|efl|arsenal|chelsea|liverpool|manchester|newcastle|barcelona|madrid|bayern|milan|juventus|psg|tottenham|everton|brighton|bournemouth|villa|palace|fulham|brentford|hull/i;

const SOURCES = [
  {
    id: "bbc-english-football",
    name: "BBC Sport - Football",
    nameEn: "BBC Sport - Football",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    language: "en",
  },
  {
    id: "espn-english-soccer",
    name: "ESPN Soccer",
    nameEn: "ESPN Soccer",
    url: "https://www.espn.com/espn/rss/soccer/news",
    language: "en",
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
    const url = cleanText(tagText(block, "link") || tagText(block, "guid"), 900);
    const title = cleanText(tagText(block, "title"), 220);
    const description = cleanText(tagText(block, "description") || tagText(block, "summary"), ARTICLE_CONTENT_MAX);
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

function isFootballHeadline(value) {
  const text = String(value ?? "");
  return !NON_FOOTBALL_KEYWORDS.test(text) && FOOTBALL_KEYWORDS.test(text);
}

function categoryFor(raw) {
  return EUROPE_KEYWORDS.test(`${raw.title} ${raw.description} ${raw.url}`) ? "europe" : "global";
}

function toNewsItem(raw, source) {
  const url = validHttpsUrl(raw.url);
  const title = cleanText(raw.title, 180);
  const summary = cleanText(raw.description, 360);
  const content = cleanText(raw.description, ARTICLE_CONTENT_MAX);
  const image = validHttpsUrl(raw.image);
  const publishedMs = raw.publishedMs;
  if (!url || !title || !summary || !content || !Number.isFinite(publishedMs) || publishedMs <= 0) return null;
  if (/[<>]/.test(title) || /[<>]/.test(summary) || !isFootballHeadline(`${title} ${summary}`)) return null;
  const id = crypto.createHash("sha256").update(`${source.id}\n${url}\n${title}`).digest("hex").slice(0, 20);
  return {
    id,
    title,
    summary,
    content,
    contentType: "rss-excerpt",
    url,
    image: image || null,
    sourceId: source.id,
    sourceName: source.name,
    sourceNameEn: source.nameEn,
    category: categoryFor(raw),
    sport: "football",
    categories: raw.categories.slice(0, 8),
    publishedAt: new Date(publishedMs).toISOString(),
    language: "en",
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml;q=0.9",
        "user-agent": "MaenSat-English-Football-Updater/1.0",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(source) {
  try {
    const body = await fetchText(source.url);
    if (!/<(?:rss|feed)\b/i.test(body)) throw new Error("response is not RSS XML");
    const parsed = parseRss(body, source);
    const recent = parsed.filter((item) => Number.isFinite(item.publishedMs) && Date.now() - item.publishedMs <= NEWS_MAX_AGE_HOURS * 60 * 60 * 1000);
    const items = recent.map((item) => toNewsItem(item, source)).filter(Boolean);
    return { source, items, error: null };
  } catch (error) {
    return { source, items: [], error: error instanceof Error ? error.message : String(error) };
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
const allEnglish = items.length > 0 && items.every((item) => item.language === "en" && /[A-Za-z]/.test(`${item.title} ${item.summary}`));
const allFootball = items.length > 0 && items.every((item) => item.sport === "football");

if (items.length < MIN_ITEMS || successfulSources.length < 1 || !categories.has("global") || !categories.has("europe") || !allEnglish || !allFootball) {
  const details = JSON.stringify({
    itemCount: items.length,
    categories: [...categories],
    allEnglish,
    allFootball,
    successfulSources: successfulSources.map((result) => result.source.id),
    failedSources,
  }, null, 2);
  throw new Error(`English football update guard rejected incomplete data: ${details}`);
}

const payload = {
  schemaVersion: 1,
  language: "en",
  generatedAt: new Date().toISOString(),
  freshnessWindowHours: NEWS_MAX_AGE_HOURS,
  itemCount: items.length,
  sources: results.map((result) => ({
    id: result.source.id,
    name: result.source.name,
    nameEn: result.source.nameEn,
    feedUrl: result.source.url,
    itemCount: result.items.length,
    ok: !result.error && result.items.length > 0,
    error: result.error,
  })),
  items,
};

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await atomicWrite(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`English football update wrote ${items.length} items from ${successfulSources.length}/${SOURCES.length} sources.`);
console.log(`Categories: ${[...categories].join(", ")}`);
if (failedSources.length) console.log(`Non-fatal source failures: ${JSON.stringify(failedSources)}`);
