import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const TIMEZONE = 'Asia/Amman';
const INTERVAL_MINUTES = Number(process.env.WORLD_CUP_2026_INTERVAL_MINUTES || 15);
const ESPN_URL = process.env.WORLD_CUP_2026_ESPN_SCOREBOARD_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200';
const BROADCAST_SOURCE_URL = process.env.WORLD_CUP_2026_BROADCAST_SOURCE_URL || '';

const CORE_JSON_FILES = [
  'matches.json',
  'broadcasts.json',
  'standings.json',
  'bracket.json',
  'groups.json',
  'data-sources.json',
  'broadcast-source.json',
  'broadcast-observed.json',
  'broadcast-review.json',
  'broadcast-trusted-sources.json',
  'bein-news-sources.json'
];

const TEAM_ALIASES = new Map([
  ['usa', 'united states'],
  ['united states of america', 'united states'],
  ['usmnt', 'united states'],
  ['england', 'england'],
  ['korea republic', 'south korea'],
  ['south korea', 'south korea'],
  ['cote divoire', 'ivory coast'],
  ['côte d’ivoire', 'ivory coast'],
  ['côte d\'ivoire', 'ivory coast'],
  ['ivory coast', 'ivory coast'],
  ['iran', 'iran'],
  ['ir iran', 'iran'],
  ['uae', 'united arab emirates'],
  ['united arab emirates', 'united arab emirates'],
  ['ksa', 'saudi arabia'],
  ['saudi arabia', 'saudi arabia']
]);

function pad2(value) {
  return String(value).padStart(2, '0');
}

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
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour,
    minute: pick('minute'),
    second: pick('second')
  };
}

function jordanIso(date = new Date()) {
  const p = jordanParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}

function jordanDateKey(date = new Date()) {
  const p = jordanParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalizeText(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, ' ')
    .toLowerCase()
    .trim();
}

function normalizeTeam(input) {
  const clean = normalizeText(input);
  if (!clean) return '';
  return TEAM_ALIASES.get(clean) || clean;
}

function parseDateMaybe(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function matchDateKey(match = {}) {
  const date = parseDateMaybe(match.kickoff_utc || match.kickoff_jordan || match.date || match.start_time || match.time);
  return date ? jordanDateKey(date) : '';
}

function getMatchId(match = {}) {
  return String(match.id || match.match_id || match.matchId || match.slug || '').trim();
}

function getMatchTeams(match = {}) {
  const home = match.home_team || match.homeTeam || match.team1 || match.team_home || match.home || match.teams?.home?.name || match.competitors?.home?.name;
  const away = match.away_team || match.awayTeam || match.team2 || match.team_away || match.away || match.teams?.away?.name || match.competitors?.away?.name;
  return { home: String(home || ''), away: String(away || '') };
}

function matchKey(match = {}) {
  const id = getMatchId(match);
  const { home, away } = getMatchTeams(match);
  const teams = [normalizeTeam(home), normalizeTeam(away)].filter(Boolean).sort().join('|');
  const date = matchDateKey(match);
  return id || `${date}|${teams}`;
}

function buildRunInfo() {
  return {
    run_id: process.env.GITHUB_RUN_ID || '',
    run_number: process.env.GITHUB_RUN_NUMBER || '',
    workflow: process.env.GITHUB_WORKFLOW || '',
    event_name: process.env.GITHUB_EVENT_NAME || '',
    event_schedule: process.env.GITHUB_EVENT_SCHEDULE || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    ref: process.env.GITHUB_REF || '',
    sha: process.env.GITHUB_SHA || '',
    trigger_source: process.env.WORLD_CUP_2026_TRIGGER_SOURCE || '',
    external_forced_at: process.env.WORLD_CUP_2026_FORCED_AT || ''
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, { allowEmptyObject = true } = {}) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim() && allowEmptyObject) return { data: {}, raw, error: null };
    return { data: JSON.parse(raw), raw, error: null };
  } catch (error) {
    return { data: null, raw: '', error };
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const body = JSON.stringify(data, null, 2) + '\n';
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, body, 'utf8');
  await fs.rename(temp, filePath);
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
}

