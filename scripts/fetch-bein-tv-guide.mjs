import fs from "node:fs";
import { chromium } from "playwright-core";

const GUIDE_URL = "https://www.beinsports.com/en-mena/tv-guide";
const CHROMIUM_PATHS = [process.env.CHROMIUM_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const LA_LIGA_RE = /Spanish LaLiga/i;
const CHANNEL_RE = /^beIN SPORTS (?:[1-9]|MAX\s*[1-6]|(?:Extra|XTRA)\s*[1-9])$/i;
const SKIP_RE = /highlights?|review|stories|netbusters|show|weekly|analysis|ملخص|استوديو|تحليل/i;

function unique(values) { return [...new Set(values.filter(Boolean))]; }

async function clickDate(page, date) {
  const day = date.slice(-2);
  const matches = page.getByText(day, { exact: true });
  const count = await matches.count();
  for (let index = 0; index < count; index += 1) {
    if (await matches.nth(index).isVisible().catch(() => false)) {
      await matches.nth(index).click({ force: true });
      await page.waitForTimeout(650);
      return true;
    }
  }
  return false;
}

async function scrapeVisibleDay(page, date) {
  const lines = await page.evaluate(() => document.body.innerText.split("\n").map((line) => line.trim()).filter(Boolean));
  const entries = [];
  let channel = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (CHANNEL_RE.test(line)) { channel = line.replace(/\bXTRA\s*([1-9])\b/i, "Extra $1"); continue; }
    if (!LA_LIGA_RE.test(line) || SKIP_RE.test(line)) continue;
    const match = line.match(/^(.+?)\s+vs\s+(.+?)\s+-\s+Spanish LaLiga\b/i);
    if (!match || !channel) continue;
    const start = lines[index + 1]?.match(/^(\d{2}):(\d{2})$/);
    const end = lines[index + 2]?.match(/^(\d{2}):(\d{2})$/);
    if (!start || !end) continue;
    entries.push({ date, homeTeamEn: match[1].trim(), awayTeamEn: match[2].trim(), channel, startTime: `${start[1]}:${start[2]}`, endTime: `${end[1]}:${end[2]}`, isLive: lines[index - 1]?.toUpperCase() === "LIVE" });
  }
  return entries;
}

export async function fetchBeinTvGuide(queryDates) {
  const executablePath = CHROMIUM_PATHS.find((path) => fs.existsSync(path));
  if (!executablePath) throw new Error("No Chromium/Chrome executable found for beIN TV guide parser");
  const browser = await chromium.launch({ headless: false, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "en-US", userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36" });
    await page.goto(GUIDE_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3500);
    const all = [];
    for (const date of queryDates) {
      if (await clickDate(page, date)) all.push(...await scrapeVisibleDay(page, date));
    }
    return unique(all.map((entry) => JSON.stringify(entry))).map((entry) => JSON.parse(entry));
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dates = process.argv.slice(2);
  const result = await fetchBeinTvGuide(dates.length ? dates : [new Date().toISOString().slice(0, 10)]);
  console.log(JSON.stringify(result, null, 2));
}
