import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const wcDir = path.join(repoRoot, 'public', 'worldcup-2026');

const matchesPath = path.join(wcDir, 'matches.json');
const broadcastsPath = path.join(wcDir, 'broadcasts.json');
const sourceConfigPath = path.join(wcDir, 'data-sources.json');
const broadcastSourcePath = path.join(wcDir, 'broadcast-source.json');
const broadcastObservedPath = path.join(wcDir, 'broadcast-observed.json');

const TEAM_ALIASES = {
  USA: ['USA', 'United States', 'US', 'U.S.', 'U.S.A.', 'America', 'الولايات المتحدة', 'أمريكا', 'امريكا'],
  'United States': ['USA', 'United States', 'US', 'U.S.', 'U.S.A.', 'America', 'الولايات المتحدة', 'أمريكا', 'امريكا'],
  Paraguay: ['Paraguay', 'باراغواي', 'باراجواي'],
  Mexico: ['Mexico', 'المكسيك'],
  'South Africa': ['South Africa', 'جنوب أفريقيا', 'جنوب افريقيا'],
  'Korea Republic': ['Korea Republic', 'South Korea', 'Korea', 'كوريا الجنوبية', 'كوريا'],
  Czechia: ['Czechia', 'Czech Republic', 'التشيك', 'جمهورية التشيك'],
  Canada: ['Canada', 'كندا'],
  'Bosnia-Herzegovina': ['Bosnia-Herzegovina', 'Bosnia and Herzegovina', 'Bosnia', 'البوسنة والهرسك', 'البوسنة'],
  Qatar: ['Qatar', 'قطر'],
  Switzerland: ['Switzerland', 'سويسرا'],
  Brazil: ['Brazil', 'البرازيل'],
  Morocco: ['Morocco', 'المغرب'],
  Haiti: ['Haiti', 'هايتي'],
  Scotland: ['Scotland', 'اسكتلندا', 'إسكتلندا'],
  Türkiye: ['Türkiye', 'Turkey', 'Turkiye', 'تركيا'],
  Turkey: ['Türkiye', 'Turkey', 'Turkiye', 'تركيا'],
  Australia: ['Australia', 'أستراليا', 'استراليا'],
  Austria: ['Austria', 'النمسا'],
  Jordan: ['Jordan', 'الأردن', 'الاردن'],
  Algeria: ['Algeria', 'الجزائر'],
  Argentina: ['Argentina', 'الأرجنتين', 'الارجنتين'],
  England: ['England', 'إنجلترا', 'انجلترا'],
  France: ['France', 'فرنسا'],
  Spain: ['Spain', 'إسبانيا', 'اسبانيا'],
  Germany: ['Germany', 'ألمانيا', 'المانيا'],
  Portugal: ['Portugal', 'البرتغال'],
  Netherlands: ['Netherlands', 'Holland', 'هولندا'],
  Japan: ['Japan', 'اليابان'],
  Belgium: ['Belgium', 'بلجيكا'],
  Croatia: ['Croatia', 'كرواتيا'],
  Uruguay: ['Uruguay', 'الأوروغواي', 'اوروجواي', 'الأوروجواي'],
  Colombia: ['Colombia', 'كولومبيا'],
  Chile: ['Chile', 'تشيلي'],
  Ecuador: ['Ecuador', 'الإكوادور', 'الاكوادور'],
  Peru: ['Peru', 'بيرو'],
  Iran: ['Iran', 'إيران', 'ايران'],
  'Saudi Arabia': ['Saudi Arabia', 'السعودية', 'المملكة العربية السعودية'],
  Egypt: ['Egypt', 'مصر'],
  Tunisia: ['Tunisia', 'تونس'],
  Ghana: ['Ghana', 'غانا'],
  Senegal: ['Senegal', 'السنغال'],
  Nigeria: ['Nigeria', 'نيجيريا'],
  Cameroon: ['Cameroon', 'الكاميرون'],
  'Ivory Coast': ['Ivory Coast', "Côte d'Ivoire", 'Cote d Ivoire', 'كوت ديفوار', 'ساحل العاج'],
  Poland: ['Poland', 'بولندا'],
  Denmark: ['Denmark', 'الدنمارك'],
  Sweden: ['Sweden', 'السويد'],
  Norway: ['Norway', 'النرويج'],
  Wales: ['Wales', 'ويلز'],
  Serbia: ['Serbia', 'صربيا']
};

