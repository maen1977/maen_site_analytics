import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/data/football-matches.json");
const TIME_ZONE = "Asia/Amman";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const DAYS_AHEAD = 7;
const FETCH_TIMEOUT_MS = 20000;
const TARGET_BROADCAST_COUNTRIES = new Set(["Jordan", "Palestine", "Lebanon", "Syria", "Iraq", "Egypt"]);

const pad = (value) => String(value).padStart(2, "0");
const isoDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const addDays = (date, amount) => new Date(date.getTime() + amount * 86400000);

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
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

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "maensat-football-matches/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toEspnMatch(event, requestedDate) {
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
    competition: compact(event?.league?.name || event?.season?.displayName || "Football", 140),
    country: compact(event?.league?.country || competition?.venue?.address?.country || "", 80),
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
    country: compact(event?.strCountry || "", 80),
    venue: compact(event?.strVenue || "", 140),
    status: compact(event?.strStatus || "NS", 40),
    sourceIds: ["thesportsdb-free"],
    sourceUrl: event?.idEvent ? `https://www.thesportsdb.com/event/${encodeURIComponent(event.idEvent)}` : "",
    sportsDbId: compact(event?.idEvent, 40),
  };
}

async function fetchEspnDay(queryDate) {
  const payload = await fetchJson(`${ESPN_BASE}?dates=${queryDate.replaceAll("-", "")}&limit=500`);
  return (payload.events || []).map((event) => toEspnMatch(event, queryDate)).filter(Boolean);
}

async function fetchSportsDbDay(queryDate) {
  const payload = await fetchJson(`${SPORTSDB_BASE}/eventsday.php?d=${queryDate}&s=Soccer`);
  return (payload.events || []).map((event) => toSportsDbMatch(event, queryDate)).filter(Boolean);
}

async function fetchSportsDbTv(eventId) {
  if (!eventId) return [];
  const payload = await fetchJson(`${SPORTSDB_BASE}/lookuptv.php?id=${encodeURIComponent(eventId)}`);
  return (payload.tvevent || [])
    .filter((entry) => TARGET_BROADCAST_COUNTRIES.has(String(entry.strCountry || "").trim()))
    .map((entry) => ({
      name: compact(entry.strChannel, 120),
      country: compact(entry.strCountry, 60),
      time: compact(entry.strTime, 20),
      verified: true,
      source: "TheSportsDB TV listing",
    }))
    .filter((entry) => entry.name && entry.country);
}

function mergeMatch(primary, secondary) {
  if (!primary) return { ...secondary };
  if (!secondary) return { ...primary };
  return {
    ...primary,
    start: primary.start || secondary.start,
    time: primary.time || secondary.time,
    homeLogo: primary.homeLogo || secondary.homeLogo,
    awayLogo: primary.awayLogo || secondary.awayLogo,
    competition: primary.competition || secondary.competition,
    country: primary.country || secondary.country,
    venue: primary.venue || secondary.venue,
    status: primary.status || secondary.status,
    sourceIds: [...new Set([...(primary.sourceIds || []), ...(secondary.sourceIds || [])])],
    sourceUrl: primary.sourceUrl || secondary.sourceUrl,
    espnId: primary.espnId || secondary.espnId,
    sportsDbId: secondary.sportsDbId || primary.sportsDbId,
  };
}

function statusLabel(value) {
  const status = String(value || "").toLowerCase();
  if (status.includes("postpon")) return "postponed";
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("in_progress") || status === "live") return "live";
  if (status.includes("final") || status === "post") return "completed";
  return "scheduled";
}

const today = localToday();
const startDate = isoDate(today);
const endDate = isoDate(addDays(today, DAYS_AHEAD));
const dates = Array.from({ length: DAYS_AHEAD + 1 }, (_, index) => isoDate(addDays(today, index)));
const surroundingDates = [isoDate(addDays(today, -1)), ...dates, isoDate(addDays(today, DAYS_AHEAD + 1))];

const [espnResults, sportsDbResults] = await Promise.all([
  Promise.allSettled(surroundingDates.map((date) => fetchEspnDay(date))),
  Promise.allSettled(dates.map((date) => fetchSportsDbDay(date))),
]);

const espnSucceeded = espnResults.filter((result) => result.status === "fulfilled");
const sportsDbSucceeded = sportsDbResults.filter((result) => result.status === "fulfilled");
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

const items = [...merged.values()]
  .map((match) => {
    const tvResult = tvByKey.get(match.key);
    const broadcasters = tvResult?.status === "fulfilled" ? tvResult.value : [];
    return {
      id: match.id,
      date: match.date,
      start: match.start,
      time: match.time,
      status: statusLabel(match.status),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeLogo: match.homeLogo || "",
      awayLogo: match.awayLogo || "",
      competition: match.competition || "Football",
      country: match.country || "",
      venue: match.venue || "",
      broadcasters,
      broadcastStatus: broadcasters.length ? "verified" : "not-verified",
      sourceIds: match.sourceIds,
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
  mode: "free-hybrid-fixtures-with-verified-regional-tv",
  sources: [
    { id: "espn-public-soccer", name: "ESPN public soccer scoreboard", ok: espnSucceeded.length > 0, requestedDays: surroundingDates.length },
    { id: "thesportsdb-free", name: "TheSportsDB free API", ok: sportsDbSucceeded.length > 0, requestedDays: dates.length },
  ],
  broadcastCountries: [...TARGET_BROADCAST_COUNTRIES],
  coverageNote: "Fixtures are collected from public football schedules. TV channels are shown only when a target-country listing is verified; no channel is inferred.",
  items,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const temporary = `${OUTPUT}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
fs.renameSync(temporary, OUTPUT);
console.log(`Football matches update wrote ${items.length} matches for ${startDate} through ${endDate}; verified regional TV listings: ${items.filter((item) => item.broadcastStatus === "verified").length}.`);
