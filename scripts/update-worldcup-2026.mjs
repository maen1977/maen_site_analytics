import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const MATCHES_FILE = path.join(WC_DIR, 'matches.json');
const STANDINGS_FILE = path.join(WC_DIR, 'standings.json');
const BRACKET_FILE = path.join(WC_DIR, 'bracket.json');
const BROADCASTS_FILE = path.join(WC_DIR, 'broadcasts.json');
const BROADCAST_SOURCE_FILE = process.env.WORLD_CUP_2026_BROADCAST_SOURCE_FILE || path.join(WC_DIR, 'broadcast-source.json');
const BROADCAST_OBSERVED_FILE = process.env.WORLD_CUP_2026_BROADCAST_OBSERVED_FILE || path.join(WC_DIR, 'broadcast-observed.json');
const SOURCE_URL = process.env.WORLD_CUP_2026_SOURCE_URL || 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const LIVE_SCORE_CHECK = process.env.WORLD_CUP_2026_LIVE_SCORE_CHECK !== '0';
const LIVE_SCORE_URL = process.env.WORLD_CUP_2026_LIVE_SCORE_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200';
const BROADCAST_SOURCE_URL = process.env.WORLD_CUP_2026_BROADCAST_SOURCE_URL || '';
const BEIN_NEWS_SOURCE_FILE = process.env.WORLD_CUP_2026_BEIN_NEWS_SOURCE_FILE || path.join(WC_DIR, 'bein-news-sources.json');
const BROADCAST_REVIEW_FILE = path.join(WC_DIR, 'broadcast-review.json');
const BEIN_AUTO_CHECK = process.env.WORLD_CUP_2026_BEIN_AUTO_CHECK !== '0';
const BEIN_NEWS_URLS = String(process.env.WORLD_CUP_2026_BEIN_NEWS_URLS || '').trim();
const BEIN_MAX_DISCOVERED_ARTICLES = Number(process.env.WORLD_CUP_2026_BEIN_MAX_DISCOVERED_ARTICLES || 12);
const BEIN_CONFIRMATION_SCORE = Number(process.env.WORLD_CUP_2026_BEIN_CONFIRMATION_SCORE || 80);
const TIMEZONE = 'Asia/Amman';
const JORDAN_OFFSET_HOURS = 3;
const FAST_MATCH_WINDOW_CRON = '2,17,32,47 * * * *';
const FAST_WINDOW_BEFORE_MINUTES = Number(process.env.WORLD_CUP_2026_FAST_BEFORE_MINUTES || 60);
const FAST_WINDOW_AFTER_MINUTES = Number(process.env.WORLD_CUP_2026_FAST_AFTER_MINUTES || 300);
const BROADCAST_CHECK_BEFORE_MINUTES = Number(process.env.WORLD_CUP_2026_BROADCAST_BEFORE_MINUTES || 1440);
const BROADCAST_CHECK_AFTER_MINUTES = Number(process.env.WORLD_CUP_2026_BROADCAST_AFTER_MINUTES || 60);
const BASE_12_HOUR_CRON = '7 0,12 * * *';
const EVENT_SCHEDULE = String(process.env.GITHUB_EVENT_SCHEDULE || '').trim();
const EVENT_NAME = String(process.env.GITHUB_EVENT_NAME || '').trim();
const FORCE_UPDATE = process.env.WORLD_CUP_2026_FORCE_UPDATE === '1' || EVENT_NAME === 'workflow_dispatch';

const TEAM_AR = {
  'Mexico':'المكسيك','South Africa':'جنوب أفريقيا','South Korea':'كوريا الجنوبية','Czech Republic':'التشيك','Canada':'كندا','Bosnia & Herzegovina':'البوسنة والهرسك','Qatar':'قطر','Switzerland':'سويسرا','Brazil':'البرازيل','Morocco':'المغرب','Haiti':'هايتي','Scotland':'اسكتلندا','USA':'أمريكا','Paraguay':'باراغواي','Australia':'أستراليا','Turkey':'تركيا','Germany':'ألمانيا','Curaçao':'كوراساو','Ivory Coast':'كوت ديفوار','Ecuador':'الإكوادور','Netherlands':'هولندا','Japan':'اليابان','Sweden':'السويد','Tunisia':'تونس','Belgium':'بلجيكا','Egypt':'مصر','Iran':'إيران','New Zealand':'نيوزيلندا','Spain':'إسبانيا','Cape Verde':'الرأس الأخضر','Saudi Arabia':'السعودية','Uruguay':'الأوروغواي','France':'فرنسا','Senegal':'السنغال','Iraq':'العراق','Norway':'النرويج','Argentina':'الأرجنتين','Algeria':'الجزائر','Austria':'النمسا','Jordan':'الأردن','Portugal':'البرتغال','DR Congo':'الكونغو الديمقراطية','Uzbekistan':'أوزبكستان','Colombia':'كولومبيا','England':'إنجلترا','Croatia':'كرواتيا','Ghana':'غانا','Panama':'بنما'
};
const STAGE_AR = {'Group Stage':'دور المجموعات','Matchday 1':'دور المجموعات','Matchday 2':'دور المجموعات','Matchday 3':'دور المجموعات','Matchday 4':'دور المجموعات','Matchday 5':'دور المجموعات','Matchday 6':'دور المجموعات','Matchday 7':'دور المجموعات','Matchday 8':'دور المجموعات','Matchday 9':'دور المجموعات','Matchday 10':'دور المجموعات','Matchday 11':'دور المجموعات','Matchday 12':'دور المجموعات','Matchday 13':'دور المجموعات','Matchday 14':'دور المجموعات','Matchday 15':'دور المجموعات','Matchday 16':'دور المجموعات','Matchday 17':'دور المجموعات','Round of 32':'دور 32','Round of 16':'دور 16','Quarter-final':'ربع النهائي','Semi-final':'نصف النهائي','Match for third place':'المركز الثالث','Final':'النهائي'};
const STADIUM_NAMES = {'Mexico City':'Mexico City Stadium / Estadio Azteca','Guadalajara (Zapopan)':'Estadio Guadalajara / Estadio Akron','Monterrey (Guadalupe)':'Estadio Monterrey / Estadio BBVA','Atlanta':'Atlanta Stadium / Mercedes-Benz Stadium','Boston (Foxborough)':'Boston Stadium / Gillette Stadium','Dallas (Arlington)':'Dallas Stadium / AT&T Stadium','Houston':'Houston Stadium / NRG Stadium','Kansas City':'Kansas City Stadium / Arrowhead Stadium','Los Angeles (Inglewood)':'Los Angeles Stadium / SoFi Stadium','Miami (Miami Gardens)':'Miami Stadium / Hard Rock Stadium','New York/New Jersey (East Rutherford)':'New York New Jersey Stadium / MetLife Stadium','Philadelphia':'Philadelphia Stadium / Lincoln Financial Field','San Francisco Bay Area (Santa Clara)':"San Francisco Bay Area Stadium / Levi's Stadium",'Seattle':'Seattle Stadium / Lumen Field','Toronto':'Toronto Stadium / BMO Field','Vancouver':'Vancouver Stadium / BC Place'};

