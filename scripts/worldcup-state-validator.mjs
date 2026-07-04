import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'worldcup-2026');
const files = ['matches.json', 'bracket.json', 'knockout-live.json'];
const errors = [];

const EXPECTED = {
  M086: { teams:['Argentina','Cape Verde'], score:[3,2], status:/انتهت بعد التمديد|after extra|aet|extra/i, winnerSide:1 },
  M087: { teams:['Colombia','Ghana'], score:[1,0], status:/انتهت|finished|final|full/i, winnerSide:1 },
  M088: { teams:['Australia','Egypt'], score:[1,1], penalties:[2,4], status:/ترجيح|penalt|shootout/i, winnerSide:2 },
  M090: { teams:['Canada','Morocco'], score:[0,3], status:/انتهت|finished|final|full/i, winnerSide:2 },
  M095: { teams:['Argentina','Egypt'], scheduled:true },
  M096: { teams:['Switzerland','Colombia'], scheduled:true },
};

function readJson(file){ return JSON.parse(fs.readFileSync(path.join(DATA_DIR,file),'utf8')); }
function statusBlob(m){
  const parts=[]; const st=m?.status;
  if(typeof st==='string') parts.push(st); else if(st&&typeof st==='object') parts.push(st.key,st.state,st.label,st.label_ar);
  const sc=m?.score; if(sc&&typeof sc==='object') parts.push(sc.status,sc.phase,sc.phase_ar,sc.status_detail);
  parts.push(m?.status_key,m?.status_ar,m?.phase,m?.live_phase,m?.live_phase_ar,m?.live_status_detail);
  return parts.filter(Boolean).join(' ').toLowerCase();
}
function teamName(x){ if(!x) return ''; if(typeof x==='object') return x.name_en || x.name_ar || ''; return String(x); }
function scoreNum(v){ if(v===null||v===undefined||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function scorePair(m){
  const a=scoreNum(m.score1 ?? m.home_score);
  const b=scoreNum(m.score2 ?? m.away_score);
  if(a!==null && b!==null) return [a,b];
  const sc=m.score;
  if(sc&&Array.isArray(sc.current)) return sc.current.map(Number);
  if(sc&&Array.isArray(sc.ft)) return sc.ft.map(Number);
  if(sc&&Array.isArray(sc.et)) return sc.et.map(Number);
  return [null,null];
}
function penPair(m){
  if(m.penalty1!=null || m.penalty2!=null) return [Number(m.penalty1), Number(m.penalty2)];
  if(m.penalty_home_score!=null || m.penalty_away_score!=null) return [Number(m.penalty_home_score), Number(m.penalty_away_score)];
  const sc=m.score;
  if(sc&&Array.isArray(sc.p)) return sc.p.map(Number);
  return null;
}
function isFinal(m){ return /finished|complete|full[_\s-]?time|final|ended|ft|aet|انته/.test(statusBlob(m)); }
function isLive(m){ return /live|in[_\s-]?play|playing|started|مباشر|الشوط/.test(statusBlob(m)); }
function kickoffMs(m){ const v=m.kickoff_jordan || m.kickoff || m.kickoff_utc; const ms=Date.parse(v); return Number.isFinite(ms)?ms:null; }
function nowMs(){ return Date.now(); }
function checkFile(file){
  const data=readJson(file);
  const map=new Map((data.matches||[]).map(m=>[m.id,m]));
  for(const [id, exp] of Object.entries(EXPECTED)){
    const m=map.get(id); if(!m){errors.push(`${file}: missing ${id}`); continue;}
    if(exp.teams){
      const t1=teamName(m.team1); const t2=teamName(m.team2);
      if(t1!==exp.teams[0] || t2!==exp.teams[1]) errors.push(`${file}: ${id} teams are ${t1} vs ${t2}, expected ${exp.teams.join(' vs ')}`);
    }
    if(exp.score){
      const p=scorePair(m);
      if(p[0]!==exp.score[0] || p[1]!==exp.score[1]) errors.push(`${file}: ${id} score is ${p.join('-')}, expected ${exp.score.join('-')}`);
      if(!isFinal(m)) errors.push(`${file}: ${id} has final score but status is not final (${statusBlob(m)})`);
      if(isLive(m)) errors.push(`${file}: ${id} is final but still live (${statusBlob(m)})`);
    }
    if(exp.penalties){
      const p=penPair(m);
      if(!p || p[0]!==exp.penalties[0] || p[1]!==exp.penalties[1]) errors.push(`${file}: ${id} penalties are ${p}, expected ${exp.penalties.join('-')}`);
    }
    if(exp.status && !exp.status.test(statusBlob(m))) errors.push(`${file}: ${id} status blob does not match ${exp.status}: ${statusBlob(m)}`);
    if(exp.winnerSide && Number(m.winner_side)!==exp.winnerSide) errors.push(`${file}: ${id} winner_side=${m.winner_side}, expected ${exp.winnerSide}`);
  }
  for(const m of data.matches||[]){
    const id=m.id || '';
    const n = Number(m.number ?? m.match_number ?? String(id).replace(/^M0*/,''));
    if(n>=89 && n<=96 && !isFinal(m)){
      const k=kickoffMs(m);
      if(k && nowMs() < k - 2*60_000){
        const p=scorePair(m);
        if(p[0]===0 && p[1]===0) errors.push(`${file}: ${id} is future scheduled but still has 0-0 score`);
      }
    }
  }
}

for (const f of files) if(fs.existsSync(path.join(DATA_DIR,f))) checkFile(f);
const status = { ok: errors.length===0, name:'World Cup state validator', version:'2026-07-04-stable-results-v1', checked_at:new Date().toISOString(), errors };
fs.writeFileSync(path.join(DATA_DIR,'state-validator-status.json'), JSON.stringify(status,null,2)+'\n');
if(errors.length){
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify(status,null,2));
