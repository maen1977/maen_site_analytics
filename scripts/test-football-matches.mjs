import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "public/data/football-matches.json"), "utf8"));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const targetCountries = new Set(["Jordan", "Palestine", "Lebanon", "Syria", "Iraq", "Egypt"]);
const statuses = new Set(["scheduled", "live", "completed", "postponed", "cancelled"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

assert(data.schemaVersion === 1, "Football matches schema version must be 1");
assert(data.timeZone === "Asia/Amman", "Football matches must use Asia/Amman timezone");
assert(data.mode === "free-hybrid-fixtures-with-verified-regional-tv", "Football matches must use the free hybrid mode");
assert(data.window && datePattern.test(data.window.startDate) && datePattern.test(data.window.endDate), "Match window dates are invalid");
assert(data.window.days === 8, "Match window must cover today plus seven days");
assert(Array.isArray(data.broadcastCountries) && data.broadcastCountries.length === targetCountries.size, "Broadcast country allowlist is incomplete");
assert(data.broadcastCountries.every((country) => targetCountries.has(country)), "Broadcast country allowlist contains an unsupported country");
assert(Array.isArray(data.sources) && data.sources.some((source) => source.id === "espn-public-soccer"), "ESPN fixture source is missing");
assert(data.sources.some((source) => source.id === "thesportsdb-free"), "TheSportsDB verification source is missing");
assert(Array.isArray(data.items) && data.items.length <= 2000, "Football matches payload is too large");

const ids = new Set();
const keys = new Set();
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
  assert(typeof item.time === "string" && /^\d{2}:\d{2}$/.test(item.time), "Match time must be HH:MM");
  assert(statuses.has(item.status), "Match status is invalid");
  assert(Array.isArray(item.sourceIds) && item.sourceIds.length > 0, "Every match must include a source");
  assert(Array.isArray(item.broadcasters), "Broadcasters must be an array");
  assert(item.broadcastStatus === (item.broadcasters.length ? "verified" : "not-verified"), "Broadcast status must reflect verified entries");
  for (const broadcaster of item.broadcasters) {
    assert(broadcaster && broadcaster.verified === true, "Every broadcaster must be explicitly verified");
    assert(typeof broadcaster.name === "string" && broadcaster.name.length > 0 && broadcaster.name.length <= 120, "Broadcaster name is invalid");
    assert(targetCountries.has(broadcaster.country), "Broadcaster country is outside the target region");
  }
}

console.log(`Football matches checks passed (${data.items.length} matches; ${data.items.filter((item) => item.broadcastStatus === "verified").length} verified regional TV listings)`);
