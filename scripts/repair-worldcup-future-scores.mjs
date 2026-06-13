import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const MATCHES_FILE = path.join(WC_DIR, 'matches.json');
const STANDINGS_FILE = path.join(WC_DIR, 'standings.json');

function ammanTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function writeJson(file, data) { await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8'); }
function matchesArray(bundle) { return Array.isArray(bundle.matches) ? bundle.matches : (Array.isArray(bundle) ? bundle : []); }
function kickoffMs(m = {}) {
  for (const raw of [m.kickoff_utc, m.kickoff_jordan, m.datetime_utc, m.datetime]) {
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isFinite(t)) return t;
  }
  return NaN;
}
function isManualFinished(m = {}) {
  const source = String(m.score_source || m.score?.source || '').toLowerCase();
  return source.includes('manual') && String(m.status || '').toLowerCase() === 'finished';
}
function looksImpossible(m = {}) {
  const hs = Number(m.home_score);
  const as = Number(m.away_score);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return false;
  if (hs > 15 || as > 15) return true;
  const source = String(m.score_source || m.score?.source || '').toLowerCase();
  if (source.includes('bein') && (hs === 22 || as === 22 || hs === 19 || as === 19)) return true;
  return false;
}
function resetScheduled(m) {
  m.status = 'scheduled';
  m.home_score = 0;
  m.away_score = 0;
  m.score = null;
  m.score_source = 'schedule-not-result';
  m.live_clock = null;
  m.live_status_detail = null;
  delete m.score_sources;
}
function emptyRow(team, teamAr, group) {
  return { team, team_ar: teamAr || team, group, played:0, wins:0, draws:0, losses:0, goals_for:0, goals_against:0, goal_diff:0, points:0, rank:null, qualified:false };
}
function rebuildStandings(bundle) {
  const matches = matchesArray(bundle);
  const groups = bundle.groups || {};
  const standings = [];
  for (const group of Object.keys(groups).sort()) {
    const teams = groups[group] || [];
    const rows = new Map();
    for (const team of teams) rows.set(team, emptyRow(team, bundle.team_ar?.[team], group));
    for (const m of matches.filter(x => x.group === group && x.status === 'finished')) {
      const a = rows.get(m.team1), b = rows.get(m.team2);
      if (!a || !b) continue;
      const s1 = Number(m.home_score), s2 = Number(m.away_score);
      if (!Number.isFinite(s1) || !Number.isFinite(s2)) continue;
      a.played++; b.played++;
      a.goals_for += s1; a.goals_against += s2;
      b.goals_for += s2; b.goals_against += s1;
      if (s1 > s2) { a.wins++; b.losses++; a.points += 3; }
      else if (s2 > s1) { b.wins++; a.losses++; b.points += 3; }
      else { a.draws++; b.draws++; a.points++; b.points++; }
    }
    for (const r of rows.values()) r.goal_diff = r.goals_for - r.goals_against;
    const sorted = [...rows.values()].sort((a,b) => b.points-a.points || b.goal_diff-a.goal_diff || b.goals_for-a.goals_for || a.team.localeCompare(b.team));
    sorted.forEach((r,i) => { r.rank = i+1; r.qualified = i < 2; });
    standings.push({ group, rows: sorted });
  }
  const best_thirds = standings.map(g => g.rows[2]).filter(Boolean).sort((a,b) => b.points-a.points || b.goal_diff-a.goal_diff || b.goals_for-a.goals_for || a.team.localeCompare(b.team));
  best_thirds.forEach((r,i) => { r.qualified = i < 8; });
  return { metadata: { last_updated: ammanTimestamp(), source: 'repair-worldcup-future-scores' }, standings, best_thirds };
}

const bundle = await readJson(MATCHES_FILE);
const now = Date.now();
const repaired = [];
for (const m of matchesArray(bundle)) {
  if (isManualFinished(m)) continue;
  const ko = kickoffMs(m);
  const future = Number.isFinite(ko) && now < ko - 5 * 60000;
  if ((future && m.status !== 'scheduled') || (future && (Number(m.home_score) !== 0 || Number(m.away_score) !== 0 || m.score)) || looksImpossible(m)) {
    repaired.push(`${m.id}: ${m.team1} vs ${m.team2}`);
    resetScheduled(m);
  }
}
bundle.metadata ||= {};
bundle.metadata.last_updated = ammanTimestamp();
bundle.metadata.last_checked_at = ammanTimestamp();
bundle.metadata.emergency_score_repair = {
  enabled: true,
  repaired_count: repaired.length,
  repaired,
  note_ar: 'إزالة أي نتيجة غير منطقية أو نتيجة لمباراة مستقبلية. يمنع تحويل وقت المباراة مثل 22:00 إلى 22-0.'
};
await writeJson(MATCHES_FILE, bundle);
await writeJson(STANDINGS_FILE, rebuildStandings(bundle));
console.log(`[worldcup-repair] repaired ${repaired.length} suspicious/future score(s).`);
