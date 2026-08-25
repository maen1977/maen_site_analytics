import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/data/football-matches.json");
const TIME_ZONE = "Asia/Amman";
const FILGOAL_TIME_ZONE = "Africa/Cairo";
const KOOORA_TIME_ZONE = "Asia/Riyadh";
const ESPN_ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const ESPN_MAJOR_LEAGUES = [
  { id: "eng.1", key: "premier-league", name: "English Premier League", country: "England" },
  { id: "esp.1", key: "la-liga", name: "Spanish LaLiga", country: "Spain" },
  { id: "ita.1", key: "serie-a", name: "Italian Serie A", country: "Italy" },
  { id: "ger.1", key: "bundesliga", name: "German Bundesliga", country: "Germany" },
  { id: "fra.1", key: "ligue-1", name: "French Ligue 1", country: "France" },
  { id: "ned.1", key: "eredivisie", name: "Dutch Eredivisie", country: "Netherlands" },
  { id: "por.1", key: "primeira-liga", name: "Portuguese Primeira Liga", country: "Portugal" },
  { id: "sco.1", key: "scottish-premiership", name: "Scottish Premiership", country: "Scotland" },
  { id: "uefa.champions", key: "champions-league", name: "UEFA Champions League", country: "Europe" },
  { id: "uefa.europa", key: "europa-league", name: "UEFA Europa League", country: "Europe" },
];
const THESPORTSDB_JORDAN_LEAGUE_ID = "5055";
const FILGOAL_BASE = "https://www.filgoal.com/matches";
const KOOORA_HOME = "https://www.kooora.com/";
const BEIN_FAQ_URL = "https://www.bein.com/en/general-faq/";
const BEIN_CHANNEL_LIST_URL = "https://www.bein.com/en/channel-list/";
const BEIN_MENA_GUIDE_URL = "https://www.beinsports.com/en-mena/tv-guide";
const BEIN_RIGHTS_COMPETITIONS = new Set(["premier-league", "la-liga", "ligue-1"]);
const AD_SPORTS_OFFICIAL_URL = "https://www.admn.ae/en/brand/4197607/abu-dhabi-sports";
const ON_SPORT_OFFICIAL_URL = "https://www.facebook.com/OnTimeSports/";
const DAYS_AHEAD = 7;
const FETCH_TIMEOUT_MS = 20000;
const FETCH_RETRIES = 3;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const TARGET_BROADCAST_COUNTRIES = new Set(["Jordan", "Palestine", "Lebanon", "Syria", "Iraq", "Egypt"]);
const ACCESS_TYPES = new Set(["fta", "encrypted", "unknown"]);
const EVIDENCE_LEVELS = new Set(["official", "editorial", "corroborated"]);
const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const pad = (value) => String(value).padStart(2, "0");
const isoDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const addDays = (date, amount) => new Date(date.getTime() + amount * 86400000);

