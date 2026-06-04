import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const WC_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const MATCHES_FILE = path.join(WC_DIR, 'matches.json');
const STANDINGS_FILE = path.join(WC_DIR, 'standings.json');
const BRACKET_FILE = path.join(WC_DIR, 'bracket.json');
const SOURCE_URL = process.env.WORLD_CUP_2026_SOURCE_URL || 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const TIMEZONE = 'Asia/Amman';
const JORDAN_OFFSET_HOURS = 3;
const HOURLY_MATCH_DAY_CRON = '17 * * * *';
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
  if (m.score?.ft) return 'finished';
  if (m.status) return m.status;
  return 'scheduled';
}
function scoreValue(score, index) {
  if (!score) return 0;
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
    status:matchStatus(m), home_score:scoreValue(m.score,0), away_score:scoreValue(m.score,1), score:m.score || null, score_source:'openfootball'
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
async function readExistingMatchesBundle() { return readJson(MATCHES_FILE); }
function hasMatchToday(existingBundle, todayKey) {
  const matches = existingBundle?.matches || [];
  return matches.some(match => matchDateKeyInJordan(match) === todayKey);
}
function shouldSkipForSmartSchedule(existingBundle) {
  if (FORCE_UPDATE) return {skip:false, reason:'manual/forced run'};
  if (!EVENT_SCHEDULE) return {skip:false, reason:'direct run without schedule'};
  if (EVENT_SCHEDULE === BASE_12_HOUR_CRON) return {skip:false, reason:'baseline 12-hour run'};
  if (EVENT_SCHEDULE === HOURLY_MATCH_DAY_CRON) {
    const todayKey = todayKeyInJordan();
    const matchToday = hasMatchToday(existingBundle, todayKey);
    return matchToday
      ? {skip:false, reason:`match day in Jordan (${todayKey})`}
      : {skip:true, reason:`no World Cup matches in Jordan date ${todayKey}; hourly run skipped`};
  }
  return {skip:false, reason:`unknown schedule (${EVENT_SCHEDULE})`};
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
function buildOutput(source, lastUpdatedIso) {
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
    source:'openfootball/worldcup.json',
    source_url:SOURCE_URL,
    official_reference:'https://digitalhub.fifa.com/m/1be9ce37eb98fcc5/original/FWC26-Match-Schedule_English.pdf',
    last_updated:lastUpdatedIso,
    update_policy:'hourly on Jordan match days, every 12 hours on rest days',
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
async function main(){
  await fs.mkdir(WC_DIR,{recursive:true});
  const existingBundle = await readExistingMatchesBundle();
  const gate = shouldSkipForSmartSchedule(existingBundle);
  if (gate.skip) {
    console.log(`[worldcup] ${gate.reason}`);
    return;
  }
  console.log(`[worldcup] running update: ${gate.reason}`);
  const source = await fetchSource(existingBundle);
  const preservedLastUpdated = existingBundle?.metadata?.last_updated || jordanNowIso();
  const draft = buildOutput(source, preservedLastUpdated);
  const currentMatches = await readText(MATCHES_FILE);
  const currentStandings = await readText(STANDINGS_FILE);
  const currentBracket = await readText(BRACKET_FILE);
  const desiredMatches = `${draft.matchesText}\n`;
  const desiredStandings = `${draft.standingsText}\n`;
  const desiredBracket = `${draft.bracketText}\n`;
  const hasChanges = desiredMatches !== currentMatches || desiredStandings !== currentStandings || desiredBracket !== currentBracket;
  if (!hasChanges) {
    console.log(`[worldcup] checked ${draft.matchCount} matches; no data changes to write.`);
    return;
  }
  const finalOutput = buildOutput(source, jordanNowIso());
  await fs.writeFile(MATCHES_FILE, `${finalOutput.matchesText}\n`);
  await fs.writeFile(STANDINGS_FILE, `${finalOutput.standingsText}\n`);
  await fs.writeFile(BRACKET_FILE, `${finalOutput.bracketText}\n`);
  console.log(`[worldcup] wrote updates for ${finalOutput.matchCount} matches, ${finalOutput.groupCount} groups`);
}
main().catch(err=>{ console.error(err); process.exitCode=1; });
