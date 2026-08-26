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
const matchesScript = read("public/assets/football-matches.js");
const matchesWorkflow = read(".github/workflows/daily-football-matches-update.yml");

assert(pages.every((html) => html.includes("/assets/maensat-enhancements.js?v=20260824-sports-v1")), "Enhancement script missing from a page");
assert(pages.every((html) => html.includes("/assets/maensat-enhancements.css?v=20260825-sports-v12")), "Enhancement stylesheet missing from a page");
assert(pages.every((html) => html.includes("/assets/football-matches.js?v=20260825-matches-v7") && html.includes('id="sports"') && html.includes('id="sportsMatchesPanel"')), "Football schedule assets missing from a page");
assert(pages.every((html) => !html.includes("sportsNewsPanel") && !html.includes("sportsArticle") && !html.includes("sports-news.js") && !html.includes("data-sports-mode=")), "Football news UI or mode switch is still present");
assert(matchesScript.includes("var MATCHES_URL") && matchesScript.includes("/data/football-matches.json") && matchesScript.includes("function loadMatches") && matchesScript.includes("function renderMatchCard") && matchesScript.includes("data-competition-window") && matchesScript.includes("data-competition-select") && matchesScript.includes("sports-competition-picker") && matchesScript.includes("sports-selected-competition") && matchesScript.includes('matchesWindow: "week"'), "Football matches loader, competition tiles, or week default is missing");
assert(matchesScript.includes("matchTime") && matchesScript.includes("matchBroadcast") && matchesScript.includes("broadcastFta") && matchesScript.includes("broadcastEncrypted") && matchesScript.includes("broadcastUnknown") && matchesScript.includes("exact channel number has not been announced yet"), "Schedule time or broadcaster labels are missing");
assert(matchesScript.includes("scheduleTodayKey") && matchesScript.includes("addDateKey(today, 7)"), "Seven-day forward schedule window is missing");
assert(!matchesScript.includes("sports-news-ar") && !matchesScript.includes("sports-news-en") && !matchesScript.includes("renderArticle") && !matchesScript.includes("articleIdFromHash"), "Matches-only script still contains football news logic");
assert(matchesWorkflow.includes("cron: '37 0,12 * * *'") && matchesWorkflow.includes("npm run github:update-matches") && matchesWorkflow.includes("test-football-matches.mjs") && matchesWorkflow.includes("newsCollection: false") && !matchesWorkflow.includes("update-sports-news") && !matchesWorkflow.includes("OPENAI_API_KEY"), "Matches-only twice-daily workflow is missing");
assert(!read("package.json").includes("update-sports-news") && !read("package.json").includes("test-sports-news"), "News commands remain in package scripts");
assert(!read("public/_headers").includes("sports-news-ar") && !read("public/_headers").includes("sports-news-en") && read("public/_headers").includes("football-matches.json"), "Football data cache headers are incorrect");
assert(fs.existsSync(path.join(root, "public/data/football-matches.json")), "Football matches dataset missing");
assert(!fs.existsSync(path.join(root, "public/data/sports-news-ar.json")) && !fs.existsSync(path.join(root, "public/data/sports-news-en.json")), "Football news datasets still exist");
assert(catalog.length >= 1, "Product catalog is empty");
assert(catalog.every((item) => item.id && item.name && item.image), "Product catalog contains an incomplete item");
assert(fs.existsSync(path.join(root, "functions/api/track-event.js")), "Track-event endpoint missing");
assert(read("functions/_lib/analytics.js").includes("event_type"), "Analytics event columns missing");
assert(read("public/_headers").includes("/data/products.json"), "Product cache header missing");

console.log(`site enhancement checks passed (${catalog.length} products; matches-only sports section)`);
