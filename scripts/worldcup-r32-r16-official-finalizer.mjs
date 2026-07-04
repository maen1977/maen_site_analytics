#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION = '20260704-r32-r16-official-finalizer-v1';
const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const FILES = {
  matches: path.join(WC_DIR, 'matches.json'),
  bracket: path.join(WC_DIR, 'bracket.json'),
  knockoutLive: path.join(WC_DIR, 'knockout-live.json'),
  overrides: path.join(WC_DIR, 'manual-results-overrides.json'),
  status: path.join(WC_DIR, 'r32-r16-official-finalizer-status.json'),
};
const TIMEZONE = 'Asia/Amman';

const TEAMS = {
  Canada: ['Canada', 'كندا'], Morocco: ['Morocco', 'المغرب'], Paraguay: ['Paraguay', 'باراغواي'], France: ['France', 'فرنسا'],
  Brazil: ['Brazil', 'البرازيل'], Norway: ['Norway', 'النرويج'], Mexico: ['Mexico', 'المكسيك'], England: ['England', 'إنجلترا'],
  Portugal: ['Portugal', 'البرتغال'], Spain: ['Spain', 'إسبانيا'], USA: ['USA', 'أمريكا'], Belgium: ['Belgium', 'بلجيكا'],
  Argentina: ['Argentina', 'الأرجنتين'], Egypt: ['Egypt', 'مصر'], Switzerland: ['Switzerland', 'سويسرا'], Colombia: ['Colombia', 'كولومبيا'],
  Australia: ['Australia', 'أستراليا'], CapeVerde: ['Cape Verde', 'الرأس الأخضر'], Ghana: ['Ghana', 'غانا'],
  SouthAfrica: ['South Africa', 'جنوب أفريقيا'], Japan: ['Japan', 'اليابان'], Germany: ['Germany', 'ألمانيا'], Netherlands: ['Netherlands', 'هولندا'],
  IvoryCoast: ['Ivory Coast', 'كوت ديفوار'], Sweden: ['Sweden', 'السويد'], Ecuador: ['Ecuador', 'الإكوادور'], DRCongo: ['DR Congo', 'الكونغو الديمقراطية'],
  Senegal: ['Senegal', 'السنغال'], Bosnia: ['Bosnia & Herzegovina', 'البوسنة والهرسك'], Austria: ['Austria', 'النمسا'], Croatia: ['Croatia', 'كرواتيا'], Algeria: ['Algeria', 'الجزائر'],
};

const R32 = {
  M073: { number: 73, teams: [TEAMS.SouthAfrica, TEAMS.Canada], slots: ['2A','2B'], score: [0,1], winner: 2, phase: 'finished' },
  M074: { number: 74, teams: [TEAMS.Germany, TEAMS.Paraguay], slots: ['1E','3A/B/C/D/F'], score: [1,1], pens: [3,4], winner: 2, phase: 'finished_on_penalties' },
  M075: { number: 75, teams: [TEAMS.Netherlands, TEAMS.Morocco], slots: ['1F','2C'], score: [1,1], pens: [2,3], winner: 2, phase: 'finished_on_penalties' },
  M076: { number: 76, teams: [TEAMS.Brazil, TEAMS.Japan], slots: ['1C','2F'], score: [2,1], winner: 1, phase: 'finished' },
  M077: { number: 77, teams: [TEAMS.France, TEAMS.Sweden], slots: ['1I','3C/D/F/G/H'], score: [3,0], winner: 1, phase: 'finished' },
  M078: { number: 78, teams: [TEAMS.IvoryCoast, TEAMS.Norway], slots: ['2E','2I'], score: [1,2], winner: 2, phase: 'finished' },
  M079: { number: 79, teams: [TEAMS.Mexico, TEAMS.Ecuador], slots: ['1A','3C/E/F/H/I'], score: [2,0], winner: 1, phase: 'finished' },
  M080: { number: 80, teams: [TEAMS.England, TEAMS.DRCongo], slots: ['1L','3E/H/I/J/K'], score: [2,1], winner: 1, phase: 'finished' },
  M081: { number: 81, teams: [TEAMS.USA, TEAMS.Bosnia], slots: ['1D','3B/E/F/I/J'], score: [2,0], winner: 1, phase: 'finished' },
  M082: { number: 82, teams: [TEAMS.Belgium, TEAMS.Senegal], slots: ['1G','3A/E/H/I/J'], score: [3,2], winner: 1, phase: 'finished' },
  M083: { number: 83, teams: [TEAMS.Portugal, TEAMS.Croatia], slots: ['2K','2L'], score: [2,1], winner: 1, phase: 'finished' },
  M084: { number: 84, teams: [TEAMS.Spain, TEAMS.Austria], slots: ['1H','2J'], score: [3,0], winner: 1, phase: 'finished' },
  M085: { number: 85, teams: [TEAMS.Switzerland, TEAMS.Algeria], slots: ['1B','3E/F/G/I/J'], score: [2,0], winner: 1, phase: 'finished' },
  M086: { number: 86, teams: [TEAMS.Argentina, TEAMS.CapeVerde], slots: ['1J','2H'], score: [3,2], winner: 1, phase: 'finished_after_extra_time' },
  M087: { number: 87, teams: [TEAMS.Colombia, TEAMS.Ghana], slots: ['1K','3D/E/I/J/L'], score: [1,0], winner: 1, phase: 'finished' },
  M088: { number: 88, teams: [TEAMS.Australia, TEAMS.Egypt], slots: ['2D','2G'], score: [1,1], pens: [2,4], winner: 2, phase: 'finished_on_penalties' },
};

