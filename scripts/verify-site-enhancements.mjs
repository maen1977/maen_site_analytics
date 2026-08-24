import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pages = [read("public/index.html"), read("public/index_phone.html")];
const catalog = JSON.parse(read("public/data/products.json"));

assert(pages.every((html) => html.includes("/assets/maensat-enhancements.js?v=20260824-sports-v1")), "Enhancement script missing from a page");
assert(pages.every((html) => html.includes("/assets/maensat-enhancements.css?v=20260824-sports-v2")), "Enhancement stylesheet missing from a page");
assert(pages.every((html) => html.includes("/assets/sports-news.js?v=20260824-v3") && html.includes('id="sports"')), "Sports section assets missing from a page");
assert(catalog.length >= 1, "Product catalog is empty");
assert(catalog.every((item) => item.id && item.name && item.image), "Product catalog contains an incomplete item");
assert(fs.existsSync(path.join(root, "functions/api/track-event.js")), "Track-event endpoint missing");
assert(read("functions/_lib/analytics.js").includes("event_type"), "Analytics event columns missing");
assert(read("public/_headers").includes("/data/products.json"), "Product cache header missing");
assert(read("public/_headers").includes("/data/sports-news.json"), "Sports news cache header missing");
assert(fs.existsSync(path.join(root, "public/data/sports-news.json")), "Sports news dataset missing");

console.log(`site enhancement checks passed (${catalog.length} products)`);
