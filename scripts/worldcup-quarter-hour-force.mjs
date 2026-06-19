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
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Maensat-WorldCup-Checker' } 
    });
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
      match_number: e.number || null,
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

  // جلب البيانات من ESPN
  const espn = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200');
  const espnEvents = espn.ok ? extractEspnEvents(espn.data) : [];

  // تحميل ملف المباريات
  const matchesPath = path.join(WC_DIR, 'matches.json');
  let data = { matches: [] };

  try {
    data = JSON.parse(await fs.readFile(matchesPath, 'utf8'));
  } catch (e) {
    console.log("Could not read matches.json, starting fresh");
  }

  let updated = 0;

  if (Array.isArray(data.matches)) {
    for (const match of data.matches) {
      // تحسين المطابقة (بالـ ID أو بالاسم)
      const espnMatch = espnEvents.find(e => 
        (e.id && String(match.id) === e.id) ||
        (normalize(match.home_team) === normalize(e.home) && 
         normalize(match.away_team) === normalize(e.away))
      );

      if (espnMatch) {
        match.status = espnMatch.status;
        match.home_score = espnMatch.home_score;
        match.away_score = espnMatch.away_score;
        match.live_status_detail = espnMatch.status_detail;
        match.last_live_update = nowIso;
        updated++;
      }

      // تحديث تلقائي ذكي
      if ((match.status === 'live' || match.status === 'مباشر' || match.status === 'scheduled') && match.kickoff_utc) {
        const kickoff = new Date(match.kickoff_utc);
        const hoursPassed = (now - kickoff) / (1000 * 60 * 60);

        if (hoursPassed > 3 && (match.home_score !== null || match.away_score !== null)) {
          match.status = 'finished';
          match.live_status_detail = 'انتهت المباراة (تحديث تلقائي)';
          updated++;
        }
      }
    }

    // ترتيب المباريات حسب رقم المباراة
    data.matches.sort((a, b) => {
      const numA = Number(a.match_number || a.id) || 9999;
      const numB = Number(b.match_number || b.id) || 9999;
      return numA - numB;
    });
  }

  // حفظ الملف
  await fs.writeFile(matchesPath, JSON.stringify(data, null, 2));

  console.log(`[worldcup] Updated ${updated} matches | Sorted by match number | ${nowIso}`);
}

main().catch(console.error);
