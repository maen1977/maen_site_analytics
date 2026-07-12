import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const VERSION = '2026-07-12-semifinals-official-lock-v2';
const files = ['matches.json', 'bracket.json', 'knockout-live.json'];
const errors = [];

const EXPECTED = {
  M086: { teams:['Argentina','Cape Verde'], score:[3,2], status:/انتهت بعد التمديد|after extra|aet|extra/i, winnerSide:1, locked:true },
  M087: { teams:['Colombia','Ghana'], score:[1,0], status:/انتهت|finished|final|full/i, winnerSide:1, locked:true },
  M088: { teams:['Australia','Egypt'], score:[1,1], penalties:[2,4], status:/ترجيح|penalt|shootout/i, winnerSide:2, locked:true },
  M089: { teams:['Paraguay','France'], score:[0,1], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M090: { teams:['Canada','Morocco'], score:[0,3], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M091: { teams:['Brazil','Norway'], score:[1,2], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M092: { teams:['Mexico','England'], score:[2,3], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M093: { teams:['Portugal','Spain'], score:[0,1], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M094: { teams:['USA','Belgium'], score:[1,4], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M095: { teams:['Argentina','Egypt'], score:[3,2], status:/انتهت|finished|final|full/i, winnerSide:1, locked:true },
  M096: { teams:['Switzerland','Colombia'], score:[0,0], penalties:[4,3], status:/ترجيح|penalt|shootout/i, winnerSide:1, locked:true },
  M097: { teams:['France','Morocco'], slots:['W89','W90'], score:[2,0], status:/انتهت|finished|final|full/i, winnerSide:1, locked:true },
  M098: { teams:['Spain','Belgium'], slots:['W93','W94'], score:[2,1], status:/انتهت|finished|final|full/i, winnerSide:1, locked:true },
  M099: { teams:['Norway','England'], slots:['W91','W92'], score:[1,2], status:/انتهت|finished|final|full/i, winnerSide:2, locked:true },
  M100: { teams:['Argentina','Switzerland'], slots:['W95','W96'], score:[3,1], status:/انتهت بعد التمديد|after extra|aet|extra/i, winnerSide:1, locked:true },
  M101: { teams:['France','Spain'], slots:['W97','W98'] },
  M102: { teams:['England','Argentina'], slots:['W99','W100'] },
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function writeJsonPreservingEol(file, data) {
  const target = path.join(DATA_DIR, file);
  let eol = '\n';
  try {
    if (fs.readFileSync(target, 'utf8').includes('\r\n')) eol = '\r\n';
  } catch {}
  fs.writeFileSync(target, JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol);
}

function statusBlob(m) {
  const parts = [];
  const st = m?.status;
  if (typeof st === 'string') parts.push(st);
  else if (st && typeof st === 'object') parts.push(st.key, st.state, st.label, st.label_ar);
  const sc = m?.score;
  if (sc && typeof sc === 'object') parts.push(sc.status, sc.phase, sc.phase_ar, sc.status_detail);
  parts.push(m?.status_key, m?.status_ar, m?.phase, m?.live_phase, m?.live_phase_ar, m?.live_status_detail);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function teamName(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value.name_en || value.team_en || value.name_ar || value.team_ar || '');
  return String(value);
}

function scoreNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scorePair(m) {
  const a = scoreNum(m.score1 ?? m.home_score ?? m.team1_score);
  const b = scoreNum(m.score2 ?? m.away_score ?? m.team2_score);
  if (a !== null && b !== null) return [a, b];
  const sc = m.score;
  for (const key of ['current', 'ft', 'et']) {
    if (sc && Array.isArray(sc[key]) && sc[key].length >= 2) return sc[key].map(Number).slice(0, 2);
  }
  return [null, null];
}

function penPair(m) {
  const pairs = [
    [m.penalty1, m.penalty2],
    [m.penalty_home_score, m.penalty_away_score],
    [m.home_penalties, m.away_penalties],
    [m.team1_penalties, m.team2_penalties],
  ];
  for (const [a, b] of pairs) {
    if (a !== null && a !== undefined && b !== null && b !== undefined) return [Number(a), Number(b)];
  }
  const sc = m.score;
  if (sc && Array.isArray(sc.p)) return sc.p.map(Number).slice(0, 2);
  return null;
}

function slotValue(m, side) {
  const team = m?.[`team${side}`];
  return String(
    m?.[`team${side}_slot`] ||
    m?.[`team${side}_source_slot`] ||
    m?.[`source_slot${side}`] ||
    m?.[`team${side}_original_slot`] ||
    m?.[`team${side}_seed`] ||
    (team && typeof team === 'object' ? team.slot : '') ||
    ''
  ).toUpperCase();
}

function isFinal(m) {
  return /finished|complete|full[_\s-]?time|final|ended|ft|aet|انته/.test(statusBlob(m));
}

function isLive(m) {
  return /live|in[_\s-]?play|playing|started|مباشر|الشوط/.test(statusBlob(m));
}

function kickoffMs(m) {
  const value = m.kickoff_jordan || m.kickoff || m.kickoff_utc;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function checkExpected(file, m, id, exp) {
  if (exp.teams) {
    const actual = [teamName(m.team1), teamName(m.team2)];
    if (actual[0] !== exp.teams[0] || actual[1] !== exp.teams[1]) {
      errors.push(`${file}: ${id} teams are ${actual.join(' vs ')}, expected ${exp.teams.join(' vs ')}`);
    }
  }
  if (exp.slots) {
    const actual = [slotValue(m, 1), slotValue(m, 2)];
    if (actual[0] !== exp.slots[0] || actual[1] !== exp.slots[1]) {
      errors.push(`${file}: ${id} source slots are ${actual.join(' / ')}, expected ${exp.slots.join(' / ')}`);
    }
  }
  if (exp.score) {
    const actual = scorePair(m);
    if (actual[0] !== exp.score[0] || actual[1] !== exp.score[1]) {
      errors.push(`${file}: ${id} score is ${actual.join('-')}, expected ${exp.score.join('-')}`);
    }
    if (!isFinal(m)) errors.push(`${file}: ${id} has a locked final score but status is not final (${statusBlob(m)})`);
    if (isLive(m)) errors.push(`${file}: ${id} is final but still marked live (${statusBlob(m)})`);
  }
  if (exp.penalties) {
    const actual = penPair(m);
    if (!actual || actual[0] !== exp.penalties[0] || actual[1] !== exp.penalties[1]) {
      errors.push(`${file}: ${id} penalties are ${actual}, expected ${exp.penalties.join('-')}`);
    }
  }
  if (exp.status && !exp.status.test(statusBlob(m))) {
    errors.push(`${file}: ${id} status does not match the locked result: ${statusBlob(m)}`);
  }
  if (exp.winnerSide && Number(m.winner_side) !== exp.winnerSide) {
    errors.push(`${file}: ${id} winner_side=${m.winner_side}, expected ${exp.winnerSide}`);
  }
  if (exp.locked && (m.canonical_locked !== true || m.official_result_locked !== true)) {
    errors.push(`${file}: ${id} is missing canonical_locked/official_result_locked`);
  }
}

function checkDataFile(file) {
  const data = readJson(file);
  const map = new Map((data.matches || []).map((m) => [m.id, m]));

  for (const [id, exp] of Object.entries(EXPECTED)) {
    const m = map.get(id);
    if (!m) {
      errors.push(`${file}: missing ${id}`);
      continue;
    }
    checkExpected(file, m, id, exp);
  }

  const semifinal = map.get('M102');
  if (semifinal && /switzerland|سويسرا/i.test(`${teamName(semifinal.team2)} ${semifinal.team2_ar || ''}`)) {
    errors.push(`${file}: M102 regressed to Switzerland; it must remain England vs Argentina`);
  }

  for (const m of data.matches || []) {
    const id = m.id || '';
    const n = Number(m.number ?? m.match_number ?? String(id).replace(/^M0*/, ''));
    if (n >= 89 && n <= 104 && !isFinal(m)) {
      const kickoff = kickoffMs(m);
      if (kickoff && Date.now() < kickoff - 2 * 60_000) {
        const pair = scorePair(m);
        if (pair[0] === 0 && pair[1] === 0) errors.push(`${file}: ${id} is future scheduled but still has a 0-0 score`);
      }
    }
  }
}

function checkManualOverrides() {
  const file = 'manual-results-overrides.json';
  const data = readJson(file);
  const map = new Map((data.results || []).map((m) => [m.id, m]));
  const metadataVersion = data.metadata?.semifinals_official_lock_version || data.metadata?.canonical_finalizer_version;
  if (metadataVersion !== VERSION) errors.push(`${file}: lock version is ${metadataVersion || 'missing'}, expected ${VERSION}`);

  for (const id of ['M097', 'M098', 'M099', 'M100']) {
    const exp = EXPECTED[id];
    const m = map.get(id);
    if (!m) {
      errors.push(`${file}: missing locked override ${id}`);
      continue;
    }
    const actualTeams = [teamName(m.team1), teamName(m.team2)];
    const actualScore = scorePair(m);
    if (actualTeams[0] !== exp.teams[0] || actualTeams[1] !== exp.teams[1]) {
      errors.push(`${file}: ${id} teams are ${actualTeams.join(' vs ')}, expected ${exp.teams.join(' vs ')}`);
    }
    if (actualScore[0] !== exp.score[0] || actualScore[1] !== exp.score[1]) {
      errors.push(`${file}: ${id} score is ${actualScore.join('-')}, expected ${exp.score.join('-')}`);
    }
    if (Number(m.winner_side) !== exp.winnerSide) errors.push(`${file}: ${id} winner_side=${m.winner_side}, expected ${exp.winnerSide}`);
    if (!(m.locked === true && m.force === true && m.verified === true)) errors.push(`${file}: ${id} override must be locked, forced, and verified`);
  }
}

for (const file of files) {
  if (fs.existsSync(path.join(DATA_DIR, file))) checkDataFile(file);
  else errors.push(`${file}: file is missing`);
}
if (fs.existsSync(path.join(DATA_DIR, 'manual-results-overrides.json'))) checkManualOverrides();
else errors.push('manual-results-overrides.json: file is missing');

const status = {
  ok: errors.length === 0,
  name: 'World Cup state validator',
  version: VERSION,
  checked_at: new Date().toISOString(),
  protected_semifinal: 'M102 England vs Argentina',
  protected_source_matches: ['M097', 'M098', 'M099', 'M100'],
  errors,
};
writeJsonPreservingEol('state-validator-status.json', status);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify(status, null, 2));
