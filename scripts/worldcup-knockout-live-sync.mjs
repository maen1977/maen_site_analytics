#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TZ = 'Asia/Amman';
const VERSION = '2026-06-30-dynamic-knockout-advancement-v3';

function nowAmmanIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}

function readJson(file) {
  const p = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function westernDigits(value = '') {
  return String(value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function deepGet(obj, paths) {
  for (const p of paths) {
    const parts = p.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object') { cur = undefined; break; }
      cur = cur[part];
    }
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
}

function looksLikeMatch(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const idish = deepGet(o, ['id', 'match_id', 'matchId', 'code', 'key', 'number', 'match_number', 'matchNumber']);
  const t1 = deepGet(o, ['team1', 'team_1', 'home', 'home_team', 'homeTeam', 'teamA', 'team_a', 'teams.home']);
  const t2 = deepGet(o, ['team2', 'team_2', 'away', 'away_team', 'awayTeam', 'teamB', 'team_b', 'teams.away']);
  const stage = deepGet(o, ['stage', 'round', 'phase', 'round_ar', 'stage_ar']);
  return Boolean(idish || (t1 && t2) || /دور|نهائي|Round|Final|Quarter|Semi/i.test(text(stage)));
}

function collectMatches(json) {
  const out = [];
  const seen = new Set();
  function visit(value, hintRound = '') {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, hintRound);
      return;
    }
    if (typeof value !== 'object') return;
    if (looksLikeMatch(value)) {
      const copy = { ...value };
      if (hintRound && !copy.__hintRound) copy.__hintRound = hintRound;
      const key = JSON.stringify([copy.id, copy.match_id, copy.matchId, copy.code, copy.number, copy.match_number, copy.team1_slot, copy.team2_slot]).slice(0, 400);
      if (!seen.has(key)) { seen.add(key); out.push(copy); }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (['matches', 'games', 'fixtures', 'bracket', 'knockout', 'data', 'items', 'rounds', 'stages'].includes(key)) visit(child, text(value.title_ar || value.title || key));
      else if (/^(round|دور|final|semi|quarter|16|32)/i.test(key)) visit(child, key);
      else if (Array.isArray(child) && child.some(looksLikeMatch)) visit(child, key);
    }
  }
  visit(json);
  return out;
}

function matchNumber(m) {
  const id = text(deepGet(m, ['id', 'match_id', 'matchId', 'code', 'key']));
  const n = Number(westernDigits(text(deepGet(m, ['number', 'match_number', 'matchNumber']))).match(/\d+/)?.[0] || '');
  if (n) return n;
  const fromId = westernDigits(id).match(/(?:M)?(\d{2,3})\b/i);
  return fromId ? Number(fromId[1]) : 0;
}

function matchCode(m) {
  const n = matchNumber(m);
  return n ? `M${String(n).padStart(3, '0')}` : (text(m.id || m.match_id || m.code || m.key) || `M${Math.random().toString(36).slice(2, 8)}`);
}

function parseMatchTimeMs(m) {
  let raw = text(deepGet(m, ['kickoff_jordan', 'kickoff_utc', 'datetime', 'date_time', 'kickoff_at', 'start_time', 'startTime', 'kickoff', 'date']));
  if (!raw) return Number.MAX_SAFE_INTEGER;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const timeRaw = text(deepGet(m, ['time', 'time_ar', 'kickoff_time', 'local_time']));
    const hm = timeRaw.match(/(\d{1,2}):(\d{2})/);
    raw = hm ? `${raw}T${hm[1].padStart(2, '0')}:${hm[2]}:00+03:00` : `${raw}T23:59:59+03:00`;
  }
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function sortByStageTimeNumber(a, b) {
  return (a.stage?.order || 99) - (b.stage?.order || 99) || parseMatchTimeMs(a.raw || a) - parseMatchTimeMs(b.raw || b) || matchNumber(a.raw || a) - matchNumber(b.raw || b);
}

function scorePair(a, b) {
  return a !== null && b !== null ? [a, b] : null;
}

function stageFromNumber(n, fallback = '') {
  const f = text(fallback);
  if (/32|٢٣|٣٢|دور\s*الـ?32|دور\s*32/i.test(f)) return { key: 'round32', title_ar: 'دور الـ32', order: 1 };
  if (/16|١٦|دور\s*الـ?16|ثمن/i.test(f)) return { key: 'round16', title_ar: 'دور الـ16', order: 2 };
  if (/ربع|quarter/i.test(f)) return { key: 'quarterfinal', title_ar: 'ربع النهائي', order: 3 };
  if (/نصف|semi/i.test(f)) return { key: 'semifinal', title_ar: 'نصف النهائي', order: 4 };
  if (/ثالث|third/i.test(f)) return { key: 'third_place', title_ar: 'مباراة المركز الثالث', order: 5 };
  if (/نهائي|final/i.test(f)) return { key: 'final', title_ar: 'النهائي', order: 6 };
  if (n >= 73 && n <= 88) return { key: 'round32', title_ar: 'دور الـ32', order: 1 };
  if (n >= 89 && n <= 96) return { key: 'round16', title_ar: 'دور الـ16', order: 2 };
  if (n >= 97 && n <= 100) return { key: 'quarterfinal', title_ar: 'ربع النهائي', order: 3 };
  if (n >= 101 && n <= 102) return { key: 'semifinal', title_ar: 'نصف النهائي', order: 4 };
  if (n === 103) return { key: 'third_place', title_ar: 'مباراة المركز الثالث', order: 5 };
  if (n === 104) return { key: 'final', title_ar: 'النهائي', order: 6 };
  return { key: 'knockout', title_ar: 'الأدوار الإقصائية', order: 9 };
}

const TEAM_NAME_KEYS_AR = ['name_ar', 'team_ar', 'arabic', 'ar', 'display_ar', 'country_ar', 'label_ar', 'short_ar'];
const TEAM_NAME_KEYS_EN = ['name_en', 'team_en', 'english', 'en', 'name', 'team', 'country', 'label', 'short_name'];

function normalizeSlot(value = '') {
  let s = westernDigits(text(value));
  if (!s) return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^نادي\s+المجموعة\s+/i, '');
  s = s.replace(/^متصدر\s+المجموعة\s+([A-L])$/i, '1$1');
  s = s.replace(/^وصيف\s+المجموعة\s+([A-L])$/i, '2$1');
  s = s.replace(/^أفضل\s+ثالث\s+(?:من\s+)?(?:المجموعة\s+)?/i, '3');
  s = s.replace(/^الفائز\s+من\s+مباراة\s+(\d{2,3})$/i, 'W$1');
  s = s.replace(/^الخاسر\s+من\s+مباراة\s+(\d{2,3})$/i, 'L$1');
  const mW = s.match(/^(?:W|Winner\s*)(\d{2,3})$/i); if (mW) return `W${mW[1]}`;
  const mL = s.match(/^(?:L|Loser\s*)(\d{2,3})$/i); if (mL) return `L${mL[1]}`;
  const direct = s.match(/^([12])\s*([A-L])$/i); if (direct) return `${direct[1]}${direct[2].toUpperCase()}`;
  const third = s.match(/^3\s*([A-L](?:\s*[\/،,]\s*[A-L])*)$/i); if (third) return '3' + third[1].replace(/[\s،,]+/g, '').toUpperCase();
  return s;
}

