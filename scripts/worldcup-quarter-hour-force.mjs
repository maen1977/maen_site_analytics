import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const INTERVAL_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);
const ESPN_URL = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200';

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date).replace(' ', 'T') + '+03:00';
}

function normalizeText(input) {
  return String(input || '').toLowerCase().trim();
}

function parseDateMaybe(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Maensat-WorldCup' } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
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
    const completed = Boolean(statusType.completed);

    return {
      id: String(event.id || ''),
      home: home.team?.displayName || '',
      away: away.team?.displayName || '',
      home_score: Number(home.score) || null,
      away_score: Number(away.score) || null,
      status: completed ? 'finished' : state === 'in' ? 'live' : 'scheduled',
      status_detail: statusType.name || statusType.description || '',
      date: event.date
    };
  });
}

async function main() {
  const now = new Date();
  const nowIso = jordanIso(now);

  const espnResult = await fetchJson(ESPN_URL);
  const espnEvents = espnResult.ok ? extractEspnEvents(espnResult.data) : [];

  const matchesPath = path.join(WC_DIR, 'matches.json');
  let matchesData = { matches: [] };

  try {
    const raw = await fs.readFile(matchesPath, 'utf8');
    matchesData = JSON.parse(raw);
  } catch {}

  if (Array.isArray(matchesData.matches)) {
    let updated = 0;

    for (const match of matchesData.matches) {
      // 1. تحديث من ESPN
      const espnMatch = espnEvents.find(e =>
        e.id === String(match.id) ||
        (normalizeText(match.home_team) === normalizeText(e.home) &&
         normalizeText(match.away_team) === normalizeText(e.away))
      );

      if (espnMatch) {
        match.status = espnMatch.status;
        match.home_score = espnMatch.home_score;
        match.away_score = espnMatch.away_score;
        match.live_status_detail = espnMatch.status_detail;
        match.last_live_update = nowIso;
        updated++;
      }

      // 2. تحديث تلقائي: أي مباراة "مباشر" مر عليها أكثر من 3 ساعات → تحولها لـ "انتهت"
      if ((match.status === 'live' || match.status === 'مباشر') && match.kickoff_utc) {
        const kickoff = parseDateMaybe(match.kickoff_utc);
        if (kickoff) {
          const hoursSinceStart = (now - kickoff) / (1000 * 60 * 60);
          if (hoursSinceStart > 3) {
            match.status = 'finished';
            match.live_status_detail = 'انتهت المباراة (تحديث تلقائي)';
            updated++;
          }
        }
      }
    }

    console.log(`[worldcup] Updated ${updated} matches`);
  }

  // حفظ الملف
  await fs.mkdir(WC_DIR, { recursive: true });
  await fs.writeFile(matchesPath, JSON.stringify(matchesData, null, 2));

  console.log(`[worldcup] Done at ${nowIso}`);
}

main().catch(console.error);
