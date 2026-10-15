import { CONFIG } from '../config.js';
import { MANAGER_CODES, PILOT_USERS, SESSION_MGR, SESSION_USER } from '../pilot.js';
import { init, refresh, me, load, score } from '../core.js';
import { esc } from '../dom.js';

const $=s=>document.querySelector(s),API=CONFIG.backend==='api';
let ready=true;try{await init()}catch(e){ready=false}
const m=API?me():null;
const isM=API?!!m&&m.role!=='agent':!!MANAGER_CODES[sessionStorage.getItem(SESSION_MGR)];
const mine=API?(m&&m.role==='agent'?m.code:null):localStorage.getItem(SESSION_USER);
if(!ready||(!isM&&!PILOT_USERS[mine])){document.body.innerHTML='<div class="wrap gate"><h1>Sign in first</h1><p>Open <a class="link" href="index.html">break.track</a> and sign in, then come back.</p></div>'}
else{$('#back').href=isM?'manager.html':'index.html';$('#ttl').textContent=isM?'Punctuality report':'🏁 Breakathon';
$('#sub').textContent=isM?'Who keeps to their break allowances over time.':`Stay inside your break times, build a streak, climb the board. Top spot earns: ${CONFIG.rewardLabel}.`;
if(API&&!isM)$('#sub').textContent+=' (Your own score is shown for now. The team board switches on once the nightly results job is added.)';
$('#th').innerHTML='<tr><th>#</th><th>Person</th><th>Punctual</th><th>Streak</th><th>Points</th>'+(isM?'<th>Breaks taken</th><th>Minutes over</th>':'')+'</tr>';
function draw(){const db=load(),rows=Object.entries(PILOT_USERS).map(([c,n])=>({c,n,...score(db,c)})).sort((a,b)=>b.points-a.points||(b.pct??-1)-(a.pct??-1));
$('#rows').innerHTML=rows.map((r,i)=>`<tr class="rank ${!isM&&r.c===mine?'me':''}"><td>${['🥇','🥈','🥉'][i]||i+1}</td><td class="person"><b>${esc(r.n)}${!isM&&r.c===mine?' (you)':''}</b></td><td>${r.pct===null?'–':r.pct+'%'}</td><td>${r.streak?'🔥 '+r.streak+' day'+(r.streak>1?'s':''):'–'}</td><td><b>${r.points}</b></td>${isM?`<td>${r.clean}/${r.taken} on time</td><td class="${r.overMin?'bad':''}">${r.overMin}</td>`:''}</tr>`).join('')}
draw();setInterval(async()=>{try{await refresh()}catch{}draw()},CONFIG.refreshSeconds*1000)}