function isSlotLike(s = '') {
  const x = normalizeSlot(s);
  return /^[12][A-L]$/.test(x) || /^3[A-L](?:\/[A-L])*$/.test(x) || /^[WL]\d{2,3}$/.test(x);
}

function teamFromRaw(raw, sideLabel = '') {
  const result = { name_ar: '', name_en: '', slot: '', source: sideLabel };
  if (raw == null) return result;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const s = text(raw);
    result.slot = isSlotLike(s) ? normalizeSlot(s) : '';
    if (!result.slot) { result.name_ar = s; result.name_en = s; }
    return result;
  }
  if (typeof raw !== 'object') return result;
  for (const k of TEAM_NAME_KEYS_AR) if (text(raw[k])) { result.name_ar = text(raw[k]); break; }
  for (const k of TEAM_NAME_KEYS_EN) if (text(raw[k])) { result.name_en = text(raw[k]); break; }
  const slotCandidate = deepGet(raw, ['slot', 'seed', 'qualification_slot', 'qualifier', 'code', 'placeholder', 'group_slot', 'source_slot']);
  if (text(slotCandidate)) result.slot = normalizeSlot(slotCandidate);
  if (!result.name_ar && result.name_en && !isSlotLike(result.name_en)) result.name_ar = result.name_en;
  if (!result.name_en && result.name_ar && !isSlotLike(result.name_ar)) result.name_en = result.name_ar;
  if (!result.slot) {
    const maybe = result.name_ar || result.name_en;
    if (isSlotLike(maybe)) { result.slot = normalizeSlot(maybe); result.name_ar = ''; result.name_en = ''; }
  }
  if (text(raw.group)) result.group = text(raw.group).toUpperCase();
  if (Number(raw.position || raw.rank || raw.place)) result.position = Number(raw.position || raw.rank || raw.place);
  return result;
}

