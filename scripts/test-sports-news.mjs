import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/sports-news-ar.json"), "utf8"));
const items = data.items;
const sources = data.sources || [];
const sourceIds = new Set(sources.map((source) => source.id));
const expectedSourceIds = new Set(["okaz-arabic-sport", "masryalyoum-arabic-sport", "almala3b-jordan-sport"]);
const allowedImageHosts = new Set(["www.okaz.com.sa", "www.al-mala3b.net", "www.almasryalyoum.com"]);
const nonFootballHeadline = /كرة السلة|basketball|سلة|كرة الطائرة|volleyball|الطائرة|كرة اليد|handball|تنس|tennis|ملاكمة|boxing|مصارعة|wrestling|فورمولا|formula|سباق|racing|ألعاب القوى|athletics|الرياضات الإلكترونية|رياضات إلكترونية|esports|كريكيت|cricket|غولف|golf|ركبي|rugby|أولمبي|olympic|البرلمان|برلماني|parliament|parliamentary|وزير شؤون|minister of parliamentary/i;
const footballLatinHeadline = /football|soccer|fifa|uefa|premier league|champions league|world cup|la liga|serie a|bundesliga|ligue 1|transfermarkt/i;
const footballArabicTokens = ["كرة القدم", "كرة قدم", "فيفا", "يويفا", "الدوري", "مباراة", "مباريات", "منتخب", "نادي", "لاعب", "مدرب", "مهاجم", "حارس", "فريق", "شباك", "تشكيلة", "ركلة", "هدف", "أهداف", "انتقال", "قميص", "ملعب", "بطولة كأس", "كأس العالم", "الكأس", "اتحاد كرة القدم", "الفيصلي", "الوحدات", "الرمثا", "الحسين", "السلط", "الجزيرة", "شباب الأردن", "الزمالك", "الأهلي", "بيراميدز", "برشلونة", "ريال مدريد", "ليفربول", "مانشستر", "نيوكاسل", "طرابزون", "باشاك شهير", "ميسي", "رونالدو", "اتحاد جدة", "نيوم", "القادسية", "الهلال", "النصر", "الشباب", "التعاون", "ضمك", "الرائد", "الخليج", "صلاح"];
const hasArabicToken = (value, token) => new RegExp(`(?:^|[^\\p{L}])${token}(?:$|[^\\p{L}])`, "iu").test(String(value ?? ""));
const isFootballHeadline = (value) => footballLatinHeadline.test(String(value ?? "")) || footballArabicTokens.some((token) => hasArabicToken(value, token));

assert.equal(data.schemaVersion, 1, "Arabic sports dataset schema version must be 1");
assert.equal(sources.length, expectedSourceIds.size, "Arabic sports dataset must use exactly the approved sources");
assert.deepEqual(sourceIds, expectedSourceIds, "Arabic sports dataset has an unapproved or missing source");
assert.ok(Array.isArray(items) && items.length >= 8 && items.length <= 90, "Arabic sports item count is outside safe bounds");
assert.equal(data.itemCount, items.length, "Arabic sports itemCount must match the items array");
assert.ok(["global", "europe", "jordan"].every((category) => items.some((item) => item.category === category)), "Arabic sports dataset must cover global, Europe, and Jordan");
assert.ok(sources.every((source) => source.id && source.feedUrl && /^https:\/\//i.test(source.feedUrl)), "every approved Arabic source must have an HTTPS feed URL");
assert.ok(sources.some((source) => source.ok && source.itemCount > 0), "at least one Arabic football source must provide items");
const jordanSource = sources.find((source) => source.id === "almala3b-jordan-sport");
assert.ok(jordanSource && jordanSource.ok && jordanSource.itemCount > 0, "the Jordan football source must be live and non-empty");
assert.ok(sources.every((source) => /كرة القدم/i.test(source.name) && source.nameEn), "every Arabic source must have Arabic and English football labels");

const ids = new Set();
const urls = new Set();
for (const item of items) {
  assert.ok(item.id && !ids.has(item.id), "Arabic sports item IDs must be unique");
  assert.ok(item.url && /^https:\/\//i.test(item.url) && !urls.has(item.url), "Arabic sports item URLs must be unique HTTPS URLs");
  assert.ok(sourceIds.has(item.sourceId), "Arabic sports item source must be declared");
  assert.equal(item.language, "ar", "every Arabic sports item must be marked Arabic");
  assert.equal(item.sport, "football", "every Arabic sports item must be football");
  assert.ok(/[\u0600-\u06FF]/.test(`${item.title} ${item.summary}`), "every Arabic sports item must contain Arabic text");
  assert.ok(item.content && item.content.length <= 1800, "every Arabic football item must have bounded internal content");
  assert.ok(item.title && item.summary, "Arabic sports item title and summary are required");
  const headline = `${item.title} ${item.summary}`;
  assert.ok(!nonFootballHeadline.test(headline), "Arabic sports dataset contains a non-football headline");
  assert.ok(isFootballHeadline(headline), "Arabic sports dataset headline lacks football context");
  assert.ok(!/\/esports\//i.test(item.url), "Arabic sports dataset must not include esports URLs");
  assert.ok(!/[<>]/.test(item.title) && !/[<>]/.test(item.summary) && !/[<>]/.test(item.content), "Arabic sports text must not contain HTML tags");
  assert.ok(!item.image || /^https:\/\//i.test(item.image), "Arabic sports image URLs must be HTTPS when present");
  if (item.image) assert.ok(allowedImageHosts.has(new URL(item.image).hostname), "Arabic sports image host is not in the CSP allowlist");
  ids.add(item.id);
  urls.add(item.url);
}

console.log(`Arabic sports dataset checks passed (${items.length} items, ${sources.length} sources)`);
