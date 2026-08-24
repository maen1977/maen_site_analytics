import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/sports-news.json"), "utf8"));
const items = data.items;
const sources = data.sources || [];
const sourceIds = new Set(sources.map((source) => source.id));
const expectedSourceIds = new Set(["okaz-arabic-sport", "masryalyoum-arabic-sport", "almala3b-jordan-sport"]);
const allowedImageHosts = new Set(["www.okaz.com.sa", "www.al-mala3b.net", "www.almasryalyoum.com"]);
const nonFootballHeadline = /كرة السلة|basketball|سلة|كرة الطائرة|volleyball|الطائرة|كرة اليد|handball|تنس|tennis|ملاكمة|boxing|مصارعة|wrestling|فورمولا|formula|سباق|racing|ألعاب القوى|athletics|الرياضات الإلكترونية|رياضات إلكترونية|esports|كريكيت|cricket|غولف|golf|ركبي|rugby|أولمبي|olympic|البرلمان|برلماني|parliament|parliamentary|وزير شؤون|minister of parliamentary/i;
const footballHeadline = /كرة القدم|كرة قدم|football|soccer|فيفا|fifa|يويفا|uefa|الدوري|مباراة|مباريات|منتخب|نادي|لاعب|مدرب|مهاجم|حارس|فريق|شباك|تشكيلة|ركلة|هدف|أهداف|انتقال|قميص|ملعب|بطولة كأس|كأس العالم|الكأس|اتحاد كرة القدم|الفيصلي|الوحدات|الرمثا|الحسين|السلط|الجزيرة|شباب الأردن|الزمالك|الأهلي|بيراميدز|برشلونة|ريال مدريد|ليفربول|مانشستر|نيوكاسل|طرابزون|باشاك شهير|ميسي|رونالدو|اتحاد جدة|نيوم|القادسية|الهلال|النصر|الشباب|التعاون|ضمك|الرائد|الخليج/i;

assert.equal(data.schemaVersion, 1, "sports dataset schema version must be 1");
assert.equal(sources.length, expectedSourceIds.size, "sports dataset must use exactly the approved Arabic sources");
assert.deepEqual(sourceIds, expectedSourceIds, "sports dataset has an unapproved or missing source");
assert.ok(Array.isArray(items) && items.length >= 8 && items.length <= 90, "sports dataset item count is outside safe bounds");
assert.equal(data.itemCount, items.length, "sports itemCount must match the items array");
assert.ok(["global", "europe", "jordan"].every((category) => items.some((item) => item.category === category)), "sports dataset must cover global, Europe, and Jordan");
assert.ok(sources.every((source) => source.id && source.feedUrl && /^https:\/\//i.test(source.feedUrl)), "every approved Arabic source must have an HTTPS feed URL");
assert.ok(sources.some((source) => source.ok && source.itemCount > 0), "at least one Arabic football source must provide items");
const jordanSource = sources.find((source) => source.id === "almala3b-jordan-sport");
assert.ok(jordanSource && jordanSource.ok && jordanSource.itemCount > 0, "the Jordan football source must be live and non-empty");
assert.ok(sources.every((source) => /كرة القدم/i.test(source.name) && source.nameEn), "every sports source must have Arabic and English football labels");
assert.equal(data.translationStatus, "complete", "sports dataset must have complete English translations");

const ids = new Set();
const urls = new Set();
for (const item of items) {
  assert.ok(item.id && !ids.has(item.id), "sports item IDs must be unique");
  assert.ok(item.url && /^https:\/\//i.test(item.url) && !urls.has(item.url), "sports item URLs must be unique HTTPS URLs");
  assert.ok(sourceIds.has(item.sourceId), "sports item source must be declared");
  assert.equal(item.language, "ar", "every sports item must be marked Arabic");
  assert.equal(item.sport, "football", "every sports item must be football");
  assert.ok(/[\u0600-\u06FF]/.test(`${item.title} ${item.summary}`), "every sports item must contain Arabic text");
  assert.ok(item.content && item.content.length <= 1800, "every football item must have bounded internal content");
  assert.ok(item.titleEn && item.summaryEn && item.contentEn, "every football item must have English title, summary, and content");
  assert.ok(item.titleEn.length <= 180 && item.summaryEn.length <= 360 && item.contentEn.length <= 1800, "English football fields must stay bounded");
  assert.ok(/[A-Za-z]/.test(`${item.titleEn} ${item.summaryEn} ${item.contentEn}`), "English football fields must contain Latin text");
  assert.ok(["rss-excerpt", "metadata-excerpt", "publisher-article"].includes(item.contentType), "football item has an unknown content type");
  assert.ok(["global", "europe", "jordan"].includes(item.category), "sports item has an unknown category");
  assert.ok(item.title && item.summary, "sports item title and summary are required");
  const headline = `${item.title} ${item.summary}`;
  assert.ok(!nonFootballHeadline.test(headline), "sports dataset contains a non-football headline");
  assert.ok(footballHeadline.test(headline), "sports dataset headline lacks football context");
  assert.ok(!/\/esports\//i.test(item.url), "sports dataset must not include esports URLs");
  assert.ok(!/[<>]/.test(item.title) && !/[<>]/.test(item.summary) && !/[<>]/.test(item.content), "sports text must not contain HTML tags");
  assert.ok(!item.image || /^https:\/\//i.test(item.image), "sports image URLs must be HTTPS when present");
  if (item.image) assert.ok(allowedImageHosts.has(new URL(item.image).hostname), "sports image host is not in the CSP allowlist");
  ids.add(item.id);
  urls.add(item.url);
}

console.log(`Arabic sports dataset checks passed (${items.length} items, ${sources.length} sources)`);