function extractTeam(match, side) {
  const side1 = ['team1', 'team_1', 'home', 'home_team', 'homeTeam', 'teamA', 'team_a', 'teams.home', 'competitors.0', 'participants.0'];
  const side2 = ['team2', 'team_2', 'away', 'away_team', 'awayTeam', 'teamB', 'team_b', 'teams.away', 'competitors.1', 'participants.1'];
  const raw = deepGet(match, side === 1 ? side1 : side2);
  const t = teamFromRaw(raw, `team${side}`);
  const slotPaths = side === 1
    ? ['team1_slot', 'team_1_slot', 'team1_source_slot', 'team1_original_slot', 'team1_seed', 'home_slot', 'home_seed', 'slot1', 'seed1', 'team1Seed', 'team1_placeholder']
    : ['team2_slot', 'team_2_slot', 'team2_source_slot', 'team2_original_slot', 'team2_seed', 'away_slot', 'away_seed', 'slot2', 'seed2', 'team2Seed', 'team2_placeholder'];
  const slot = deepGet(match, slotPaths);
  if (text(slot)) t.slot = normalizeSlot(slot);
  return t;
}

function teamDisplayName(team) {
  return text(team?.name_ar || team?.arabic || team?.team_ar || team?.name || team?.name_en || team?.team || team?.country_ar || team?.country || '');
}

