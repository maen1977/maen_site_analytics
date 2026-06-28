import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const REFRESH_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);
const GROUPS = 'ABCDEFGHIJKL'.split('');

const FILES = {
  bracket: path.join(WC_DIR, 'bracket.json'),
  matches: path.join(WC_DIR, 'matches.json'),
  standings: path.join(WC_DIR, 'standings.json'),
  status: path.join(WC_DIR, 'bracket-linker-status.json'),
  deployHealth: path.join(WC_DIR, 'deploy-health.json'),
  deployMarker: path.join(WC_DIR, 'deploy-marker.txt'),
  heartbeat: path.join(WC_DIR, 'heartbeat.json'),
  updateCheck: path.join(WC_DIR, 'update-check.json'),
  version: path.join(WC_DIR, 'version.json'),
};

function jordanIso(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date).replace(' ', 'T') + '+03:00';
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

function rowsFromStandings(standings) {
  const blocks = Array.isArray(standings?.standings) ? standings.standings : [];
  const map = new Map();
  for (const block of blocks) {
    const group = String(block?.group || '').trim().toUpperCase();
    if (!GROUPS.includes(group)) continue;
    const rows = Array.isArray(block?.rows) ? block.rows : [];
    map.set(group, {
      group,
      complete: block.complete === true || rows.some((r) => Number(r?.played || 0) >= 3),
      rows: rows.map((row, index) => ({ ...row, group, rank: Number(row.rank || index + 1) })),
    });
  }
  return map;
}

function teamTranslations(...bundles) {
  const out = new Map();
  for (const bundle of bundles) {
    const source = bundle?.team_ar || bundle?.teams_ar || bundle?.translations?.team_ar || {};
    for (const [key, value] of Object.entries(source || {})) {
      if (key && value) out.set(String(key), String(value));
    }
  }
  return out;
}

