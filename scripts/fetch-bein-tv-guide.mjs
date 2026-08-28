import fs from "node:fs";
import { chromium } from "playwright-core";

const GUIDE_URLS = [
  "https://www.beinsports.com/en-mena/tv-guide",
  "https://www.beinsports.com/ar-mena/جدول-البث",
];
const CHROMIUM_PATHS = [process.env.CHROMIUM_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const CHANNEL_RE = /^beIN SPORTS (?:[1-9]|MAX\s*[1-6]|(?:Extra|XTRA)\s*[1-9]|NEWS)(?:\s+HD)?$/i;
const SKIP_RE = /highlights?|review|stories|netbusters|show|weekly|analysis|handball|basketball|volleyball|tennis|futsal|ملخص|استوديو|تحليل/i;

function unique(values) { return [...new Set(values.filter(Boolean))]; }

async function clickDate(page, date) {
  const day = date.slice(-2);
  const dateTiles = page.locator('div[tabindex="0"]').filter({ hasText: new RegExp(`(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)${day}$`) });
  const count = await dateTiles.count();
  for (let index = 0; index < count; index += 1) {
    const dateTile = dateTiles.nth(index);
    if (!(await dateTile.isVisible().catch(() => false))) continue;
    await dateTile.click({ force: true });
    await page.waitForTimeout(900);
    return true;
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
    if (SKIP_RE.test(line)) continue;
    const match = line.match(/^(.+?)\s+vs\s+(.+?)\s+-\s+(.+?)\s*$/i);
    if (!match || !channel || !/\b(?:League|Liga|Bundesliga|Ligue|Eredivisie|Premiership|Champions|Europa|LaLiga|Serie A|Primeira|Cup|Cup)/i.test(match[3])) continue;
    const start = lines[index + 1]?.match(/^(\d{2}):(\d{2})$/);
    const end = lines[index + 2]?.match(/^(\d{2}):(\d{2})$/);
    if (!start || !end) continue;
    entries.push({ date, homeTeamEn: match[1].trim(), awayTeamEn: match[2].trim(), competitionEn: match[3].trim(), channel, startTime: `${start[1]}:${start[2]}`, endTime: `${end[1]}:${end[2]}`, isLive: lines[index - 1]?.toUpperCase() === "LIVE" });
  }
  return entries;
}

export async function fetchBeinTvGuide(queryDates) {
  const executablePath = CHROMIUM_PATHS.find((path) => fs.existsSync(path));
  if (!executablePath) throw new Error("No Chromium/Chrome executable found for beIN TV guide parser");
  const browser = await chromium.launch({ headless: false, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const all = [];
    for (const guideUrl of GUIDE_URLS) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "en-US", userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36" });
      try {
        try {
          await page.goto(guideUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
        } catch (error) {
          console.error(`beIN guide navigation failed for ${guideUrl}: ${error.message}`);
          continue;
        }
        await page.waitForTimeout(3500);
        for (const date of queryDates) {
          if (await clickDate(page, date)) all.push(...await scrapeVisibleDay(page, date));
        }
      } finally {
        await page.close();
      }
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
