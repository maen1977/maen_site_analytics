import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const NOW = new Date();
const VERSION = '2026-07-12-semifinals-official-lock-v2';
const nowAmman = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Amman', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
}).format(NOW).replace(' ', 'T') + '+03:00';

const TEAM_AR = {
  'Argentina':'الأرجنتين','Cape Verde':'الرأس الأخضر','Colombia':'كولومبيا','Ghana':'غانا','Australia':'أستراليا','Egypt':'مصر',
  'Canada':'كندا','Morocco':'المغرب','Paraguay':'باراغواي','France':'فرنسا','Brazil':'البرازيل','Norway':'النرويج','Mexico':'المكسيك','England':'إنجلترا',
  'Portugal':'البرتغال','Spain':'إسبانيا','USA':'أمريكا','Belgium':'بلجيكا','Switzerland':'سويسرا','Winner of match 89':'الفائز من مباراة 89'
};

const FINAL_STATUS = Object.freeze({ key:'finished', state:'finished', label_ar:'انتهت', label:'Full Time' });
const FINAL_AET_STATUS = Object.freeze({ key:'finished', state:'finished', label_ar:'انتهت بعد التمديد', label:'Final Score - After Extra Time' });
const FINAL_PEN_STATUS = Object.freeze({ key:'finished', state:'finished', label_ar:'انتهت بركلات الترجيح', label:'Final Score - After Penalties' });
const SCHEDULED_STATUS = Object.freeze({ key:'scheduled', state:'scheduled', label_ar:'لم تبدأ', label:'Scheduled' });
const LIVE_STATUS = Object.freeze({ key:'live', state:'live', label_ar:'مباشر', label:'Live' });
const PENDING_STATUS = Object.freeze({ key:'pending_verification', state:'pending_verification', label_ar:'بانتظار التحديث', label:'Awaiting update' });

const OFFICIAL_RESULTS = {
  M086: { number:86, stage:'Round of 32', team1:'Argentina', team2:'Cape Verde', slot1:'W86', slot2:'W88', score:[3,2], winnerSide:1, phase:'finished_after_extra_time', phaseAr:'انتهت بعد التمديد', status:FINAL_AET_STATUS, note_ar:'الأرجنتين فازت 3-2 على الرأس الأخضر بعد التمديد.' },
  M087: { number:87, stage:'Round of 32', team1:'Colombia', team2:'Ghana', slot1:'W85', slot2:'W87', score:[1,0], winnerSide:1, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'كولومبيا فازت 1-0 على غانا.' },
  M088: { number:88, stage:'Round of 32', team1:'Australia', team2:'Egypt', slot1:'W86', slot2:'W88', score:[1,1], penalties:[2,4], winnerSide:2, phase:'finished_on_penalties', phaseAr:'انتهت بركلات الترجيح', status:FINAL_PEN_STATUS, note_ar:'مصر فازت 4-2 على أستراليا بركلات الترجيح بعد التعادل 1-1.' },
  M089: { number:89, stage:'Round of 16', team1:'Paraguay', team2:'France', slot1:'W74', slot2:'W77', score:[0,1], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'فرنسا فازت 1-0 على باراغواي وتأهلت إلى ربع النهائي.' },
  M090: { number:90, stage:'Round of 16', team1:'Canada', team2:'Morocco', slot1:'W73', slot2:'W75', score:[0,3], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'المغرب فاز 3-0 على كندا وتأهل إلى ربع النهائي.' },
  M091: { number:91, stage:'Round of 16', team1:'Brazil', team2:'Norway', slot1:'W76', slot2:'W78', score:[1,2], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'النرويج فازت 2-1 على البرازيل وتأهلت إلى ربع النهائي.' },
  M092: { number:92, stage:'Round of 16', team1:'Mexico', team2:'England', slot1:'W79', slot2:'W80', score:[2,3], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'إنجلترا فازت 3-2 على المكسيك وتأهلت إلى ربع النهائي.' },
  M093: { number:93, stage:'Round of 16', team1:'Portugal', team2:'Spain', slot1:'W83', slot2:'W84', score:[0,1], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'إسبانيا فازت 1-0 على البرتغال وتأهلت إلى ربع النهائي.' },
  M094: { number:94, stage:'Round of 16', team1:'USA', team2:'Belgium', slot1:'W81', slot2:'W82', score:[1,4], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'بلجيكا فازت 4-1 على أمريكا وتأهلت إلى ربع النهائي.' },
  M095: { number:95, stage:'Round of 16', team1:'Argentina', team2:'Egypt', slot1:'W86', slot2:'W88', score:[3,2], winnerSide:1, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'الأرجنتين فازت 3-2 على مصر وتأهلت إلى ربع النهائي.' },
  M096: { number:96, stage:'Round of 16', team1:'Switzerland', team2:'Colombia', slot1:'W85', slot2:'W87', score:[0,0], penalties:[4,3], winnerSide:1, phase:'finished_on_penalties', phaseAr:'انتهت بركلات الترجيح', status:FINAL_PEN_STATUS, note_ar:'سويسرا فازت 4-3 على كولومبيا بركلات الترجيح بعد التعادل 0-0 وتأهلت إلى ربع النهائي.' },
  M097: { number:97, stage:'Quarter-final', team1:'France', team2:'Morocco', slot1:'W89', slot2:'W90', score:[2,0], winnerSide:1, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'فرنسا فازت 2-0 على المغرب وتأهلت إلى نصف النهائي.' },
  M098: { number:98, stage:'Quarter-final', team1:'Spain', team2:'Belgium', slot1:'W93', slot2:'W94', score:[2,1], winnerSide:1, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'إسبانيا فازت 2-1 على بلجيكا وتأهلت إلى نصف النهائي.' },
  M099: { number:99, stage:'Quarter-final', team1:'Norway', team2:'England', slot1:'W91', slot2:'W92', score:[1,2], winnerSide:2, phase:'finished', phaseAr:'انتهت', status:FINAL_STATUS, note_ar:'إنجلترا فازت 2-1 على النرويج وتأهلت إلى نصف النهائي.' },
  M100: { number:100, stage:'Quarter-final', team1:'Argentina', team2:'Switzerland', slot1:'W95', slot2:'W96', score:[3,1], winnerSide:1, phase:'finished_after_extra_time', phaseAr:'انتهت بعد التمديد', status:FINAL_AET_STATUS, note_ar:'الأرجنتين فازت 3-1 على سويسرا بعد التمديد وتأهلت لمواجهة إنجلترا في نصف النهائي.' }
};

