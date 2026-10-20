import { CONFIG } from '../config.js';
import { PILOT_USERS, MANAGER_CODES, SESSION_USER } from '../pilot.js';
import { load, save, purge, dayKey, hhmm, mmss, durHM, fmtMin, tidy, atTime, slotsFor, plan, STORAGE_KEY, init, refresh, me, signIn, signOut } from '../core.js';
import { jokeFor } from '../jokes.js';
import { esc, setHtml } from '../dom.js';
const $=s=>document.querySelector(s),SESSION=SESSION_USER,USERS=PILOT_USERS,COL=['var(--teal)','var(--warn)','var(--go)','#8E6CE0','#E86FA6','#5B8DEF','#C9A227','#778899'];
let TODAY=dayKey(),code=CONFIG.backend==='api'?null:localStorage.getItem(SESSION),db=load();
const rec=()=>db.days[TODAY]?.[code],P=now=>plan(rec(),db.adj[TODAY]?.[code],now,slotsFor(db,code,TODAY));
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(CONFIG.backend==='api'){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role!=='agent'){await signOut();$('#gateErr').textContent="That's a manager code. Team leads sign in on the manager page (link below).";return}code=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!USERS[c]){$('#gateErr').textContent=MANAGER_CODES[c]?"That's a manager code. Team leads sign in on the manager page (link below).":"That code isn't on the pilot list. Check it with your team lead.";return}code=c;localStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{localStorage.removeItem(SESSION);code=null;closeTimer();await signOut();showGate()});
function ensureRec(){db=load();purge(db);const d=(db.days[TODAY]??={});if(!d[code])d[code]={name:USERS[code],shiftStart:Math.floor(Date.now()/60000)*60000,shiftEnd:null,breaks:[],active:null};save(db)}
function commit(fn){db=load();const r=db.days[TODAY]?.[code];if(r)fn(r);save(db);renderAll()}
$('#startIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{r.shiftStart=atTime(e.target.value,Date.now());if(r.shiftEnd&&r.shiftEnd<=r.shiftStart)r.shiftEnd+=864e5})});
$('#endIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{let t=atTime(e.target.value,r.shiftStart);if(t<=r.shiftStart)t+=864e5;r.shiftEnd=t})});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>commit(r=>{r.shiftEnd=r.shiftStart+Number(c.dataset.len)*36e5})));
$('#tiles').addEventListener('click',e=>{const b=e.target.closest('button[data-slot]');if(!b)return;if(rec().active?.slot!==b.dataset.slot)commit(r=>{r.active={slot:b.dataset.slot,start:Date.now()}});openTimer()});
$('#tStop').addEventListener('click',()=>endBreak(false));
function endBreak(auto){const a=rec()?.active;if(!a)return;const key=a.slot;
  commit(r=>{const x=r.active;if(!x)return;r.breaks.push({slot:x.slot,start:x.start,end:auto?x.start+CONFIG.forgotToStopMinutes*6e4:Date.now(),...(auto?{flag:'forgot'}:{})});r.active=null});
  closeTimer();showResult(key,auto)}
function showResult(key,auto){const p=P(Date.now()),i=p.findIndex(s=>s.key===key),s=p[i],n=p[i+1];let body;
  if(auto)body=`Your break was left running for ${CONFIG.forgotToStopMinutes} minutes, so we closed it automatically. Your manager will see it flagged.`;
  else if(s.over>0)body=`You used your full ${tidy(s.allowed)} min of ${s.label}, plus ${fmtMin(s.over)} over. `+(n?`That's come off ${n.label}, which is now ${tidy(n.allowed)} min. Sorry mate, hope you don't mind 😅`:'There\'s no later break to take it from, so it\'s been noted for your manager.');
  else if(s.left>=10)body=`${tidy(s.used/60)} of ${tidy(s.allowed)} min used. You still have ${fmtMin(s.left)} of ${s.label}. Hit Resume whenever 👌`;
  else body='Right on time. Nicely done 👌';
  $('#rTitle').textContent=s.done?`${s.label} done`:`${s.label} paused`;$('#rBody').textContent=body;$('#resOv').classList.remove('hidden');$('#rOk').focus()}
$('#rOk').addEventListener('click',()=>$('#resOv').classList.add('hidden'));
function openTimer(){$('#timerOv').classList.remove('hidden');$('#tStop').focus();tick()}
function closeTimer(){$('#timerOv').classList.add('hidden');document.title='break.track'}
function renderBreaks(){const r=rec(),now=Date.now(),p=P(now),anyA=!!r.active;
  const tot=p.reduce((a,s)=>a+s.base,0),used=p.reduce((a,s)=>a+s.used,0);
  $('#rFg').style.strokeDashoffset=565.49*(1-Math.min(1,tot?used/(tot*60):0));$('#rFg').style.stroke=p.some(s=>s.over)?'var(--stop)':'var(--teal)';
  $('#rNum').textContent=Math.round(used/60);$('#rOf').textContent=`of ${tidy(tot)} min`;
  setHtml($('#tList'),p.map((s,i)=>{const t=[...s.segs.map(b=>`${hhmm(b.start)}–${hhmm(b.end)}`),...(s.act?[`${hhmm(s.act.start)}– now`]:[])].join(', ');
    return `<li><i class="dot" style="background:${COL[i%8]}"></i><div><b>${esc(s.label)}</b><span class="${s.over?'bad':''}">${t?t+(s.over?` (+${fmtMin(s.over)} over)`:''):'not taken yet'}</span></div></li>`}).join(''));
  setHtml($('#tiles'),p.map((s,i)=>{const prev=p[i-1];
    const tl=s.act?'In progress':s.done?(s.over?`Done · +${fmtMin(s.over)} over`:'Done ✓'):`${Math.ceil(s.left/60)} Min Left`;
    const src=p.slice(0,i).reverse().find(x=>x.over>0),note=s.deducted>0&&src?`<small>Sorry mate, ${esc(s.label)} is ${tidy(s.allowed)} min because ${esc(src.label)} ran ${fmtMin(src.over)} over. Hope you understand 😅</small>`:s.adjust?`<small style="color:var(--muted)">${s.adjust>0?'+':''}${s.adjust} min from your manager</small>`:'';
    const btn=s.act?`<button class="btn teal" data-slot="${s.key}">Open timer</button>`:s.done||s.allowed<=0?`<button class="btn ghost" disabled>${s.allowed<=0?'No time left':'Done'}</button>`:`<button class="btn" data-slot="${s.key}" ${anyA?'disabled':''}>${s.used>0?'Resume':'Start'}</button>`;
    return `<div class="tile${s.act?' live':''}"><b>${esc(s.label)}</b><div class="tl">${tl}</div><div class="tbar"><i style="width:${s.allowed?Math.round(s.left/(s.allowed*60)*100):0}%;background:${s.over?'var(--stop)':'var(--go)'}"></i></div>${note}${btn}</div>`}).join(''))}
function renderAll(){const r=rec();if(!r)return;$('#who').textContent=r.name;$('#startIn').value=hhmm(r.shiftStart);$('#endIn').value=r.shiftEnd?hhmm(r.shiftEnd):'';
  $('#startHint').textContent=r.shiftEnd?'Shift start was set when you first opened break.track today. Change it if you started earlier.':`We've set your start to ${hhmm(r.shiftStart)}. Now add your end time or pick a shift length.`;renderBreaks();tick()}
let lastBr=0;
function tick(){const now=Date.now();if(dayKey(new Date(now))!==TODAY){TODAY=dayKey();ensureRec();renderAll();return}
  const r=rec();if(!r)return;if(r.active&&now-r.active.start>CONFIG.forgotToStopMinutes*6e4){endBreak(true);return}
  if(r.active&&now-lastBr>900){lastBr=now;renderBreaks()}
  const p=P(now),start=r.shiftStart,end=r.shiftEnd,total=end?end-start:0,pct=end?(now-start)/total*100:null,cl=pct===null?0:Math.max(0,Math.min(100,pct));
  const worked=end?Math.max(0,Math.min(now,end)-start)/1000:0;
  $('#pct').textContent=pct===null?'–':pct<0?'Soon':durHM(worked);
  $('#pctLabel').innerHTML=pct===null?'Add your end time to switch on your progress bar.':pct<0?`Your shift starts at <b>${hhmm(start)}</b>.`:pct>=100?'<b>Shift complete.</b> Nicely done.':`worked and counting. Only <b>${durHM((end-now)/1000)}</b> to go.`;
  $('#fill').style.width=cl+'%';$('#fill').classList.toggle('full',cl>=100);$('#nowDot').style.left=cl+'%';$('#nowDot').style.display=pct===null?'none':'';$('#endsL').textContent=hhmm(start);$('#endsR').textContent=end?hhmm(end):'--:--';
  let segs='',flags='';
  if(end){p.forEach(s=>[...s.segs.map(b=>[b.start,b.end]),...(s.act?[[s.act.start,now]]:[])].forEach(([a,b])=>{const l=Math.max(0,(a-start)/total*100),w=Math.max(.7,Math.min(100,(b-start)/total*100)-l);segs+=`<div class="seg${s.over>0?' over':''}" style="left:${l}%;width:${w}%"></div>`}));
    let bi=0;p.forEach(s=>{if(s.tone==='custom')return;const f=s.tone==='lunch'?.5:[.25,.75][bi++]??.5;if(s.used>0)return;const t=start+f*total;if(t<now-6e5)return;flags+=`<div class="flag" style="left:${f*100}%"><b>${s.label!==s.defaultLabel?esc(s.label):s.tone==='lunch'?'Lunch':s.label.replace('Break ','B')}</b> ${hhmm(t)}</div>`})}
  $('#segs').innerHTML=segs;$('#flags').innerHTML=flags;
  const used=p.reduce((a,s)=>a+s.used,0),allowed=p.reduce((a,s)=>a+s.base,0);
  $('#sTaken').innerHTML=`${p.filter(s=>s.done).length} <small>of ${p.length}</small>`;$('#sUsed').innerHTML=`${Math.round(used/60)} <small>of ${tidy(allowed)} min</small>`;
  if(end){const left=Math.max(0,(end-now)/1000),unused=p.reduce((a,s)=>a+(s.done?0:s.left),0);$('#sLeft').textContent=durHM(left);$('#sWork').textContent=durHM(Math.max(0,left-unused))}else{$('#sLeft').textContent='–';$('#sWork').textContent='–'}
  const j=jokeFor(now,r,pct);if($('#joke').textContent!==j)$('#joke').textContent=j;
  if(r.active){const i=p.findIndex(s=>s.key===r.active.slot),s=p[i],n=p[i+1],tot=s.allowed*60,left=tot-s.used,ratio=tot?left/tot:-1;
    const ph=left<=0?'over':ratio<=1/3?'red':ratio<=2/3?'amber':'green',sh=left>=0?Math.ceil(left):Math.floor(-left);
    $('#timerBox').className='dialog timer '+ph;$('#tName').textContent=`${s.label} · ${tidy(s.allowed)} min${s.used-(now-r.active.start)/1000>1?' (resumed)':''}`;$('#tDigits').textContent=(left<0?'−':'')+mmss(sh);
    $('#ringFg').style.strokeDashoffset=565.49*(1-Math.max(0,Math.min(1,ratio)));$('#tPhase').textContent={green:'Plenty of time',amber:'Getting there',red:'Nearly up',over:'Over your break'}[ph];
    $('#tSub').textContent=left<0?(n?`${fmtMin(-left)} over so far. It will come off ${n.label}.`:`${fmtMin(-left)} over so far. Your manager will see this.`):`Back at ${hhmm(now+left*1000)}. Back early? You can resume later.`;
    document.title=`${left<0?'−':''}${mmss(sh)} · ${s.label}`}}
let t1,t2;
function boot(){if(!code||!USERS[code])return showGate();$('#gate').classList.add('hidden');$('#app').classList.remove('hidden');ensureRec();renderAll();if(rec().active)openTimer();
  clearInterval(t1);clearInterval(t2);t1=setInterval(tick,1000);t2=setInterval(async()=>{if(CONFIG.backend==='api'){try{if(await refresh()){db=load();renderAll()}}catch{}return}const s=localStorage.getItem(STORAGE_KEY);if(s!==JSON.stringify(db)){db=load();renderAll()}},CONFIG.refreshSeconds*1000)}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&code){db=load();renderAll()}});
(async()=>{if(CONFIG.backend==='api')$('#pw').classList.remove('hidden');try{await init();if(CONFIG.backend==='api'){const m=me();code=m&&m.role==='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