function extractStandings(data) {
  const teams = [];
  function add(raw, group, index) {
    if (!raw || typeof raw !== 'object') return;
    const t = teamFromRaw(raw, 'standing');
    t.group = text(raw.group || raw.group_letter || raw.groupLetter || group || '').replace(/^Group\s+/i, '').toUpperCase();
    t.position = Number(raw.position || raw.rank || raw.place || raw.pos || raw.order || index + 1 || 0);
    t.played = Number(raw.played ?? raw.pl ?? raw.matches_played ?? raw.mp ?? raw.p ?? 0);
    t.points = Number(raw.points ?? raw.pts ?? raw.point ?? 0);
    t.gd = Number(raw.goal_difference ?? raw.gd ?? raw.diff ?? ((raw.goals_for ?? raw.gf ?? 0) - (raw.goals_against ?? raw.ga ?? 0)) ?? 0);
    t.gf = Number(raw.goals_for ?? raw.gf ?? raw.goals_scored ?? 0);
    t.ga = Number(raw.goals_against ?? raw.ga ?? raw.goals_conceded ?? 0);
    if (!t.name_ar && !t.name_en) return;
    if (!/^[A-L]$/.test(t.group)) return;
    teams.push(t);
  }
  function visit(value, groupHint = '') {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (item && typeof item === 'object' && (item.team || item.name || item.name_ar || item.team_ar || item.country || item.country_ar) && (item.position || item.rank || item.points !== undefined || item.pts !== undefined || groupHint)) add(item, groupHint, idx);
        else visit(item, groupHint);
      });
      return;
    }
    if (typeof value !== 'object') return;
    const groupHere = text(value.group || value.group_letter || value.groupLetter || groupHint).replace(/^Group\s+/i, '').toUpperCase();
    const arr = deepGet(value, ['teams', 'standings', 'table', 'ranking', 'rows']);
    if (Array.isArray(arr)) { arr.forEach((x, i) => add(x, groupHere, i)); return; }
    for (const [k, v] of Object.entries(value)) {
      const g = /^[A-L]$/i.test(k) ? k.toUpperCase() : groupHere;
      if (/^group\s*[A-L]$/i.test(k)) visit(v, k.replace(/^group\s*/i, '').toUpperCase());
      else visit(v, g);
    }
  }
  visit(data);
  const byKey = new Map();
  for (const t of teams) {
    const key = `${t.group}:${teamDisplayName(t)}`;
    if (!byKey.has(key) || (t.position && !byKey.get(key).position)) byKey.set(key, t);
  }
  return [...byKey.values()].sort((a, b) => a.group.localeCompare(b.group) || a.position - b.position);
}

function compareThird(a, b) {
  return (b.points - a.points) || (b.gd - a.gd) || (b.gf - a.gf) || String(a.group).localeCompare(String(b.group));
}

function scoreValue(v) {
  const n = Number(westernDigits(text(v)).match(/-?\d+/)?.[0]);
  return Number.isFinite(n) ? n : null;
}

function getScores(m) {
  const s1 = scoreValue(deepGet(m, ['score1', 'team1_score', 'home_score', 'homeScore', 'score.current.0', 'score.et.0', 'score.ft.0', 'score.home', 'score.ft.home', 'result.home', 'goals_home', 'goals.team1']));
  const s2 = scoreValue(deepGet(m, ['score2', 'team2_score', 'away_score', 'awayScore', 'score.current.1', 'score.et.1', 'score.ft.1', 'score.away', 'score.ft.away', 'result.away', 'goals_away', 'goals.team2']));
  const p1 = scoreValue(deepGet(m, ['penalty1', 'penalties1', 'penalty_home_score', 'home_penalties', 'team1_penalties', 'penalties.home', 'penalties.team1', 'score.p.0', 'score.penalties.home', 'score.penalties.team1', 'score.penalty_home_score']));
  const p2 = scoreValue(deepGet(m, ['penalty2', 'penalties2', 'penalty_away_score', 'away_penalties', 'team2_penalties', 'penalties.away', 'penalties.team2', 'score.p.1', 'score.penalties.away', 'score.penalties.team2', 'score.penalty_away_score']));
  return { s1, s2, p1, p2, ft: scorePair(scoreValue(deepGet(m, ['score.ft.0'])), scoreValue(deepGet(m, ['score.ft.1']))), et: scorePair(scoreValue(deepGet(m, ['score.et.0'])), scoreValue(deepGet(m, ['score.et.1']))), p: scorePair(p1, p2) };
}

