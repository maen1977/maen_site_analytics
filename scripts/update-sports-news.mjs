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
const MALA3B_DETAIL_LIMIT = 18;
const ARTICLE_CONTENT_MAX = 1800;

const EUROPE_KEYWORDS = /أوروبا|الأوروبي|الإنجليزي|الإنكليزي|الإسباني|الإيطالي|الألماني|الفرنسي|الدوري الإنجليزي|الدوري الإسباني|الدوري الإيطالي|الدوري الألماني|الدوري الفرنسي|دوري أبطال أوروبا|الدوري الأوروبي|البريميرليغ|البريميرليج|الليغا|لاليغا|لا ليغا|تشامبيونز|برشلونة|ريال مدريد|ليفربول|نيوكاسل|مانشستر|تشيلسي|أرسنال|بايرن|بوروسيا|باريس سان جيرمان|ميلان|إنتر ميلان|يوفنتوس|طرابزون|باشاك شهير|uefa|premier league|la liga|bundesliga|serie a|ligue 1/i;
const NON_FOOTBALL_KEYWORDS = /كرة السلة|basketball|سلة|كرة الطائرة|volleyball|الطائرة|كرة اليد|handball|تنس|tennis|ملاكمة|boxing|مصارعة|wrestling|فورمولا|formula|سباق|racing|ألعاب القوى|athletics|الرياضات الإلكترونية|رياضات إلكترونية|esports|كريكيت|cricket|غولف|golf|ركبي|rugby|أولمبي|olympic/i;
const FOOTBALL_KEYWORDS = /كرة القدم|كرة قدم|football|soccer|فيفا|fifa|يويفا|uefa|الدوري|مباراة|مباريات|منتخب|نادي|لاعب|مدرب|مهاجم|حارس|فريق|شباك|تشكيلة|ركلة|هدف|أهداف|انتقال|قميص|ملعب|بطولة كأس|كأس العالم|الكأس|اتحاد كرة القدم|الفيصلي|الوحدات|الرمثا|الحسين|السلط|الجزيرة|شباب الأردن|الزمالك|الأهلي|بيراميدز|برشلونة|ريال مدريد|ليفربول|مانشستر|نيوكاسل|طرابزون|باشاك شهير|ميسي|رونالدو|اتحاد جدة|نيوم|القادسية|الهلال|النصر|الشباب|التعاون|ضمك|الرائد|الخليج/i;

const SOURCES = [
  {
    id: "okaz-arabic-sport",
    name: "عكاظ - كرة القدم",
    nameEn: "Okaz - Football",
    url: "https://www.okaz.com.sa/rssFeed/0",
    language: "ar",
    isSports(item) {
      try {
        return /\/(?:sport|esports)\//i.test(new URL(item.url).pathname) && isFootballHeadline(`${item.title} ${item.description}`);
      } catch {
        return false;
      }
    },
    categoryFor(item) {
      return EUROPE_KEYWORDS.test(`${item.title} ${item.description} ${item.url}`) ? "europe" : "global";
    },
  },
  {
    id: "masryalyoum-arabic-sport",
    name: "المصري اليوم - كرة القدم",
    nameEn: "Al-Masry Al-Youm - Football",
    url: "https://www.almasryalyoum.com/rss/rssfeed",
    language: "ar",
    isSports(item) {
      return isFootballHeadline(`${item.title} ${item.description}`);
    },
    categoryFor(item) {
      return EUROPE_KEYWORDS.test(`${item.title} ${item.description} ${item.url}`) ? "europe" : "global";
    },
  },
  {
    id: "almala3b-jordan-sport",
    name: "الملاعب الرياضي - الأردن - كرة القدم",
    nameEn: "Al-Mala3b Sports - Jordan - Football",
    url: "https://www.al-mala3b.net/rss.php",
    language: "ar",
    kind: "mala3b",
    isSports(item) {
      return isFootballHeadline(item.title);
    },
    categoryFor() {
      return "jordan";
    },
  },
];

