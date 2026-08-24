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
const sportsScript = read("public/assets/sports-news.js");
const sportsWorkflow = read(".github/workflows/daily-sports-news-update.yml");

assert(pages.every((html) => html.includes("/assets/maensat-enhancements.js?v=20260824-sports-v1")), "Enhancement script missing from a page");
assert(pages.every((html) => html.includes("/assets/maensat-enhancements.css?v=20260824-sports-v7")), "Enhancement stylesheet missing from a page");
assert(pages.every((html) => html.includes("/assets/sports-news.js?v=20260824-v11") && html.includes('id="sports"') && html.includes('id="sportsArticle"')), "Sports section assets missing from a page");
assert(pages.every((html) => html.includes('data-sports-mode="news"') && html.includes('data-sports-mode="matches"') && html.includes('data-matches-window="today"') && html.includes('data-matches-window="tomorrow"') && html.includes('data-matches-window="week"')), "Football matches tabs are missing from a page");
assert(sportsScript.includes("function localizedField") && sportsScript.includes("function installLanguageBridge"), "Football language bridge is missing");
assert(sportsScript.includes("var DATA_URLS") && sportsScript.includes("/data/sports-news-ar.json") && sportsScript.includes("/data/sports-news-en.json"), "Independent Arabic and English football datasets are missing");
assert(sportsScript.includes("var MATCHES_URL") && sportsScript.includes("/data/football-matches.json") && sportsScript.includes("function loadMatches") && sportsScript.includes("function setSportsMode"), "Football matches loader or mode switch is missing");
assert(sportsScript.includes("broadcastFta") && sportsScript.includes("broadcastEncrypted") && sportsScript.includes("broadcastUnknown") && sportsScript.includes("matchesWithBroadcasters") && sportsScript.includes("broadcastAccessEvidence") && sportsScript.includes("accessSourceUrl") && sportsScript.includes("sourceUrl"), "Broadcaster access labels or evidence links are missing");
assert(sportsScript.includes("if (root.lang !== lang) root.lang = lang") && sportsScript.includes("if (state.renderedLanguage !== lang) setLanguageFields()"), "Sports language observer is not guarded against repeated renders");
assert(pages.every((html) => html.includes("if(root.lang!==lang) root.lang=lang")), "Global language enhancer still writes unchanged document attributes");
assert(!sportsScript.includes("titleEn") && !sportsScript.includes("summaryEn") && !sportsScript.includes("contentEn"), "Sports UI still depends on machine-translated fields");
assert(sportsScript.includes("sports-article-back") && sportsScript.includes("Back to football"), "Internal football reader back button is missing");
assert(sportsWorkflow.includes("35 5 * * *") && sportsWorkflow.includes("update-sports-news-en.mjs") && sportsWorkflow.includes("update-football-matches.mjs") && sportsWorkflow.includes("test-football-matches.mjs") && !sportsWorkflow.includes("OPENAI_API_KEY") && !sportsWorkflow.includes("translate-sports-news.mjs"), "Free hybrid football workflow is missing");
assert(catalog.length >= 1, "Product catalog is empty");
assert(catalog.every((item) => item.id && item.name && item.image), "Product catalog contains an incomplete item");
assert(fs.existsSync(path.join(root, "functions/api/track-event.js")), "Track-event endpoint missing");
assert(read("functions/_lib/analytics.js").includes("event_type"), "Analytics event columns missing");
assert(read("public/_headers").includes("/data/products.json"), "Product cache header missing");
assert(read("public/_headers").includes("/data/sports-news-ar.json") && read("public/_headers").includes("/data/sports-news-en.json") && read("public/_headers").includes("/data/football-matches.json"), "Football data cache headers missing");
assert(fs.existsSync(path.join(root, "public/data/sports-news-ar.json")) && fs.existsSync(path.join(root, "public/data/sports-news-en.json")) && fs.existsSync(path.join(root, "public/data/football-matches.json")), "Football datasets missing");

console.log(`site enhancement checks passed (${catalog.length} products)`);