function cleanSlot(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parseSlot(value) {
  const raw = String(value || '').trim();
  const slot = cleanSlot(raw);
  if (!slot) return null;
  let m = slot.match(/^([12])([A-L])$/);
  if (m) return { type: 'rank', seed: slot, rank: Number(m[1]), group: m[2] };
  m = slot.match(/^3([A-L](?:\/[A-L])*)$/);
  if (m) return { type: 'third', seed: slot, groups: m[1].split('/').filter((g) => GROUPS.includes(g)) };
  m = slot.match(/^W(\d{1,3})$/);
  if (m) return { type: 'winner', seed: slot, match: Number(m[1]) };
  m = slot.match(/^L(\d{1,3})$/);
  if (m) return { type: 'loser', seed: slot, match: Number(m[1]) };
  return null;
}

function teamName(row, translations) {
  const team = String(row?.team || row?.name || '').trim();
  const team_ar = String(row?.team_ar || translations.get(team) || team).trim();
  return team ? { team, team_ar, group: row.group, rank: row.rank, row } : null;
}

function resolveRankSlot(slot, groupMap, translations) {
  const block = groupMap.get(slot.group);
  const row = block?.rows?.find((r) => Number(r.rank) === slot.rank) || block?.rows?.[slot.rank - 1];
  const named = teamName(row, translations);
  if (!named) return null;
  return {
    ...named,
    seed: slot.seed,
    source: `group-${slot.group}-rank-${slot.rank}`,
    status: block?.complete ? 'resolved' : 'provisional',
  };
}

function sortThirdRows(rows) {
  return [...rows].sort((a, b) =>
    Number(b.points || 0) - Number(a.points || 0) ||
    Number(b.goal_diff || 0) - Number(a.goal_diff || 0) ||
    Number(b.goals_for || 0) - Number(a.goals_for || 0) ||
    String(a.team || '').localeCompare(String(b.team || ''))
  );
}

function buildThirdMap(standings, groupMap) {
  let thirdRows = [];
  if (Array.isArray(standings?.best_thirds) && standings.best_thirds.length) {
    thirdRows = standings.best_thirds.map((row, index) => ({
      ...row,
      group: String(row.group || '').trim().toUpperCase(),
      rank: 3,
      best_third_rank: Number(row.best_third_rank || index + 1),
      qualified: row.qualified === true || row.current_best_third_qualifying === true || index < 8,
    }));
  } else {
    thirdRows = sortThirdRows([...groupMap.values()].map((block) => block.rows?.[2]).filter(Boolean))
      .map((row, index) => ({ ...row, rank: 3, best_third_rank: index + 1, qualified: index < 8 }));
  }
  const map = new Map();
  for (const row of thirdRows) {
    const group = String(row.group || '').trim().toUpperCase();
    if (!GROUPS.includes(group)) continue;
    if (row.qualified === false && row.current_best_third_qualifying !== true && Number(row.best_third_rank || 99) > 8) continue;
    map.set(group, row);
  }
  return map;
}

function thirdScore(row) {
  return 1_000_000 - Number(row.best_third_rank || 99) * 10_000 + Number(row.points || 0) * 100 + Number(row.goal_diff || 0) * 10 + Number(row.goals_for || 0);
}

function chooseThirdAssignments(slots, thirdMap) {
  const uniqueSlots = slots.map((slot, index) => ({ ...slot, index })).sort((a, b) => {
    const ca = a.groups.filter((g) => thirdMap.has(g)).length;
    const cb = b.groups.filter((g) => thirdMap.has(g)).length;
    return ca - cb || a.index - b.index;
  });
  let best = { score: -Infinity, picked: new Map() };

  function walk(i, used, picked, score) {
    if (i >= uniqueSlots.length) {
      if (score > best.score) best = { score, picked: new Map(picked) };
      return;
    }
    const slot = uniqueSlots[i];
    const candidates = slot.groups
      .map((group) => thirdMap.get(group))
      .filter((row) => row && !used.has(String(row.group || '').toUpperCase()))
      .sort((a, b) => thirdScore(b) - thirdScore(a));

    if (!candidates.length) {
      walk(i + 1, used, picked, score - 5000);
      return;
    }
    for (const row of candidates) {
      const group = String(row.group || '').toUpperCase();
      used.add(group);
      picked.set(slot.key, row);
      walk(i + 1, used, picked, score + thirdScore(row));
      picked.delete(slot.key);
      used.delete(group);
    }
  }

  walk(0, new Set(), new Map(), 0);
  return best.picked;
}

function sideSlot(match, side) {
  return match[`${side}_slot`] || match[`${side}_seed`] || match[`${side}_original_slot`] || match[side];
}

function rememberSlot(match, side, slot) {
  if (!slot) return;
  if (!match[`${side}_slot`]) match[`${side}_slot`] = slot;
  if (!match[`${side}_original_slot`]) match[`${side}_original_slot`] = slot;
  match[`${side}_seed`] = slot;
}

function applyResolution(match, side, slot, resolution) {
  if (!resolution?.team) return false;
  const before = JSON.stringify({ team: match[side], ar: match[`${side}_ar`] });
  rememberSlot(match, side, slot);
  match[side] = resolution.team;
  match[`${side}_ar`] = resolution.team_ar || resolution.team;
  match[`${side}_resolved_from`] = resolution.seed || slot;
  match[`${side}_resolved_group`] = resolution.group || null;
  match[`${side}_resolution_status`] = resolution.status || 'resolved';
  match[`${side}_resolution_source`] = resolution.source || 'worldcup-bracket-linker';
  return before !== JSON.stringify({ team: match[side], ar: match[`${side}_ar`] });
}

function scoreNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function penaltyScore(match, side) {
  const keys = side === 'team1'
    ? ['team1_penalties', 'home_penalties', 'penalty_home', 'penalties_home', 'pen_home']
    : ['team2_penalties', 'away_penalties', 'penalty_away', 'penalties_away', 'pen_away'];
  for (const key of keys) {
    const n = scoreNumber(match[key] ?? match.score?.[key]);
    if (n !== null) return n;
  }
  return null;
}

function finished(match) {
  const text = `${match?.status || ''} ${match?.live_status_detail || ''} ${match?.score?.status_detail || ''}`.toLowerCase();
  return Boolean(match?.score?.ft) || text.includes('finished') || text.includes('final') || text.includes('ft') || text.includes('after penalties');
}

function winnerOrLoser(match, wantWinner = true) {
  if (!match || !finished(match)) return null;
  const a = scoreNumber(match.home_score ?? match.team1_score ?? match.score?.ft?.[0]);
  const b = scoreNumber(match.away_score ?? match.team2_score ?? match.score?.ft?.[1]);
  if (a === null || b === null) return null;
  let team1Wins = a > b;
  if (a === b) {
    const pa = penaltyScore(match, 'team1');
    const pb = penaltyScore(match, 'team2');
    if (pa === null || pb === null || pa === pb) return null;
    team1Wins = pa > pb;
  }
  const pickTeam1 = wantWinner ? team1Wins : !team1Wins;
  const team = pickTeam1 ? match.team1 : match.team2;
  const team_ar = pickTeam1 ? match.team1_ar : match.team2_ar;
  if (!team || parseSlot(team)) return null;
  return { team, team_ar: team_ar || team };
}

function refreshSearchText(match) {
  match.search_text = [
    match.team1, match.team2, match.team1_ar, match.team2_ar,
    match.ground, match.stadium, match.round, match.stage, match.stage_ar,
    match.num ? `Match ${match.num}` : '',
  ].filter(Boolean).join(' ');
}

function isKnockoutMatch(match) {
  const text = `${match?.stage || ''} ${match?.round || ''} ${match?.stage_ar || ''}`.toLowerCase();
  return !/group stage|دور المجموعات/.test(text) && (Number(match?.num || 0) >= 73 || /round|دور|quarter|semi|final|32|16/.test(text));
}

function linkMatchList(matches, groupMap, thirdAssignments, translations, nowIso) {
  const byNum = new Map();
  for (const m of matches || []) {
    const n = Number(m?.num || String(m?.id || '').replace(/\D/g, ''));
    if (Number.isFinite(n)) byNum.set(n, m);
  }

  let directResolved = 0;
  let thirdResolved = 0;
  let winnerResolved = 0;
  let changed = 0;
  const unresolved = [];
  const thirdSlots = [];

  for (const match of matches || []) {
    if (!isKnockoutMatch(match)) continue;
    for (const side of ['team1', 'team2']) {
      const slot = String(sideSlot(match, side) || '').trim();
      const parsed = parseSlot(slot);
      if (!parsed) continue;
      rememberSlot(match, side, parsed.seed);
      if (parsed.type === 'rank') {
        const resolution = resolveRankSlot(parsed, groupMap, translations);
        if (resolution) {
          if (applyResolution(match, side, parsed.seed, resolution)) changed++;
          directResolved++;
        } else {
          unresolved.push({ match: match.id || match.num, side, slot: parsed.seed, reason: 'group-rank-not-ready' });
        }
      } else if (parsed.type === 'third') {
        thirdSlots.push({ key: `${match.id || match.num}:${side}`, match, side, seed: parsed.seed, groups: parsed.groups });
      } else if (parsed.type === 'winner' || parsed.type === 'loser') {
        const previous = byNum.get(parsed.match);
        const wl = winnerOrLoser(previous, parsed.type === 'winner');
        if (wl) {
          if (applyResolution(match, side, parsed.seed, { ...wl, seed: parsed.seed, source: `${parsed.type}-match-${parsed.match}`, status: 'resolved' })) changed++;
          winnerResolved++;
        } else {
          unresolved.push({ match: match.id || match.num, side, slot: parsed.seed, reason: `${parsed.type}-not-ready` });
        }
      }
    }
    refreshSearchText(match);
  }

  for (const slot of thirdSlots) {
    const row = thirdAssignments.get(slot.key);
    if (!row) {
      unresolved.push({ match: slot.match.id || slot.match.num, side: slot.side, slot: slot.seed, reason: 'best-third-not-ready-or-no-valid-assignment' });
      continue;
    }
    const named = teamName(row, translations);
    if (!named) continue;
    if (applyResolution(slot.match, slot.side, slot.seed, {
      ...named,
      seed: slot.seed,
      source: `best-third-${row.group}`,
      status: 'resolved',
    })) changed++;
    thirdResolved++;
    refreshSearchText(slot.match);
  }

  for (const match of matches || []) {
    if (isKnockoutMatch(match)) {
      match.bracket_linked_at = nowIso;
    }
  }

  return { directResolved, thirdResolved, winnerResolved, changed, unresolved };
}

function collectThirdSlots(matches) {
  const out = [];
  for (const match of matches || []) {
    if (!isKnockoutMatch(match)) continue;
    for (const side of ['team1', 'team2']) {
      const slot = String(sideSlot(match, side) || '').trim();
      const parsed = parseSlot(slot);
      if (parsed?.type === 'third') {
        out.push({ key: `${match.id || match.num}:${side}`, match, side, seed: parsed.seed, groups: parsed.groups });
      }
    }
  }
  return out;
}

async function patchStatusFiles(nowIso, summary) {
  const nextIso = jordanIso(new Date(Date.now() + REFRESH_MINUTES * 60 * 1000));
  const version = crypto.createHash('sha1').update(`${nowIso}:${JSON.stringify(summary)}`).digest('hex').slice(0, 12);

  const deployHealth = {
    name: 'MaenSat World Cup 2026 deploy health',
    last_checked_at: nowIso,
    timezone: TIMEZONE,
    github_run_id: process.env.GITHUB_RUN_ID || '',
    github_run_number: process.env.GITHUB_RUN_NUMBER || '',
    github_workflow: process.env.GITHUB_WORKFLOW || '',
    github_event_name: process.env.GITHUB_EVENT_NAME || '',
    trigger_source: process.env.WORLD_CUP_2026_TRIGGER_SOURCE || '',
    cloudflare_hook_configured: Boolean(process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK),
    cloudflare_note_ar: process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK
      ? 'تم العثور على سر CLOUDFLARE_PAGES_DEPLOY_HOOK وسيحاول الـ Action طلب نشر Cloudflare بعد الـ commit.'
      : 'سر CLOUDFLARE_PAGES_DEPLOY_HOOK غير موجود. إذا كان Cloudflare Pages غير مربوط تلقائياً بـ GitHub، سيبقى الموقع على نسخة قديمة حتى تضيف Deploy Hook أو تعيد ربط GitHub.',
    bracket_summary: summary,
  };
  await writeJson(FILES.deployHealth, deployHealth);

  const currentHeartbeat = await readJson(FILES.heartbeat, {});
  const heartbeat = {
    ...(currentHeartbeat && typeof currentHeartbeat === 'object' ? currentHeartbeat : {}),
    name: 'Maensat World Cup 2026 quarter-hour forced check',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: REFRESH_MINUTES,
    cache_buster: version,
    bracket_linker: summary,
    cloudflare_hook_configured: Boolean(process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK),
    note_ar: 'يتغير هذا الملف في كل تشغيل حتى يعرف الموقع أن هناك فحصاً جديداً للنتائج والأدوار.',
  };
  await writeJson(FILES.heartbeat, heartbeat);
  await writeJson(FILES.updateCheck, { ...heartbeat, deploy_health: deployHealth });
  await writeJson(FILES.version, { version, generated_at: nowIso, next_expected_check_at: nextIso, refresh_interval_minutes: REFRESH_MINUTES, bracket_linker: summary });

  let marker = '';
  try { marker = await fs.readFile(FILES.deployMarker, 'utf8'); } catch {}
  const markerLines = marker.split(/\r?\n/).filter((line) => line && !line.startsWith('bracket-linked=') && !line.startsWith('cache=') && !line.startsWith('cloudflare-hook='));
  markerLines.push(`bracket-linked=${nowIso}`);
  markerLines.push(`cache=${version}`);
  markerLines.push(`cloudflare-hook=${process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK ? 'configured' : 'missing'}`);
  await fs.writeFile(FILES.deployMarker, markerLines.join('\n') + '\n');
}

async function main() {
  const nowIso = jordanIso();
  await fs.mkdir(WC_DIR, { recursive: true });

  const standings = await readJson(FILES.standings, null);
  const bracket = await readJson(FILES.bracket, null);
  const matchesBundle = await readJson(FILES.matches, null);

  if (!standings || !bracket) {
    throw new Error('standings.json أو bracket.json غير موجود. شغّل تحديث كأس العالم الأساسي أولاً.');
  }
  if (!Array.isArray(bracket.matches)) bracket.matches = [];

  const groupMap = rowsFromStandings(standings);
  const translations = teamTranslations(matchesBundle, bracket, standings);
  const thirdMap = buildThirdMap(standings, groupMap);
  const allThirdSlots = [
    ...collectThirdSlots(bracket.matches),
    ...(Array.isArray(matchesBundle?.matches) ? collectThirdSlots(matchesBundle.matches) : []),
  ];
  const thirdAssignments = chooseThirdAssignments(allThirdSlots, thirdMap);

  const bracketResult = linkMatchList(bracket.matches, groupMap, thirdAssignments, translations, nowIso);
  let matchesResult = { directResolved: 0, thirdResolved: 0, winnerResolved: 0, changed: 0, unresolved: [] };
  if (Array.isArray(matchesBundle?.matches)) {
    matchesResult = linkMatchList(matchesBundle.matches, groupMap, thirdAssignments, translations, nowIso);
  }

  const summary = {
    last_linked_at: nowIso,
    timezone: TIMEZONE,
    groups_seen: [...groupMap.keys()].sort(),
    best_third_groups_seen: [...thirdMap.keys()].sort(),
    bracket: bracketResult,
    matches_file: matchesResult,
    third_assignment_count: thirdAssignments.size,
    third_assignments: [...thirdAssignments.entries()].map(([key, row]) => ({ key, group: row.group, team: row.team, team_ar: row.team_ar })),
  };

  bracket.metadata = {
    ...(bracket.metadata && typeof bracket.metadata === 'object' ? bracket.metadata : {}),
    last_checked_at: nowIso,
    last_updated: nowIso,
    timezone: TIMEZONE,
    refresh_interval_minutes: REFRESH_MINUTES,
    bracket_team_name_linker: true,
    bracket_team_name_linked_at: nowIso,
    bracket_resolution_summary: summary,
    note_ar: 'تم ربط رموز الأدوار مثل 1A و2B و3A/B/C بأسماء المتأهلين من standings.json بدون تعديل تصميم الموقع.',
  };

  await writeJson(FILES.bracket, bracket);
  if (Array.isArray(matchesBundle?.matches) && matchesResult.changed > 0) {
    matchesBundle.metadata = {
      ...(matchesBundle.metadata && typeof matchesBundle.metadata === 'object' ? matchesBundle.metadata : {}),
      last_checked_at: nowIso,
      last_updated: nowIso,
      bracket_team_name_linked_at: nowIso,
    };
    await writeJson(FILES.matches, matchesBundle);
  }
  await writeJson(FILES.status, summary);
  await patchStatusFiles(nowIso, summary);

  console.log(`[worldcup-bracket] bracket changed=${bracketResult.changed} direct=${bracketResult.directResolved} third=${bracketResult.thirdResolved} winners=${bracketResult.winnerResolved} unresolved=${bracketResult.unresolved.length}`);
}

main().catch(async (error) => {
  console.error('[worldcup-bracket] failed:', error);
  try {
    const nowIso = jordanIso();
    await writeJson(FILES.status, { last_linked_at: nowIso, ok: false, error: error.stack || error.message });
    await writeJson(FILES.deployHealth, {
      name: 'MaenSat World Cup 2026 deploy health',
      last_checked_at: nowIso,
      ok: false,
      error: error.message,
      cloudflare_hook_configured: Boolean(process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK),
    });
  } catch {}
  process.exitCode = 1;
});
