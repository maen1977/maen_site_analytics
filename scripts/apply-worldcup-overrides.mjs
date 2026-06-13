import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const matchesPath = path.join(repoRoot, 'public', 'worldcup-2026', 'matches.json');
const standingsPath = path.join(repoRoot, 'public', 'worldcup-2026', 'standings.json');
const overridesPath = path.join(repoRoot, 'public', 'worldcup-2026', 'manual-results-overrides.json');

function ammanTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getScore(match) {
  const home = Number(match.home_score);
  const away = Number(match.away_score);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function applyOverrides(matchesData, overrides) {
  const matches = Array.isArray(matchesData.matches) ? matchesData.matches : [];
  const byId = new Map(matches.map((match) => [String(match.id), match]));
  const applied = [];

  for (const override of overrides.results || []) {
    const id = String(override.id || '');
    const match = byId.get(id);
    if (!match) {
      console.warn(`⚠️ لم أجد مباراة بالمعرّف ${id}; تم تجاهلها.`);
      continue;
    }

    match.status = override.status ?? match.status ?? 'finished';
    match.home_score = Number(override.home_score);
    match.away_score = Number(override.away_score);
    match.score = override.score ?? {
      ft: [match.home_score, match.away_score],
      source: override.score_source || 'manual',
      status_detail: override.live_status_detail || 'FT'
    };
    match.score_source = override.score_source || 'manual';
    match.live_clock = override.live_clock ?? null;
    match.live_status_detail = override.live_status_detail || 'FT';

    // Keep the public Arabic label cleaner. The old file used "أمريكا"; both work,
    // but "الولايات المتحدة" is clearer for a public World Cup section.
    if (override.team1_ar) match.team1_ar = override.team1_ar;
    if (override.team2_ar) match.team2_ar = override.team2_ar;

    applied.push(`${id}: ${match.team1} ${match.home_score}-${match.away_score} ${match.team2}`);
  }

  return applied;
}

function buildStandings(matchesData, previousStandingsData = null) {
  const groups = matchesData.groups || {};
  const teamAr = matchesData.team_ar || {};
  const tableByGroup = {};

  for (const [group, teams] of Object.entries(groups)) {
    tableByGroup[group] = new Map();
    for (const team of teams) {
      tableByGroup[group].set(team, {
        team,
        team_ar: teamAr[team] || team,
        group,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,
        points: 0,
        rank: 0,
        qualified: false
      });
    }
  }

  for (const match of matchesData.matches || []) {
    if (match.stage && match.stage !== 'Group Stage') continue;
    if (!match.group || !tableByGroup[match.group]) continue;
    if (match.status !== 'finished') continue;

    const score = getScore(match);
    if (!score) continue;

    const groupTable = tableByGroup[match.group];
    const home = groupTable.get(match.team1);
    const away = groupTable.get(match.team2);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goals_for += score.home;
    home.goals_against += score.away;
    away.goals_for += score.away;
    away.goals_against += score.home;

    if (score.home > score.away) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (score.home < score.away) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const standings = Object.entries(tableByGroup).map(([group, rowsMap]) => {
    const rows = Array.from(rowsMap.values()).map((row) => ({
      ...row,
      goal_diff: row.goals_for - row.goals_against
    })).sort((a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      a.team.localeCompare(b.team)
    ).map((row, index) => ({
      ...row,
      rank: index + 1,
      // Your current standings file marks ranks 1-3 as qualified/candidate.
      // Keeping that behavior avoids breaking the front-end display.
      qualified: index < 3
    }));

    return { group, rows };
  }).sort((a, b) => a.group.localeCompare(b.group));

  const now = ammanTimestamp();
  const previousMeta = previousStandingsData?.metadata || {};
  return {
    metadata: {
      ...previousMeta,
      name: previousMeta.name || matchesData.metadata?.name || 'كأس العالم 2026',
      english_name: previousMeta.english_name || matchesData.metadata?.english_name || 'World Cup 2026',
      source: matchesData.metadata?.source || previousMeta.source || 'matches.json',
      last_updated: now,
      last_checked_at: now,
      timezone: 'Asia/Amman',
      total_matches: matchesData.metadata?.total_matches || (matchesData.matches || []).length,
      teams_count: matchesData.metadata?.teams_count || Object.values(groups).flat().length,
      groups_count: matchesData.metadata?.groups_count || Object.keys(groups).length,
      manual_overrides_applied: true
    },
    standings
  };
}

const matchesData = await readJson(matchesPath);
const overrides = await readJson(overridesPath);
let previousStandings = null;
try {
  previousStandings = await readJson(standingsPath);
} catch {
  previousStandings = null;
}

const applied = applyOverrides(matchesData, overrides);
const now = ammanTimestamp();

matchesData.metadata = {
  ...(matchesData.metadata || {}),
  last_updated: now,
  last_checked_at: now,
  manual_overrides_applied: true,
  manual_overrides_file: 'public/worldcup-2026/manual-results-overrides.json'
};

const standingsData = buildStandings(matchesData, previousStandings);

await writeJson(matchesPath, matchesData);
await writeJson(standingsPath, standingsData);

if (applied.length) {
  console.log('✅ Applied World Cup manual overrides:');
  for (const item of applied) console.log(`- ${item}`);
} else {
  console.log('ℹ️ No manual overrides were applied.');
}
console.log('✅ Rebuilt standings.json from finished group-stage matches.');
