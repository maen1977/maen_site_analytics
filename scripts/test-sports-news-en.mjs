import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/sports-news-en.json"), "utf8"));
const items = data.items;
const sources = data.sources || [];
const sourceIds = new Set(sources.map((source) => source.id));
const expectedSourceIds = new Set(["bbc-english-football", "espn-english-soccer"]);
const allowedImageHosts = new Set(["ichef.bbci.co.uk", "a.espncdn.com", "www.bbc.co.uk", "www.espn.com"]);
const nonFootballHeadline = /basketball|tennis|boxing|wrestling|formula\s*1|motorsport|cricket|golf|rugby|athletics|olympic|esports|e-sports|volleyball|handball|baseball|hockey/i;
const footballHeadline = /football|soccer|fifa|uefa|premier league|champions league|world cup|europa league|conference league|la liga|serie a|bundesliga|ligue 1|league cup|fa cup|efl|goalkeeper|striker|manager|coach|player|club|match|fixture|transfer|goal|league|cup|arsenal|chelsea|liverpool|manchester|newcastle|barcelona|madrid|bayern|milan|juventus|psg|tottenham|everton|brighton|bournemouth|villa|palace|fulham|brentford|hull/i;

assert.equal(data.schemaVersion, 1, "English sports dataset schema version must be 1");
assert.equal(data.language, "en", "English sports dataset must be marked English");
assert.equal(sources.length, expectedSourceIds.size, "English sports dataset must use exactly the approved sources");
assert.deepEqual(sourceIds, expectedSourceIds, "English sports dataset has an unapproved or missing source");
assert.ok(Array.isArray(items) && items.length >= 8 && items.length <= 60, "English sports item count is outside safe bounds");
assert.equal(data.itemCount, items.length, "English sports itemCount must match the items array");
assert.ok(items.some((item) => item.category === "global") && items.some((item) => item.category === "europe"), "English sports dataset must cover global and Europe");
assert.ok(sources.every((source) => source.id && source.feedUrl && /^https:\/\//i.test(source.feedUrl)), "every English source must have an HTTPS feed URL");
assert.ok(sources.some((source) => source.ok && source.itemCount > 0), "at least one English football source must provide items");
assert.ok(sources.every((source) => source.nameEn), "every English source must have an English label");

const ids = new Set();
const urls = new Set();
for (const item of items) {
  assert.ok(item.id && !ids.has(item.id), "English sports item IDs must be unique");
  assert.ok(item.url && /^https:\/\//i.test(item.url) && !urls.has(item.url), "English sports item URLs must be unique HTTPS URLs");
  assert.ok(sourceIds.has(item.sourceId), "English sports item source must be declared");
  assert.equal(item.language, "en", "every English sports item must be marked English");
  assert.equal(item.sport, "football", "every English sports item must be football");
  assert.ok(/[A-Za-z]/.test(`${item.title} ${item.summary}`), "every English sports item must contain English text");
  assert.ok(item.content && item.content.length <= 1800, "every English football item must have bounded internal content");
  assert.ok(item.title && item.summary, "English sports item title and summary are required");
  const headline = `${item.title} ${item.summary}`;
  assert.ok(!nonFootballHeadline.test(headline), "English sports dataset contains a non-football headline");
  assert.ok(footballHeadline.test(headline), "English sports dataset headline lacks football context");
  assert.ok(!/[<>]/.test(item.title) && !/[<>]/.test(item.summary) && !/[<>]/.test(item.content), "English sports text must not contain HTML tags");
  assert.ok(!item.image || /^https:\/\//i.test(item.image), "English sports image URLs must be HTTPS when present");
  if (item.image) assert.ok(allowedImageHosts.has(new URL(item.image).hostname), "English sports image host is not in the CSP allowlist");
  assert.ok(["rss-excerpt"].includes(item.contentType), "English item has an unknown content type");
  assert.ok(["global", "europe"].includes(item.category), "English item has an unknown category");
  ids.add(item.id);
  urls.add(item.url);
}

console.log(`English sports dataset checks passed (${items.length} items, ${sources.length} sources)`);
