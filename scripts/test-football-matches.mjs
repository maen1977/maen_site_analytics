import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/football-matches.json"), "utf8"));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const targetCountries = new Set(["Jordan", "Palestine", "Lebanon", "Syria", "Iraq", "Egypt"]);
const accessTypes = new Set(["fta", "encrypted", "unknown"]);
const evidenceLevels = new Set(["official", "editorial", "corroborated"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedSourceDomains = [
  "filgoal.com",
  "kooora.com",
  "beinsports.com",
  "bein.com",
  "admn.ae",
  "adsports.ae",
  "ontimesports.com",
  "thesportsdb.com",
  "petra.gov.jo",
  "jfa.jo",
];
const officialSourceDomains = new Set(["beinsports.com", "bein.com", "admn.ae", "adsports.ae", "ontimesports.com", "petra.gov.jo", "jfa.jo"]);

function hostAllowed(url, domains) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch (error) {
    return false;
  }
}

function isIsoTimestamp(value) {
  const date = new Date(value);
  return typeof value === "string" && value.length >= 20 && Number.isFinite(date.getTime()) && value.includes("T");
}

assert(data.schemaVersion === 1, "Football matches schema version must be 1");
assert(data.timeZone === "Asia/Amman", "Football matches must use Asia/Amman timezone");
assert(data.mode === "all-published-competitions-with-verified-regional-tv", "Football matches must use the all published competitions mode");
assert(data.window && datePattern.test(data.window.startDate) && datePattern.test(data.window.endDate), "Match window dates are invalid");
assert(data.window.days === 8, "Match window must cover today plus seven days");
assert(Array.isArray(data.broadcastCountries) && data.broadcastCountries.length === targetCountries.size, "Broadcast country allowlist is incomplete");
assert(data.broadcastCountries.every((country) => targetCountries.has(country)), "Broadcast country allowlist contains an unsupported country");
assert(Array.isArray(data.sources) && data.sources.some((source) => source.id === "espn-major-leagues"), "Selected ESPN league source is missing");
assert(data.sources.some((source) => source.id === "thesportsdb-jordan"), "Jordanian Pro League source is missing");
assert(data.sources.some((source) => source.id === "filgoal-matches"), "FilGoal Arabic broadcaster source is missing");
assert(data.sources.some((source) => source.id === "kooora-broadcast"), "Kooora Arabic broadcaster source is missing");
assert(data.sources.some((source) => source.id === "bein-access-rules"), "beIN access rules source is missing");
assert(data.sources.some((source) => source.id === "jordan-tv-rights"), "Jordan TV rights source is missing");
assert(Array.isArray(data.items) && data.items.length <= 2000, "Football matches payload is too large");

const ids = new Set();
const keys = new Set();
let verifiedBroadcasterCount = 0;
for (const item of data.items) {
  assert(item && typeof item === "object", "Every match must be an object");
  assert(typeof item.id === "string" && item.id.length >= 12 && !ids.has(item.id), "Every match id must be unique and bounded");
  ids.add(item.id);
  assert(datePattern.test(item.date) && item.date >= data.window.startDate && item.date <= data.window.endDate, "Match date is outside the published window");
  assert(typeof item.homeTeam === "string" && item.homeTeam.length > 0 && item.homeTeam.length <= 120, "Home team is invalid");
  assert(typeof item.awayTeam === "string" && item.awayTeam.length > 0 && item.awayTeam.length <= 120, "Away team is invalid");
  const key = `${item.date}|${item.homeTeam.toLowerCase()}|${item.awayTeam.toLowerCase()}`;
  assert(!keys.has(key), "Duplicate match teams and date detected");
  keys.add(key);
  assert(typeof item.competition === "string" && item.competition.length > 0 && item.competition.length <= 140, "Competition is invalid");
  assert(typeof item.competitionKey === "string" && item.competitionKey.length > 0 && item.competitionKey.length <= 80, "Competition key is invalid");
  assert(typeof item.time === "string" && /^\d{2}:\d{2}$/.test(item.time), "Match time must be HH:MM");
  assert(!Object.prototype.hasOwnProperty.call(item, "status"), "Match status must not be published");
  assert(!Object.prototype.hasOwnProperty.call(item, "broadcastStatus"), "Broadcast status must not be published as a match result state");
  assert(Array.isArray(item.sourceIds) && item.sourceIds.length > 0, "Every match must include a source");
  assert(Array.isArray(item.broadcasters), "Broadcasters must be an array");
  assert(item.broadcasters.length <= 8, "Broadcaster list must be bounded");
  for (const broadcaster of item.broadcasters) {
    assert(broadcaster && broadcaster.verified === true, "Every broadcaster must be explicitly verified");
    assert(typeof broadcaster.name === "string" && broadcaster.name.length > 0 && broadcaster.name.length <= 120, "Broadcaster name is invalid");
    assert(typeof broadcaster.nameAr === "string" && broadcaster.nameAr.length > 0 && broadcaster.nameAr.length <= 120, "Broadcaster Arabic name is invalid");
    assert(typeof broadcaster.nameEn === "string" && broadcaster.nameEn.length > 0 && broadcaster.nameEn.length <= 120, "Broadcaster English/brand name is invalid");
    assert(targetCountries.has(broadcaster.country), "Broadcaster country is outside the target region");
    assert(targetCountries.has(broadcaster.region), "Broadcaster region is outside the target region");
    assert(accessTypes.has(broadcaster.accessType), "Broadcaster accessType must be fta, encrypted, or unknown");
    assert(evidenceLevels.has(broadcaster.evidenceLevel), "Broadcaster evidenceLevel is invalid");
    assert(typeof broadcaster.sourceName === "string" && broadcaster.sourceName.length > 0 && broadcaster.sourceName.length <= 120, "Broadcaster sourceName is invalid");
    assert(typeof broadcaster.sourceUrl === "string" && /^https:\/\//i.test(broadcaster.sourceUrl), "Broadcaster sourceUrl must be HTTPS");
    assert(hostAllowed(broadcaster.sourceUrl, allowedSourceDomains), `Broadcaster source host is not allowlisted: ${broadcaster.sourceUrl}`);
    if (broadcaster.evidenceUrls !== undefined) {
      assert(Array.isArray(broadcaster.evidenceUrls) && broadcaster.evidenceUrls.length >= 1 && broadcaster.evidenceUrls.length <= 4, "Broadcaster evidenceUrls must be a bounded array");
      assert(broadcaster.evidenceUrls.every((url) => /^https:\/\//i.test(url) && hostAllowed(url, allowedSourceDomains)), "Every broadcaster evidence URL must be HTTPS and allowlisted");
    }
    if (broadcaster.evidenceSources !== undefined) {
      assert(Array.isArray(broadcaster.evidenceSources) && broadcaster.evidenceSources.length >= 1 && broadcaster.evidenceSources.length <= 4, "Broadcaster evidenceSources must be a bounded array");
      assert(broadcaster.evidenceSources.every((source) => source && typeof source.name === "string" && source.name.length > 0 && /^https:\/\//i.test(source.url) && hostAllowed(source.url, allowedSourceDomains)), "Every broadcaster evidence source must have an HTTPS allowlisted URL");
    }
    if (broadcaster.evidenceLevel === "official") {
      assert(hostAllowed(broadcaster.sourceUrl, [...officialSourceDomains]), "Official broadcaster evidence must come from an official broadcaster domain");
    }
    if (broadcaster.accessType !== "unknown") {
      assert(typeof broadcaster.accessSourceUrl === "string" && /^https:\/\//i.test(broadcaster.accessSourceUrl), "Non-unknown access type requires a separate HTTPS access source");
      assert(hostAllowed(broadcaster.accessSourceUrl, [...officialSourceDomains]), "Non-unknown access type must cite an official broadcaster access source");
      assert(typeof broadcaster.accessSourceName === "string" && broadcaster.accessSourceName.length > 0, "Non-unknown access type requires an access source name");
    }
    if (broadcaster.accessSourceUrl) {
      assert(/^https:\/\//i.test(broadcaster.accessSourceUrl) && hostAllowed(broadcaster.accessSourceUrl, allowedSourceDomains), `Broadcaster access source is not allowlisted: ${broadcaster.accessSourceUrl}`);
    }
    assert(isIsoTimestamp(broadcaster.verifiedAt), "Broadcaster verifiedAt must be an ISO timestamp");
    verifiedBroadcasterCount += 1;
  }
}

console.log(`Football matches checks passed (${data.items.length} matches; ${verifiedBroadcasterCount} verified regional TV listings; access types are explicit)`);
