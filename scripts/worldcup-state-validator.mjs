import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(),'public','worldcup-2026');
const VERSION = '2026-07-20-complete-knockout-canonical-lock-v3';
const LOCKED_AT = '2026-07-20T01:00:00+03:00';
const C = {
M073:['South Africa','Canada',[0,1],null,2],M074:['Germany','Paraguay',[1,1],[3,4],2],M075:['Netherlands','Morocco',[1,1],[2,3],2],M076:['Brazil','Japan',[2,1],null,1],
M077:['France','Sweden',[3,0],null,1],M078:['Ivory Coast','Norway',[1,2],null,2],M079:['Mexico','Ecuador',[2,0],null,1],M080:['England','DR Congo',[2,1],null,1],
M081:['USA','Bosnia & Herzegovina',[2,0],null,1],M082:['Belgium','Senegal',[3,2],null,1],M083:['Portugal','Croatia',[2,1],null,1],M084:['Spain','Austria',[3,0],null,1],
M085:['Switzerland','Algeria',[2,0],null,1],M086:['Argentina','Cape Verde',[3,2],null,1],M087:['Colombia','Ghana',[1,0],null,1],M088:['Australia','Egypt',[1,1],[2,4],2],
M089:['Paraguay','France',[0,1],null,2],M090:['Canada','Morocco',[0,3],null,2],M091:['Brazil','Norway',[1,2],null,2],M092:['Mexico','England',[2,3],null,2],
M093:['Portugal','Spain',[0,1],null,2],M094:['USA','Belgium',[1,4],null,2],M095:['Argentina','Egypt',[3,2],null,1],M096:['Switzerland','Colombia',[0,0],[4,3],1],
M097:['France','Morocco',[2,0],null,1],M098:['Spain','Belgium',[2,1],null,1],M099:['Norway','England',[1,2],null,2],M100:['Argentina','Switzerland',[3,1],null,1],
M101:['France','Spain',[0,2],null,2],M102:['England','Argentina',[1,2],null,2],M103:['France','England',[4,6],null,2],M104:['Spain','Argentina',[1,0],null,1]
};
const AR = {'South Africa':'جنوب أفريقيا','Canada':'كندا','Germany':'ألمانيا','Paraguay':'باراغواي','Netherlands':'هولندا','Morocco':'المغرب','Brazil':'البرازيل','Japan':'اليابان','France':'فرنسا','Sweden':'السويد','Ivory Coast':'كوت ديفوار','Norway':'النرويج','Mexico':'المكسيك','Ecuador':'الإكوادور','England':'إنجلترا','DR Congo':'الكونغو الديمقراطية','USA':'الولايات المتحدة','Bosnia & Herzegovina':'البوسنة والهرسك','Belgium':'بلجيكا','Senegal':'السنغال','Portugal':'البرتغال','Croatia':'كرواتيا','Spain':'إسبانيا','Austria':'النمسا','Switzerland':'سويسرا','Algeria':'الجزائر','Argentina':'الأرجنتين','Cape Verde':'الرأس الأخضر','Colombia':'كولومبيا','Ghana':'غانا','Australia':'أستراليا','Egypt':'مصر'};
const errors=[];
const read=f=>JSON.parse(fs.readFileSync(path.join(DATA_DIR,f),'utf8'));
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const team=v=>obj(v)?String(v.name_en||v.name||v.team||''):String(v||'');
const teamAr=(m,s)=>obj(m[`team${s}`])?String(m[`team${s}`].name_ar||''):String(m[`team${s}_ar`]||'');
const score=m=>[Number(m.home_score??m.score1??m.team1_score??m.score?.ft?.[0]),Number(m.away_score??m.score2??m.team2_score??m.score?.ft?.[1])];
const pens=m=>{const a=m.penalty1??m.penalty_home_score??m.home_penalties??m.team1_penalties??m.score?.p?.[0];const b=m.penalty2??m.penalty_away_score??m.away_penalties??m.team2_penalties??m.score?.p?.[1];return a==null||b==null?null:[Number(a),Number(b)];};
function walk(v,fn,seen=new Set()){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);fn(v);if(Array.isArray(v))v.forEach(x=>walk(x,fn,seen));else Object.values(v).forEach(x=>walk(x,fn,seen));}
function checkRecord(file,m,id){const [a,b,sc,pp,w]=C[id];const actual=[team(m.team1),team(m.team2)];if(actual[0]!==a||actual[1]!==b)errors.push(`${file} ${id}: teams ${actual.join(' vs ')} expected ${a} vs ${b}`);const actualScore=score(m);if(actualScore[0]!==sc[0]||actualScore[1]!==sc[1])errors.push(`${file} ${id}: score ${actualScore.join('-')} expected ${sc.join('-')}`);const p=pens(m);if(pp&&(!p||p[0]!==pp[0]||p[1]!==pp[1]))errors.push(`${file} ${id}: penalties ${p} expected ${pp}`);if(!pp&&p)errors.push(`${file} ${id}: unexpected penalties ${p}`);if(Number(m.winner_side)!==w)errors.push(`${file} ${id}: winner_side ${m.winner_side} expected ${w}`);if(Number(m.num??m.number??m.match_number)!==Number(id.slice(1)))errors.push(`${file} ${id}: wrong match number`);if(teamAr(m,1)!==AR[a]||teamAr(m,2)!==AR[b])errors.push(`${file} ${id}: Arabic names are wrong`);const status=typeof m.status==='string'?m.status:String(m.status?.key||m.status?.state||'');if(!/finished/i.test(status))errors.push(`${file} ${id}: status is not finished`);if(m.canonical_locked!==true||m.official_result_locked!==true)errors.push(`${file} ${id}: canonical lock missing`);if(a!=='Switzerland'&&teamAr(m,1)==='سويسرا')errors.push(`${file} ${id}: leaked سويسرا on team1`);if(b!=='Switzerland'&&teamAr(m,2)==='سويسرا')errors.push(`${file} ${id}: leaked سويسرا on team2`);}
const matchShape=m=>obj(m)&&['num','number','match_number','matchNumber','stage','stage_ar','kickoff','kickoff_utc','kickoff_jordan','home_score','away_score','score1','score2','team1_ar','team2_ar'].some(k=>Object.hasOwn(m,k));
for(const file of ['matches.json','bracket.json','knockout-live.json']){const data=read(file);const seen=Object.fromEntries(Object.keys(C).map(k=>[k,0]));walk(data,m=>{const id=matchShape(m)&&/^M\d{3}$/.test(String(m.id||''))?String(m.id):null;if(id&&C[id]){seen[id]++;checkRecord(file,m,id);}});for(const [id,n] of Object.entries(seen))if(n===0)errors.push(`${file}: missing ${id}`);}
const overrides=read('manual-results-overrides.json');const byId=new Map((overrides.results||[]).map(m=>[m.id,m]));for(const id of Object.keys(C)){const m=byId.get(id);if(!m)errors.push(`manual-results-overrides.json: missing ${id}`);else checkRecord('manual-results-overrides.json',m,id);}
const status={ok:errors.length===0,version:VERSION,checked_at:LOCKED_AT,final:{id:'M104',team1:'Spain',team2:'Argentina',score:[1,0],status:'finished'},errors};
fs.writeFileSync(path.join(DATA_DIR,'state-validator-status.json'),`${JSON.stringify(status,null,2)}\n`,'utf8');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('WORLD_CUP_CANONICAL_VALIDATION_OK: M073-M104; final Spain 1-0 Argentina');
