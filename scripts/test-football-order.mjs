import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payload = JSON.parse(fs.readFileSync(path.join(root, "public/data/football-matches.json"), "utf8"));
const key = (match) => `${match.date || "9999-12-31"}T${match.time || "99:99"}`;
const groups = new Map();
for (const match of payload.items || []) {
  const list = groups.get(match.competitionKey) || [];
  list.push(match);
  groups.set(match.competitionKey, list);
}
let checked = 0;
for (const [competition, matches] of groups) {
  const sorted = matches.slice().sort((a, b) => key(a).localeCompare(key(b)) || a.homeTeam.localeCompare(b.homeTeam) || a.awayTeam.localeCompare(b.awayTeam));
  for (let index = 0; index < matches.length; index += 1) {
    if (matches[index].id !== sorted[index].id) throw new Error(`Chronological order failed for ${competition} at index ${index}`);
    checked += 1;
  }
}
console.log(`Football chronological order passed (${checked} matches across ${groups.size} competitions)`);