function ensureObject(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data;
}

function touchMetadata(data, nowIso, runInfo, extra = {}) {
  const object = ensureObject(data);
  if (!object) return false;
  object.metadata ||= {};
  const meta = object.metadata;
  if (!meta.last_data_change_at && meta.last_updated) meta.last_data_change_at = meta.last_updated;
  meta.last_checked_at = nowIso;
  meta.last_updated = nowIso;
  meta.automation_heartbeat = true;
  meta.automation_heartbeat_at = nowIso;
  meta.force_quarter_hour_update = true;
  meta.refresh_interval_minutes = INTERVAL_MINUTES;
  meta.cache_buster = crypto.createHash('sha1').update(`${nowIso}:${runInfo.run_id}:${runInfo.sha}`).digest('hex').slice(0, 16);
  meta.github_run_id = runInfo.run_id;
  meta.github_run_number = runInfo.run_number;
  meta.github_sha = runInfo.sha;
  meta.github_event_name = runInfo.event_name;
  meta.github_trigger_source = runInfo.trigger_source;
  meta.external_forced_at = runInfo.external_forced_at;
  meta.cloudflare_deploy_trigger = true;
  meta.note_ar = 'تم فحص بيانات كأس العالم والقنوات تلقائياً. هذا الوقت يتغير كل ربع ساعة لإجبار GitHub وCloudflare Pages على نشر نسخة حديثة.';
  Object.assign(meta, extra);
  return true;
}