function offsetToMinutes(time='') { const m=String(time).match(/UTC([+-]\d{1,2})/); return m ? Number(m[1])*60 : 0; }
function timeParts(time='') { const m=String(time).match(/(\d{1,2}):(\d{2})/); return m ? [Number(m[1]),Number(m[2])] : [0,0]; }
function kickoffUtc(date, time) {
  const [h, min] = timeParts(time); const offsetM = offsetToMinutes(time);
  return new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7))-1, Number(date.slice(8,10)), h, min) - offsetM*60000);
}
function kickoffJordanIso(date, time) { return new Date(kickoffUtc(date,time).getTime()+JORDAN_OFFSET_HOURS*3600000).toISOString().replace('Z','+03:00'); }
function dateKeyInJordan(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const pick = (type) => parts.find(p => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
function todayKeyInJordan() {
  return process.env.WORLD_CUP_2026_TODAY || dateKeyInJordan(new Date());
}
function matchDateKeyInJordan(match) {
  if (match.kickoff_utc) return dateKeyInJordan(new Date(match.kickoff_utc));
  if (match.kickoff_jordan) return String(match.kickoff_jordan).slice(0,10);
  return String(match.date || '').slice(0,10);
}
function matchStatus(m) {
  if (m.score?.p || m.score?.et || m.score?.ft) return 'finished';
  if (m.score?.live && Array.isArray(m.score.live)) return 'live';
  if (m.status) return m.status;
  return 'scheduled';
}
function isFinishedMatch(match = {}) {
  const status = String(match.status || '').toLowerCase();
  const score = match.score || {};
  return status.includes('finished') || status === 'ft' || Boolean(score.ft || score.et || score.p);
}
function nowForSchedule() {
  const forced = process.env.WORLD_CUP_2026_NOW;
  const parsed = forced ? new Date(forced) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function kickoffMs(match = {}) {
  const raw = match.kickoff_utc || match.kickoff_jordan || match.date;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}
function scoreValue(score, index) {
  if (!score) return 0;
  if (score.live && Number.isFinite(score.live[index])) return score.live[index];
  if (score.ft && Number.isFinite(score.ft[index])) return score.ft[index];
  if (score.et && Number.isFinite(score.et[index])) return score.et[index];
  return 0;
}
function winnerOf(m) {
  const score = m.score || {}; const ft=score.et || score.ft;
  if (!ft || !Number.isFinite(ft[0]) || !Number.isFinite(ft[1])) return null;
  if (ft[0] > ft[1]) return m.team1;
  if (ft[1] > ft[0]) return m.team2;
  if (score.p && Number.isFinite(score.p[0]) && Number.isFinite(score.p[1])) return score.p[0] > score.p[1] ? m.team1 : m.team2;
  return null;
}
function loserOf(m) {
  const w = winnerOf(m); if (!w) return null; return w === m.team1 ? m.team2 : m.team1;
}
function normalizeSourceMatch(m, idx) {
  const stage = m.group ? 'Group Stage' : (m.round || ''); const num = m.num || (stage==='Group Stage' ? idx+1 : undefined);
  const utc = kickoffUtc(m.date, m.time).toISOString();
  const t1=m.team1, t2=m.team2;
  const obj = {
    id: `M${String(num || idx+1).padStart(3,'0')}`, num, round:m.round, stage, stage_ar:STAGE_AR[m.round] || STAGE_AR[stage] || m.round,
    group:(m.group||'').replace('Group ',''), date:m.date, time:m.time, kickoff_utc:utc, kickoff_jordan:kickoffJordanIso(m.date,m.time),
    team1:t1, team2:t2, team1_ar:TEAM_AR[t1] || t1, team2_ar:TEAM_AR[t2] || t2, ground:m.ground || '', stadium:STADIUM_NAMES[m.ground] || m.ground || '',
    status:matchStatus(m), home_score:scoreValue(m.score,0), away_score:scoreValue(m.score,1), score:m.score || null, score_source:m.score_source || m.score?.source || 'openfootball', live_clock:m.live_clock || m.score?.clock || null, live_status_detail:m.live_status_detail || m.score?.status_detail || null
  };
  obj.search_text = [obj.team1,obj.team2,obj.team1_ar,obj.team2_ar,obj.ground,obj.stadium,obj.stage_ar,obj.group].filter(Boolean).join(' ');
  return obj;
}
function buildGroups(matches) {
  const groups = {};
  for (const m of matches.filter(x=>x.group)) {
    groups[m.group] ||= [];
    for (const t of [m.team1, m.team2]) if (!groups[m.group].includes(t)) groups[m.group].push(t);
  }
  return groups;
}
function emptyRow(team, group) { return {team, team_ar:TEAM_AR[team]||team, group, played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,goal_diff:0,points:0,rank:null,qualified:false}; }
function computeStandings(matches, groups) {
  const standings = [];
  for (const [group,teams] of Object.entries(groups).sort()) {
    const map = new Map(teams.map(t=>[t, emptyRow(t,group)]));
    for (const m of matches.filter(x=>x.group===group && x.status==='finished')) {
      const a=map.get(m.team1), b=map.get(m.team2); if (!a||!b) continue;
      const s1=m.home_score, s2=m.away_score; a.played++; b.played++; a.goals_for+=s1; a.goals_against+=s2; b.goals_for+=s2; b.goals_against+=s1;
      if (s1>s2){a.wins++;b.losses++;a.points+=3;} else if (s2>s1){b.wins++;a.losses++;b.points+=3;} else {a.draws++;b.draws++;a.points++;b.points++;}
    }
    for (const r of map.values()) r.goal_diff = r.goals_for - r.goals_against;
    const rows=[...map.values()].sort((a,b)=>b.points-a.points || b.goal_diff-a.goal_diff || b.goals_for-a.goals_for || a.team.localeCompare(b.team));
    rows.forEach((r,i)=>{r.rank=i+1; r.qualified=i<2;}); standings.push({group, rows});
  }
  const thirds = standings.map(g=>g.rows[2]).filter(Boolean).sort((a,b)=>b.points-a.points || b.goal_diff-a.goal_diff || b.goals_for-a.goals_for || a.team.localeCompare(b.team));
  thirds.forEach((r,i)=>{r.qualified=i<8;});
  return {standings, best_thirds:thirds};
}
async function readJson(file) { try { return JSON.parse(await fs.readFile(file,'utf8')); } catch { return null; } }
async function readText(file) { try { return await fs.readFile(file,'utf8'); } catch { return ''; } }
async function fileExists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function readExistingMatchesBundle() { return readJson(MATCHES_FILE); }

function uniq(values) {
  return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
}
function decodeHtmlEntities(text = '') {
  const named = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '};
  return String(text)
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
      if (code[0] === '#') {
        const value = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : m;
      }
      return named[code] || m;
    });
}
function stripHtmlToText(html = '') {
  return decodeHtmlEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}
function normalizeArabicText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function westernDigits(value = '') {
  return String(value).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}
const EXTRA_TEAM_ALIASES = {
  'South Africa':['جنوب إفريقيا','جنوب افريقيا','جنوب أفريقيا','منتخب جنوب إفريقيا','south africa'],
  'USA':['أمريكا','امريكا','الولايات المتحدة','الولايات المتحده','المنتخب الأمريكي','usa','united states'],
  'Czech Republic':['التشيك','تشيكيا','جمهورية التشيك','czech republic','czechia'],
  'Ivory Coast':['كوت ديفوار','ساحل العاج','ivory coast','cote d ivoire'],
  'DR Congo':['الكونغو الديمقراطية','الكونغو الديموقراطية','الكونغو الديمقراطيه','dr congo','congo dr'],
  'Saudi Arabia':['السعودية','السعوديه','المنتخب السعودي','saudi arabia'],
  'South Korea':['كوريا الجنوبية','كوريا الجنوبيه','المنتخب الكوري','south korea'],
  'New Zealand':['نيوزيلندا','نيوزيلاند','new zealand'],
  'Cape Verde':['الرأس الأخضر','الراس الاخضر','كيب فيردي','cape verde'],
  'Bosnia & Herzegovina':['البوسنة والهرسك','البوسنه والهرسك','البوسنة','bosnia','bosnia and herzegovina'],
  'Curaçao':['كوراساو','curacao','curaçao'],
  'Qatar':['قطر','العنابي','qatar'],
  'Egypt':['مصر','المنتخب المصري','الفراعنة','egypt'],
  'Jordan':['الأردن','الاردن','النشامى','jordan'],
  'Mexico':['المكسيك','المكسيكي','mexico'],
  'Morocco':['المغرب','أسود الأطلس','اسود الاطلس','morocco'],
  'Tunisia':['تونس','نسور قرطاج','tunisia'],
  'Algeria':['الجزائر','الخضر','algeria']
};
function aliasesForTeam(name, arName) {
  return uniq([name, arName, ...(EXTRA_TEAM_ALIASES[name] || []), ...(EXTRA_TEAM_ALIASES[arName] || [])]);
}
function textHasAny(textNorm, aliases = []) {
  return aliases.some(alias => {
    const norm = normalizeArabicText(alias);
    return norm && textNorm.includes(norm);
  });
}
function matchConfidenceFromText(match = {}, textNorm = '') {
  const a1 = aliasesForTeam(match.team1, match.team1_ar);
  const a2 = aliasesForTeam(match.team2, match.team2_ar);
  const has1 = textHasAny(textNorm, a1);
  const has2 = textHasAny(textNorm, a2);
  const reasons = [];
  let score = 0;
  if (has1 && has2) { score += 80; reasons.push('both teams mentioned'); }
  else if (has1 || has2) { score += 35; reasons.push('one team mentioned'); }
  const dateIso = String(match.date || '').slice(0,10);
  const day = dateIso ? String(Number(dateIso.slice(8,10))) : '';
  const month = dateIso ? String(Number(dateIso.slice(5,7))) : '';
  if (day && textNorm.includes(day) && (textNorm.includes(month) || textNorm.includes('يونيو') || textNorm.includes('june'))) { score += 15; reasons.push('date hint'); }
  if (match.num === 1 && /\b(افتتاح|افتتاحيه|الافتتاحيه|opening)\b/.test(textNorm)) { score += 25; reasons.push('opening match hint'); }
  if (String(match.id || '').toLowerCase() && textNorm.includes(String(match.id).toLowerCase())) { score += 20; reasons.push('match id mentioned'); }
  return {score: Math.min(score, 100), reasons, has1, has2};
}
function hasBroadcastAction(textNorm = '') {
  return /(تبث|تبثها|ينقل|تنقل|منقوله|مباشر|بث|تغطيه|قناه|قنوات|على قناه|عبر|broadcast|live|coverage|air)/.test(textNorm);
}
function hasFreeHint(textNorm = '') {
  return /(مجانا|مجانيه|مجاني|المفتوحه|مفتوحه|free to air|free|unencrypted|fta)/.test(textNorm);
}
function hasEncryptedHint(textNorm = '') {
  return /(مشفّر|مشفر|باقة|باقة|اشتراك|مشترك|max|4k|encrypted|subscription|beinconnect|connect|اشترك|الباقات|باقة|قنوات مخصصه|مخصصه)/.test(textNorm);
}
function hasPremiumBeinHint(textNorm = '') {
  return /(max|4k|uhd|news|الاخباريه|الإخبارية|beinconnect|connect|اشترك|اشتراك|الباقات|باقة|مشترك|subscription|encrypted|مشفر|مشفّر|قنوات مخصصه|مخصصه|pay per view)/.test(textNorm);
}
function hasStandaloneBeinContext(textNorm = '') {
  return /(شاهد عبر|مشاهده عبر|متاح عبر|يبث عبر|تبث عبر|ينقل عبر|تنقل عبر|على بي ان سبورت|علي بي ان سبورت|على قناه بي ان سبورت|قناه بي ان سبورت|beIN sports live|watch on bein sports|live on bein sports|on bein sports|via bein sports)/i.test(textNorm);
}
function findSnippet(text = '', needle = '', size = 240) {
  const hay = String(text || '');
  const idx = needle ? hay.toLowerCase().indexOf(String(needle).toLowerCase()) : -1;
  const start = idx >= 0 ? Math.max(0, idx - size) : 0;
  return hay.slice(start, Math.min(hay.length, start + size * 2)).replace(/\s+/g, ' ').trim();
}
function findSnippetAt(text = '', index = 0, size = 240) {
  const hay = String(text || '');
  const idx = Number.isFinite(index) ? Math.max(0, index) : 0;
  const start = Math.max(0, idx - size);
  return hay.slice(start, Math.min(hay.length, idx + size)).replace(/\s+/g, ' ').trim();
}
function channelKey(channel = {}) {
  return normalizeArabicText([channel.name_en, channel.name_ar, channel.type].filter(Boolean).join(' '));
}
function upsertChannels(existing = [], incoming = []) {
  const out = Array.isArray(existing) ? JSON.parse(JSON.stringify(existing)) : [];
  for (const channel of incoming || []) {
    const key = channelKey(channel);
    const idx = out.findIndex(c => channelKey(c) === key);
    if (idx >= 0) out[idx] = {...out[idx], ...channel};
    else out.push(channel);
  }
  return out;
}

function coreBeinChannelKind(channel = {}) {
  const text = normalizeArabicText([channel.name_en, channel.name_ar, channel.name, channel.title, channel.type].filter(Boolean).join(' '));
  const isBein = /(?:^|\s)(?:bein\s+sports|بي\s+ان\s+سبورت)(?:\s|$)/.test(text);
  if (!isBein) return 'other';
  if (/(connect|كونكت|اشتراك|الباقات|باقات|باقه|باقة)/.test(text)) return 'blocked';
  if (/(news|اخباريه|الاخباريه)/.test(text)) return 'blocked';
  if (/(4k|4\s*كي|فور\s*كي|فوركي)/.test(text)) return 'bein-4k';
  const maxMatch = text.match(/(?:max|ماكس)\s*([0-9])?/);
  if (maxMatch) {
    const number = String(maxMatch[1] || '').trim();
    if (number === '1') return 'bein-max-1';
    if (number === '2') return 'bein-max-2';
    return 'blocked';
  }
  if (/(free|fta|مفتوح|المفتوحه|المفتوحة|مجاني|مجانيه)/.test(text)) return 'bein-free';
  // MaenSat display rule: plain beIN SPORTS as a standalone channel means the free-to-air beIN SPORTS channel.
  return 'bein-free';
}
function normalizeCoreBeinChannel(channel = {}) {
  const kind = coreBeinChannelKind(channel);
  if (kind === 'other') return channel;
  if (kind === 'blocked') return null;
  const base = {...channel};
  if (kind === 'bein-free') return {
    ...base,
    name_ar: 'beIN SPORTS المفتوحة',
    name_en: 'beIN SPORTS Free-to-air',
    type: 'free',
    status: base.status || 'confirmed',
    note_ar: base.note_ar || 'قاعدة MaenSat: ظهور beIN SPORTS كقناة مستقلة يعني beIN SPORTS المفتوحة/المجانية؛ MAX و4K قنوات مشفرة منفصلة.'
  };
  if (kind === 'bein-max-1') return {
    ...base,
    name_ar: 'beIN SPORTS MAX 1',
    name_en: 'beIN SPORTS MAX 1',
    type: 'encrypted',
    status: base.status || 'confirmed'
  };
  if (kind === 'bein-max-2') return {
    ...base,
    name_ar: 'beIN SPORTS MAX 2',
    name_en: 'beIN SPORTS MAX 2',
    type: 'encrypted',
    status: base.status || 'confirmed'
  };
  if (kind === 'bein-4k') return {
    ...base,
    name_ar: 'beIN SPORTS 4K',
    name_en: 'beIN SPORTS 4K',
    type: 'encrypted',
    status: base.status || 'confirmed'
  };
  return channel;
}
function coreBeinChannelKey(channel = {}) {
  const kind = coreBeinChannelKind(channel);
  if (kind !== 'other' && kind !== 'blocked') return kind;
  return channelKey(channel);
}
function filterCoreBeinChannels(channels = []) {
  const out = [];
  for (const raw of channels || []) {
    const normalized = normalizeCoreBeinChannel(raw);
    if (!normalized) continue;
    const key = coreBeinChannelKey(normalized);
    const idx = out.findIndex(c => coreBeinChannelKey(c) === key);
    if (idx >= 0) out[idx] = {...out[idx], ...normalized};
    else out.push(normalized);
  }
  return out;
}
function sanitizeBroadcastsForCoreBeinChannels(broadcasts = {}) {
  const out = JSON.parse(JSON.stringify(broadcasts || {}));
  if (Array.isArray(out.default_channels)) out.default_channels = filterCoreBeinChannels(out.default_channels);
  out.matches ||= {};
  for (const [key, value] of Object.entries(out.matches || {})) {
    if (Array.isArray(value?.channels)) out.matches[key].channels = filterCoreBeinChannels(value.channels);
  }
  out.metadata ||= {};
  out.metadata.core_bein_channel_filter = true;
  out.metadata.core_bein_channel_filter_ar = 'يعرض الموقع فقط beIN SPORTS المفتوحة، وbeIN SPORTS MAX 1، وbeIN SPORTS MAX 2، وbeIN SPORTS 4K. يتم إخفاء MAX 3-6 وNEWS وCONNECT والباقات. عند وجود مباريات بنفس التوقيت تُربط القناة بمقطع المباراة نفسها فقط لمنع خلط MAX 1 وMAX 2.';
  return out;
}
function extractChannelCandidates(text = '', sourceUrl = '') {
  const candidates = [];
  const patterns = [
    {kind:'max', regex:/\bbeIN\s*SPORTS\s*MAX\s*([0-9١-٩])?\b/gi},
    {kind:'max', regex:/بي\s*إن\s*سبورت\s*ماكس\s*([0-9١-٩])?/gi},
    {kind:'max', regex:/بي\s*ان\s*سبورت\s*ماكس\s*([0-9١-٩])?/gi},
    {kind:'4k', regex:/\bbeIN\s*SPORTS\s*4K\b/gi},
    {kind:'4k', regex:/بي\s*إن\s*سبورت\s*4\s*كي/gi},
    {kind:'free', regex:/\bbeIN\s*SPORTS\s*(?:Free\s*to\s*air|FTA)\b/gi},
    {kind:'free', regex:/\bbeIN\s*SPORTS\s*المفتوحة\b/gi},
    {kind:'free', regex:/بي\s*إن\s*سبورت\s*المفتوح[هة]/gi},
    {kind:'free', regex:/القناة\s+المفتوح[هة]/gi},
    {kind:'standalone_free', regex:/\bbeIN\s*SPORTS\b(?!\s*(?:MAX|4K|NEWS|الإخبارية|الاخبارية|CONNECT))/gi},
    {kind:'standalone_free', regex:/بي\s*إن\s*سبورت\b(?!\s*(?:ماكس|4\s*كي|الإخبارية|الاخبارية|كونكت))/gi},
    {kind:'standalone_free', regex:/بي\s*ان\s*سبورت\b(?!\s*(?:ماكس|4\s*كي|الإخبارية|الاخبارية|كونكت))/gi},
    {kind:'news', regex:/\bbeIN\s*SPORTS\s*(?:NEWS|الإخبارية|الاخبارية)\b/gi},
    {kind:'news', regex:/بي\s*إن\s*سبورت\s*(?:الإخبارية|الاخبارية)/gi}
  ];
  for (const {kind, regex} of patterns) {
    for (const match of text.matchAll(regex)) {
      const raw = match[0];
      const number = westernDigits(match[1] || '').trim();
      const snippet = findSnippetAt(text, match.index, 220);
      const snippetNorm = normalizeArabicText(snippet);
      let nameEn = 'beIN SPORTS';
      let nameAr = 'beIN SPORTS';
      let type = 'encrypted';
      let status = 'confirmed';
      if (kind === 'max') {
        // MaenSat display rule: only MAX 1 and MAX 2 are shown for World Cup pages.
        // Generic MAX or MAX 3-6 are ignored to avoid clutter and accidental channel claims.
        if (number !== '1' && number !== '2') continue;
        nameEn = `beIN SPORTS MAX ${number}`;
        nameAr = `beIN SPORTS MAX ${number}`;
        type = 'encrypted';
        status = 'confirmed';
      } else if (kind === '4k') {
        nameEn = 'beIN SPORTS 4K';
        nameAr = 'beIN SPORTS 4K';
        type = 'encrypted';
      } else if (kind === 'free') {
        nameEn = 'beIN SPORTS Free-to-air';
        nameAr = 'beIN SPORTS المفتوحة';
        type = 'free';
        status = hasFreeHint(snippetNorm) || hasFreeHint(normalizeArabicText(text)) ? 'confirmed' : 'pending_official_announcement';
      } else if (kind === 'standalone_free') {
        // MaenSat exact rule:
        // If the official broadcaster page lists plain "beIN SPORTS" as a channel near the match, publish it as the free-to-air beIN SPORTS channel.
        // This stays true even when the same channel list also includes beIN SPORTS MAX or beIN SPORTS 4K; those are added separately as encrypted.
        // Article branding like "beIN SPORTS announced..." is still ignored unless it appears in a broadcast/watch/on-channel context.
        if (!hasFreeHint(snippetNorm) && !hasStandaloneBeinContext(snippetNorm)) continue;
        nameEn = 'beIN SPORTS Free-to-air';
        nameAr = 'beIN SPORTS المفتوحة';
        type = 'free';
        status = 'confirmed';
      } else if (kind === 'news') {
        // NEWS is not part of MaenSat's compact match-channel display.
        continue;
      }
      candidates.push({
        name_ar: nameAr,
        name_en: nameEn,
        type,
        status,
        source_name: 'beIN SPORTS',
        source_url: sourceUrl,
        evidence_ar: snippet,
        note_ar: kind === 'max' && !number ? 'ذكرت beIN SPORTS MAX دون تحديد رقم القناة؛ يبقى الرقم بانتظار التأكيد.' : (kind === 'standalone_free' ? 'حسب قاعدة MaenSat: ظهور beIN SPORTS كقناة مستقلة يُعامل كقناة beIN SPORTS المفتوحة، حتى لو ظهرت معها MAX أو 4K كقنوات مشفرة منفصلة.' : 'تم التقاطها من مصدر beIN SPORTS الرسمي.')
      });
    }
  }
  const byKey = new Map();
  for (const c of candidates) byKey.set(channelKey(c), c);
  return [...byKey.values()];
}

function matchChannelTerms(match = {}, side = 1) {
  const names = side === 1
    ? [match.team1, match.team1_ar, match.home_team, match.home_team_ar]
    : [match.team2, match.team2_ar, match.away_team, match.away_team_ar];
  return uniq(names
    .map(v => normalizeArabicText(String(v || '')).trim())
    .filter(v => v && v.length >= 3));
}
function allIndexesOf(haystack = '', needle = '') {
  const out = [];
  const n = String(needle || '');
  if (!n) return out;
  let idx = String(haystack || '').indexOf(n);
  while (idx >= 0) {
    out.push(idx);
    idx = String(haystack || '').indexOf(n, idx + Math.max(1, n.length));
  }
  return out;
}
function findBestTeamPairRange(textNorm = '', match = {}) {
  const aTerms = matchChannelTerms(match, 1);
  const bTerms = matchChannelTerms(match, 2);
  if (!aTerms.length || !bTerms.length) return null;
  const aPositions = [];
  const bPositions = [];
  for (const term of aTerms) for (const index of allIndexesOf(textNorm, term)) aPositions.push({index, length:term.length, term});
  for (const term of bTerms) for (const index of allIndexesOf(textNorm, term)) bPositions.push({index, length:term.length, term});
  if (!aPositions.length || !bPositions.length) return null;
  let best = null;
  for (const a of aPositions) {
    for (const b of bPositions) {
      const distance = Math.abs(a.index - b.index);
      if (distance > 900) continue;
      const start = Math.min(a.index, b.index);
      const end = Math.max(a.index + a.length, b.index + b.length);
      const item = {start, end, distance, terms:[a.term, b.term]};
      if (!best || item.distance < best.distance) best = item;
    }
  }
  return best;
}
function rangesForMatchesOnPage(textNorm = '', matches = []) {
  const out = [];
  for (const m of matches || []) {
    const range = findBestTeamPairRange(textNorm, m);
    if (range) out.push({match:m, ...range});
  }
  return out.sort((a,b) => a.start - b.start || a.end - b.end);
}
function kickoffSignature(match = {}) {
  return String(match.kickoff_utc || match.kickoff_jordan || `${match.date || ''} ${match.time || ''}`).trim();
}
function simultaneousKickoffCount(match = {}, matches = []) {
  const sig = kickoffSignature(match);
  if (!sig) return 1;
  return (matches || []).filter(m => kickoffSignature(m) === sig).length || 1;
}
function extractMatchSpecificChannelContext(text = '', match = {}, matches = []) {
  const textNorm = normalizeArabicText(text);
  const current = findBestTeamPairRange(textNorm, match);
  if (!current) {
    return {
      text: '',
      precise: false,
      method: 'no-both-teams-nearby',
      note_ar: 'لم يتم العثور على اسمي الفريقين قريبين من بعضهما؛ لم يتم نشر القنوات تلقائياً لتجنب خلط المباريات.'
    };
  }

  const allRanges = rangesForMatchesOnPage(textNorm, matches);
  const sameRange = (r) => r.match === match || (r.match?.id && r.match.id === match.id) || (r.match?.num && r.match.num === match.num);
  const prev = [...allRanges].reverse().find(r => !sameRange(r) && r.end <= current.start);
  const next = allRanges.find(r => !sameRange(r) && r.start >= current.end);

  const leftBoundary = prev ? Math.floor((prev.end + current.start) / 2) : 0;
  const rightBoundary = next ? Math.floor((current.end + next.start) / 2) : textNorm.length;

  // Keep the extraction window tied to the exact match block. This is what prevents
  // beIN SPORTS MAX 1 from being copied to a different simultaneous match that has MAX 2.
  const start = Math.max(leftBoundary, current.start - 260);
  const end = Math.min(rightBoundary, current.end + 420);
  const segment = textNorm.slice(start, end).trim();
  return {
    text: segment,
    precise: true,
    method: simultaneousKickoffCount(match, matches) > 1 ? 'both-teams-nearby-simultaneous-safe-block' : 'both-teams-nearby-match-block',
    boundaries: {start, end, leftBoundary, rightBoundary, pair_start: current.start, pair_end: current.end, distance: current.distance},
    note_ar: simultaneousKickoffCount(match, matches) > 1
      ? 'تم استخراج القنوات من مقطع المباراة نفسها فقط لأن هناك مباريات بنفس التوقيت؛ لا يتم نسخ MAX 1/MAX 2 بين المباريات.'
      : 'تم استخراج القنوات من مقطع قريب من اسمي الفريقين فقط، وليس من الصفحة كاملة.'
  };
}
function safeTitleFromHtml(html = '') {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtmlToText(m[1]) : '';
}
function absoluteUrl(raw, base) {
  try { return new URL(raw, base).toString(); } catch { return ''; }
}
function discoverArticleUrls(html = '', baseUrl = '') {
  const urls = [];
  for (const match of String(html).matchAll(/href=["']([^"']+)["']/gi)) {
    const url = absoluteUrl(decodeHtmlEntities(match[1]), baseUrl);
    if (!url) continue;
    if (!/^https:\/\/(www\.)?beinsports\.com\/ar-mena\//i.test(url)) continue;
    const decoded = decodeURIComponent(url).toLowerCase();
    if (!decoded.includes('كأس-العالم-fifa-2026') && !decoded.includes('fifa-2026')) continue;
    urls.push(url.split('#')[0]);
  }
  return uniq(urls).slice(0, BEIN_MAX_DISCOVERED_ARTICLES);
}
async function loadBeinSeedUrls() {
  const envUrls = BEIN_NEWS_URLS ? BEIN_NEWS_URLS.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean) : [];
  let fileUrls = [];
  const src = await readJson(BEIN_NEWS_SOURCE_FILE);
  if (Array.isArray(src)) fileUrls = src;
  else if (src && Array.isArray(src.urls)) fileUrls = src.urls;
  const defaults = [
    'https://www.beinsports.com/ar-mena/كرة-القدم/كأس-العالم-fifa-2026',
    'https://www.beinsports.com/ar-mena/جدول-البث'
  ];
  return uniq([...envUrls, ...fileUrls, ...defaults]);
}
async function fetchHtmlPage(url) {
  const res = await fetch(url, {headers:{'user-agent':'maensat-worldcup-bein-official-checker/1.0 (+https://maensat.pages.dev)'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
async function fetchBeinOfficialPages() {
  const seeds = await loadBeinSeedUrls();
  const queue = [...seeds];
  const seen = new Set();
  const pages = [];
  for (let i = 0; i < queue.length && pages.length < seeds.length + BEIN_MAX_DISCOVERED_ARTICLES; i++) {
    const url = queue[i];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const html = await fetchHtmlPage(url);
      const text = stripHtmlToText(html);
      const decodedUrl = decodeURIComponent(url).toLowerCase();
      const kind = decodedUrl.includes('/الأخبار-الفيديو/') || decodedUrl.includes('/news/') ? 'article' : (decodedUrl.includes('جدول-البث') ? 'schedule' : 'listing');
      pages.push({url, title: safeTitleFromHtml(html), text, kind});
      if (pages.length <= seeds.length) {
        for (const child of discoverArticleUrls(html, url)) if (!seen.has(child)) queue.push(child);
      }
    } catch (err) {
      console.warn('[worldcup-bein] failed to fetch official page:', url, err.message);
    }
  }
  return pages;
}
function buildBeinBroadcastSourceFromPages(pages = [], matches = []) {
  const source = {
    metadata: {
      name: 'Auto-detected official beIN SPORTS World Cup broadcast confirmations',
      name_ar: 'تأكيدات بث كأس العالم الملتقطة تلقائياً من beIN SPORTS الرسمي',
      source_name: 'beIN SPORTS',
      last_checked_at: jordanNowIso(),
      policy_ar: 'النشر التلقائي يتم فقط عندما تظهر القناة داخل مقطع المباراة نفسها. عند وجود مباراتين بنفس التوقيت لا يتم نقل MAX 1/MAX 2 من مباراة إلى أخرى؛ النتائج غير الواضحة تذهب إلى ملف المراجعة.'
    },
    matches: {},
    review: []
  };
  for (const page of pages) {
    const text = `${page.title || ''} ${page.text || ''}`;
    const textNorm = normalizeArabicText(text);
    if (!/bein|بي ان|بي ان|بيين|بي ان سبورت|كاس العالم|world cup|fifa/.test(textNorm)) continue;
    const broadcastAction = hasBroadcastAction(textNorm);
    const canPublishFromPage = page.kind !== 'listing';
    for (const match of matches || []) {
      const conf = matchConfidenceFromText(match, textNorm);
      if (conf.score < 45) continue;
      const context = extractMatchSpecificChannelContext(text, match, matches || []);
      const channels = context.precise ? extractChannelCandidates(context.text, page.url) : [];
      const simultaneous = simultaneousKickoffCount(match, matches || []) > 1;
      const reviewItem = {
        match_id: match.id,
        match_num: match.num,
        teams_ar: `${match.team1_ar || match.team1} × ${match.team2_ar || match.team2}`,
        kickoff_jordan: match.kickoff_jordan || '',
        simultaneous_matches_at_same_time: simultaneous,
        confidence: conf.score,
        reasons: conf.reasons,
        source_url: page.url,
        title: page.title,
        page_kind: page.kind,
        channels_found: channels.map(c => c.name_ar),
        action_words_found: broadcastAction,
        channel_context_method: context.method,
        channel_context_note_ar: context.note_ar,
        note_ar: canPublishFromPage ? 'مراجعة تلقائية من beIN؛ لا تنشر إلا إذا كانت القنوات داخل مقطع المباراة نفسها، خصوصاً عند وجود مباراتين بنفس التوقيت.' : 'صفحة فهرس/قائمة؛ تستخدم للاكتشاف والمراجعة ولا تنشر تلقائياً لتجنب الخلط بين عدة أخبار.'
      };
      if (canPublishFromPage && conf.score >= BEIN_CONFIRMATION_SCORE && broadcastAction && context.precise && channels.length) {
        const key = match.id || `M${String(match.num || '').padStart(3,'0')}`;
        source.matches[key] ||= {channels: []};
        source.matches[key].channels = upsertChannels(source.matches[key].channels, channels.map(c => ({
          ...c,
          status: c.status === 'pending_official_announcement' ? 'confirmed' : c.status,
          match_confidence: conf.score,
          match_confidence_reasons: conf.reasons,
          match_channel_context_method: context.method
        })));
        reviewItem.published = true;
        reviewItem.note_ar = simultaneous
          ? 'تم نشرها لأن القناة وجدت داخل مقطع المباراة نفسها رغم وجود مباريات بنفس التوقيت؛ لم يتم نسخ قنوات من مباراة ثانية.'
          : 'تم نشرها لأن الخبر الرسمي ذكر المباراة والقناة داخل مقطع المباراة نفسه.';
      } else {
        reviewItem.published = false;
      }
      source.review.push(reviewItem);
    }
  }
  return source;
}
async function fetchBeinOfficialBroadcastSource(existingBundle) {
  if (!BEIN_AUTO_CHECK) return {source:null, review:null};
  try {
    const pages = await fetchBeinOfficialPages();
    const source = buildBeinBroadcastSourceFromPages(pages, existingBundle?.matches || []);
    const review = {
      metadata: {
        name_ar: 'تقرير مراجعة أخبار beIN SPORTS الرسمية لكأس العالم',
        last_checked_at: source.metadata.last_checked_at,
        checked_pages: pages.map(p => ({url:p.url, title:p.title, kind:p.kind})),
        confirmation_score: BEIN_CONFIRMATION_SCORE,
        auto_check_enabled: BEIN_AUTO_CHECK
      },
      published_matches: Object.keys(source.matches || {}).length,
      candidates: source.review || []
    };
    console.log(`[worldcup-bein] checked ${pages.length} official beIN pages; published ${review.published_matches} match broadcaster entr${review.published_matches === 1 ? 'y' : 'ies'}; review candidates ${review.candidates.length}`);
    return {source, review};
  } catch (err) {
    console.warn('[worldcup-bein] official beIN check failed, keeping existing broadcaster data:', err.message);
    return {source:null, review:{metadata:{name_ar:'تعذر فحص beIN SPORTS الرسمي', last_checked_at:jordanNowIso(), error:err.message}, published_matches:0, candidates:[]}};
  }
}
function hasMatchToday(existingBundle, todayKey) {
  const matches = existingBundle?.matches || [];
  return matches.some(match => matchDateKeyInJordan(match) === todayKey);
}
function activeMatchWindow(existingBundle, now = nowForSchedule()) {
  const matches = existingBundle?.matches || [];
  const nowMs = now.getTime();
  let nextWindow = null;
  for (const match of matches) {
    const startMs = kickoffMs(match);
    if (!Number.isFinite(startMs)) continue;
    const windowStart = startMs - FAST_WINDOW_BEFORE_MINUTES * 60000;
    const windowEnd = startMs + FAST_WINDOW_AFTER_MINUTES * 60000;
    if (nowMs >= windowStart && nowMs <= windowEnd && !isFinishedMatch(match)) {
      const label = `${match.team1 || 'TBD'} vs ${match.team2 || 'TBD'}${match.num ? ` (#${match.num})` : ''}`;
      return {active:true, reason:`inside live/near-match window for ${label}`};
    }
    if (nowMs < windowStart) {
      const waitMs = windowStart - nowMs;
      if (!nextWindow || waitMs < nextWindow.waitMs) nextWindow = {waitMs, match};
    }
  }
  if (nextWindow) {
    const hours = Math.round(nextWindow.waitMs / 36e5 * 10) / 10;
    return {active:false, reason:`next fast update window starts in about ${hours} hours`};
  }
  return {active:false, reason:'no upcoming fast update window found'};
}
function shouldSkipForSmartSchedule(existingBundle) {
  if (FORCE_UPDATE) return {skip:false, reason:'manual/forced run'};
  if (!EVENT_SCHEDULE) return {skip:false, reason:'direct run without schedule'};
  if (EVENT_SCHEDULE === BASE_12_HOUR_CRON) return {skip:false, reason:'baseline 12-hour run'};
  if (EVENT_SCHEDULE === FAST_MATCH_WINDOW_CRON) {
    const window = activeMatchWindow(existingBundle);
    return window.active
      ? {skip:false, reason:`15-minute update allowed: ${window.reason}`}
      : {skip:true, reason:`15-minute update skipped: ${window.reason}`};
  }
  return {skip:false, reason:`unknown schedule (${EVENT_SCHEDULE})`};
}

function defaultBroadcasts(lastUpdatedIso = '2026-06-05T00:00:00+03:00') {
  return {
    metadata: {
      name: 'World Cup 2026 broadcasters for Jordan / MENA',
      name_ar: 'القنوات الناقلة لكأس العالم 2026 - الأردن / الشرق الأوسط وشمال أفريقيا',
      region: 'Jordan / MENA',
      language_focus: ['Arabic'],
      frequencies_included: false,
      policy: 'No frequencies and no streaming links. MaenSat rule: plain beIN SPORTS is the free-to-air channel; beIN SPORTS MAX 1, MAX 2, and 4K are encrypted. Other beIN variants are hidden. When matches share kickoff time, channels are published only from the exact match block to avoid mixing MAX 1/MAX 2.',
      policy_ar: 'لا توجد ترددات ولا روابط بث. قاعدة MaenSat: beIN SPORTS كقناة مستقلة تعني beIN SPORTS المفتوحة/المجانية؛ beIN SPORTS MAX 1 وMAX 2 و4K مشفرة. يتم إخفاء MAX 3-6 وNEWS وCONNECT والباقات. عند وجود مباراتين بنفس الوقت لا تُنشر القناة إلا إذا ظهرت داخل مقطع المباراة نفسها.',
      last_updated: lastUpdatedIso,
      update_policy: 'Broadcaster data can be merged from WORLD_CUP_2026_BROADCAST_SOURCE_URL when a trusted JSON source is configured; otherwise pending statuses are preserved. Match scores use a separate 15-minute smart match-window update.'
    },
    default_channels: [
      {name_ar:'beIN SPORTS المفتوحة', name_en:'beIN SPORTS Free-to-air', type:'free', status:'pending_official_announcement', note_ar:'تظهر كمجانية إذا ذكر المصدر beIN SPORTS المفتوحة أو ذكر beIN SPORTS كقناة مستقلة قرب المباراة؛ MAX 1 وMAX 2 و4K تبقى مشفرة منفصلة', note_en:'Shown as free-to-air when the official source says Free-to-air, or plain beIN SPORTS near the match'}
    ],
    matches: {},
    status_values: {
      confirmed:'Confirmed channel for the match',
      to_be_confirmed:'Encrypted channel group known, exact channel pending',
      pending_official_announcement:'Free-to-air status pending official announcement',
      not_available:'No broadcaster information available'
    }
  };
}
function hasPendingBroadcastChannels(entry) {
  const channels = Array.isArray(entry?.channels) ? entry.channels : [];
  return channels.some(c => String(c?.status || '').toLowerCase() !== 'confirmed');
}
function shouldCheckBroadcasts(existingBundle, broadcasts, now = nowForSchedule()) {
  if (FORCE_UPDATE) return {check:true, reason:'manual/forced run'};
  const matches = existingBundle?.matches || [];
  const map = broadcasts?.matches || {};
  const defaults = {channels: broadcasts?.default_channels || []};
  const nowMs = now.getTime();
  for (const match of matches) {
    const startMs = kickoffMs(match);
    if (!Number.isFinite(startMs)) continue;
    const inWindow = nowMs >= startMs - BROADCAST_CHECK_BEFORE_MINUTES * 60000 && nowMs <= startMs + BROADCAST_CHECK_AFTER_MINUTES * 60000;
    if (!inWindow) continue;
    const entry = map[match.id] || map[String(match.num)] || map[`M${String(match.num || '').padStart(3,'0')}`] || defaults;
    if (hasPendingBroadcastChannels(entry)) return {check:true, reason:`pending broadcaster info near match ${match.id || match.num}`};
  }
  return {check:false, reason:'no pending broadcaster info inside check window'};
}
async function fetchBroadcastSource() {
  if (BROADCAST_SOURCE_URL) {
    const res = await fetch(BROADCAST_SOURCE_URL, {headers:{'user-agent':'maensat-worldcup-broadcast-updater'}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
  if (await fileExists(BROADCAST_SOURCE_FILE)) {
    const local = await readJson(BROADCAST_SOURCE_FILE);
    if (local) return local;
  }
  return null;
}

async function fetchObservedBroadcastSource() {
  if (!(await fileExists(BROADCAST_OBSERVED_FILE))) return null;
  const local = await readJson(BROADCAST_OBSERVED_FILE);
  if (!local) return null;
  return local;
}
function normalizeBroadcastSource(source = {}) {
  if (Array.isArray(source)) {
    const matches = {};
    for (const row of source) {
      const key = row.match_id || row.id || row.match || row.num;
      if (key) matches[String(key)] = {channels: row.channels || row.broadcasters || []};
    }
    return {matches};
  }
  return {
    default_channels: source.default_channels || source.defaultChannels,
    matches: source.matches || source.broadcasts || {}
  };
}
function mergeBroadcasts(base, incoming) {
  const src = normalizeBroadcastSource(incoming);
  const out = JSON.parse(JSON.stringify(base || defaultBroadcasts(jordanNowIso())));
  if (Array.isArray(src.default_channels) && src.default_channels.length) out.default_channels = src.default_channels;
  out.matches ||= {};
  for (const [key, value] of Object.entries(src.matches || {})) {
    const existing = out.matches[key] || {};
    const next = {...existing, ...(value || {})};
    if (Array.isArray(existing.channels) || Array.isArray(value?.channels)) {
      next.channels = upsertChannels(existing.channels || [], value?.channels || []);
    }
    out.matches[key] = next;
  }
  out.metadata ||= {};
  out.metadata.last_updated = jordanNowIso();
  out.metadata.broadcast_source_url = BROADCAST_SOURCE_URL || out.metadata.broadcast_source_url || '';
  out.metadata.broadcast_source_file = BROADCAST_SOURCE_URL ? '' : path.relative(ROOT, BROADCAST_SOURCE_FILE).replace(/\\/g, '/');
  if (incoming?.metadata?.source_name === 'beIN SPORTS') {
    out.metadata.bein_official_last_checked_at = incoming.metadata.last_checked_at || out.metadata.bein_official_last_checked_at || '';
    out.metadata.bein_official_auto_check = true;
  }
  if (incoming?.metadata?.source_name === 'MaenSat observed confirmation') {
    out.metadata.observed_broadcast_last_checked_at = incoming.metadata.last_checked_at || out.metadata.observed_broadcast_last_checked_at || '';
    out.metadata.observed_broadcast_file = path.relative(ROOT, BROADCAST_OBSERVED_FILE).replace(/\\/g, '/');
    out.metadata.observed_broadcast_note_ar = 'تأكيدات مشاهدة يدوية من صاحب الموقع؛ تُدمج فوق المصادر التلقائية ولا تمس ملفات المباريات/الترتيب/القوس.';
  }
  return out;
}
async function buildBroadcastOutput(existingBroadcasts, existingBundle) {
  let broadcasts = existingBroadcasts || defaultBroadcasts(existingBundle?.metadata?.last_updated || '2026-06-05T00:00:00+03:00');
  const sourceAvailable = Boolean(BROADCAST_SOURCE_URL) || await fileExists(BROADCAST_SOURCE_FILE);
  const gate = shouldCheckBroadcasts(existingBundle, broadcasts);
  if (!gate.check) {
    console.log(`[worldcup-broadcasts] ${gate.reason}`);
    if (!FORCE_UPDATE) return {broadcasts, review:null};
  }
  if (!sourceAvailable) {
    console.log('[worldcup-broadcasts] no trusted JSON broadcast source configured; continuing with official beIN auto-check only');
  } else {
    try {
      const source = await fetchBroadcastSource();
      if (source) {
        broadcasts = mergeBroadcasts(broadcasts, source);
        console.log(`[worldcup-broadcasts] merged trusted JSON broadcaster data: ${gate.reason || 'manual/local source'}`);
      } else {
        console.log('[worldcup-broadcasts] broadcast source is empty; keeping existing trusted broadcaster data');
      }
    } catch (err) {
      console.warn('[worldcup-broadcasts] trusted JSON fetch failed, keeping existing broadcaster data:', err.message);
    }
  }
  const {source: beinSource, review} = await fetchBeinOfficialBroadcastSource(existingBundle);
  if (beinSource && Object.keys(beinSource.matches || {}).length) {
    broadcasts = mergeBroadcasts(broadcasts, beinSource);
    console.log('[worldcup-bein] merged official beIN broadcaster confirmations');
  }
  const observedSource = await fetchObservedBroadcastSource();
  if (observedSource && Object.keys(normalizeBroadcastSource(observedSource).matches || {}).length) {
    broadcasts = mergeBroadcasts(broadcasts, observedSource);
    console.log('[worldcup-observed] merged local observed broadcaster confirmations');
  }
  broadcasts = sanitizeBroadcastsForCoreBeinChannels(broadcasts);
  return {broadcasts, review};
}


function teamNameKey(name = '') {
  const aliases = {
    'united states':'usa',
    'usmnt':'usa',
    'czechia':'czech republic',
    'bosnia and herzegovina':'bosnia herzegovina',
    'bosnia & herzegovina':'bosnia herzegovina',
    'cote divoire':'ivory coast',
    'côte divoire':'ivory coast',
    'cote d ivoire':'ivory coast',
    'dr congo':'dr congo',
    'congo dr':'dr congo',
    'congo democratic republic':'dr congo',
    'korea republic':'south korea',
    'republic of korea':'south korea'
  };
  const raw = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(fc|national team|men)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return aliases[raw] || raw.replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function numberFromScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function espnCompetitorKey(comp = {}) {
  const team = comp.team || {};
  return [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
    .filter(Boolean)
    .map(teamNameKey);
}
function findEspnCompetitor(entry, teamName) {
  const wanted = teamNameKey(teamName);
  return (entry.competitors || []).find(comp => espnCompetitorKey(comp).includes(wanted));
}
function extractEspnLiveEntries(json = {}) {
  const entries = [];
  for (const event of json.events || []) {
    const competition = event.competitions?.[0] || {};
    const status = competition.status || event.status || {};
    entries.push({
      id: event.id,
      name: event.name || event.shortName || '',
      date: competition.date || event.date || '',
      status,
      competitors: competition.competitors || []
    });
  }
  return entries;
}
function ymdUtc(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
function addDays(date = new Date(), days = 0) {
  return new Date(date.getTime() + days * 86400000);
}
function espnUrlWithDateRange(baseUrl = LIVE_SCORE_URL, now = nowForSchedule()) {
  const start = ymdUtc(addDays(now, -1));
  const end = ymdUtc(addDays(now, 2));
  const sep = String(baseUrl).includes('?') ? '&' : '?';
  return `${baseUrl}${sep}dates=${start}-${end}`;
}
async function fetchEspnEntriesFromUrl(url) {
  const res = await fetch(url, {headers:{'user-agent':'maensat-worldcup-live-score-updater/1.2 (+https://maensat.pages.dev)'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return extractEspnLiveEntries(json);
}
async function fetchLiveScoreEntries() {
  if (!LIVE_SCORE_CHECK) return [];
  const urls = uniq([LIVE_SCORE_URL, espnUrlWithDateRange(LIVE_SCORE_URL)]);
  const byId = new Map();
  let okCount = 0;
  for (const url of urls) {
    try {
      const entries = await fetchEspnEntriesFromUrl(url);
      okCount += 1;
      for (const entry of entries) {
        const key = String(entry.id || `${entry.name}-${entry.date}`);
        if (key) byId.set(key, entry);
      }
      console.log(`[worldcup-live] fetched ${entries.length} ESPN event(s) from ${url.includes('dates=') ? 'date-window scoreboard' : 'default scoreboard'}`);
    } catch (err) {
      console.warn('[worldcup-live] ESPN fetch failed for one scoreboard URL:', err.message);
    }
  }
  const merged = [...byId.values()];
  if (!okCount) {
    console.warn('[worldcup-live] all live score fetches failed; keeping fixture-source scores only');
    return [];
  }
  console.log(`[worldcup-live] using ${merged.length} unique ESPN scoreboard event(s) after merging default + date-window results`);
  return merged;
}
function applyLiveScoresToSource(source = {}, liveEntries = []) {
  if (!Array.isArray(source.matches) || !liveEntries.length) return source;
  let applied = 0;
  const matches = source.matches.map(match => {
    const entry = liveEntries.find(e => findEspnCompetitor(e, match.team1) && findEspnCompetitor(e, match.team2));
    if (!entry) return match;
    const c1 = findEspnCompetitor(entry, match.team1);
    const c2 = findEspnCompetitor(entry, match.team2);
    const s1 = numberFromScore(c1?.score);
    const s2 = numberFromScore(c2?.score);
    if (s1 === null || s2 === null) return match;
    const statusType = entry.status?.type || {};
    const state = String(statusType.state || '').toLowerCase();
    const completed = Boolean(statusType.completed) || state === 'post' || /final|full time|ft/i.test(statusType.name || statusType.description || statusType.detail || '');
    const inProgress = state === 'in' || /STATUS_(FIRST|SECOND|HALF|EXTRA|IN_PROGRESS)/i.test(statusType.name || '');
    if (!completed && !inProgress && s1 === 0 && s2 === 0) return match;
    const score = {...(match.score || {})};
    if (completed) {
      score.ft = [s1, s2];
      delete score.live;
    } else {
      score.live = [s1, s2];
    }
    score.source = 'espn';
    score.event_id = entry.id || null;
    score.status_detail = statusType.detail || statusType.description || entry.status?.displayClock || '';
    score.clock = entry.status?.displayClock || statusType.shortDetail || '';
    applied += 1;
    return {
      ...match,
      score,
      status: completed ? 'finished' : 'live',
      score_source: 'espn',
      live_clock: score.clock || null,
      live_status_detail: score.status_detail || null,
      espn_event_id: entry.id || null
    };
  });
  if (applied) {
    console.log(`[worldcup-live] applied live/final score updates to ${applied} match(es)`);
    return {...source, matches, live_score_source: 'espn'};
  }
  console.log('[worldcup-live] no ESPN live score matched current World Cup fixtures');
  return source;
}

async function fetchSource(existingBundle) {
  try {
    const res = await fetch(SOURCE_URL, {headers:{'user-agent':'maensat-worldcup-updater'}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[worldcup] fetch failed, keeping existing fixture data:', err.message);
    if (!existingBundle?.matches) throw err;
    return {
      name: existingBundle.metadata?.english_name || 'World Cup 2026',
      matches: existingBundle.matches.map(m=>({
        ...m,
        team1:m.team1,
        team2:m.team2,
        group:m.group ? `Group ${m.group}` : '',
        round:m.round,
        date:m.date,
        time:m.time,
        ground:m.ground,
        score:m.score
      }))
    };
  }
}
function buildOutput(source, lastUpdatedIso, lastCheckedIso = lastUpdatedIso) {
  let matches = source.matches.map(normalizeSourceMatch).sort((a,b)=>String(a.kickoff_utc).localeCompare(String(b.kickoff_utc)) || (a.num||0)-(b.num||0));
  const groups = buildGroups(matches);
  const standingsObj = computeStandings(matches, groups);
  const byNum = new Map(matches.filter(m=>m.num).map(m=>[String(m.num), m]));
  for (const m of matches) {
    for (const side of ['team1','team2']) {
      const val=m[side]; const wm=String(val||'').match(/^W(\d{2,3})$/); const lm=String(val||'').match(/^L(\d{2,3})$/);
      if (wm && byNum.get(wm[1])) { const w=winnerOf(byNum.get(wm[1])); if (w) { m[side]=w; m[side+'_ar']=TEAM_AR[w]||w; } }
      if (lm && byNum.get(lm[1])) { const l=loserOf(byNum.get(lm[1])); if (l) { m[side]=l; m[side+'_ar']=TEAM_AR[l]||l; } }
    }
  }
  const metadata = {
    name:'كأس العالم 2026',
    english_name: source.name || 'World Cup 2026',
    source: source.live_score_source ? 'openfootball/worldcup.json + ESPN live scoreboard' : 'openfootball/worldcup.json',
    source_url:SOURCE_URL,
    live_score_source: source.live_score_source || null,
    live_score_url: source.live_score_source ? LIVE_SCORE_URL : null,
    official_reference:'https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule_English.pdf',
    last_updated:lastUpdatedIso,
    last_checked_at:lastCheckedIso,
    update_policy:'every 15 minutes only during near/live match windows, every 12 hours otherwise',
    timezone:TIMEZONE,
    total_matches:104,
    teams_count:48,
    groups_count:12
  };
  const matchesObj = {metadata, groups, team_ar:TEAM_AR, stadiums:STADIUM_NAMES, matches};
  const standingsObjOut = {metadata, ...standingsObj};
  const bracketObj = {metadata, matches:matches.filter(m=>m.stage!=='Group Stage')};
  return {
    matchesObj,
    standingsObj: standingsObjOut,
    bracketObj,
    matchesText: JSON.stringify(matchesObj, null, 2),
    standingsText: JSON.stringify(standingsObjOut, null, 2),
    bracketText: JSON.stringify(bracketObj, null, 2),
    matchCount: matches.length,
    groupCount: Object.keys(groups).length
  };
}
function jordanNowIso() {
  return new Date(Date.now()+JORDAN_OFFSET_HOURS*3600000).toISOString().replace('Z','+03:00');
}
function comparableWorldCupText(text) {
  try {
    const obj = JSON.parse(text || 'null');
    if (obj?.metadata) delete obj.metadata.last_checked_at;
    return JSON.stringify(obj);
  } catch {
    return text || '';
  }
}
async function writeMatchBundles(output) {
  await fs.writeFile(MATCHES_FILE, `${output.matchesText}\n`);
  await fs.writeFile(STANDINGS_FILE, `${output.standingsText}\n`);
  await fs.writeFile(BRACKET_FILE, `${output.bracketText}\n`);
}
async function main(){
  await fs.mkdir(WC_DIR,{recursive:true});
  const existingBundle = await readExistingMatchesBundle();
  const gate = shouldSkipForSmartSchedule(existingBundle);
  if (gate.skip) {
    console.log(`[worldcup] ${gate.reason}`);
    return;
  }
  console.log(`[worldcup] running update: ${gate.reason}`);
  let source = await fetchSource(existingBundle);
  const liveEntries = await fetchLiveScoreEntries();
  source = applyLiveScoresToSource(source, liveEntries);
  const checkedAtIso = jordanNowIso();
  const preservedLastUpdated = existingBundle?.metadata?.last_updated || checkedAtIso;
  const draft = buildOutput(source, preservedLastUpdated, checkedAtIso);
  const currentMatches = await readText(MATCHES_FILE);
  const currentStandings = await readText(STANDINGS_FILE);
  const currentBracket = await readText(BRACKET_FILE);
  const currentBroadcasts = await readText(BROADCASTS_FILE);
  const existingBroadcasts = await readJson(BROADCASTS_FILE);
  const {broadcasts: broadcastOutput, review: broadcastReview} = await buildBroadcastOutput(existingBroadcasts, existingBundle);
  const desiredMatches = `${draft.matchesText}
`;
  const desiredStandings = `${draft.standingsText}
`;
  const desiredBracket = `${draft.bracketText}
`;
  const desiredBroadcasts = `${JSON.stringify(broadcastOutput, null, 2)}
`;
  const currentReview = await readText(BROADCAST_REVIEW_FILE);
  const desiredReview = broadcastReview ? `${JSON.stringify(broadcastReview, null, 2)}
` : currentReview;
  const matchDataChanged = comparableWorldCupText(desiredMatches) !== comparableWorldCupText(currentMatches) || comparableWorldCupText(desiredStandings) !== comparableWorldCupText(currentStandings) || comparableWorldCupText(desiredBracket) !== comparableWorldCupText(currentBracket);
  const broadcastDataChanged = desiredBroadcasts !== currentBroadcasts;
  const reviewDataChanged = desiredReview !== currentReview;

  if (matchDataChanged) {
    const finalOutput = buildOutput(source, checkedAtIso, checkedAtIso);
    await writeMatchBundles(finalOutput);
    console.log(`[worldcup] wrote updates for ${finalOutput.matchCount} matches, ${finalOutput.groupCount} groups`);
  } else {
    await writeMatchBundles(draft);
    console.log(`[worldcup] checked ${draft.matchCount} matches; refreshed last_checked_at only.`);
  }
  if (broadcastDataChanged) {
    await fs.writeFile(BROADCASTS_FILE, desiredBroadcasts);
    console.log('[worldcup-broadcasts] wrote broadcaster data updates');
  }
  if (reviewDataChanged && broadcastReview) {
    await fs.writeFile(BROADCAST_REVIEW_FILE, desiredReview);
    console.log('[worldcup-bein] wrote official beIN review report');
  }
}
main().catch(err=>{ console.error(err); process.exitCode=1; });