const R16 = {
  M089: { number: 89, teams: [TEAMS.Paraguay, TEAMS.France], slots: ['W74','W77'] },
  M090: { number: 90, teams: [TEAMS.Canada, TEAMS.Morocco], slots: ['W73','W75'] },
  M091: { number: 91, teams: [TEAMS.Brazil, TEAMS.Norway], slots: ['W76','W78'] },
  M092: { number: 92, teams: [TEAMS.Mexico, TEAMS.England], slots: ['W79','W80'] },
  M093: { number: 93, teams: [TEAMS.Portugal, TEAMS.Spain], slots: ['W83','W84'] },
  M094: { number: 94, teams: [TEAMS.USA, TEAMS.Belgium], slots: ['W81','W82'] },
  M095: { number: 95, teams: [TEAMS.Argentina, TEAMS.Egypt], slots: ['W86','W88'] },
  M096: { number: 96, teams: [TEAMS.Switzerland, TEAMS.Colombia], slots: ['W85','W87'] },
};

function ammanIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T');
  return `${parts}+03:00`;
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}
function numFromId(id) { return Number(String(id || '').replace(/\D/g, '')); }
function idOf(m) {
  const id = String(m?.id || '').match(/M\d{3}/i)?.[0]?.toUpperCase();
  if (id) return id;
  const n = Number(m?.number ?? m?.num ?? m?.match_number ?? m?.matchNumber);
  return Number.isFinite(n) ? `M${String(n).padStart(3,'0')}` : '';
}
function status(key, labelAr, label = null) {
  return { key, state: key === 'scheduled' ? 'scheduled' : 'finished', label_ar: labelAr, label: label || labelAr };
}
function phaseLabel(phase) {
  if (phase === 'finished_on_penalties') return ['انتهت بركلات الترجيح', 'Finished on penalties'];
  if (phase === 'finished_after_extra_time') return ['انتهت بعد التمديد', 'Finished after extra time'];
  return ['انتهت', 'Finished'];
}
function teamObj(team, slot) {
  return { name_ar: team[1], name_en: team[0], group: '', position: '', slot, unresolved: false, resolved_from: slot };
}
function setNumbers(m, n) {
  m.id = `M${String(n).padStart(3, '0')}`;
  m.num = n;
  m.number = n;
  m.match_number = n;
  m.matchNumber = n;
  m.display_number = n;
}
function clearScores(m) {
  for (const k of ['score1','score2','team1_score','team2_score','team1Score','team2Score','home_score','away_score','homeScore','awayScore','penalty1','penalty2','penalty_home_score','penalty_away_score','home_penalties','away_penalties','team1_penalties','team2_penalties','winner_side','loser_side']) {
    if (k in m) m[k] = null;
  }
  if ('score_ft' in m) m.score_ft = null;
  if ('score_et' in m) m.score_et = null;
  if ('score_penalties' in m) m.score_penalties = null;
  m.score = null;
  m.score_text = null;
}
function applyTextMatch(m, fix, nowIso, round) {
  const before = JSON.stringify(m);
  setNumbers(m, fix.number);
  m.round = round === 16 ? 'Round of 16' : 'Round of 32';
  m.stage = m.round;
  m.stage_ar = round === 16 ? 'دور 16' : 'دور 32';
  m.team1 = fix.teams[0][0];
  m.team2 = fix.teams[1][0];
  m.team1_ar = fix.teams[0][1];
  m.team2_ar = fix.teams[1][1];
  m.team1_slot = fix.slots[0];
  m.team2_slot = fix.slots[1];
  m.team1_original_slot = fix.slots[0];
  m.team2_original_slot = fix.slots[1];
  m.team1_seed = fix.slots[0];
  m.team2_seed = fix.slots[1];
  m.team1_source_slot = fix.slots[0];
  m.team2_source_slot = fix.slots[1];
  m.team1_resolved_from = fix.slots[0];
  m.team2_resolved_from = fix.slots[1];
  m.team1_resolution_status = 'resolved';
  m.team2_resolution_status = 'resolved';
  m.team1_resolution_source = fix.slots[0];
  m.team2_resolution_source = fix.slots[1];
  if (round === 32) {
    const [labelAr, labelEn] = phaseLabel(fix.phase);
    const [a, b] = fix.score;
    m.status = status(fix.phase, labelAr, labelEn);
    m.status_key = fix.phase;
    m.status_ar = labelAr;
    m.phase = fix.phase;
    m.home_score = a; m.away_score = b; m.homeScore = a; m.awayScore = b;
    m.score1 = a; m.score2 = b; m.team1_score = a; m.team2_score = b; m.team1Score = a; m.team2Score = b;
    m.score_text = `${a} - ${b}`;
    m.winner_side = fix.winner;
    m.loser_side = fix.winner === 1 ? 2 : 1;
    m.score = {
      source: 'r32-r16-official-finalizer',
      status: 'finished',
      phase: fix.phase,
      phase_ar: labelAr,
      status_detail: labelEn,
      current: [a, b],
      checked_at: nowIso,
      winner_side: fix.winner,
    };
    if (fix.phase === 'finished_after_extra_time') m.score.et = [a, b];
    else m.score.ft = [a, b];
    if (fix.pens) {
      const [p1, p2] = fix.pens;
      m.penalty1 = p1; m.penalty2 = p2; m.penalty_home_score = p1; m.penalty_away_score = p2;
      m.home_penalties = p1; m.away_penalties = p2; m.team1_penalties = p1; m.team2_penalties = p2;
      m.score.p = [p1, p2];
      m.score.penalties = { home: p1, away: p2, team1: p1, team2: p2 };
      m.score.et = [a, b];
    } else {
      for (const k of ['penalty1','penalty2','penalty_home_score','penalty_away_score','home_penalties','away_penalties','team1_penalties','team2_penalties']) if (k in m) m[k] = null;
    }
    m.score_source = 'r32-r16-official-finalizer';
    m.live_score_source = 'r32-r16-official-finalizer';
    m.live_phase = fix.phase;
    m.live_phase_ar = labelAr;
    m.live_status_detail = labelAr;
    m.live_clock = null;
    m.verified = true;
    m.locked = true;
    m.official_finalized_at = nowIso;
  } else {
    clearScores(m);
    m.status = status('scheduled', 'لم تبدأ', 'Scheduled');
    m.status_key = 'scheduled';
    m.status_ar = 'لم تبدأ';
    m.phase = 'scheduled';
    m.live_phase = 'scheduled';
    m.live_phase_ar = 'لم تبدأ';
    m.live_status_detail = 'Scheduled';
    m.live_clock = null;
    m.score_source = 'scheduled';
    m.official_pairing_finalized_at = nowIso;
  }
  m.search_text = [m.team1, m.team2, m.team1_ar, m.team2_ar, m.ground, m.stadium, m.round, m.stage_ar, `Match ${fix.number}`].filter(Boolean).join(' ');
  return JSON.stringify(m) !== before;
}
function applyLiveMatch(m, fix, nowIso, round) {
  const before = JSON.stringify(m);
  setNumbers(m, fix.number);
  m.stage_key = round === 16 ? 'round16' : 'round32';
  m.stage_ar = round === 16 ? 'دور الـ16' : 'دور الـ32';
  m.stage_order = round === 16 ? 2 : 1;
  m.team1 = teamObj(fix.teams[0], fix.slots[0]);
  m.team2 = teamObj(fix.teams[1], fix.slots[1]);
  m.source_slot1 = fix.slots[0];
  m.source_slot2 = fix.slots[1];
  if (round === 32) {
    const [labelAr, labelEn] = phaseLabel(fix.phase);
    const [a, b] = fix.score;
    m.status = status(fix.phase, labelAr, labelEn);
    m.status_key = fix.phase;
    m.status_ar = labelAr;
    m.phase = fix.phase;
    m.score1 = a; m.score2 = b; m.team1_score = a; m.team2_score = b; m.team1Score = a; m.team2Score = b;
    m.home_score = a; m.away_score = b; m.homeScore = a; m.awayScore = b;
    m.score_ft = fix.phase === 'finished_after_extra_time' ? null : [a, b];
    m.score_et = fix.phase === 'finished_after_extra_time' || fix.pens ? [a, b] : null;
    m.score_text = `${a} - ${b}`;
    m.winner_side = fix.winner;
    if (fix.pens) {
      const [p1, p2] = fix.pens;
      m.penalty1 = p1; m.penalty2 = p2; m.score_penalties = [p1, p2];
      m.penalty_home_score = p1; m.penalty_away_score = p2; m.home_penalties = p1; m.away_penalties = p2; m.team1_penalties = p1; m.team2_penalties = p2;
    } else {
      m.penalty1 = m.penalty2 = m.score_penalties = null;
      m.penalty_home_score = m.penalty_away_score = m.home_penalties = m.away_penalties = m.team1_penalties = m.team2_penalties = null;
    }
    m.score_source = 'r32-r16-official-finalizer';
    m.official_finalized_at = nowIso;
  } else {
    clearScores(m);
    m.status = status('scheduled', 'لم تبدأ', 'Scheduled');
    m.status_key = 'scheduled';
    m.status_ar = 'لم تبدأ';
    m.phase = 'scheduled';
    m.score_ft = null; m.score_et = null; m.score_penalties = null;
    m.official_pairing_finalized_at = nowIso;
  }
  return JSON.stringify(m) !== before;
}
function allKnockoutLiveMatches(bundle) {
  const out = [];
  if (Array.isArray(bundle?.matches)) out.push(...bundle.matches);
  for (const r of (Array.isArray(bundle?.rounds) ? bundle.rounds : [])) {
    if (Array.isArray(r.matches)) out.push(...r.matches);
  }
  return out;
}
function applyBundle(bundle, live = false, nowIso) {
  if (!bundle || !Array.isArray(bundle.matches)) return { changed: 0, checked: 0 };
  const targets = live ? allKnockoutLiveMatches(bundle) : bundle.matches;
  let changed = 0, checked = 0;
  for (const m of targets) {
    const id = idOf(m);
    if (R32[id]) { checked++; if ((live ? applyLiveMatch : applyTextMatch)(m, R32[id], nowIso, 32)) changed++; }
    else if (R16[id]) { checked++; if ((live ? applyLiveMatch : applyTextMatch)(m, R16[id], nowIso, 16)) changed++; }
  }
  if (bundle.metadata && typeof bundle.metadata === 'object') {
    bundle.metadata.r32_r16_official_finalized_at = nowIso;
    bundle.metadata.r32_r16_official_finalizer_version = VERSION;
  }
  if (bundle.summary && typeof bundle.summary === 'object') {
    bundle.summary.r32_r16_official_finalized_at = nowIso;
  }
  if (Array.isArray(bundle.dynamic_advancement_checks)) {
    const resolved = {
      'M095:team1': TEAMS.Argentina[1], 'M095:team2': TEAMS.Egypt[1],
      'M096:team1': TEAMS.Switzerland[1], 'M096:team2': TEAMS.Colombia[1],
    };
    for (const c of bundle.dynamic_advancement_checks) {
      const key = `${c.match}:${c.side}`;
      if (resolved[key]) {
        c.resolved_team_ar = resolved[key];
        c.unresolved = false;
        c.ok = true;
      }
    }
  }
  return { changed, checked };
}
function overrideFromFix(id, fix) {
  const n = fix.number; const [a,b] = fix.score; const [labelAr, labelEn] = phaseLabel(fix.phase);
  const o = {
    id, num: n, number: n, match_number: n,
    team1: fix.teams[0][0], team2: fix.teams[1][0], team1_ar: fix.teams[0][1], team2_ar: fix.teams[1][1],
    stage: 'Round of 32', stage_ar: 'دور 32', status: fix.phase,
    home_score: a, away_score: b, score1: a, score2: b,
    winner_side: fix.winner, loser_side: fix.winner === 1 ? 2 : 1,
    score: { source: 'manual-official-finalizer', status: 'finished', phase: fix.phase, phase_ar: labelAr, status_detail: labelEn, current: [a,b], winner_side: fix.winner },
    score_source: 'manual-official-finalizer', live_phase: fix.phase, live_phase_ar: labelAr, live_status_detail: labelAr,
    verified: true, locked: true, force: true,
    note_ar: `تثبيت رسمي: ${fix.teams[0][1]} ${a}-${b} ${fix.teams[1][1]}${fix.pens ? `، الترجيح ${fix.pens[0]}-${fix.pens[1]}` : ''}.`,
  };
  if (fix.phase === 'finished_after_extra_time') o.score.et = [a,b]; else o.score.ft = [a,b];
  if (fix.pens) {
    const [p1,p2] = fix.pens;
    Object.assign(o, { penalty_home_score: p1, penalty_away_score: p2, home_penalties: p1, away_penalties: p2, team1_penalties: p1, team2_penalties: p2 });
    o.score.et = [a,b]; o.score.p = [p1,p2]; o.score.penalties = { home: p1, away: p2, team1: p1, team2: p2 };
  }
  return o;
}
async function updateOverrides(nowIso) {
  const data = await readJson(FILES.overrides, { metadata: {}, results: [] });
  data.metadata = { ...(data.metadata || {}), updated_at: nowIso, r32_r16_official_finalizer_version: VERSION, note_ar: 'تصحيحات نهائية موثقة لدور 32 وتمرير فائزين صحيحين لدور 16.' };
  const byId = new Map((data.results || []).map(x => [x.id, x]));
  for (const id of ['M086','M087','M088']) byId.set(id, overrideFromFix(id, R32[id]));
  data.results = Array.from(byId.values()).sort((a,b) => (Number(a.num || a.number || 0) - Number(b.num || b.number || 0)) || String(a.id).localeCompare(String(b.id)));
  await writeJson(FILES.overrides, data);
  return { results: data.results.length };
}