function matchStatus(m) {
  const raw = text(deepGet(m, ['score.phase', 'live_phase', 'status_ar', 'status', 'state', 'match_status', 'period']));
  const detail = text(deepGet(m, ['score.phase_ar', 'live_phase_ar', 'score.status_detail', 'live_status_detail']));
  const low = `${raw} ${detail}`.toLowerCase();
  const scores = getScores(m);
  if (/finished_on_penalties|penalties|penalty|shootout|ترجيح/.test(low) && scores.p) return { key: 'finished_on_penalties', label_ar: 'انتهت بركلات الترجيح' };
  if (/finished_after_extra_time|after\s+extra|aet|تمديد|وقت\s*إضاف|وقت\s*اضاف/.test(low)) return { key: 'finished_after_extra_time', label_ar: 'انتهت بعد التمديد' };
  if (/extra_time_first/.test(low)) return { key: 'live', label_ar: 'الشوط الإضافي الأول' };
  if (/extra_time_second/.test(low)) return { key: 'live', label_ar: 'الشوط الإضافي الثاني' };
  if (/penalties|penalty|shootout|ترجيح/.test(low)) return { key: 'live', label_ar: 'ركلات الترجيح' };
  if (/live|in[_\s-]?play|playing|مباشر|الشوط|استراحة|first_half|second_half|half_time/.test(low)) return { key: 'live', label_ar: detail || 'مباشر' };
  if (/finished|full[_\s-]?time|ft|ended|complete|انته/.test(low)) return { key: 'finished', label_ar: 'انتهت' };
  if (scores.s1 !== null && scores.s2 !== null && /final|ft|انته/i.test(low)) return { key: 'finished', label_ar: 'انتهت' };
  return { key: 'scheduled', label_ar: 'لم تبدأ' };
}

function winnerSide(m) {
  const { s1, s2, p1, p2 } = getScores(m);
  const status = matchStatus(m).key;
  if (!['finished', 'finished_on_penalties', 'finished_after_extra_time'].includes(status)) return null;
  if (s1 !== null && s2 !== null && s1 !== s2) return s1 > s2 ? 1 : 2;
  if (p1 !== null && p2 !== null && p1 !== p2) return p1 > p2 ? 1 : 2;
  const rawWinner = text(deepGet(m, ['winner', 'winner_team', 'winnerTeam', 'qualified']));
  if (rawWinner) {
    const a = teamDisplayName(m.__resolvedTeam1 || {}).toLowerCase();
    const b = teamDisplayName(m.__resolvedTeam2 || {}).toLowerCase();
    const w = rawWinner.toLowerCase();
    if (a && w.includes(a)) return 1;
    if (b && w.includes(b)) return 2;
  }
  return null;
}

function loserSide(m) {
  const w = winnerSide(m);
  return w === 1 ? 2 : w === 2 ? 1 : null;
}


function rawScorePriority(raw) {
  if (!raw || typeof raw !== 'object') return 0;
  const scores = getScores(raw);
  const status = matchStatus(raw).key;
  const source = text(deepGet(raw, ['score_source', 'live_score_source', 'score.source'])).toLowerCase();
  let priority = 0;
  if (scores.s1 !== null && scores.s2 !== null) priority += 10;
  if (scores.p1 !== null && scores.p2 !== null) priority += 6;
  if (status === 'finished' || status === 'finished_on_penalties' || status === 'finished_after_extra_time') priority += 8;
  if (status === 'live') priority += 5;
  if (/espn|manual|verified/.test(source)) priority += 4;
  return priority;
}

function mergePreferScoredMatch(existing, incoming) {
  if (!existing || !Object.keys(existing).length) return { ...incoming };
  const incomingPriority = rawScorePriority(incoming);
  const existingPriority = rawScorePriority(existing);
  // Keep the richer live/final score object if bracket.json still has the same match as scheduled.
  if (incomingPriority >= existingPriority) return { ...existing, ...incoming };
  return { ...incoming, ...existing };
}