async function fetchJson(url, label, timeoutMs = 25_000) {
  if (!url) return { ok: false, skipped: true, label, url, error: 'empty url' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json,text/plain,*/*',
        'user-agent': 'maensat-worldcup-quarter-hour-check/1.0'
      }
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, label, url, status: response.status, error: text.slice(0, 300) };
    }
    try {
      return { ok: true, label, url, status: response.status, data: JSON.parse(text) };
    } catch (error) {
      return { ok: false, label, url, status: response.status, error: `Invalid JSON: ${error.message}`, preview: text.slice(0, 300) };
    }
  } catch (error) {
    return { ok: false, label, url, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

function extractEspnEvents(scoreboard) {
  const events = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  return events.map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const statusType = competition.status?.type || event.status?.type || {};
    const state = String(statusType.state || '').toLowerCase();
    const statusName = statusType.name || statusType.description || event.status?.type?.name || '';
    const completed = Boolean(statusType.completed || competition.status?.type?.completed || event.status?.type?.completed);
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    return {
      id: String(event.id || competition.id || ''),
      date: event.date || competition.date || '',
      home: home.team?.displayName || home.team?.shortDisplayName || home.team?.name || '',
      away: away.team?.displayName || away.team?.shortDisplayName || away.team?.name || '',
      home_score: Number.isFinite(homeScore) ? homeScore : null,
      away_score: Number.isFinite(awayScore) ? awayScore : null,
      state,
      completed,
      status: completed ? 'finished' : state === 'in' ? 'live' : state === 'pre' ? 'scheduled' : normalizeText(statusName),
      status_detail: statusName || '',
      source_url: ESPN_URL
    };
  }).filter((event) => event.home && event.away);
}

function isSameMatch(localMatch, event) {
  const localId = getMatchId(localMatch);
  if (localId && event.id && localId === event.id) return true;

  const localTeams = getMatchTeams(localMatch);
  const localHome = normalizeTeam(localTeams.home);
  const localAway = normalizeTeam(localTeams.away);
  const eventHome = normalizeTeam(event.home);
  const eventAway = normalizeTeam(event.away);
  const sameDirection = localHome && localAway && localHome === eventHome && localAway === eventAway;
  const reverseDirection = localHome && localAway && localHome === eventAway && localAway === eventHome;
  if (!sameDirection && !reverseDirection) return false;

  const localDate = matchDateKey(localMatch);
  const eventDate = event.date ? jordanDateKey(new Date(event.date)) : '';
  return !localDate || !eventDate || localDate === eventDate;
}

function applyEspnToMatches(matchesData, espnEvents, nowIso) {
  if (!matchesData || !Array.isArray(matchesData.matches)) return { updated: 0, checked: espnEvents.length };
  let updated = 0;

  for (const match of matchesData.matches) {
    const event = espnEvents.find((candidate) => isSameMatch(match, candidate));
    if (!event) continue;

    match.live_checked_at = nowIso;
    match.live_score_source = 'espn';
    match.live_score_source_url = event.source_url;
    match.live_status_detail = event.status_detail || match.live_status_detail || '';

    if (event.status) match.status = event.status;
    if (Number.isFinite(event.home_score) && Number.isFinite(event.away_score)) {
      match.home_score = event.home_score;
      match.away_score = event.away_score;
      match.score ||= {};
      const pair = [event.home_score, event.away_score];
      if (event.completed || event.status === 'finished') {
        match.score.ft = pair;
        delete match.score.current;
        delete match.score.live;
      } else if (event.status === 'live') {
        match.score.current = pair;
        match.score.live = pair;
      }
      match.score.source = 'espn';
      match.score.status_detail = event.status_detail;
      match.score.checked_at = nowIso;
      updated += 1;
    }
  }

  matchesData.metadata ||= {};
  matchesData.metadata.live_score_source = 'espn';
  matchesData.metadata.live_score_checked_at = nowIso;
  matchesData.metadata.live_score_events_seen = espnEvents.length;
  matchesData.metadata.live_score_matches_updated = updated;
  return { updated, checked: espnEvents.length };
}

function arrayFromUnknown(data, preferredKeys = []) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function getBroadcastId(item = {}) {
  return String(item.match_id || item.matchId || item.id || item.slug || item.fixture_id || '').trim();
}

function mergeBroadcastItem(target, source, nowIso) {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return false;
  const before = JSON.stringify(target);
  for (const key of ['channels', 'broadcasters', 'broadcasts', 'tv_channels', 'channel', 'status', 'fta_status', 'notes', 'note_ar', 'source', 'source_url']) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') target[key] = source[key];
  }
  target.last_checked_at = nowIso;
  target.broadcast_checked_at = nowIso;
  target.broadcast_source_merge = true;
  return JSON.stringify(target) !== before;
}

function mergeBroadcastSources(broadcastsData, sourceData, nowIso) {
  if (!broadcastsData || typeof broadcastsData !== 'object') return { updated: 0, sourceItems: 0 };
  const targetItems = arrayFromUnknown(broadcastsData, ['matches', 'broadcasts', 'items', 'games']);
  const sourceItems = arrayFromUnknown(sourceData, ['matches', 'broadcasts', 'items', 'games']);
  if (!targetItems.length || !sourceItems.length) return { updated: 0, sourceItems: sourceItems.length };

  let updated = 0;
  for (const sourceItem of sourceItems) {
    const id = getBroadcastId(sourceItem);
    const target = targetItems.find((item) => {
      const targetId = getBroadcastId(item);
      if (id && targetId && id === targetId) return true;
      const targetKey = matchKey(item);
      const sourceKey = matchKey(sourceItem);
      return targetKey && sourceKey && targetKey === sourceKey;
    });
    if (target && mergeBroadcastItem(target, sourceItem, nowIso)) updated += 1;
  }
  return { updated, sourceItems: sourceItems.length };
}

async function loadOptionalLocalJson(fileName) {
  const filePath = path.join(WC_DIR, fileName);
  if (!(await exists(filePath))) return null;
  const { data, error } = await readJson(filePath);
  if (error) return null;
  return data;
}

async function main() {
  await fs.mkdir(WC_DIR, { recursive: true });
  const now = new Date();
  const nowIso = jordanIso(now);
  const nextIso = jordanIso(addMinutes(now, INTERVAL_MINUTES));
  const runInfo = buildRunInfo();

  const errors = [];
  const changedFiles = [];

  const espnResult = await fetchJson(ESPN_URL, 'espn-scoreboard');
  const espnEvents = espnResult.ok ? extractEspnEvents(espnResult.data) : [];
  if (!espnResult.ok) errors.push({ source: 'espn-scoreboard', error: espnResult.error || `HTTP ${espnResult.status || ''}`.trim(), checked_at: nowIso });

  let externalBroadcastResult = { ok: false, skipped: true, label: 'broadcast-source-url', error: 'not configured' };
  if (BROADCAST_SOURCE_URL) {
    externalBroadcastResult = await fetchJson(BROADCAST_SOURCE_URL, 'broadcast-source-url');
    if (!externalBroadcastResult.ok) errors.push({ source: 'broadcast-source-url', url: BROADCAST_SOURCE_URL, error: externalBroadcastResult.error || `HTTP ${externalBroadcastResult.status || ''}`.trim(), checked_at: nowIso });
  }

  const localBroadcastSource = await loadOptionalLocalJson('broadcast-source.json');
  const localObservedSource = await loadOptionalLocalJson('broadcast-observed.json');
  const localTrustedSource = await loadOptionalLocalJson('broadcast-trusted-sources.json');

  for (const fileName of CORE_JSON_FILES) {
    const filePath = path.join(WC_DIR, fileName);
    const isPresent = await exists(filePath);
    if (!isPresent) {
      if (['matches.json', 'broadcasts.json', 'standings.json', 'bracket.json', 'groups.json', 'data-sources.json'].includes(fileName)) {
        const initial = { metadata: {}, generated_by: 'worldcup-quarter-hour-force' };
        touchMetadata(initial, nowIso, runInfo, { initialized_missing_file: true });
        await writeJson(filePath, initial);
        changedFiles.push(fileName);
      }
      continue;
    }

    const { data, error } = await readJson(filePath);
    if (error) {
      errors.push({ file: fileName, error: error.message, checked_at: nowIso });
      continue;
    }

    const object = ensureObject(data);
    if (!object) {
      errors.push({ file: fileName, error: 'Top-level JSON is not an object; not rewriting to avoid changing schema.', checked_at: nowIso });
      continue;
    }

    let extraMeta = {};
    if (fileName === 'matches.json') {
      const result = applyEspnToMatches(object, espnEvents, nowIso);
      extraMeta = {
        quarter_hour_match_check: true,
        quarter_hour_match_check_at: nowIso,
        espn_scoreboard_ok: Boolean(espnResult.ok),
        espn_events_seen: result.checked,
        espn_matches_updated: result.updated
      };
    }

    if (fileName === 'broadcasts.json') {
      const merges = [];
      if (externalBroadcastResult.ok) merges.push(mergeBroadcastSources(object, externalBroadcastResult.data, nowIso));
      if (localBroadcastSource) merges.push(mergeBroadcastSources(object, localBroadcastSource, nowIso));
      if (localObservedSource) merges.push(mergeBroadcastSources(object, localObservedSource, nowIso));
      if (localTrustedSource) merges.push(mergeBroadcastSources(object, localTrustedSource, nowIso));
      const updated = merges.reduce((sum, item) => sum + (item?.updated || 0), 0);
      const sourceItems = merges.reduce((sum, item) => sum + (item?.sourceItems || 0), 0);
      extraMeta = {
        quarter_hour_broadcast_check: true,
        quarter_hour_broadcast_check_at: nowIso,
        external_broadcast_source_configured: Boolean(BROADCAST_SOURCE_URL),
        external_broadcast_source_ok: Boolean(externalBroadcastResult.ok),
        broadcast_source_items_seen: sourceItems,
        broadcast_items_updated: updated,
        broadcast_note_ar: 'تم فحص مصادر القنوات كل ربع ساعة. إذا لم يوجد مصدر خارجي مضبوط، يتم الحفاظ على القنوات اليدوية/المحلية وتحديث وقت الفحص فقط.'
      };
    }

    touchMetadata(object, nowIso, runInfo, extraMeta);
    await writeJson(filePath, object);
    changedFiles.push(fileName);
  }

  const status = {
    name: 'Maensat World Cup 2026 quarter-hour forced check',
    timezone: TIMEZONE,
    last_checked_at: nowIso,
    last_updated: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: INTERVAL_MINUTES,
    source: 'github-actions',
    github: runInfo,
    checks: {
      espn_scoreboard: {
        ok: Boolean(espnResult.ok),
        url: ESPN_URL,
        events_seen: espnEvents.length,
        error: espnResult.ok ? '' : espnResult.error || ''
      },
      broadcast_source_url: {
        configured: Boolean(BROADCAST_SOURCE_URL),
        ok: Boolean(externalBroadcastResult.ok),
        url: BROADCAST_SOURCE_URL,
        error: externalBroadcastResult.ok ? '' : externalBroadcastResult.error || ''
      },
      files_written: changedFiles,
      errors_count: errors.length
    },
    cache_buster: crypto.createHash('sha1').update(`${nowIso}:${JSON.stringify(changedFiles)}:${runInfo.run_id}`).digest('hex'),
    note_ar: 'هذا الملف يتغير كل ربع ساعة حتى لو لم تتغير النتيجة أو القنوات، حتى يجبر GitHub وCloudflare Pages على نشر نسخة حديثة.'
  };

  await writeJson(path.join(WC_DIR, 'heartbeat.json'), status);
  await writeJson(path.join(WC_DIR, 'update-check.json'), { ...status, errors });
  await writeJson(path.join(WC_DIR, 'version.json'), {
    version: status.cache_buster.slice(0, 12),
    generated_at: nowIso,
    next_expected_check_at: nextIso,
    refresh_interval_minutes: INTERVAL_MINUTES,
    github: runInfo
  });

  const marker = [
    'World Cup 2026 quarter-hour deploy marker',
    `last_checked_at=${nowIso}`,
    `next_expected_check_at=${nextIso}`,
    `timezone=${TIMEZONE}`,
    `github_run_id=${runInfo.run_id}`,
    `github_run_number=${runInfo.run_number}`,
    `github_sha=${runInfo.sha}`,
    `files_written=${changedFiles.join(',')}`,
    `errors=${errors.length}`,
    'cloudflare_deploy_trigger=true',
    'deploy_hook_secret_name=CLOUDFLARE_PAGES_DEPLOY_HOOK',
    ''
  ].join('\n');
  await writeText(path.join(WC_DIR, 'deploy-marker.txt'), marker);

  if (errors.length) {
    await writeJson(path.join(WC_DIR, 'update-errors.json'), {
      last_checked_at: nowIso,
      errors,
      note_ar: 'هذه أخطاء فحص غير قاتلة. التحديث القسري والنبض يستمران حتى لو فشل مصدر خارجي.'
    });
  }

  console.log(`[worldcup-quarter-hour-force] checked at ${nowIso}`);
  console.log(`[worldcup-quarter-hour-force] wrote files: ${changedFiles.join(', ') || 'heartbeat only'}`);
  console.log(`[worldcup-quarter-hour-force] ESPN events seen: ${espnEvents.length}`);
  console.log(`[worldcup-quarter-hour-force] errors: ${errors.length}`);
}

main().catch((error) => {
  console.error('[worldcup-quarter-hour-force] Fatal error:', error);
  process.exit(1);
});