async function main() {
  const nowIso = ammanIso();
  const matches = await readJson(FILES.matches);
  const bracket = await readJson(FILES.bracket);
  const knockout = await readJson(FILES.knockoutLive);
  const a = applyBundle(matches, false, nowIso);
  const b = applyBundle(bracket, false, nowIso);
  const c = applyBundle(knockout, true, nowIso);
  if (matches) await writeJson(FILES.matches, matches);
  if (bracket) await writeJson(FILES.bracket, bracket);
  if (knockout) await writeJson(FILES.knockoutLive, knockout);
  const o = await updateOverrides(nowIso);
  const status = {
    version: VERSION,
    updated_at: nowIso,
    files: { matches: a, bracket: b, knockout_live: c, manual_overrides: o },
    fixed_results: {
      M086: 'Argentina 3-2 Cape Verde, AET',
      M087: 'Colombia 1-0 Ghana',
      M088: 'Australia 1-1 Egypt, Egypt 4-2 pens',
    },
    fixed_round16: {
      M089: 'Paraguay vs France', M090: 'Canada vs Morocco', M091: 'Brazil vs Norway', M092: 'Mexico vs England',
      M093: 'Portugal vs Spain', M094: 'USA vs Belgium', M095: 'Argentina vs Egypt', M096: 'Switzerland vs Colombia',
    },
    note_ar: 'يفصل هذا الإصلاح بين ترتيب العرض حسب توقيت الأردن وبين رقم المباراة الرسمي، ويمنع عودة نتائج دور 32 أو أزواج دور 16 إلى قيم قديمة.',
  };
  await writeJson(FILES.status, status);
  console.log(JSON.stringify(status, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