function makePlaceholder(slot) {
  const s = normalizeSlot(slot);
  const w = s.match(/^W(\d{2,3})$/); if (w) return { name_ar: `الفائز من مباراة ${w[1]}`, name_en: `Winner of match ${w[1]}`, slot: s, unresolved: true };
  const l = s.match(/^L(\d{2,3})$/); if (l) return { name_ar: `الخاسر من مباراة ${l[1]}`, name_en: `Loser of match ${l[1]}`, slot: s, unresolved: true };
  const d = s.match(/^([12])([A-L])$/); if (d) return { name_ar: `${d[1] === '1' ? 'متصدر' : 'وصيف'} المجموعة ${d[2]}`, name_en: `${d[1] === '1' ? 'Winner' : 'Runner-up'} Group ${d[2]}`, slot: s, unresolved: true };
  const t = s.match(/^3([A-L](?:\/[A-L])*)$/); if (t) return { name_ar: `أفضل ثالث من المجموعات ${t[1].replace(/\//g, ' أو ')}`, name_en: `Best third ${t[1]}`, slot: s, unresolved: true };
  return { name_ar: text(slot) || 'لم يتحدد بعد', name_en: text(slot) || 'TBD', slot: s, unresolved: true };
}

function teamObject(t, extra = {}) {
  return {
    name_ar: t?.name_ar || t?.team_ar || t?.arabic || t?.name || t?.name_en || t?.team || '',
    name_en: t?.name_en || t?.team_en || t?.english || t?.name || t?.team || t?.name_ar || '',
    group: t?.group || '',
    position: t?.position || '',
    slot: t?.slot || '',
    unresolved: Boolean(t?.unresolved),
    ...extra
  };
}

