import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const INTERVAL_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);

const ESPN_URL = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200';

function jordanParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '00';
  let hour = pick('hour');
  if (hour === '24') hour = '00';
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour, minute: pick('minute'), second: pick('second') };
}

function jordanIso(date = new Date()) {
  const p = jordanParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}

function normalizeText(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, ' ')
    .toLowerCase()
    .trim();
}

function getMatchId(match = {}) {
  return String(match.id || match.match_id || match.matchId || '').trim();
}

function getMatchTeams(match = {}) {
  const home = match.home_team || match.homeTeam || match.team1 || match.home || '';
  const away = match.away_team || match.awayTeam || match.team2 || match.away || '';
  return { home: String(home), away: String(away) };
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Maensat-WorldCup-Checker' } });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function extractEspnEvents(scoreboard) {
  const events = scoreboard?.events || [];
  return events.map(event => {
    const comp = event.competitions?.[0] || {};
    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};

    const statusType = comp.status?.type || event.status?.type || {};
    const state = String(statusType.state || '').toLowerCase();
    const completed = Boolean(statusType.completed || state === 'post' || state === 'final');

    return {
      id: String(event.id || ''),
      home: home.team?.displayName || home.team?.name || '',
      away: away.team?.displayName || away.team?.name || '',
      home_score: Number(home.score) || null,
      away_score: Number(away.score) || null,
      status: completed ? 'finished' : state === 'in' ? 'live' : 'scheduled',
      status_detail: statusType.name || statusType.description || '',
      date: event.date
    };
  });
}

async function main() {
  const nowIso = jordanIso();
  const espnResult = await fetchJson(ESPN_URL);
  const espnEvents = espnResult.ok ? extractEspnEvents(espnResult.data) : [];

  // Load matches.json
  const matchesPath = path.join(WC_DIR, 'matches.json');
  const { data: matchesData } = await readJson(matchesPath);

  if (matchesData && Array.isArray(matchesData.matches)) {
    let updated = 0;
    for (const match of matchesData.matches) {
      const espnMatch = espnEvents.find(e => 
        getMatchId(match) === e.id || 
        (normalizeText(getMatchTeams(match).home) === normalizeText(e.home) && 
         normalizeText(getMatchTeams(match).away) === normalizeText(e.away))
      );

      if (espnMatch) {
        match.status = espnMatch.status;
        match.home_score = espnMatch.home_score;
        match.away_score = espnMatch.away_score;
        match.live_status_detail = espnMatch.status_detail;
        match.last_live_update = nowIso;
        updated++;
      }
    }
    console.log(`Updated ${updated} matches status`);
  }

  // Save
  await writeJson(matchesPath, matchesData || { matches: [] });

  console.log(`✅ World Cup update completed at ${nowIso}`);
}

// Helper functions
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return { data: JSON.parse(raw) };
  } catch {
    return { data: null };
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

main().catch(console.error);
