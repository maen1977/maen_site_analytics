import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/sports-news.json"), "utf8"));
const items = data.items;
const sourceIds = new Set((data.sources || []).map((source) => source.id));

assert.equal(data.schemaVersion, 1, "sports dataset schema version must be 1");
assert.ok(Array.isArray(data.sources) && data.sources.length >= 3, "sports dataset needs at least three sources");
assert.ok(Array.isArray(items) && items.length >= 8 && items.length <= 90, "sports dataset item count is outside safe bounds");
assert.equal(data.itemCount, items.length, "sports itemCount must match the items array");
assert.ok(["global", "europe", "jordan"].every((category) => items.some((item) => item.category === category)), "sports dataset must cover global, Europe, and Jordan");

const ids = new Set();
const urls = new Set();
for (const item of items) {
  assert.ok(item.id && !ids.has(item.id), "sports item IDs must be unique");
  assert.ok(item.url && /^https:\/\//i.test(item.url) && !urls.has(item.url), "sports item URLs must be unique HTTPS URLs");
  assert.ok(sourceIds.has(item.sourceId), "sports item source must be declared");
  assert.ok(["global", "europe", "jordan"].includes(item.category), "sports item has an unknown category");
  assert.ok(item.title && item.summary, "sports item title and summary are required");
  assert.ok(!/[<>]/.test(item.title) && !/[<>]/.test(item.summary), "sports text must not contain HTML tags");
  assert.ok(!item.image || /^https:\/\//i.test(item.image), "sports image URLs must be HTTPS when present");
  ids.add(item.id);
  urls.add(item.url);
}

console.log(`sports dataset checks passed (${items.length} items, ${data.sources.length} sources)`);