function main() {
  const matchesJson = readJson('matches.json');
  const bracketJson = readJson('bracket.json');
  const standingsJson = readJson('standings.json') || readJson('groups.json');
  const standings = extractStandings(standingsJson || {});
  const standingSlot = new Map();
  for (const t of standings) {
    if (t.position === 1) standingSlot.set(`1${t.group}`, t);
    if (t.position === 2) standingSlot.set(`2${t.group}`, t);
    if (t.position === 3) standingSlot.set(`3${t.group}`, t);
  }
  const thirdRanking = standings.filter(t => t.position === 3).sort(compareThird).slice(0, 8);

  const allRaw = [...collectMatches(matchesJson), ...collectMatches(bracketJson)];
  const byCodeRaw = new Map();
  for (const raw of allRaw) {
    const n = matchNumber(raw);
    if (!n || n < 73 || n > 104) continue;
    const code = `M${String(n).padStart(3, '0')}`;
    const current = byCodeRaw.get(code) || {};
    byCodeRaw.set(code, mergePreferScoredMatch(current, raw));
  }

  const rawMatches = [...byCodeRaw.values()].sort((a, b) => parseMatchTimeMs(a) - parseMatchTimeMs(b) || matchNumber(a) - matchNumber(b));
  const byNumber = new Map();
  const usedThirdGroups = new Set();
  const assignedThird = [];

  function resolveInitialTeam(team, matchCodeValue, side) {
    const slot = normalizeSlot(team.slot || team.name_ar || team.name_en || '');
    // Dynamic knockout placeholders must stay dynamic on every run.
    // If an older file already contains a stale country name beside W74/L101,
    // ignore that stale name and resolve from the source match again.
    if (/^[WL]\d{2,3}$/i.test(slot)) return makePlaceholder(slot);
    if (/^[12][A-L]$/.test(slot) && standingSlot.has(slot)) return teamObject(standingSlot.get(slot), { slot, resolved_from: slot });
    if (/^3([A-L])$/.test(slot) && standingSlot.has(slot)) {
      const group = slot.slice(1);
      usedThirdGroups.add(group);
      assignedThird.push({ key: `${matchCodeValue}:team${side}`, group, team_ar: teamDisplayName(standingSlot.get(slot)), slot });
      return teamObject(standingSlot.get(slot), { slot, resolved_from: slot });
    }
    if (team.name_ar || team.name_en) return teamObject(team, { slot: team.slot || '' });
    return makePlaceholder(slot || '');
  }

  // First pass: direct qualifiers and real names.
  for (const raw of rawMatches) {
    const n = matchNumber(raw);
    const code = matchCode(raw);
    const stage = stageFromNumber(n, raw.__hintRound || deepGet(raw, ['stage', 'round', 'phase', 'stage_ar', 'round_ar']));
    const t1 = resolveInitialTeam(extractTeam(raw, 1), code, 1);
    const t2 = resolveInitialTeam(extractTeam(raw, 2), code, 2);
    const normalized = { raw, n, code, stage, team1: t1, team2: t2 };
    raw.__normalized = normalized;
    byNumber.set(n, normalized);
  }

  // Second pass: multi best-third slots, keeping every best-third group used only once.
  function resolveBestThirdIfNeeded(team, matchCodeValue, side) {
    const slot = normalizeSlot(team.slot || '');
    const m = slot.match(/^3([A-L](?:\/[A-L])*)$/);
    if (!m || !team.unresolved) return team;
    const allowed = m[1].split('/');
    let candidate = thirdRanking.find(t => allowed.includes(t.group) && !usedThirdGroups.has(t.group));
    if (!candidate) candidate = thirdRanking.find(t => allowed.includes(t.group));
    if (!candidate) return team;
    usedThirdGroups.add(candidate.group);
    assignedThird.push({ key: `${matchCodeValue}:team${side}`, group: candidate.group, team_ar: teamDisplayName(candidate), slot });
    return teamObject(candidate, { slot, resolved_from: `best-third:${candidate.group}` });
  }
  for (const norm of byNumber.values()) {
    norm.team1 = resolveBestThirdIfNeeded(norm.team1, norm.code, 1);
    norm.team2 = resolveBestThirdIfNeeded(norm.team2, norm.code, 2);
  }

  // Third pass: winners/losers for later rounds. Re-run in order so newly completed matches cascade.
  function resolveWinnerLoser(team) {
    const slot = normalizeSlot(team.slot || '');
    const ref = slot.match(/^([WL])(\d{2,3})$/);
    if (!ref) return team;
    const prev = byNumber.get(Number(ref[2]));
    if (!prev) return makePlaceholder(slot);
    const side = ref[1] === 'W' ? winnerSide(prev.raw) : loserSide(prev.raw);
    if (side === 1) return teamObject(prev.team1, { slot, resolved_from: slot, unresolved: false });
    if (side === 2) return teamObject(prev.team2, { slot, resolved_from: slot, unresolved: false });
    return makePlaceholder(slot);
  }
  for (let i = 0; i < 3; i++) {
    for (const norm of [...byNumber.values()].sort((a, b) => a.n - b.n)) {
      norm.team1 = resolveWinnerLoser(norm.team1);
      norm.team2 = resolveWinnerLoser(norm.team2);
      norm.raw.__resolvedTeam1 = norm.team1;
      norm.raw.__resolvedTeam2 = norm.team2;
    }
  }

  const normalizedMatches = [...byNumber.values()].sort(sortByStageTimeNumber).map(({ raw, n, code, stage, team1, team2 }) => {
    const scores = getScores(raw);
    const kickoff = text(deepGet(raw, ['kickoff_jordan', 'kickoff_utc', 'datetime', 'date_time', 'kickoff', 'kickoff_at', 'start_time', 'startTime', 'date'])) || '';
    const phase = text(deepGet(raw, ['score.phase', 'live_phase', 'status']));
    return {
      id: code,
      number: n,
      stage_key: stage.key,
      stage_ar: stage.title_ar,
      stage_order: stage.order,
      sort_time: parseMatchTimeMs(raw),
      date: text(deepGet(raw, ['date_ar', 'date', 'match_date', 'day'])) || '',
      time: text(deepGet(raw, ['time_ar', 'time', 'kickoff_time'])) || '',
      kickoff,
      kickoff_jordan: text(deepGet(raw, ['kickoff_jordan'])) || '',
      kickoff_utc: text(deepGet(raw, ['kickoff_utc'])) || '',
      venue_ar: text(deepGet(raw, ['venue_ar', 'stadium_ar', 'stadium.name_ar', 'venue.name_ar', 'stadium', 'venue'])) || '',
      city_ar: text(deepGet(raw, ['city_ar', 'city', 'venue.city_ar'])) || '',
      status: matchStatus(raw),
      phase,
      score1: scores.s1,
      score2: scores.s2,
      score_ft: scores.ft,
      score_et: scores.et,
      penalty1: scores.p1,
      penalty2: scores.p2,
      score_penalties: scores.p,
      winner_side: scoreValue(deepGet(raw, ['winner_side', 'score.winner_side'])),
      team1,
      team2,
      source_slot1: extractTeam(raw, 1).slot || '',
      source_slot2: extractTeam(raw, 2).slot || '',
      channels: deepGet(raw, ['channels', 'broadcasts.channels', 'broadcast_channels']) || []
    };
  });

  const roundMap = new Map();
  for (const m of normalizedMatches) {
    if (!roundMap.has(m.stage_key)) roundMap.set(m.stage_key, { key: m.stage_key, title_ar: m.stage_ar, order: m.stage_order, matches: [] });
    roundMap.get(m.stage_key).matches.push(m);
  }
  const rounds = [...roundMap.values()].sort((a, b) => a.order - b.order).map((round) => ({ ...round, matches: round.matches.sort((a, b) => (a.sort_time || Number.MAX_SAFE_INTEGER) - (b.sort_time || Number.MAX_SAFE_INTEGER) || a.number - b.number) }));
  const unresolvedSymbols = normalizedMatches.flatMap(m => [m.team1, m.team2]).filter(t => t?.unresolved).map(t => t.slot).filter(Boolean);
  const dynamicAdvancementChecks = normalizedMatches.flatMap((m) => [
    { match: m.id, side: 'team1', source_slot: m.source_slot1, team: m.team1 },
    { match: m.id, side: 'team2', source_slot: m.source_slot2, team: m.team2 },
  ]).filter((entry) => /^[WL]\d{2,3}$/i.test(entry.source_slot || '')).map((entry) => ({
    match: entry.match,
    side: entry.side,
    source_slot: entry.source_slot,
    resolved_team_ar: entry.team?.name_ar || '',
    unresolved: Boolean(entry.team?.unresolved),
    ok: !entry.team?.unresolved || /^الفائز من مباراة|^الخاسر من مباراة/.test(entry.team?.name_ar || '')
  }));

  const output = {
    name: 'MaenSat World Cup 2026 knockout live cards',
    version: VERSION,
    last_updated_at: nowAmmanIso(),
    timezone: TZ,
    summary: {
      matches: normalizedMatches.length,
      rounds: rounds.length,
      direct_resolved: normalizedMatches.flatMap(m => [m.team1, m.team2]).filter(t => /^[12][A-L]$/.test(t.resolved_from || '')).length,
      best_third_resolved: assignedThird.length,
      unresolved_future_slots: unresolvedSymbols,
      dynamic_advancement_slots_checked: dynamicAdvancementChecks.length
    },
    third_assignments: assignedThird,
    dynamic_advancement_checks: dynamicAdvancementChecks,
    rounds,
    matches: normalizedMatches
  };

  writeJson('knockout-live.json', output);
  writeJson('knockout-live-health.json', {
    name: 'MaenSat knockout live update health',
    version: VERSION,
    last_checked_at: output.last_updated_at,
    timezone: TZ,
    workflow_hint_ar: 'هذا الملف يتحدث من نفس Workflow الأصلي كل 15 دقيقة، ويغذي تبويب الأدوار بالكروت والنتائج والتمديد وركلات الترجيح.',
    matches: output.summary.matches,
    rounds: output.summary.rounds,
    best_third_resolved: output.summary.best_third_resolved,
    unresolved_future_slots: output.summary.unresolved_future_slots,
    dynamic_advancement_slots_checked: output.summary.dynamic_advancement_slots_checked,
    dynamic_advancement_checks: dynamicAdvancementChecks
  });
  console.log(`Wrote public/worldcup-2026/knockout-live.json with ${normalizedMatches.length} knockout matches.`);
}

main();