const OFFICIAL_PAIRINGS = {
  M089: { number:89, team1:'Paraguay', team2:'France', slot1:'W74', slot2:'W77' },
  M090: { number:90, team1:'Canada', team2:'Morocco', slot1:'W73', slot2:'W75' },
  M091: { number:91, team1:'Brazil', team2:'Norway', slot1:'W76', slot2:'W78' },
  M092: { number:92, team1:'Mexico', team2:'England', slot1:'W79', slot2:'W80' },
  M093: { number:93, team1:'Portugal', team2:'Spain', slot1:'W83', slot2:'W84' },
  M094: { number:94, team1:'USA', team2:'Belgium', slot1:'W81', slot2:'W82' },
  M095: { number:95, team1:'Argentina', team2:'Egypt', slot1:'W86', slot2:'W88' },
  M096: { number:96, team1:'Switzerland', team2:'Colombia', slot1:'W85', slot2:'W87' },
  M097: { number:97, team1:'France', team2:'Morocco', slot1:'W89', slot2:'W90' },
  M098: { number:98, team1:'Spain', team2:'Belgium', slot1:'W93', slot2:'W94' },
  M099: { number:99, team1:'Norway', team2:'England', slot1:'W91', slot2:'W92' },
  M100: { number:100, team1:'Argentina', team2:'Switzerland', slot1:'W95', slot2:'W96' },
  M101: { number:101, team1:'France', team2:'Spain', slot1:'W97', slot2:'W98' },
  M102: { number:102, team1:'England', team2:'Argentina', slot1:'W99', slot2:'W100' }
};

