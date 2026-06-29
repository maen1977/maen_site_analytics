import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';

const FILES = {
  matches: path.join(WC_DIR, 'matches.json'),
  bracket: path.join(WC_DIR, 'bracket.json'),
  knockoutLive: path.join(WC_DIR, 'knockout-live.json'),
  status: path.join(WC_DIR, 'r32-correction-status.json'),
  bracketStatus: path.join(WC_DIR, 'bracket-linker-status.json'),
  heartbeat: path.join(WC_DIR, 'heartbeat.json'),
  updateCheck: path.join(WC_DIR, 'update-check.json'),
  version: path.join(WC_DIR, 'version.json'),
  deployMarker: path.join(WC_DIR, 'deploy-marker.txt'),
};

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

function matchNum(match) {
  const raw = match?.num ?? match?.number ?? String(match?.id || '').replace(/\D/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isFinished(match) {
  const text = `${match?.status || ''} ${match?.live_status_detail || ''} ${match?.score?.status_detail || ''} ${match?.status?.state || ''}`.toLowerCase();
  return text.includes('finished') || text.includes('final') || text.includes('full time') || text === 'ft' || Boolean(match?.score?.ft);
}

function isLive(match) {
  const text = `${match?.status || ''} ${match?.live_status_detail || ''} ${match?.score?.status_detail || ''} ${match?.status?.state || ''}`.toLowerCase();
  return text.includes('live') || text.includes('in progress') || text.includes('halftime') || text.includes('half time');
}

function scoreObj(home, away, nowIso, statusDetail = 'Full Time') {
  return {
    source: 'r32-official-correction',
    status_detail: statusDetail,
    clock: statusDetail === 'Full Time' ? "90'" : "0'",
    checked_at: nowIso,
    current: [home, away],
    ...(statusDetail === 'Full Time' ? { ft: [home, away] } : {}),
  };
}

const R32 = {
  73: { id: 'M073', team1: 'South Africa', team1_ar: 'جنوب أفريقيا', team2: 'Canada', team2_ar: 'كندا', result: [0, 1], source_slot1: '2A', source_slot2: '2B', group1: 'A', group2: 'B' },
  76: { id: 'M076', team1: 'Brazil', team1_ar: 'البرازيل', team2: 'Japan', team2_ar: 'اليابان', result: [2, 1], source_slot1: '1C', source_slot2: '2F', group1: 'C', group2: 'F' },
  74: { id: 'M074', team1: 'Germany', team1_ar: 'ألمانيا', team2: 'Paraguay', team2_ar: 'باراغواي', source_slot1: '1E', source_slot2: '3A/B/C/D/F', group1: 'E', group2: 'D', third2: true },
  75: { id: 'M075', team1: 'Netherlands', team1_ar: 'هولندا', team2: 'Morocco', team2_ar: 'المغرب', source_slot1: '1F', source_slot2: '2C', group1: 'F', group2: 'C' },
  78: { id: 'M078', team1: 'Ivory Coast', team1_ar: 'كوت ديفوار', team2: 'Norway', team2_ar: 'النرويج', source_slot1: '2E', source_slot2: '2I', group1: 'E', group2: 'I' },
  77: { id: 'M077', team1: 'France', team1_ar: 'فرنسا', team2: 'Sweden', team2_ar: 'السويد', source_slot1: '1I', source_slot2: '3C/D/F/G/H', group1: 'I', group2: 'F', third2: true },
  79: { id: 'M079', team1: 'Mexico', team1_ar: 'المكسيك', team2: 'Ecuador', team2_ar: 'الإكوادور', source_slot1: '1A', source_slot2: '3C/E/F/H/I', group1: 'A', group2: 'E', third2: true },
  80: { id: 'M080', team1: 'England', team1_ar: 'إنجلترا', team2: 'DR Congo', team2_ar: 'الكونغو الديمقراطية', source_slot1: '1L', source_slot2: '3E/H/I/J/K', group1: 'L', group2: 'K', third2: true },
  82: { id: 'M082', team1: 'Belgium', team1_ar: 'بلجيكا', team2: 'Senegal', team2_ar: 'السنغال', source_slot1: '1G', source_slot2: '3A/E/H/I/J', group1: 'G', group2: 'I', third2: true },
  81: { id: 'M081', team1: 'USA', team1_ar: 'الولايات المتحدة', team2: 'Bosnia & Herzegovina', team2_ar: 'البوسنة والهرسك', source_slot1: '1D', source_slot2: '3B/E/F/I/J', group1: 'D', group2: 'B', third2: true },
  84: { id: 'M084', team1: 'Spain', team1_ar: 'إسبانيا', team2: 'Austria', team2_ar: 'النمسا', source_slot1: '1H', source_slot2: '2J', group1: 'H', group2: 'J' },
  83: { id: 'M083', team1: 'Portugal', team1_ar: 'البرتغال', team2: 'Croatia', team2_ar: 'كرواتيا', source_slot1: '2K', source_slot2: '2L', group1: 'K', group2: 'L' },
  85: { id: 'M085', team1: 'Switzerland', team1_ar: 'سويسرا', team2: 'Algeria', team2_ar: 'الجزائر', source_slot1: '1B', source_slot2: '3E/F/G/I/J', group1: 'B', group2: 'J', third2: true },
  88: { id: 'M088', team1: 'Australia', team1_ar: 'أستراليا', team2: 'Egypt', team2_ar: 'مصر', source_slot1: '2D', source_slot2: '2G', group1: 'D', group2: 'G' },
  86: { id: 'M086', team1: 'Argentina', team1_ar: 'الأرجنتين', team2: 'Cape Verde', team2_ar: 'الرأس الأخضر', source_slot1: '1J', source_slot2: '2H', group1: 'J', group2: 'H' },
  87: { id: 'M087', team1: 'Colombia', team1_ar: 'كولومبيا', team2: 'Ghana', team2_ar: 'غانا', source_slot1: '1K', source_slot2: '3D/E/I/J/L', group1: 'K', group2: 'L', third2: true },
};

function applyCore(match, fix, nowIso) {
  if (!match || !fix) return false;
  const before = JSON.stringify(match);
  match.id = match.id || fix.id;
  match.num = match.num ?? match.number ?? Number(fix.id.replace(/\D/g, ''));
  match.round = match.round || 'Round of 32';
  match.stage = match.stage || 'Round of 32';
  match.stage_ar = match.stage_ar || 'دور 32';
  match.team1 = fix.team1;
  match.team2 = fix.team2;
  match.team1_ar = fix.team1_ar;
  match.team2_ar = fix.team2_ar;

  match.team1_slot = match.team1_slot || fix.source_slot1;
  match.team2_slot = match.team2_slot || fix.source_slot2;
  match.team1_original_slot = match.team1_original_slot || fix.source_slot1;
  match.team2_original_slot = match.team2_original_slot || fix.source_slot2;
  match.team1_seed = fix.source_slot1;
  match.team2_seed = fix.source_slot2;
  match.team1_source_slot = fix.source_slot1;
  match.team2_source_slot = fix.source_slot2;
  match.team1_resolved_from = fix.source_slot1;
  match.team2_resolved_from = fix.source_slot2;
  match.team1_resolved_group = fix.group1;
  match.team2_resolved_group = fix.group2;
  match.team1_resolution_status = 'resolved';
  match.team2_resolution_status = 'resolved';
  match.team1_resolution_source = fix.source_slot1.startsWith('3') ? `best-third-${fix.group1}` : `group-${fix.group1}-rank-${fix.source_slot1[0]}`;
  match.team2_resolution_source = fix.third2 ? `best-third-${fix.group2}` : `group-${fix.group2}-rank-${fix.source_slot2[0]}`;
  match.r32_official_corrected_at = nowIso;
  match.r32_official_pairing = true;

  if (fix.result) {
    const [home, away] = fix.result;
    match.status = 'finished';
    match.home_score = home;
    match.away_score = away;
    match.score = scoreObj(home, away, nowIso);
    match.score_source = match.score_source || 'r32-official-correction';
    match.live_status_detail = 'Full Time';
    match.live_clock = match.live_clock || "90'";
  } else if (!isFinished(match) && !isLive(match)) {
    // Avoid showing fake 0-0 for games that have not started.
    match.status = match.status || 'scheduled';
    match.home_score = null;
    match.away_score = null;
    if (match.score?.status_detail && /scheduled/i.test(match.score.status_detail)) {
      match.score = null;
    }
  }

  match.search_text = [
    match.team1, match.team2, match.team1_ar, match.team2_ar,
    match.ground, match.stadium, match.round, match.stage, match.stage_ar,
    match.num ? `Match ${match.num}` : '',
  ].filter(Boolean).join(' ');
  return JSON.stringify(match) !== before;
}

function teamObj(en, ar, slot, group = '') {
  return { name_ar: ar, name_en: en, group, position: '', slot, unresolved: false };
}

function applyKnockoutLiveMatch(match, fix, nowIso) {
  if (!match || !fix) return false;
  const before = JSON.stringify(match);
  match.id = match.id || fix.id;
  match.number = match.number ?? Number(fix.id.replace(/\D/g, ''));
  match.team1 = teamObj(fix.team1, fix.team1_ar, fix.source_slot1, fix.group1);
  match.team2 = teamObj(fix.team2, fix.team2_ar, fix.source_slot2, fix.group2);
  match.source_slot1 = fix.source_slot1;
  match.source_slot2 = fix.source_slot2;
  match.r32_official_corrected_at = nowIso;
  if (fix.result) {
    const [home, away] = fix.result;
    match.score1 = home;
    match.score2 = away;
    match.status = { key: 'finished', label_ar: 'انتهت', state: 'post', detail_ar: 'انتهت', detail_en: 'Final' };
  } else if (!isFinished(match) && !isLive(match)) {
    match.score1 = null;
    match.score2 = null;
    match.status = { key: 'scheduled', label_ar: 'لم تبدأ', state: 'pre', detail_ar: 'لم تبدأ', detail_en: 'Scheduled' };
  }
  return JSON.stringify(match) !== before;
}

function applyToBundle(bundle, nowIso) {
  if (!bundle || !Array.isArray(bundle.matches)) return { changed: 0, checked: 0 };
  let changed = 0;
  let checked = 0;
  for (const match of bundle.matches) {
    const fix = R32[matchNum(match)];
    if (!fix) continue;
    checked++;
    if (applyCore(match, fix, nowIso)) changed++;
  }
  if (checked) {
    bundle.metadata = {
      ...(bundle.metadata && typeof bundle.metadata === 'object' ? bundle.metadata : {}),
      r32_official_corrected_at: nowIso,
      r32_official_pairings_version: '2026-06-29-v1',
      note_ar: 'تصحيح رسمي لتوزيع مباريات دور الـ32 مع إبقاء تحديث الـ15 دقيقة كما هو.',
    };
  }
  return { changed, checked };
}

function applyToKnockoutLive(bundle, nowIso) {
  if (!bundle) return { changed: 0, checked: 0 };
  let changed = 0, checked = 0;
  const visit = (matches) => {
    if (!Array.isArray(matches)) return;
    for (const match of matches) {
      const n = matchNum(match);
      const fix = R32[n];
      if (!fix) continue;
      checked++;
      if (applyKnockoutLiveMatch(match, fix, nowIso)) changed++;
    }
  };
  visit(bundle.matches);
  if (Array.isArray(bundle.rounds)) {
    for (const round of bundle.rounds) visit(round.matches);
  }
  if (checked) {
    bundle.last_updated_at = nowIso;
    bundle.r32_official_corrected_at = nowIso;
  }
  return { changed, checked };
}

async function updateSmallStatusFiles(nowIso, summary) {
  const fingerprint = crypto.createHash('sha1').update(JSON.stringify(summary)).digest('hex').slice(0, 12);
  for (const file of [FILES.heartbeat, FILES.updateCheck, FILES.version]) {
    const obj = await readJson(file, {});
    if (obj && typeof obj === 'object') {
      obj.r32_official_correction = summary;
      obj.cache_buster = obj.cache_buster || fingerprint;
      obj.last_updated = obj.last_updated || nowIso;
      await writeJson(file, obj);
    }
  }
  const markerOld = await fs.readFile(FILES.deployMarker, 'utf8').catch(() => '');
  const lines = markerOld.split(/\r?\n/).filter(Boolean).filter((line) => !line.startsWith('r32-official-correction='));
  lines.push(`r32-official-correction=${nowIso}`);
  await fs.writeFile(FILES.deployMarker, lines.join('\n') + '\n');
}

async function main() {
  const nowIso = jordanIso();
  await fs.mkdir(WC_DIR, { recursive: true });
  const matches = await readJson(FILES.matches);
  const bracket = await readJson(FILES.bracket);
  const knockoutLive = await readJson(FILES.knockoutLive);
  if (!matches && !bracket && !knockoutLive) throw new Error('لم أجد ملفات كأس العالم المطلوب تصحيحها.');

  const matchesResult = applyToBundle(matches, nowIso);
  const bracketResult = applyToBundle(bracket, nowIso);
  const knockoutLiveResult = applyToKnockoutLive(knockoutLive, nowIso);

  if (matches) await writeJson(FILES.matches, matches);
  if (bracket) await writeJson(FILES.bracket, bracket);
  if (knockoutLive) await writeJson(FILES.knockoutLive, knockoutLive);

  const summary = {
    ok: true,
    name: 'MaenSat World Cup 2026 Round of 32 official correction',
    corrected_at: nowIso,
    timezone: TIMEZONE,
    version: '2026-06-29-v1',
    matches_file: matchesResult,
    bracket_file: bracketResult,
    knockout_live_file: knockoutLiveResult,
    corrected_pairings: Object.entries(R32).map(([num, m]) => ({ match: `M${String(num).padStart(3, '0')}`, team1: m.team1, team1_ar: m.team1_ar, team2: m.team2, team2_ar: m.team2_ar, result: m.result || null })),
    note_ar: 'هذا التصحيح يركب بعد التحديث الأصلي كل ربع ساعة حتى لا ترجع أخطاء توزيع دور الـ32.',
  };
  await writeJson(FILES.status, summary);

  const bracketStatus = await readJson(FILES.bracketStatus, null);
  if (bracketStatus && typeof bracketStatus === 'object') {
    bracketStatus.r32_official_correction = summary;
    await writeJson(FILES.bracketStatus, bracketStatus);
  }
  await updateSmallStatusFiles(nowIso, summary);
  console.log(`[worldcup-r32] corrected pairs. matches=${matchesResult.changed}/${matchesResult.checked} bracket=${bracketResult.changed}/${bracketResult.checked} knockoutLive=${knockoutLiveResult.changed}/${knockoutLiveResult.checked}`);
}

main().catch((error) => {
  console.error('[worldcup-r32] failed:', error);
  process.exitCode = 1;
});