function localDateParts(date = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function localToday() {
  const parts = localDateParts();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function compact(value, maxLength = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;|&#47;/gi, "/");
}

function normalizeTeam(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|club|women|womens|u19|u20|u21|u23)\b/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_ALIASES = new Map([
  ["أبها", ["abha"]],
  ["الخليج", ["al khaleej"]],
  ["التعاون", ["al taawoun", "al taawon"]],
  ["الفيحاء", ["al fayha"]],
  ["الاتفاق", ["al ettifaq"]],
  ["النصر", ["al nassr"]],
  ["الشباب", ["al shabab"]],
  ["الرياض", ["al riyadh"]],
  ["فالنسيا", ["valencia"]],
  ["ريال بيتيس", ["real betis"]],
  ["سيلتك", ["celtic"]],
  ["لاسك", ["lask linz", "lask"]],
  ["نيميخن", ["nec nijmegen", "nec"]],
  ["بودو جليمت", ["bodo glimt"]],
]);

function teamNamesMatch(sourceName, fixtureName) {
  const source = normalizeTeam(sourceName);
  const fixture = normalizeTeam(fixtureName);
  if (!source || !fixture) return false;
  if (source === fixture || source.includes(fixture) || fixture.includes(source)) return true;
  const aliases = TEAM_ALIASES.get(source) || [];
  if (aliases.some((alias) => {
    const normalizedAlias = normalizeTeam(alias);
    return normalizedAlias === fixture || normalizedAlias.includes(fixture) || fixture.includes(normalizedAlias);
  })) return true;
  return [...TEAM_ALIASES.entries()].some(([key, values]) => {
    const normalizedKey = normalizeTeam(key);
    const sourceIsAlias = values.some((alias) => normalizeTeam(alias) === source);
    return sourceIsAlias && (normalizedKey === fixture || normalizedKey.includes(fixture) || fixture.includes(normalizedKey));
  });
}

function fixtureHasSourceTeams(sourceMatch, fixture) {
  const direct = teamNamesMatch(sourceMatch.homeTeamAr, fixture.homeTeam) && teamNamesMatch(sourceMatch.awayTeamAr, fixture.awayTeam);
  const reversed = teamNamesMatch(sourceMatch.homeTeamAr, fixture.awayTeam) && teamNamesMatch(sourceMatch.awayTeamAr, fixture.homeTeam);
  return direct || reversed;
}

function sourceCompetitionMatches(hint, fixture) {
  if (!hint) return true;
  const season = String(fixture.seasonSlug || "").toLowerCase();
  return season.includes(hint) || (hint === "uefa-champions-league" && season === "playoff-round");
}

function matchKey(date, home, away) {
  return `${date}|${normalizeTeam(home)}|${normalizeTeam(away)}`;
}

function stableId(value) {
  return `match-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 20)}`;
}

function dateFromValue(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function localDateFromInstant(value) {
  const date = dateFromValue(value);
  if (!date) return "";
  const parts = localDateParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function displayTime(value) {
  const date = dateFromValue(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedDateTimeToUtc(dateKey, time, timeZone) {
  const match = String(`${dateKey} ${time}`).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const wallClock = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0);
  const offset = timeZoneOffsetMinutes(new Date(wallClock), timeZone);
  return new Date(wallClock - offset * 60000);
}

async function fetchWithRetry(url, accept, parse) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept, "user-agent": "maensat-football-matches/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await parse(response);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRIES) await sleep(attempt * 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchJson(url) {
  return fetchWithRetry(url, "application/json", (response) => response.json());
}

async function fetchText(url) {
  return fetchWithRetry(url, "text/html,application/xhtml+xml", (response) => response.text());
}

function toEspnMatch(event, requestedDate, leagueMeta = {}) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((team) => team.homeAway === "home") || competitors[1] || {};
  const away = competitors.find((team) => team.homeAway === "away") || competitors[0] || {};
  const start = event?.date || competition?.date;
  const homeName = compact(home.team?.displayName || home.team?.shortDisplayName || home.team?.name, 120);
  const awayName = compact(away.team?.displayName || away.team?.shortDisplayName || away.team?.name, 120);
  if (!start || !homeName || !awayName) return null;
  const date = localDateFromInstant(start) || requestedDate;
  return {
    key: matchKey(date, homeName, awayName),
    id: stableId(`${date}|${homeName}|${awayName}`),
    date,
    start,
    time: displayTime(start),
    homeTeam: homeName,
    awayTeam: awayName,
    homeLogo: compact(home.team?.logo, 500),
    awayLogo: compact(away.team?.logo, 500),
    competition: compact(leagueMeta.name || event?.league?.name || event?.season?.displayName || "Football", 140),
    competitionKey: leagueMeta.key || leagueMeta.id || compact(event?.season?.slug, 160),
    seasonSlug: compact(event?.season?.slug, 160),
    country: compact(leagueMeta.country || event?.league?.country || competition?.venue?.address?.country || "", 80),
    venue: compact(competition?.venue?.fullName || "", 140),
    status: compact(competition?.status?.type?.name || event?.status?.type?.name || "STATUS_SCHEDULED", 40),
    sourceIds: ["espn-public-soccer"],
    sourceUrl: compact(event?.links?.[0]?.href, 600),
    espnId: compact(event?.id, 40),
  };
}

function toSportsDbMatch(event, requestedDate) {
  const homeName = compact(event?.strHomeTeam, 120);
  const awayName = compact(event?.strAwayTeam, 120);
  if (!homeName || !awayName) return null;
  const timestamp = event?.strTimestamp || `${event?.dateEvent || requestedDate}T${event?.strTime || "00:00:00"}`;
  const date = event?.dateEvent || localDateFromInstant(timestamp) || requestedDate;
  return {
    key: matchKey(date, homeName, awayName),
    id: stableId(`${date}|${homeName}|${awayName}`),
    date,
    start: timestamp,
    time: displayTime(timestamp),
    homeTeam: homeName,
    awayTeam: awayName,
    homeLogo: compact(event?.strHomeTeamBadge, 500),
    awayLogo: compact(event?.strAwayTeamBadge, 500),
    competition: compact(event?.strLeague || "Football", 140),
    competitionKey: event?.idLeague === THESPORTSDB_JORDAN_LEAGUE_ID ? "jordan-pro-league" : compact(event?.strLeague || "football", 140).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    seasonSlug: "",
    country: compact(event?.strCountry || "", 80),
    venue: compact(event?.strVenue || "", 140),
    status: compact(event?.strStatus || "NS", 40),
    sourceIds: ["thesportsdb-free"],
    sourceUrl: event?.idEvent ? `https://www.thesportsdb.com/event/${encodeURIComponent(event.idEvent)}` : "",
    sportsDbId: compact(event?.idEvent, 40),
  };
}

async function fetchEspnLeagueDay(queryDate, league) {
  const payload = await fetchJson(`${ESPN_ROOT}/${league.id}/scoreboard?dates=${queryDate.replaceAll("-", "")}&limit=100`);
  return (payload.events || []).map((event) => toEspnMatch(event, queryDate, league)).filter(Boolean);
}

async function fetchEspnDay(queryDate) {
  const results = await Promise.allSettled(ESPN_MAJOR_LEAGUES.map((league) => fetchEspnLeagueDay(queryDate, league)));
  return results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
}

async function fetchJordanLeague() {
  const payload = await fetchJson(`${SPORTSDB_BASE}/eventsseason.php?id=${THESPORTSDB_JORDAN_LEAGUE_ID}&s=2026-2027`);
  return (payload.events || []).map((event) => toSportsDbMatch(event, event.dateEvent || "")).filter(Boolean);
}

function classifyAccessType(channelName) {
  const channel = String(channelName || "").replace(/\s+/g, " ").trim();
  if (/^beIN\s+SPORTS(?:\s+NEWS)?$/i.test(channel)) return "fta";
  if (/^beIN\s+SPORTS\s+(?:[1-9]|MAX\s*[1-6])(?:\s+HD)?$/i.test(channel)) return "encrypted";
  return "unknown";
}

function broadcasterEntry({ name, country, sourceName, sourceUrl, evidenceLevel, accessType, accessSourceName, accessSourceUrl }) {
  const cleanName = compact(name, 120);
  const cleanCountry = compact(country, 60);
  const cleanSourceUrl = String(sourceUrl || "");
  if (!cleanName || !TARGET_BROADCAST_COUNTRIES.has(cleanCountry) || !/^https:\/\//i.test(cleanSourceUrl)) return null;
  const inferredAccessType = accessType || classifyAccessType(cleanName);
  if (!ACCESS_TYPES.has(inferredAccessType) || !EVIDENCE_LEVELS.has(evidenceLevel)) return null;
  const cleanAccessSourceUrl = String(accessSourceUrl || "");
  if (cleanAccessSourceUrl && !/^https:\/\//i.test(cleanAccessSourceUrl)) return null;
  const result = {
    name: cleanName,
    nameAr: cleanName,
    nameEn: cleanName,
    country: cleanCountry,
    region: cleanCountry,
    accessType: inferredAccessType,
    verified: true,
    evidenceLevel,
    sourceName: compact(sourceName, 120),
    sourceUrl: cleanSourceUrl,
    verifiedAt: new Date().toISOString(),
  };
  const isBeinChannel = /^beIN\s+SPORTS/i.test(cleanName);
  if (isBeinChannel && inferredAccessType !== "unknown" && !cleanAccessSourceUrl) {
    result.accessSourceName = "beIN official FAQ and channel list";
    result.accessSourceUrl = BEIN_FAQ_URL;
  } else if (cleanAccessSourceUrl) {
    result.accessSourceName = compact(accessSourceName || "Official access information", 120);
    result.accessSourceUrl = cleanAccessSourceUrl;
  }
  return result;
}

async function fetchSportsDbTv(eventId) {
  if (!eventId) return [];
  const sourceUrl = `https://www.thesportsdb.com/event/${encodeURIComponent(eventId)}`;
  const payload = await fetchJson(`${SPORTSDB_BASE}/lookuptv.php?id=${encodeURIComponent(eventId)}`);
  return (payload.tvevent || [])
    .filter((entry) => TARGET_BROADCAST_COUNTRIES.has(String(entry.strCountry || "").trim()))
    .map((entry) => broadcasterEntry({
      name: entry.strChannel,
      country: entry.strCountry,
      sourceName: "TheSportsDB TV listing",
      sourceUrl,
      evidenceLevel: "corroborated",
    }))
    .filter(Boolean);
}

const FILGOAL_COMPETITION_HINTS = [
  [/الدوري الإنجليزي/, "english-premier-league"],
  [/الدوري الإسباني/, "laliga"],
  [/الدوري الإيطالي/, "serie-a"],
  [/الدوري الألماني/, "german-bundesliga"],
  [/الدوري الفرنسي/, "french-ligue-1"],
  [/الدوري التركي/, "turkish-super-lig"],
  [/الدوري السعودي|دوري روشن السعودي/, "saudi-pro-league"],
  [/الدوري البرتغالي/, "portuguese-primeira-liga"],
  [/الدوري المصري/, "egyptian-premier-league"],
  [/دوري أبطال أوروبا/, "uefa-champions-league"],
  [/دوري أبطال إفريقيا|أبطال أفريقيا/, "caf-champions-league"],
  [/الدوري الهولندي/, "dutch-eredivisie"],
  [/الدوري البلجيكي/, "belgian-pro-league"],
];

function filGoalCompetitionHint(competition) {
  const found = FILGOAL_COMPETITION_HINTS.find(([pattern]) => pattern.test(String(competition || "")));
  return found ? found[1] : "";
}

function parseFilGoalMatches(html, requestedDate) {
  const matches = [];
  const cardPattern = /<div class="cin_cntnr">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<div class="match-aux">([\s\S]*?)<\/div>\s*<\/a>\s*<\/div>/g;
  let card;
  while ((card = cardPattern.exec(html))) {
    const body = card[2];
    const aux = card[3];
    const teams = [...body.matchAll(/<strong>([^<]+)<\/strong>/g)].map((entry) => decodeHtml(entry[1]).replace(/\s+/g, " ").trim());
    const dateMatch = aux.match(/(\d{2})-(\d{2})-(\d{4})\s*-\s*(\d{2}:\d{2})/);
    const channelMatch = aux.match(/<span>\s*<svg><use[^>]*#fb_screen[^>]*><\/use><\/svg>\s*([^<]+)<\/span>/);
    if (!dateMatch || teams.length < 2 || !channelMatch) continue;
    const sourceDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    if (!sourceDate || !channelMatch[1]) continue;
    const beforeCard = html.slice(0, card.index);
    const competitionMatch = [...beforeCard.matchAll(/<h6[^>]*>\s*<span>([^<]+)<\/span>/g)].at(-1);
    const href = decodeHtml(card[1]);
    matches.push({
      homeTeamAr: teams.at(-2),
      awayTeamAr: teams.at(-1),
      date: sourceDate,
      time: dateMatch[4],
      competitionAr: competitionMatch ? decodeHtml(competitionMatch[1]).replace(/\s+/g, " ").trim() : "",
      channel: decodeHtml(channelMatch[1]).replace(/\s+/g, " ").trim(),
      sourceUrl: new URL(href, FILGOAL_BASE).href,
      sourceDate: requestedDate,
    });
  }
  return matches;
}

async function fetchFilGoalDay(queryDate) {
  const html = await fetchText(`${FILGOAL_BASE}?date=${encodeURIComponent(queryDate)}`);
  return parseFilGoalMatches(html, queryDate);
}

function htmlText(value) {
  return decodeHtml(String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")).trim();
}

function koooraDailyTitle(queryDate) {
  const date = new Date(`${queryDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = localDateParts(date, KOOORA_TIME_ZONE);
  return `${parts.day} ${ARABIC_MONTHS[parts.month - 1]} ${parts.year}`;
}

function findKoooraDailyArticle(html, queryDate) {
  const target = koooraDailyTitle(queryDate);
  if (!target) return "";
  const cardPattern = /<a\s+class="fco-card"\s+href="([^"]+)"[\s\S]{0,6500}?<span class="fco-card__headline-text">([\s\S]*?)<\/span>/gi;
  let card;
  while ((card = cardPattern.exec(html))) {
    const headline = htmlText(card[2]);
    if (!headline.includes("جدول مباريات اليوم") || !headline.includes(target)) continue;
    try {
      return new URL(decodeHtml(card[1]), KOOORA_HOME).href;
    } catch (error) {
      return "";
    }
  }
  return "";
}

function koooraChannelAllowed(channel) {
  return /beIN|ثمانية|on\s*time|on\s*sport|أون\s*تايم|أون\s*سبورت|أبوظبي|ابوظبي|AD\s*Sports|SSC|الكأس|Al\s*Kass/i.test(String(channel || ""));
}

function parseKoooraMatches(html, queryDate, sourceUrl) {
  const expectedDate = koooraDailyTitle(queryDate);
  const articleDateMatch = htmlText(html.slice(0, Math.min(html.length, 180000))).match(/جدول مباريات اليوم[\s\S]{0,180}?([0-3]?\d)\s*-\s*(0?[1-9]|1[0-2])\s*-\s*(20\d{2})/);
  const articleDate = articleDateMatch
    ? `${articleDateMatch[3]}-${pad(articleDateMatch[2])}-${pad(articleDateMatch[1])}`
    : "";
  if (!expectedDate || articleDate !== queryDate) return [];
  const matches = [];
  const tablePattern = /<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]{0,1400}?<span class="fco-responsive-table">[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/gi;
  let table;
  while ((table = tablePattern.exec(html))) {
    const competitionAr = htmlText(table[1]);
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let row;
    while ((row = rowPattern.exec(table[2]))) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => htmlText(cell[1]));
      if (cells.length < 3 || !/^.+\s[-–—]\s.+$/.test(cells[0])) continue;
      const timeMatch = cells[1].match(/(\d{1,2}):(\d{2})/);
      const channel = cells[2].replace(/\s+/g, " ").trim();
      if (!timeMatch || !channel || !koooraChannelAllowed(channel)) continue;
      const teams = cells[0].split(/\s[-–—]\s/).map((team) => team.trim()).filter(Boolean);
      if (teams.length < 2) continue;
      matches.push({
        homeTeamAr: teams[0],
        awayTeamAr: teams.slice(1).join(" - "),
        date: queryDate,
        time: `${pad(timeMatch[1])}:${timeMatch[2]}`,
        competitionAr,
        channel,
        sourceUrl,
      });
    }
  }
  return matches;
}

async function fetchKoooraDays(queryDates) {
  const homeHtml = await fetchText(KOOORA_HOME);
  const results = await Promise.all(queryDates.map(async (queryDate) => {
    const articleUrl = findKoooraDailyArticle(homeHtml, queryDate);
    if (!articleUrl) return [];
    const articleHtml = await fetchText(articleUrl);
    return parseKoooraMatches(articleHtml, queryDate, articleUrl);
  }));
  return results.flat();
}

function matchFilGoalToFixture(sourceMatch, fixtures) {
  const sourceInstant = zonedDateTimeToUtc(sourceMatch.date, sourceMatch.time, FILGOAL_TIME_ZONE);
  if (!sourceInstant) return null;
  const hint = filGoalCompetitionHint(sourceMatch.competitionAr);
  const candidates = fixtures.filter((fixture) => {
    const fixtureInstant = dateFromValue(fixture.start);
    if (!fixtureInstant) return false;
    const minutes = Math.abs(fixtureInstant.getTime() - sourceInstant.getTime()) / 60000;
    if (minutes > 20) return false;
    return sourceCompetitionMatches(hint, fixture);
  });
  const namedCandidates = candidates.filter((fixture) => fixtureHasSourceTeams(sourceMatch, fixture));
  if (namedCandidates.length === 1) return namedCandidates[0];
  return candidates.length === 1 ? candidates[0] : null;
}

function normalizeChannelKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bhd\b/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function beINRightsFallback(match) {
  if (!match || !BEIN_RIGHTS_COMPETITIONS.has(match.competitionKey)) return null;
  return broadcasterEntry({
    name: "beIN SPORTS (MENA)",
    country: "Jordan",
    sourceName: "beIN SPORTS MENA guide and regional rights",
    sourceUrl: BEIN_MENA_GUIDE_URL,
    evidenceLevel: "official",
    accessType: "encrypted",
    accessSourceName: "beIN official FAQ and channel list",
    accessSourceUrl: BEIN_FAQ_URL,
  });
}

function mergeBroadcasters(...lists) {
  const unique = new Map();
  for (const entry of lists.flat()) {
    if (!entry || entry.verified !== true) continue;
    const key = normalizeChannelKey(entry.name);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...entry, evidenceUrls: [entry.sourceUrl], evidenceSources: [{ name: entry.sourceName, url: entry.sourceUrl }] });
      continue;
    }
    const evidenceUrls = [...new Set([...(existing.evidenceUrls || [existing.sourceUrl]), entry.sourceUrl].filter(Boolean))].slice(0, 4);
    const sourceNames = [...new Set([existing.sourceName, entry.sourceName].filter(Boolean))];
    const evidenceSources = [...(existing.evidenceSources || [{ name: existing.sourceName, url: existing.sourceUrl }]), { name: entry.sourceName, url: entry.sourceUrl }]
      .filter((source, index, all) => source.url && all.findIndex((candidate) => candidate.url === source.url) === index)
      .slice(0, 4);
    unique.set(key, {
      ...existing,
      sourceName: sourceNames.join(" + "),
      evidenceLevel: sourceNames.length > 1 ? "corroborated" : existing.evidenceLevel,
      evidenceUrls,
      evidenceSources,
    });
  }
  return [...unique.values()].slice(0, 8);
}

function mergeMatch(primary, secondary) {
  if (!primary) return { ...secondary };
  if (!secondary) return { ...primary };
  const primaryCompetition = primary.competition && primary.competition !== "Football" ? primary.competition : "";
  const secondaryCompetition = secondary.competition && secondary.competition !== "Football" ? secondary.competition : "";
  return {
    ...primary,
    start: primary.start || secondary.start,
    time: primary.time || secondary.time,
    homeLogo: primary.homeLogo || secondary.homeLogo,
    awayLogo: primary.awayLogo || secondary.awayLogo,
    competition: primaryCompetition || secondaryCompetition || primary.competition || secondary.competition || "Football",
    seasonSlug: primary.seasonSlug || secondary.seasonSlug || "",
    country: primary.country || secondary.country,
    venue: primary.venue || secondary.venue,
    status: primary.status || secondary.status,
    sourceIds: [...new Set([...(primary.sourceIds || []), ...(secondary.sourceIds || [])])],
    sourceUrl: primary.sourceUrl || secondary.sourceUrl,
    espnId: primary.espnId || secondary.espnId,
    sportsDbId: secondary.sportsDbId || primary.sportsDbId,
  };
}

const today = localToday();
const startDate = isoDate(today);
const endDate = isoDate(addDays(today, DAYS_AHEAD));
const dates = Array.from({ length: DAYS_AHEAD + 1 }, (_, index) => isoDate(addDays(today, index)));
const surroundingDates = [isoDate(addDays(today, -1)), ...dates, isoDate(addDays(today, DAYS_AHEAD + 1))];

const [espnResults, sportsDbResults, filGoalResults, koooraResults] = await Promise.all([
  Promise.allSettled(surroundingDates.map((date) => fetchEspnDay(date))),
  Promise.allSettled([fetchJordanLeague()]),
  Promise.allSettled(dates.map((date) => fetchFilGoalDay(date))),
  Promise.allSettled([fetchKoooraDays(dates)]),
]);

const espnSucceeded = espnResults.filter((result) => result.status === "fulfilled");
const sportsDbSucceeded = sportsDbResults.filter((result) => result.status === "fulfilled");
const filGoalSucceeded = filGoalResults.filter((result) => result.status === "fulfilled");
const koooraSucceeded = koooraResults.filter((result) => result.status === "fulfilled");
if (!espnSucceeded.length && !sportsDbSucceeded.length) {
  throw new Error("Both match data providers failed");
}

const merged = new Map();
for (const result of [...espnSucceeded, ...sportsDbSucceeded]) {
  for (const match of result.value) {
    if (!dates.includes(match.date)) continue;
    const current = merged.get(match.key);
    merged.set(match.key, mergeMatch(current, match));
  }
}

const tvCandidates = [...merged.values()].filter((match) => match.sportsDbId);
const tvResults = await Promise.allSettled(tvCandidates.map((match) => fetchSportsDbTv(match.sportsDbId)));
const tvByKey = new Map(tvCandidates.map((match, index) => [match.key, tvResults[index]]));

const filGoalByKey = new Map();
for (const result of filGoalSucceeded) {
  for (const sourceMatch of result.value) {
    const fixture = matchFilGoalToFixture(sourceMatch, [...merged.values()].filter((match) => match.date === sourceMatch.date));
    if (!fixture) continue;
    const broadcaster = broadcasterEntry({
      name: sourceMatch.channel,
      country: "Egypt",
      sourceName: "FilGoal match schedule",
      sourceUrl: sourceMatch.sourceUrl,
      evidenceLevel: "editorial",
    });
    if (!broadcaster) continue;
    const previous = filGoalByKey.get(fixture.key) || [];
    filGoalByKey.set(fixture.key, [...previous, broadcaster]);
  }
}

function matchKoooraToFixture(sourceMatch, fixtures) {
  const sourceInstant = zonedDateTimeToUtc(sourceMatch.date, sourceMatch.time, KOOORA_TIME_ZONE);
  if (!sourceInstant) return null;
  const hint = filGoalCompetitionHint(sourceMatch.competitionAr);
  const candidates = fixtures.filter((fixture) => {
    const fixtureInstant = dateFromValue(fixture.start);
    if (!fixtureInstant) return false;
    const minutes = Math.abs(fixtureInstant.getTime() - sourceInstant.getTime()) / 60000;
    if (minutes > 20) return false;
    return sourceCompetitionMatches(hint, fixture);
  });
  const namedCandidates = candidates.filter((fixture) => fixtureHasSourceTeams(sourceMatch, fixture));
  if (namedCandidates.length === 1) return namedCandidates[0];
  return candidates.length === 1 ? candidates[0] : null;
}

const koooraByKey = new Map();
for (const result of koooraSucceeded) {
  for (const sourceMatch of result.value) {
    const fixture = matchKoooraToFixture(sourceMatch, [...merged.values()].filter((match) => match.date === sourceMatch.date));
    if (!fixture) continue;
    const broadcaster = broadcasterEntry({
      name: sourceMatch.channel,
      country: "Egypt",
      sourceName: "Kooora daily broadcast table",
      sourceUrl: sourceMatch.sourceUrl,
      evidenceLevel: "editorial",
    });
    if (!broadcaster) continue;
    const previous = koooraByKey.get(fixture.key) || [];
    koooraByKey.set(fixture.key, [...previous, broadcaster]);
  }
}

const items = [...merged.values()]
  .map((match) => {
    const tvResult = tvByKey.get(match.key);
    const sportsDbBroadcasters = tvResult?.status === "fulfilled" ? tvResult.value : [];
    const filGoalBroadcasters = filGoalByKey.get(match.key) || [];
    const koooraBroadcasters = koooraByKey.get(match.key) || [];
    let broadcasters = mergeBroadcasters(sportsDbBroadcasters, filGoalBroadcasters, koooraBroadcasters);
    const rightsFallback = broadcasters.length ? null : beINRightsFallback(match);
    if (rightsFallback) broadcasters = [rightsFallback];
    const sourceIds = [...new Set([...(match.sourceIds || []), ...(filGoalBroadcasters.length ? ["filgoal-matches"] : []), ...(koooraBroadcasters.length ? ["kooora-broadcast"] : []), ...(rightsFallback ? ["bein-regional-rights"] : [])])];
    return {
      id: match.id,
      date: match.date,
      start: match.start,
      time: match.time,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeLogo: match.homeLogo || "",
      awayLogo: match.awayLogo || "",
      competition: match.competition || "Football",
      competitionKey: match.competitionKey || "football",
      country: match.country || "",
      venue: match.venue || "",
      broadcasters,
      sourceIds,
      sourceUrl: match.sourceUrl || "",
    };
  })
  .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.homeTeam.localeCompare(b.homeTeam));

if (!items.length && (espnSucceeded.length || sportsDbSucceeded.length)) {
  console.warn("No matches were returned for the current window; publishing an empty but valid schedule.");
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  timeZone: TIME_ZONE,
  window: { startDate, endDate, days: DAYS_AHEAD + 1 },
  mode: "selected-major-leagues-and-jordan-with-verified-regional-tv",
  sources: [
    { id: "espn-major-leagues", name: "ESPN public scoreboards for selected major leagues", ok: espnSucceeded.length > 0, requestedDays: surroundingDates.length, requestedLeagues: ESPN_MAJOR_LEAGUES.map((league) => league.id) },
    { id: "thesportsdb-jordan", name: "TheSportsDB Jordanian Pro League season", url: `https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id=${THESPORTSDB_JORDAN_LEAGUE_ID}&s=2026-2027`, ok: sportsDbSucceeded.length > 0, requestedDays: 1 },
    { id: "filgoal-matches", name: "FilGoal Arabic match schedule", url: FILGOAL_BASE, ok: filGoalSucceeded.length > 0, requestedDays: dates.length },
    { id: "kooora-broadcast", name: "Kooora Arabic daily broadcast tables", url: KOOORA_HOME, ok: koooraSucceeded.length > 0, requestedDays: dates.length },
    { id: "bein-access-rules", name: "beIN official FAQ and channel list", url: BEIN_FAQ_URL, relatedUrl: BEIN_CHANNEL_LIST_URL, ok: true, requestedDays: 1 },
    { id: "bein-regional-rights", name: "beIN SPORTS MENA guide and regional rights fallback", url: BEIN_MENA_GUIDE_URL, ok: true, requestedDays: dates.length, note: "Network-level fallback for Premier League, LaLiga, and Ligue 1; exact channel number is shown only when a dated listing provides it" },
    { id: "ad-sports-official", name: "Abu Dhabi Sports official brand source", url: AD_SPORTS_OFFICIAL_URL, ok: false, requestedDays: 0, note: "No dated public fixture listing was available" },
    { id: "on-sport-official", name: "ON Sport official public source", url: ON_SPORT_OFFICIAL_URL, ok: false, requestedDays: 0, note: "No dated public fixture listing was available" },
  ],
  broadcastCountries: [...TARGET_BROADCAST_COUNTRIES],
  coverageNote: "Only selected major competitions are published: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Scottish Premiership, UEFA Champions League, UEFA Europa League, and the Jordanian Pro League. Arabic/regional broadcaster metadata is shown when a dated match schedule is matched unambiguously. For Premier League, LaLiga, and Ligue 1, beIN SPORTS (MENA) may be shown as a network-level official rights fallback when no exact channel listing is available; the numbered channel is never guessed. beIN access labels use the official FAQ/channel-list rules; AD Sports, ON Sport, and Thmanyah remain unknown unless a dated source states the access type.",
  items,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const temporary = `${OUTPUT}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
fs.renameSync(temporary, OUTPUT);
console.log(`Football matches update wrote ${items.length} matches for ${startDate} through ${endDate}; matches with regional TV listings: ${items.filter((item) => item.broadcasters.length > 0).length}; FilGoal matched broadcaster listings: ${[...filGoalByKey.values()].reduce((sum, value) => sum + value.length, 0)}; Kooora matched broadcaster listings: ${[...koooraByKey.values()].reduce((sum, value) => sum + value.length, 0)}.`);