function readJson(file) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
function writeJson(file, data) {
  const target = path.join(DATA_DIR, file);
  let eol = '\n';
  try {
    if (fs.readFileSync(target, 'utf8').includes('\r\n')) eol = '\r\n';
  } catch {}
  fs.writeFileSync(target, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol);
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function teamAr(name) { return TEAM_AR[name] || name; }
function matchNumFromId(id) { const n = Number(String(id || '').replace(/^M0*/, '')); return Number.isFinite(n) ? n : null; }
function isKoObjectMatch(m) { return m && typeof m.team1 === 'object' && m.team1 !== null; }
function isFinishedStatus(m) {
  const s = normalizeStatusText(m);
  return /finished|complete|full[_\s-]?time|final|ended|ft|aet|انته/.test(s);
}
function normalizeStatusText(m) {
  const parts = [];
  const st = m?.status;
  if (typeof st === 'string') parts.push(st);
  else if (st && typeof st === 'object') parts.push(st.key, st.state, st.label, st.label_ar);
  const sc = m?.score;
  if (sc && typeof sc === 'object') parts.push(sc.status, sc.phase, sc.phase_ar, sc.status_detail);
  parts.push(m?.phase, m?.live_phase, m?.live_phase_ar, m?.live_status_detail, m?.status_key, m?.status_ar);
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function setNumberFields(m, number) {
  if (!number) return;
  m.number = number;
  m.match_number = number;
  m.matchNumber = number;
  m.display_number = number;
  if ('num' in m) m.num = number;
}
function setStatus(m, status, phase, phaseAr) {
  m.status = clone(status);
  m.status_key = status.key;
  m.status_ar = status.label_ar;
  m.phase = phase || status.key;
  m.live_phase = phase || status.key;
  m.live_phase_ar = phaseAr || status.label_ar;
  m.live_status_detail = phaseAr || status.label_ar;
  if (status.key === 'finished') {
    m.live_clock = 'FT';
    m.live_period = null;
  } else if (status.key === 'scheduled') {
    m.live_clock = "0'";
    m.live_period = null;
  }
}
function setFlatTeams(m, team1, team2, slot1, slot2, unresolved1=false, unresolved2=false) {
  m.team1 = team1;
  m.team2 = team2;
  m.team1_ar = teamAr(team1);
  m.team2_ar = teamAr(team2);
  if (slot1) { m.team1_slot = slot1; m.team1_source_slot = slot1; m.team1_seed = slot1; m.team1_original_slot = slot1; m.source_slot1 = slot1; }
  if (slot2) { m.team2_slot = slot2; m.team2_source_slot = slot2; m.team2_seed = slot2; m.team2_original_slot = slot2; m.source_slot2 = slot2; }
  m.team1_resolution_status = unresolved1 ? 'unresolved' : 'resolved';
  m.team2_resolution_status = unresolved2 ? 'unresolved' : 'resolved';
  m.team1_resolved_from = slot1 || m.team1_resolved_from;
  m.team2_resolved_from = slot2 || m.team2_resolved_from;
}
function makeTeamObj(name, slot, unresolved=false) {
  return { name_ar: teamAr(name), name_en: name, group: '', position: '', slot, unresolved: Boolean(unresolved), resolved_from: unresolved ? undefined : slot };
}
function setKoTeams(m, team1, team2, slot1, slot2, unresolved1=false, unresolved2=false) {
  m.team1 = makeTeamObj(team1, slot1, unresolved1);
  m.team2 = makeTeamObj(team2, slot2, unresolved2);
  m.source_slot1 = slot1;
  m.source_slot2 = slot2;
}
function clearScoreFields(m) {
  for (const k of ['home_score','away_score','score1','score2','homeScore','awayScore','team1_score','team2_score','team1Score','team2Score','penalty1','penalty2','penalty_home_score','penalty_away_score','home_penalties','away_penalties','team1_penalties','team2_penalties']) {
    if (k in m) m[k] = null;
  }
  m.score = null;
  m.score_ft = null;
  m.score_et = null;
  m.score_penalties = null;
  m.score_text = null;
  m.winner_side = null;
  m.loser_side = null;
  m.winner = null;
  m.winner_ar = null;
}
function setBaseScoreFields(m, score1, score2) {
  m.home_score = score1;
  m.away_score = score2;
  m.score1 = score1;
  m.score2 = score2;
  m.homeScore = score1;
  m.awayScore = score2;
  m.team1_score = score1;
  m.team2_score = score2;
  m.team1Score = score1;
  m.team2Score = score2;
  m.score_text = `${score1} - ${score2}`;
}
function applyOfficialResult(m, result, ko=false) {
  setNumberFields(m, result.number || matchNumFromId(m.id));
  const slot1 = result.slot1 || m.team1_slot || m.source_slot1;
  const slot2 = result.slot2 || m.team2_slot || m.source_slot2;
  if (ko) setKoTeams(m, result.team1, result.team2, slot1, slot2);
  else setFlatTeams(m, result.team1, result.team2, slot1, slot2);
  setBaseScoreFields(m, result.score[0], result.score[1]);
  if (Array.isArray(result.penalties)) {
    const [p1,p2] = result.penalties;
    m.penalty1 = p1; m.penalty2 = p2;
    m.penalty_home_score = p1; m.penalty_away_score = p2;
    m.home_penalties = p1; m.away_penalties = p2;
    m.team1_penalties = p1; m.team2_penalties = p2;
    m.score_penalties = [p1,p2];
    m.score_text = `${result.score[0]} - ${result.score[1]} (${p1} - ${p2} ترجيح)`;
  } else {
    for (const k of ['penalty1','penalty2','penalty_home_score','penalty_away_score','home_penalties','away_penalties','team1_penalties','team2_penalties']) if (k in m) m[k] = null;
    m.score_penalties = null;
  }
  m.winner_side = result.winnerSide;
  m.loser_side = result.winnerSide === 1 ? 2 : 1;
  const winnerName = result.winnerSide === 1 ? result.team1 : result.team2;
  m.winner = winnerName;
  m.winner_ar = teamAr(winnerName);
  m.score_source = 'manual-official-finalizer';
  m.live_score_source = 'manual-official-finalizer';
  m.score_updated_by = 'worldcup-canonical-finalizer';
  m.canonical_locked = true;
  m.official_result_locked = true;
  m.official_result_checked_at = nowAmman;
  m.note_ar = result.note_ar;
  setStatus(m, result.status, result.phase, result.phaseAr);
  const scoreObj = {
    source: 'manual-official-finalizer',
    status: 'finished',
    phase: result.phase,
    phase_ar: result.phaseAr,
    status_detail: result.phaseAr,
    checked_at: nowAmman,
    current: result.score,
    ft: result.score,
    winner_side: result.winnerSide
  };
  if (result.phase === 'finished_after_extra_time') scoreObj.et = result.score;
  if (Array.isArray(result.penalties)) {
    scoreObj.et = result.score;
    scoreObj.p = result.penalties;
    scoreObj.penalties = { home: result.penalties[0], away: result.penalties[1], team1: result.penalties[0], team2: result.penalties[1] };
  }
  m.score = scoreObj;
}
function kickoffMs(m) {
  const v = m?.kickoff_jordan || m?.kickoff || m?.kickoff_utc || null;
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}
function normalizeScheduledOrLive(m) {
  if (!m || isFinishedStatus(m)) return;
  const k = kickoffMs(m);
  const now = NOW.getTime();
  if (k && now < k - 2 * 60_000) {
    clearScoreFields(m);
    setStatus(m, SCHEDULED_STATUS, 'scheduled', 'لم تبدأ');
    return;
  }
  if (k && now >= k - 2 * 60_000 && now <= k + 240 * 60_000) {
    const hasScore = Number.isFinite(Number(m.score1 ?? m.home_score));
    if (!hasScore) setBaseScoreFields(m, 0, 0);
    setStatus(m, LIVE_STATUS, 'live', 'مباشر');
    if (!m.score) m.score = { source:'time-live-fallback', status:'live', phase:'live', phase_ar:'مباشر', current:[m.score1 ?? 0, m.score2 ?? 0], checked_at: nowAmman };
    return;
  }
  if (k && now > k + 240 * 60_000) {
    if (!Number.isFinite(Number(m.score1 ?? m.home_score))) clearScoreFields(m);
    setStatus(m, PENDING_STATUS, 'pending_verification', 'بانتظار التحديث');
  }
}
function applyPairing(m, p, ko=false) {
  setNumberFields(m, p.number || matchNumFromId(m.id));
  if (ko) setKoTeams(m, p.team1, p.team2, p.slot1, p.slot2, p.unresolved1, p.unresolved2);
  else setFlatTeams(m, p.team1, p.team2, p.slot1, p.slot2, p.unresolved1, p.unresolved2);
  if (!OFFICIAL_RESULTS[m.id]) normalizeScheduledOrLive(m);
}
function indexById(list) { const map = new Map(); for (const m of list || []) if (m && m.id) map.set(m.id, m); return map; }
function updateDataFile(file) {
  const data = readJson(file);
  const list = data.matches || [];
  const map = indexById(list);
  for (const [id,p] of Object.entries(OFFICIAL_PAIRINGS)) if (map.has(id)) applyPairing(map.get(id), p, isKoObjectMatch(map.get(id)));
  for (const [id,r] of Object.entries(OFFICIAL_RESULTS)) if (map.has(id)) applyOfficialResult(map.get(id), r, isKoObjectMatch(map.get(id)));
  // Re-apply every resolved knockout path after locking results. This is the final guard
  // against stale scheduled names being written by an earlier updater or a racing workflow.
  const resolvedKnockoutPairings = {
    M097: ['France','Morocco','W89','W90'],
    M098: ['Spain','Belgium','W93','W94'],
    M099: ['Norway','England','W91','W92'],
    M100: ['Argentina','Switzerland','W95','W96'],
    M101: ['France','Spain','W97','W98'],
    M102: ['England','Argentina','W99','W100'],
  };
  for (const [id, [team1, team2, slot1, slot2]] of Object.entries(resolvedKnockoutPairings)) {
    const qm = map.get(id);
    if (qm && !isKoObjectMatch(qm)) setFlatTeams(qm, team1, team2, slot1, slot2, false, false);
    if (qm && isKoObjectMatch(qm)) setKoTeams(qm, team1, team2, slot1, slot2, false, false);
  }
  if (data.metadata) {
    data.metadata.canonical_finalizer_at = nowAmman;
    data.metadata.canonical_finalizer_version = VERSION;
    data.metadata.semifinals_official_lock_at = nowAmman;
    data.metadata.semifinals_official_lock_version = VERSION;
  }
  if ('last_updated_at' in data) data.last_updated_at = nowAmman;
  if (data.summary) {
    data.summary.canonical_finalizer_at = nowAmman;
    data.summary.canonical_finalizer_version = VERSION;
    data.summary.semifinals_official_lock_at = nowAmman;
    data.summary.semifinals_official_lock_version = VERSION;
  }
  writeJson(file, data);
  return list.length;
}
function updateManualOverrides() {
  const file = 'manual-results-overrides.json';
  const data = readJson(file);
  data.metadata = data.metadata || {};
  data.metadata.updated_at = nowAmman;
  data.metadata.canonical_finalizer_version = VERSION;
  data.metadata.semifinals_official_lock_at = nowAmman;
  data.metadata.semifinals_official_lock_version = VERSION;
  data.metadata.note_ar = 'تصحيحات رسمية مقفلة تمنع عودة نتائج ربع النهائي أو أسماء المتأهلين إلى بيانات قديمة؛ نصف النهائي M102 هو إنجلترا ضد الأرجنتين.';
  const byId = new Map((data.results || []).map(r => [r.id, r]));
  for (const [id, r] of Object.entries(OFFICIAL_RESULTS)) {
    byId.set(id, {
      id, num: r.number, team1: r.team1, team2: r.team2, team1_ar: teamAr(r.team1), team2_ar: teamAr(r.team2),
      stage: r.stage, stage_ar: ({ 'Round of 32':'دور 32', 'Round of 16':'دور 16', 'Quarter-final':'ربع النهائي', 'Semi-final':'نصف النهائي' }[r.stage] || r.stage),
      status: 'finished', home_score: r.score[0], away_score: r.score[1], score1: r.score[0], score2: r.score[1],
      penalty_home_score: r.penalties?.[0] ?? null, penalty_away_score: r.penalties?.[1] ?? null,
      home_penalties: r.penalties?.[0] ?? null, away_penalties: r.penalties?.[1] ?? null,
      team1_penalties: r.penalties?.[0] ?? null, team2_penalties: r.penalties?.[1] ?? null,
      winner_side: r.winnerSide, loser_side: r.winnerSide === 1 ? 2 : 1,
      score: { source:'manual-official-finalizer', status:'finished', phase:r.phase, phase_ar:r.phaseAr, status_detail:r.phaseAr, current:r.score, ft:r.score, et:r.phase.includes('extra')||r.penalties ? r.score : undefined, p:r.penalties, winner_side:r.winnerSide, checked_at:nowAmman },
      score_source: 'manual-official-finalizer', live_score_source:'manual-official-finalizer', live_phase:r.phase, live_phase_ar:r.phaseAr, live_status_detail:r.phaseAr,
      verified: true, locked: true, force: true, note_ar: r.note_ar
    });
  }
  data.results = Array.from(byId.values()).sort((a,b)=>(a.num||999)-(b.num||999));
  writeJson(file, data);
}

const touched = [];
for (const file of ['matches.json', 'bracket.json', 'knockout-live.json']) {
  if (fs.existsSync(path.join(DATA_DIR, file))) {
    updateDataFile(file);
    touched.push(file);
  }
}
updateManualOverrides();
const status = { ok:true, name:'World Cup canonical finalizer', version:VERSION, updated_at:nowAmman, touched:[...touched,'manual-results-overrides.json'], official_results:Object.keys(OFFICIAL_RESULTS), official_pairings:Object.keys(OFFICIAL_PAIRINGS), note_ar:'يثبت نتائج ربع النهائي M097-M100 ومسار نصف النهائي، ويقفل M102 على إنجلترا ضد الأرجنتين بعد كل تحديث.' };
writeJson('canonical-finalizer-status.json', status);
console.log(JSON.stringify(status, null, 2));