function westernDigits(value = '') {
  return String(value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function normalizeText(value = '') {
  return westernDigits(String(value))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/&amp;/g, '&')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function compactKey(value = '') {
  return normalizeText(value).replace(/\s+/g, '');
}

function ammanTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'MaenSat-WorldCup-Updater/2.0 (+https://maensat.pages.dev)',
        'accept': 'text/html,application/json;q=0.9,*/*;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function isEnabled(source) {
  return source && source.enabled !== false && source.url;
}

function getMatchesArray(matchesData) {
  if (Array.isArray(matchesData.matches)) return matchesData.matches;
  if (Array.isArray(matchesData)) return matchesData;
  return [];
}

function teamAliases(match, side, matchesData) {
  const names = new Set();
  const team = match?.[side];
  if (team) names.add(team);
  const arKey = `${side}_ar`;
  if (match?.[arKey]) names.add(match[arKey]);
  if (matchesData?.team_ar?.[team]) names.add(matchesData.team_ar[team]);
  for (const alias of TEAM_ALIASES[team] || []) names.add(alias);
  return Array.from(names).filter(Boolean).map(String);
}

function anyAliasInText(textNorm, aliases) {
  return aliases.some(alias => {
    const key = normalizeText(alias);
    return key && textNorm.includes(key);
  });
}

function lineHasAlias(line, aliases) {
  const norm = normalizeText(line);
  return anyAliasInText(norm, aliases);
}

function htmlToLines(html = '') {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|td|section|article|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');
  return withBreaks.split(/\n+/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseScoreFromLine(line = '') {
  const clean = westernDigits(line).trim();

  // SECURITY / DATA QUALITY RULE:
  // Never parse HH:MM kickoff times as football scores.
  // The previous version accepted 22:00 as 22-0, which created fake results
  // for future matches such as Qatar vs Switzerland.
  if (/^\d{1,2}\s*[:]\s*\d{2}$/.test(clean)) return null;

  const maxReasonableGoals = 15;
  if (/^\d{1,2}\s*-\s*\d{1,2}$/.test(clean)) {
    const [a, b] = clean.split('-').map(v => Number(v.trim()));
    if (a <= maxReasonableGoals && b <= maxReasonableGoals) return [a, b];
  }
  // beIN schedule sometimes renders finished matches like: "13 Jun 4 - 1".
  const monthWords = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
  if (monthWords.test(clean)) {
    const m = clean.match(/(?:^|\s)(\d{1,2})\s*-\s*(\d{1,2})(?:\s|$)/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a <= maxReasonableGoals && b <= maxReasonableGoals) return [a, b];
    }
  }
  return null;
}

function parseScoreBetweenLines(lines, aIndex, bIndex) {
  const lo = Math.min(aIndex, bIndex);
  const hi = Math.max(aIndex, bIndex);
  for (let i = lo + 1; i < hi; i += 1) {
    const score = parseScoreFromLine(lines[i]);
    if (score) return score;
  }
  return null;
}

function getMatchKickoffDate(match) {
  const candidates = [
    match.kickoff_utc,
    match.kickoff_jordan,
    match.date_utc,
    match.utc_time,
    match.datetime_utc,
    match.datetime,
    match.kickoff,
    match.local_time,
    match.match_time,
    match.date
  ].filter(Boolean);
  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function statusFromKickoff(match, sourceStatus = '') {
  const normalizedStatus = normalizeText(sourceStatus);
  const kickoff = getMatchKickoffDate(match);
  const minutesSinceKickoff = kickoff ? (Date.now() - kickoff.getTime()) / 60000 : null;

  if (kickoff && minutesSinceKickoff < -5) return 'scheduled';
  if (/(scheduled|pre[- ]?game|not started|fixture|لم تبدا|لم تبدأ)/i.test(sourceStatus) || normalizedStatus.includes('لم تبدا')) return 'scheduled';
  if (/(full time|final|finished|ft|انتهت|نهايه|نهاية)/i.test(sourceStatus) || normalizedStatus.includes('انتهت')) return 'finished';
  if (/(live|in progress|halftime|half time|ht|مباشر|الشوط)/i.test(sourceStatus)) return 'live';
  if (!kickoff) return 'scheduled';

  if (minutesSinceKickoff >= 150) return 'finished';
  if (minutesSinceKickoff >= -5) return 'live';
  return 'scheduled';
}

function makeCandidate({ match, source, homeScore, awayScore, status = '', confidence = 0, evidence = '' }) {
  const hs = Number(homeScore);
  const as = Number(awayScore);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;

  // Reject impossible/time-derived scores. This prevents 22:00 becoming 22-0.
  if (hs < 0 || as < 0 || hs > 15 || as > 15) return null;

  const kickoff = getMatchKickoffDate(match);
  if (kickoff && Date.now() < kickoff.getTime() - 5 * 60000) return null;

  const resolvedStatus = statusFromKickoff(match, status);
  if (resolvedStatus === 'scheduled') return null;
  return {
    id: String(match.id),
    home_score: hs,
    away_score: as,
    status: resolvedStatus,
    source_name: source.name,
    source_url: source.url,
    trust: Number(source.trust || 50),
    confidence: Number(confidence || source.trust || 50),
    evidence: evidence.slice(0, 300),
    collected_at: ammanTimestamp()
  };
}

function collectCandidatesFromBeinPage(html, source, matchesData) {
  const lines = htmlToLines(html);
  const matches = getMatchesArray(matchesData);
  const candidates = [];

  for (const match of matches) {
    const aAliases = teamAliases(match, 'team1', matchesData);
    const bAliases = teamAliases(match, 'team2', matchesData);
    const aLines = [];
    const bLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lineHasAlias(lines[i], aAliases)) aLines.push(i);
      if (lineHasAlias(lines[i], bAliases)) bLines.push(i);
    }
    let best = null;
    for (const ai of aLines) {
      for (const bi of bLines) {
        const distance = Math.abs(ai - bi);
        if (distance > 8) continue;
        const score = parseScoreBetweenLines(lines, ai, bi);
        if (!score) continue;
        const [left, right] = score;
        const team1First = ai < bi;
        const homeScore = team1First ? left : right;
        const awayScore = team1First ? right : left;
        const context = lines.slice(Math.max(0, Math.min(ai, bi) - 2), Math.min(lines.length, Math.max(ai, bi) + 3)).join(' | ');
        const candidate = makeCandidate({
          match,
          source,
          homeScore,
          awayScore,
          status: context,
          confidence: Math.min(99, Number(source.trust || 90) + (distance <= 3 ? 3 : 0)),
          evidence: context
        });
        if (!candidate) continue;
        if (!best || candidate.confidence > best.confidence) best = candidate;
      }
    }
    if (best) candidates.push(best);
  }
  return candidates;
}

function dateYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getDateWindow(days = 2) {
  const out = [];
  const now = new Date();
  for (let delta = -days; delta <= days; delta += 1) {
    const d = new Date(now.getTime() + delta * 86400000);
    out.push(dateYmd(d));
  }
  return out;
}

function namesFromEspnCompetitor(comp = {}) {
  const team = comp.team || {};
  return [team.name, team.displayName, team.shortDisplayName, team.abbreviation, team.location].filter(Boolean).map(String);
}

function matchFromSourceNames(matchesData, namesA, namesB) {
  const matches = getMatchesArray(matchesData);
  const aNorm = normalizeText(namesA.join(' '));
  const bNorm = normalizeText(namesB.join(' '));
  for (const match of matches) {
    const mA = teamAliases(match, 'team1', matchesData);
    const mB = teamAliases(match, 'team2', matchesData);
    const direct = anyAliasInText(aNorm, mA) && anyAliasInText(bNorm, mB);
    const reverse = anyAliasInText(aNorm, mB) && anyAliasInText(bNorm, mA);
    if (direct) return { match, reversed: false };
    if (reverse) return { match, reversed: true };
  }
  return null;
}

function candidatesFromEspnPayload(payload, source, matchesData) {
  const candidates = [];
  for (const event of payload?.events || []) {
    for (const competition of event.competitions || []) {
      const competitors = competition.competitors || [];
      if (competitors.length < 2) continue;
      const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
      const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
      const found = matchFromSourceNames(matchesData, namesFromEspnCompetitor(home), namesFromEspnCompetitor(away));
      if (!found) continue;
      const homeScore = Number(home.score);
      const awayScore = Number(away.score);
      const sourceStatus = event.status?.type?.description || event.status?.type?.name || event.status?.type?.state || '';
      const candidate = makeCandidate({
        match: found.match,
        source,
        homeScore: found.reversed ? awayScore : homeScore,
        awayScore: found.reversed ? homeScore : awayScore,
        status: sourceStatus,
        confidence: Number(source.trust || 88),
        evidence: `${event.name || event.shortName || ''} ${sourceStatus}`.trim()
      });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function flattenObjects(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) flattenObjects(item, out);
    return out;
  }
  out.push(value);
  for (const item of Object.values(value)) flattenObjects(item, out);
  return out;
}

function valueByKeys(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function candidatesFromCommonJson(payload, source, matchesData) {
  const candidates = [];
  const objects = flattenObjects(payload);
  for (const obj of objects) {
    const strings = Object.values(obj).filter(v => ['string', 'number'].includes(typeof v)).join(' ');
    const textNorm = normalizeText(strings);
    for (const match of getMatchesArray(matchesData)) {
      const aAliases = teamAliases(match, 'team1', matchesData);
      const bAliases = teamAliases(match, 'team2', matchesData);
      if (!anyAliasInText(textNorm, aAliases) || !anyAliasInText(textNorm, bAliases)) continue;

      const homeScore = valueByKeys(obj, ['home_score', 'homeScore', 'score1', 'team1_score', 'team1Score', 'homeGoals', 'goals_home', 'goalsForHome']);
      const awayScore = valueByKeys(obj, ['away_score', 'awayScore', 'score2', 'team2_score', 'team2Score', 'awayGoals', 'goals_away', 'goalsForAway']);
      if (homeScore === undefined || awayScore === undefined) continue;
      const status = String(valueByKeys(obj, ['status', 'state', 'matchStatus', 'status_detail', 'statusDetail']) || '');
      const candidate = makeCandidate({
        match,
        source,
        homeScore,
        awayScore,
        status,
        confidence: Number(source.trust || 70),
        evidence: strings.slice(0, 300)
      });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

async function collectResultCandidates(config, matchesData) {
  const candidates = [];
  const sources = config.results_sources || [];
  for (const source of sources.filter(isEnabled)) {
    try {
      if (source.type === 'bein_worldcup_page' || source.type === 'html') {
        const html = await fetchText(source.url);
        candidates.push(...collectCandidatesFromBeinPage(html, source, matchesData));
      } else if (source.type === 'espn_scoreboard') {
        const days = Number(source.date_window_days || 2);
        for (const date of getDateWindow(days)) {
          const joiner = source.url.includes('?') ? '&' : '?';
          const text = await fetchText(`${source.url}${joiner}dates=${date}`);
          candidates.push(...candidatesFromEspnPayload(JSON.parse(text), source, matchesData));
        }
      } else if (source.type === 'json_common') {
        const text = await fetchText(source.url);
        candidates.push(...candidatesFromCommonJson(JSON.parse(text), source, matchesData));
      }
    } catch (error) {
      console.warn(`⚠️ Source failed: ${source.name}: ${error.message}`);
    }
  }
  return candidates;
}

function candidateRank(candidate) {
  return Number(candidate.trust || 0) * 2 + Number(candidate.confidence || 0) + (candidate.status === 'finished' ? 10 : 0);
}

function mergeResultCandidates(matchesData, candidates) {
  const matches = getMatchesArray(matchesData);
  const byId = new Map();
  for (const candidate of candidates) {
    const id = String(candidate.id);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(candidate);
  }

  const changes = [];
  const conflicts = [];
  for (const match of matches) {
    const id = String(match.id);
    const list = (byId.get(id) || []).sort((a, b) => candidateRank(b) - candidateRank(a));
    if (!list.length) continue;

    const top = list[0];
    const differs = Number(match.home_score) !== top.home_score || Number(match.away_score) !== top.away_score || match.status !== top.status;
    const disagree = list.filter(c => c.home_score !== top.home_score || c.away_score !== top.away_score);
    if (disagree.length) conflicts.push({ id, chosen: top, alternatives: disagree.slice(0, 3) });

    if (differs) {
      match.status = top.status;
      match.home_score = top.home_score;
      match.away_score = top.away_score;
      match.score = {
        ft: top.status === 'finished' ? [top.home_score, top.away_score] : undefined,
        current: top.status === 'live' ? [top.home_score, top.away_score] : undefined,
        source: top.source_name,
        status_detail: top.status === 'finished' ? 'FT' : 'LIVE'
      };
      Object.keys(match.score).forEach(k => match.score[k] === undefined && delete match.score[k]);
      match.score_source = top.source_name;
      match.live_status_detail = top.status === 'finished' ? 'FT' : 'LIVE';
      match.live_clock = top.status === 'live' ? (match.live_clock || '') : null;
      changes.push(`${id}: ${match.team1} ${top.home_score}-${top.away_score} ${match.team2} (${top.source_name})`);
    }
    match.score_sources = list.slice(0, 5).map(c => ({
      source_name: c.source_name,
      source_url: c.source_url,
      status: c.status,
      home_score: c.home_score,
      away_score: c.away_score,
      confidence: c.confidence,
      collected_at: c.collected_at
    }));
  }
  return { changes, conflicts };
}

function channelKey(channel = {}) {
  return compactKey(`${channel.name_en || ''} ${channel.name_ar || ''}`);
}

function mergeChannels(existing = [], incoming = []) {
  const out = Array.isArray(existing) ? [...existing] : [];
  for (const channel of incoming.filter(Boolean)) {
    const key = channelKey(channel);
    const idx = out.findIndex(c => channelKey(c) === key);
    if (idx >= 0) out[idx] = { ...out[idx], ...channel };
    else out.push(channel);
  }
  return out;
}

function officialBeinDefaultChannels(sourceUrl = '') {
  return [
    {
      name_ar: 'beIN SPORTS MAX',
      name_en: 'beIN SPORTS MAX channels',
      type: 'encrypted',
      status: 'confirmed',
      source_name: 'beIN SPORTS official coverage plan',
      source_url: sourceUrl,
      note_ar: 'beIN أعلنت تغطية كل مباريات كأس العالم 2026 عبر قنوات MAX في منطقة الشرق الأوسط وشمال أفريقيا. رقم القناة التفصيلي لكل مباراة يبقى حسب جدول beIN اليومي.',
      note_en: 'Official beIN coverage umbrella; exact per-match MAX channel depends on the daily beIN TV guide.'
    },
    {
      name_ar: 'beIN SPORTS 4K HDR',
      name_en: 'beIN SPORTS 4K HDR',
      type: 'encrypted',
      status: 'confirmed',
      source_name: 'beIN SPORTS official coverage plan',
      source_url: sourceUrl,
      note_ar: 'تظهر كخيار تغطية رسمي من beIN، وليس تأكيدًا أن كل مباراة منفردة ستعرض على 4K.'
    },
    {
      name_ar: 'beIN SPORTS المفتوحة',
      name_en: 'beIN SPORTS Free-to-air',
      type: 'free',
      status: 'pending_official_announcement',
      source_name: 'MaenSat channel policy',
      source_url: sourceUrl,
      note_ar: 'لا تُعتبر المباراة مجانية إلا عند وجود إعلان رسمي أو تأكيد مشاهدة يدوي.'
    }
  ];
}

function extractChannelsFromText(text = '', source = {}) {
  const norm = normalizeText(text);
  const channels = [];
  if (/bein\s*sports\s*max\s*1/i.test(text) || /بي\s*(?:ان|إن)\s*سبورت\s*ماكس\s*1/.test(text)) channels.push({ name_ar: 'beIN SPORTS MAX 1', name_en: 'beIN SPORTS MAX 1', type: 'encrypted', status: 'confirmed' });
  if (/bein\s*sports\s*max\s*2/i.test(text) || /بي\s*(?:ان|إن)\s*سبورت\s*ماكس\s*2/.test(text)) channels.push({ name_ar: 'beIN SPORTS MAX 2', name_en: 'beIN SPORTS MAX 2', type: 'encrypted', status: 'confirmed' });
  if (/bein\s*sports\s*4k/i.test(text) || /4\s*k\s*hdr/i.test(text) || norm.includes('4 كي')) channels.push({ name_ar: 'beIN SPORTS 4K HDR', name_en: 'beIN SPORTS 4K HDR', type: 'encrypted', status: 'confirmed' });
  if (/free\s*to\s*air|\bfta\b/i.test(text) || norm.includes('المفتوحه') || norm.includes('المجانيه') || norm.includes('القناه المفتوحه')) channels.push({ name_ar: 'beIN SPORTS المفتوحة', name_en: 'beIN SPORTS Free-to-air', type: 'free', status: 'confirmed' });
  return channels.map(channel => ({
    ...channel,
    source_name: source.name,
    source_url: source.url,
    evidence_ar: text.slice(0, 260)
  }));
}

function mergeBroadcastCandidatesFromHtml(broadcasts, html, source, matchesData) {
  const lines = htmlToLines(html);
  const matches = getMatchesArray(matchesData);
  let updated = 0;
  broadcasts.matches ||= {};
  for (const match of matches) {
    const aAliases = teamAliases(match, 'team1', matchesData);
    const bAliases = teamAliases(match, 'team2', matchesData);
    for (let i = 0; i < lines.length; i += 1) {
      if (!lineHasAlias(lines[i], aAliases)) continue;
      const windowLines = lines.slice(Math.max(0, i - 8), Math.min(lines.length, i + 12));
      const windowText = windowLines.join(' | ');
      if (!anyAliasInText(normalizeText(windowText), bAliases)) continue;
      const channels = extractChannelsFromText(windowText, source);
      if (!channels.length) continue;
      broadcasts.matches[String(match.id)] ||= { channels: [] };
      broadcasts.matches[String(match.id)].channels = mergeChannels(broadcasts.matches[String(match.id)].channels, channels);
      broadcasts.matches[String(match.id)].last_checked_at = ammanTimestamp();
      updated += 1;
      break;
    }
  }
  return updated;
}

async function mergeBroadcasts(config, matchesData) {
  const broadcasts = await readJson(broadcastsPath, {
    metadata: {
      name: 'World Cup 2026 broadcasters for Jordan / MENA',
      name_ar: 'القنوات الناقلة لكأس العالم 2026 - الأردن / الشرق الأوسط وشمال أفريقيا',
      region: 'Jordan / MENA'
    },
    default_channels: [],
    matches: {}
  });

  const now = ammanTimestamp();
  broadcasts.metadata ||= {};
  broadcasts.metadata.region = broadcasts.metadata.region || 'Jordan / MENA';
  broadcasts.metadata.last_checked_at = now;
  broadcasts.metadata.multi_source_broadcast_update = true;
  broadcasts.metadata.frequencies_included = false;
  broadcasts.metadata.policy_ar = 'لا ينشر الموقع ترددات أو روابط بث. يتم عرض القنوات الناقلة فقط، والقناة المفتوحة تبقى pending إلى أن يوجد تأكيد رسمي/يدوي للمباراة.';

  const coverageSource = (config.broadcast_sources || []).find(s => s.type === 'bein_coverage_article' && isEnabled(s));
  broadcasts.default_channels = mergeChannels(broadcasts.default_channels || [], officialBeinDefaultChannels(coverageSource?.url || ''));

  let exactUpdates = 0;
  for (const source of (config.broadcast_sources || []).filter(isEnabled)) {
    try {
      if (source.type === 'bein_worldcup_page' || source.type === 'html') {
        const html = await fetchText(source.url);
        exactUpdates += mergeBroadcastCandidatesFromHtml(broadcasts, html, source, matchesData);
      } else if (source.type === 'bein_coverage_article') {
        const html = await fetchText(source.url);
        const text = htmlToLines(html).join(' | ');
        broadcasts.metadata.bein_coverage_article_checked_at = now;
        broadcasts.metadata.bein_coverage_article_summary_ar = 'beIN تؤكد تغطية كأس العالم 2026 في MENA عبر قنوات MAX و4K مع تغطية يومية مطولة؛ رقم القناة لكل مباراة يؤخذ من جدول beIN أو التأكيد اليدوي.';
        const extra = extractChannelsFromText(text, source);
        broadcasts.default_channels = mergeChannels(broadcasts.default_channels || [], extra.length ? extra : officialBeinDefaultChannels(source.url));
      }
    } catch (error) {
      console.warn(`⚠️ Broadcast source failed: ${source.name}: ${error.message}`);
    }
  }

  // Preserve and merge optional local editorial files, if present in the repository.
  const broadcastSource = await readJson(broadcastSourcePath, null);
  if (broadcastSource?.default_channels) broadcasts.default_channels = mergeChannels(broadcasts.default_channels, broadcastSource.default_channels);
  if (broadcastSource?.matches) {
    broadcasts.matches ||= {};
    for (const [id, value] of Object.entries(broadcastSource.matches)) {
      broadcasts.matches[id] ||= { channels: [] };
      broadcasts.matches[id] = { ...broadcasts.matches[id], ...value, channels: mergeChannels(broadcasts.matches[id].channels, value.channels || []) };
    }
  }

  const observed = await readJson(broadcastObservedPath, null);
  if (observed?.matches) {
    broadcasts.matches ||= {};
    for (const [id, value] of Object.entries(observed.matches)) {
      broadcasts.matches[id] ||= { channels: [] };
      broadcasts.matches[id] = {
        ...broadcasts.matches[id],
        ...value,
        observed: true,
        channels: mergeChannels(broadcasts.matches[id].channels, value.channels || [])
      };
    }
    broadcasts.metadata.observed_broadcast_file = 'public/worldcup-2026/broadcast-observed.json';
  }

  broadcasts.metadata.exact_channel_matches_updated = exactUpdates;
  await writeJson(broadcastsPath, broadcasts);
  return { exactUpdates, defaultChannels: broadcasts.default_channels?.length || 0 };
}

function updateMatchesMetadata(matchesData, resultSummary, candidates) {
  matchesData.metadata ||= {};
  matchesData.metadata.last_checked_at = ammanTimestamp();
  matchesData.metadata.multi_source_results_update = true;
  matchesData.metadata.multi_source_result_candidates = candidates.length;
  matchesData.metadata.multi_source_result_changes = resultSummary.changes.length;
  if (resultSummary.conflicts.length) matchesData.metadata.multi_source_result_conflicts = resultSummary.conflicts.length;
}

const matchesData = await readJson(matchesPath);
const config = await readJson(sourceConfigPath, { results_sources: [], broadcast_sources: [] });

const candidates = await collectResultCandidates(config, matchesData);
const resultSummary = mergeResultCandidates(matchesData, candidates);
updateMatchesMetadata(matchesData, resultSummary, candidates);
await writeJson(matchesPath, matchesData);

const broadcastSummary = await mergeBroadcasts(config, matchesData);

if (resultSummary.changes.length) {
  console.log('✅ Multi-source result updates:');
  for (const change of resultSummary.changes) console.log(`- ${change}`);
} else {
  console.log(`ℹ️ No score changes from multi-source check. Candidates found: ${candidates.length}.`);
}
if (resultSummary.conflicts.length) console.log(`⚠️ Result conflicts detected: ${resultSummary.conflicts.length}. Highest-trust source was used.`);
console.log(`✅ Broadcast update complete. Default channels: ${broadcastSummary.defaultChannels}; exact match-channel updates: ${broadcastSummary.exactUpdates}.`);