function hasArabicToken(value, token) {
  return new RegExp(`(?:^|[^\\p{L}])${token}(?:$|[^\\p{L}])`, "iu").test(String(value ?? ""));
}

function isFootballHeadline(value) {
  const text = String(value ?? "");
  return !NON_FOOTBALL_KEYWORDS.test(text) && (FOOTBALL_KEYWORDS.test(text) || hasArabicToken(text, "صلاح"));
}

function extractMala3bArticleContent(html) {
  const match = String(html ?? "").match(/<div\b[^>]*id\s*=\s*["']newscontent["'][^>]*>([\s\S]*?)<\/div>/i);
  return match ? cleanText(match[1], ARTICLE_CONTENT_MAX) : "";
}

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
    .replace(/\*{2}media\[\d+\]\*{2}/gi, " ")
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

function parseMala3bIndex(html, source) {
  const matches = [...html.matchAll(/<a\b[^>]*href\s*=\s*(["'])([^"']*page=article&id=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  return matches
    .map((match) => {
      let url = "";
      try {
        url = new URL(decodeEntities(match[2]), source.url).href;
      } catch {
        url = "";
      }
      return { source, url, title: cleanText(match[3], 220) };
    })
    .filter((item) => {
      if (!item.url || !item.title || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, MALA3B_DETAIL_LIMIT);
}

function htmlAttribute(tag, attribute) {
  const match = tag.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function metaContent(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const property = htmlAttribute(tag, "property").toLowerCase();
    const name = htmlAttribute(tag, "name").toLowerCase();
    if (property === key.toLowerCase() || name === key.toLowerCase()) return htmlAttribute(tag, "content");
  }
  return "";
}

function parseMala3bDate(value) {
  const raw = cleanText(value, 120);
  const match = raw.match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let hour = Number(match[4]);
    const meridiem = match[6].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return Date.parse(`${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${match[5]}:00+03:00`);
  }
  return Date.parse(raw);
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
  const text = `${item.title} ${item.categories.join(" ")} ${item.description}`.toLowerCase();
  if (/basketball|fiba|nba|wnba|كرة السلة/.test(text)) return "basketball";
  if (/\btennis\b|\bwimbledon\b|\batp\b|\bwta\b|(?:^|[^\p{L}])تنس(?:$|[^\p{L}])/iu.test(text)) return "tennis";
  if (/formula|f1|motorsport|indycar|فورمولا/.test(text)) return "motorsport";
  if (/cricket|كريكيت/.test(text)) return "cricket";
  if (/boxing|ufc|mma|ملاكمة|مصارعة/.test(text)) return "combat";
  if (/rugby|golf|athletics|olympic|cycling|سباق|غولف|ألعاب القوى/.test(text)) return "other";
  if (/football|soccer|fifa|uefa|premier league|champions league|world cup|goalkeeper|striker|كرة القدم|الدوري|فيفا|يويفا/.test(text)) return "football";
  return source.id === "almala3b-jordan-sport" ? "football" : "other";
}

function toNewsItem(raw, source, overrides = {}) {
  const url = validHttpsUrl(raw.url);
  const title = cleanText(raw.title, 180);
  const summary = cleanText(overrides.summary || raw.description, 360);
  const content = cleanText(overrides.content || raw.description, ARTICLE_CONTENT_MAX);
  const image = validHttpsUrl(overrides.image || raw.image);
  const publishedMs = overrides.publishedMs ?? raw.publishedMs;
  if (!url || !title || !summary || !content || !Number.isFinite(publishedMs) || publishedMs <= 0) return null;
  if (/[<>]/.test(title) || /[<>]/.test(summary) || !/[\u0600-\u06FF]/.test(`${title} ${summary}`)) return null;
  const id = crypto.createHash("sha256").update(`${source.id}\n${url}\n${title}`).digest("hex").slice(0, 20);
  return {
    id,
    title,
    summary,
    content,
    contentType: overrides.contentType || "rss-excerpt",
    url,
    image: image || null,
    sourceId: source.id,
    sourceName: source.name,
    sourceNameEn: source.nameEn || source.name,
    category: source.categoryFor(raw),
    sport: "football",
    categories: raw.categories.slice(0, 8),
    publishedAt: new Date(publishedMs).toISOString(),
    language: source.language,
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, text/html;q=0.8",
        "user-agent": "MaenSat-Sports-Updater/1.0",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRssSource(source) {
  const body = await fetchText(source.url);
  if (!/<(?:rss|feed)\b/i.test(body)) throw new Error("response is not RSS XML");
  const parsed = parseRss(body, source);
  const recent = parsed.filter((item) => Date.now() - item.publishedMs <= NEWS_MAX_AGE_HOURS * 60 * 60 * 1000);
  const filtered = source.isSports ? recent.filter((item) => source.isSports(item)) : recent;
  return filtered.map((item) => toNewsItem(item, source)).filter(Boolean);
}

async function fetchMala3bSource(source) {
  const indexBody = await fetchText(source.url);
  const entries = parseMala3bIndex(indexBody, source).filter((entry) => source.isSports(entry));
  const detailed = await Promise.all(entries.map(async (entry) => {
    try {
      const body = await fetchText(entry.url);
      const dateMatch = body.match(/<span\b[^>]*class\s*=\s*["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const publishedMs = parseMala3bDate(dateMatch ? dateMatch[1] : "");
      const summary = metaContent(body, "og:description") || metaContent(body, "description");
      const articleContent = extractMala3bArticleContent(body);
      const image = metaContent(body, "og:image");
      return toNewsItem({ ...entry, description: summary, publishedMs, categories: [] }, source, {
        summary,
        content: articleContent || summary,
        contentType: articleContent ? "publisher-article" : "metadata-excerpt",
        publishedMs,
        image,
      });
    } catch {
      return null;
    }
  }));
  return detailed
    .filter(Boolean)
    .filter((item) => isFootballHeadline(`${item.title} ${item.content}`))
    .filter((item) => Date.now() - Date.parse(item.publishedAt) <= NEWS_MAX_AGE_HOURS * 60 * 60 * 1000);
}

async function fetchSource(source) {
  try {
    const items = source.kind === "mala3b" ? await fetchMala3bSource(source) : await fetchRssSource(source);
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
const allArabic = items.length > 0 && items.every((item) => item.language === "ar" && /[\u0600-\u06FF]/.test(`${item.title} ${item.summary}`));
const allFootball = items.length > 0 && items.every((item) => item.sport === "football");

if (
  items.length < MIN_ITEMS ||
  !categories.has("global") ||
  !categories.has("europe") ||
  !categories.has("jordan") ||
  !allArabic ||
  !allFootball
) {
  const details = JSON.stringify(
    {
      itemCount: items.length,
      categories: [...categories],
      allArabic,
      allFootball,
      successfulSources: successfulSources.map((result) => result.source.id),
      failedSources,
    },
    null,
    2,
  );
  throw new Error(`Sports update guard rejected incomplete Arabic data: ${details}`);
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  freshnessWindowHours: NEWS_MAX_AGE_HOURS,
  itemCount: items.length,
  sources: results.map((result) => ({
    id: result.source.id,
    name: result.source.name,
    nameEn: result.source.nameEn || result.source.name,
    feedUrl: result.source.url,
    itemCount: result.items.length,
    ok: !result.error && result.items.length > 0,
    error: result.error,
  })),
  items,
};

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await atomicWrite(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Sports news update wrote ${items.length} Arabic items from ${successfulSources.length}/${SOURCES.length} sources.`);
console.log(`Categories: ${[...categories].join(", ")}`);
if (failedSources.length) console.log(`Non-fatal source failures: ${JSON.stringify(failedSources)}`);
