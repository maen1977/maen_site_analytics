import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date).replace(' ', 'T') + '+03:00';
}

function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Maensat-WorldCup-Strong' } });
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

function extractEspnEvents(scoreboard) {
  const events = scoreboard?.events || [];
  return events.map(e => {
    const comp = e.competitions?.[0] || {};
    const comps = comp.competitors || [];
    const home = comps.find(c => c.homeAway === 'home') || comps[0] || {};
    const away = comps.find(c => c.homeAway === 'away') || comps[1] || {};
    const status = comp.status?.type || {};

    return {
      id: String(e.id || ''),
      num: e.number || null,
      home: home.team?.displayName || '',
      away: away.team?.displayName || '',
      home_score: Number(home.score) || null,
      away_score: Number(away.score) || null,
      status: status.completed ? 'finished' : status.state === 'in' ? 'live' : 'scheduled',
      status_detail: status.name || status.description || '',
      date: e.date
    };
  });
}

async function main() {
  const now = new Date();
  const nowIso = jordanIso(now);

  // 1. تحميل التصحيحات اليدوية (أولوية عالية)
  const overridesPath = path.join(WC_DIR, 'manual-results-overrides.json');
  let overrides = {};
  try {
    const raw = await fs.readFile(overridesPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.results && Array.isArray(parsed.results)) {
      for (const o of parsed.results) {
        if (o.id) overrides[o.id] = o;
      }
    }
  } catch {}

  // 2. جلب بيانات ESPN
  const espn = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200');
  const espnEvents = espn.ok ? extractEspnEvents(espn.data) : [];

  // 3. تحميل ملف المباريات
  const matchesPath = path.join(WC_DIR, 'matches.json');
  let data = { matches: [] };
  try {
    data = JSON.parse(await fs.readFile(matchesPath, 'utf8'));
  } catch {}

  let updated = 0;
  let overridden = 0;

  if (Array.isArray(data.matches)) {
    for (const match of data.matches) {
      // === أولوية 1: التصحيح اليدوي ===
      if (overrides[match.id]) {
        const o = overrides[match.id];
        match.status = o.status || match.status;
        match.home_score = o.home_score ?? match.home_score;
        match.away_score = o.away_score ?? match.away_score;
        match.live_status_detail = o.live_status_detail || 'انتهت المباراة (تصحيح يدوي)';
        match.score_source = 'manual-override';
        overridden++;
        updated++;
        continue; // ما نكملش على ESPN
      }

      // === أولوية 2: ESPN ===
      const espnMatch = espnEvents.find(e =>
        (e.id && String(match.id) === e.id) ||
        (normalize(match.team1 || match.home_team) === normalize(e.home) &&
         normalize(match.team2 || match.away_team) === normalize(e.away))
      );

      if (espnMatch) {
        match.status = espnMatch.status;
        if (espnMatch.home_score !== null) match.home_score = espnMatch.home_score;
        if (espnMatch.away_score !== null) match.away_score = espnMatch.away_score;
        match.live_status_detail = espnMatch.status_detail;
        match.last_live_update = nowIso;
        updated++;
      }

      // === أولوية 3: تحديث تلقائي ذكي ===
      if ((match.status === 'live' || match.status === 'مباشر' || match.status === 'scheduled') && match.kickoff_utc) {
        const kickoff = new Date(match.kickoff_utc);
        const hours = (now - kickoff) / (1000 * 60 * 60);

        if (hours > 3) {
          match.status = 'finished';
          match.live_status_detail = 'انتهت المباراة (تحديث تلقائي)';
          updated++;
        }
      }
    }

    // ترتيب المباريات
    data.matches.sort((a, b) => {
      const numA = Number(a.num || a.id?.replace('M', '') || 9999);
      const numB = Number(b.num || b.id?.replace('M', '') || 9999);
      return numA - numB;
    });
  }

  await fs.writeFile(matchesPath, JSON.stringify(data, null, 2));

  console.log(`[worldcup] Updated: ${updated} | Manual overrides applied: ${overridden} | ${nowIso}`);
}

main().catch(console.error);
