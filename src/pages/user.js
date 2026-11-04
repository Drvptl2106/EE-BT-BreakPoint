import { CONFIG } from '../config.js?v=c85a4b0b52';
import { PILOT_USERS, MANAGER_CODES, SESSION_USER } from '../pilot.js?v=c85a4b0b52';
import { myRewards, claimReward, setLook } from '../core.js?v=c85a4b0b52';
import { load, save, purge, dayKey, hhmm, mmss, durHM, fmtMin, tidy, atTime, slotsFor, plan, streakOf, workDayOf, STORAGE_KEY, init, refresh, me, signIn, signOut, now, breakathon, weekOf } from '../core.js?v=c85a4b0b52';
import { offerAlerts, checkAlerts } from '../notify.js?v=c85a4b0b52';
import { setupIdeas } from '../ideas.js?v=c85a4b0b52';
import { setupUi, syncUi, isPro } from '../ui.js?v=c85a4b0b52';
import { jokeFor, proNote } from '../jokes.js?v=c85a4b0b52';
import { esc, setHtml } from '../dom.js?v=c85a4b0b52';
import { startClock, setLive, setupTabs, setupPassword, setupTheme, setupApp } from '../chrome.js?v=c85a4b0b52';
import { raceHTML, wireRacers, avatar, prizeHTML, lookPanelHTML, itemName } from '../race.js?v=c85a4b0b52';
import { toast } from '../chrome.js?v=c85a4b0b52';

const $=s=>document.querySelector(s),SESSION=SESSION_USER,USERS=PILOT_USERS,API=CONFIG.backend==='api';
let TODAY=dayKey(new Date(now())),code=API?null:localStorage.getItem(SESSION),db=load(),tab='day';
const rec=()=>db.days[TODAY]?.[code],P=at=>plan(rec(),db.adj[TODAY]?.[code],at,slotsFor(db,code,TODAY));
const hms=sec=>{const s=Math.max(0,Math.floor(sec));return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};

/* ---------- sign in / out ---------- */
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(API){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role!=='agent'){await signOut();$('#gateErr').textContent="That's a manager code. Team leads sign in on the manager page (link below).";return}code=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!USERS[c]){$('#gateErr').textContent=MANAGER_CODES[c]?"That's a manager code. Team leads sign in on the manager page (link below).":"That code isn't on the pilot list. Check it with your team lead.";return}code=c;localStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{ideas.show(false);localStorage.removeItem(SESSION);code=null;document.title='breakpoint';await signOut();showGate()});

/* ---------- changes ---------- */
function ensureRec(){db=load();purge(db);const d=(db.days[TODAY]??={});if(!d[code])d[code]={name:USERS[code],shiftStart:Math.floor(now()/60000)*60000,shiftEnd:null,breaks:[],active:null};save(db)}
function commit(fn){db=load();const r=db.days[TODAY]?.[code];if(r)fn(r);save(db);renderAll()}
$('#startIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{r.shiftStart=atTime(e.target.value,now());if(r.shiftEnd&&r.shiftEnd<=r.shiftStart)r.shiftEnd+=864e5})});
$('#endIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{let t=atTime(e.target.value,r.shiftStart);if(t<=r.shiftStart)t+=864e5;r.shiftEnd=t})});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>commit(r=>{r.shiftEnd=r.shiftStart+Number(c.dataset.len)*36e5})));
$('#bars').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='tStop')return endBreak(false);
  const slot=b.dataset.slot||b.dataset.next;if(slot&&rec().active?.slot!==slot){commit(r=>{r.active={slot,start:now()}});if(!offerAlerts())toast(isPro()?'Break started. The timer is running.':'Break started. Enjoy it, the timer is running.')}});
function endBreak(auto){const a=rec()?.active;if(!a)return;const key=a.slot;
  commit(r=>{const x=r.active;if(!x)return;r.breaks.push({slot:x.slot,start:x.start,end:auto?x.start+CONFIG.forgotToStopMinutes*6e4:now(),...(auto?{flag:'forgot'}:{})});r.active=null});
  document.title='breakpoint';showResult(key,auto)}
/* after a break: a short message that doesn't get in the way */
function showResult(key,auto){const p=P(now()),s=p.find(x=>x.key===key),last=s?.segs.at(-1),took=last?Math.round((last.end-last.start)/6e4):0;
  const total=p.reduce((a,x)=>a+Math.max(0,x.base),0)*60,used=p.reduce((a,x)=>a+x.used,0),over=used-total;
  const body=auto?`Your break was still running after ${CONFIG.forgotToStopMinutes} minutes, so it was closed. If that's not right, your team lead can fix it.`
    :over>=CONFIG.overToleranceMinutes*60?`Welcome back. ${s.label}: ${took} min. You're ${mins(over)} min over today's break time.`
    :`Welcome back. ${s.label}: ${took} min. ${mins(total-used)} min of break time left today.`;
  toast(body,7000)}
/* ---------- today's break time as one ring ----------
   The day's breaks are one pot (plan() in src/core.js), so the ring shows the whole day: each break taken in its own colour,
   what's left in grey, red only once the day's total is used up. One number in the middle (minutes left today, or a
   stopwatch while on a break), one big button, and a plain list of what was taken when. No "borrowed" maths on screen. */
const RING_COLS=['#0E9F94','#5B8DEF','#F2B705','#A47BE0','#46B36B','#F08A4B','#E36B9A','#3FB8D6'];
const mins=sec=>Math.round(Math.max(0,sec)/60),R=86,RC=2*Math.PI*R;
const arcSvg=(a,b,col,w=18,r=R)=>b>a?`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${(b-a)*2*Math.PI*r} ${2*Math.PI*r}" stroke-dashoffset="${-a*2*Math.PI*r}"/>`:'';
function renderBars(at){const r=rec(),p=P(at),run=p.find(s=>s.act),col=k=>RING_COLS[p.findIndex(s=>s.key===k)%RING_COLS.length];
  const total=p.reduce((a,s)=>a+Math.max(0,s.base),0)*60,used=p.reduce((a,s)=>a+s.used,0),left=Math.max(0,total-used),over=Math.max(0,used-total),
    isOver=over>=CONFIG.overToleranceMinutes*60;
  $('#brkSum').textContent=`${mins(used)} of ${mins(total)} min used`;
  /* the ring: every sitting in the order it happened, in its break's colour; anything past the day's total in red, outside */
  const sit=[...(r.breaks||[]).map(b=>({k:b.slot,s:(b.end-b.start)/1000,t:b.start})),...(r.active?[{k:r.active.slot,s:Math.max(0,(at-r.active.start)/1000),t:r.active.start}]:[])].sort((x,y)=>x.t-y.t);
  let pos=0,g=arcSvg(0,1,'var(--surface-3)');
  for(const x of sit){const e=pos+x.s/(total||1);g+=arcSvg(Math.min(1,pos),Math.min(1,e),col(x.k));pos=e}
  if(isOver)g+=arcSvg(0,Math.min(1,over/(total||1)),'var(--danger)',6,100);
  const mid=run?`<b>${mmss((at-run.act.start)/1000)}</b><span>on ${esc(run.label)}</span><small class="${isOver?'bad':''}">${isOver?`${mins(over)} min over today`:`${mins(left)} min left today`}</small>`
    :isOver?`<b>${mins(over)}</b><span>min over today</span>`:`<b>${mins(left)}</b><span>min break time left today</span>`;
  let act;
  if(run){const own=Math.max(0,run.base*60-run.used);
    act=`<div class="times">${own>0?`<span>Planned: back at <b>${hhmm(at+own*1000)}</b></span>`:''}${isOver?`<span class="bad">Over by <b>${mins(over)} min</b></span>`:`<span>Latest: <b>${hhmm(at+left*1000)}</b></span>`}</div>
      <button class="btn yellow big" id="tStop">I'm back</button>`}
  else{const open=p.filter(s=>s.left>0&&s.allowed>0&&!s.done),nx=open[0];
    act=nx?`<button class="btn yellow big" data-next="${nx.key}">${nx.used>0?'Resume':'Start'} ${esc(nx.label)}</button>
      ${open.length>1?`<div class="chips2" aria-label="Other breaks">${open.slice(1).map(s=>`<button class="chipb" data-slot="${s.key}"><i style="background:${col(s.key)}"></i>${s.used>0?'Resume ':''}${esc(s.label)}</button>`).join('')}</div>`:''}`
      :`<p class="say">All your breaks are taken${left>0?`. ${mins(left)} min left today if you need it.`:'.'}</p>`}
  /* a plain list: what was taken when, or how long each one usually is */
  const row=s=>{const d=`<i class="dot" style="background:${col(s.key)}"></i>`,segs=s.segs.map(b=>`${hhmm(b.start)}–${hhmm(b.end)}`).join(', ');
    const note=[s.adjust?`${s.adjust>0?'+':''}${s.adjust} min from your team lead`:'',s.segs.some(b=>b.flag)?'closed automatically':''].filter(Boolean).join(' · ');
    if(s.act)return `<li class="on">${d}<div><b>${esc(s.label)}</b><small>On now · since ${hhmm(s.act.start)}${segs?` · earlier ${segs}`:''}</small></div><span class="t">${mins(s.used)} min</span></li>`;
    if(s.used>0)return `<li>${d}<div><b>${esc(s.label)}</b><small>${segs}${note?` · ${note}`:''}</small></div><span class="t">${mins(s.used)} min</span></li>`;
    return `<li class="todo">${d}<div><b>${esc(s.label)}</b><small>Not taken yet · usually ${Math.max(0,s.base)} min${note?` · ${note}`:''}</small></div><span class="t">–</span></li>`};
  setHtml($('#bars'),`<div class="ringwrap"><div class="ring${run?' on':''}${isOver?' over':''}" role="timer" aria-live="off"><svg viewBox="0 0 200 200" aria-hidden="true">${g}</svg><div class="mid">${mid}</div></div>${act}</div>
    <ul class="blist" aria-label="Today's breaks">${p.map(row).join('')}</ul>`)}

/* ---------- the shift pie: worked, breaks, over and still to go, with the time ticking to the second ---------- */
const C=2*Math.PI*90,arc=(a,b,col)=>b>a?`<circle cx="110" cy="110" r="90" stroke="${col}" stroke-dasharray="${(b-a)*C} ${C}" stroke-dashoffset="${-a*C}"/>`:'';
function renderShift(at){const r=rec(),p=P(at),start=r.shiftStart,end=r.shiftEnd,total=end?end-start:0;
  if(!end){$('#arcs').innerHTML=arc(0,1,'var(--line)');$('#nowMark').innerHTML='';$('#worked').textContent='–';$('#workedLbl').textContent='Add your end time to switch on your shift clock';return}
  const f=t=>Math.max(0,Math.min(1,(t-start)/total)),fn=f(at);let g=arc(0,1,'var(--line)')+arc(0,fn,'var(--teal)');
  for(const s of p){const segs=[...s.segs.map(b=>[b.start,b.end]),...(s.act?[[s.act.start,at]]:[])].sort((a,b)=>b[0]-a[0]);let over=s.over*1000;
    for(const [a,b] of segs){const red=Math.min(over,b-a);over-=red;g+=arc(f(a),f(b-red),'var(--ee-yellow)')+arc(f(b-red),f(b),'var(--stop)')}}
  $('#arcs').innerHTML=g;
  const ang=(fn*360-90)*Math.PI/180;$('#nowMark').innerHTML=fn>0&&fn<1?`<circle cx="${110+90*Math.cos(ang)}" cy="${110+90*Math.sin(ang)}" r="9" style="fill:var(--ink);stroke:var(--surface);stroke-width:4"/>`:'';
  if(at<start){$('#worked').textContent=hhmm(start);$('#workedLbl').textContent='your shift starts at';return}
  $('#worked').textContent=hms((Math.min(at,end)-start)/1000);
  $('#workedLbl').textContent=at>=end?'Shift complete':`worked · ${hms((end-at)/1000)} to go`}

function renderAll(){const r=rec();if(!r)return;$('#who').textContent=r.name;$('#startIn').value=hhmm(r.shiftStart);$('#endIn').value=r.shiftEnd?hhmm(r.shiftEnd):'';
  document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',!!r.shiftEnd&&r.shiftEnd-r.shiftStart===Number(c.dataset.len)*36e5));
  $('#startHint').textContent=r.shiftEnd?'':`Started ${hhmm(r.shiftStart)}. Add your end time or pick a shift length.`;
  const k=streakOf(db,code,TODAY);$('#streak').classList.toggle('hidden',k<2);$('#streak').textContent=isPro()?`${k} on-time days in a row`:`🔥 ${k}-day streak`;tick()}

function tick(){const at=now(),wd=workDayOf(db,code,at);if(wd!==TODAY){TODAY=wd;ensureRec();renderAll();return}   // a new working day (not just midnight)
  const r=rec();if(!r)return;if(r.active&&at-r.active.start>CONFIG.forgotToStopMinutes*6e4){endBreak(true);return}
  renderBars(at);renderShift(at);checkAlerts(P(at).find(x=>x.act),isPro());
  const p=P(at),end=r.shiftEnd,pct=end?(at-r.shiftStart)/(end-r.shiftStart)*100:null;
  const used=p.reduce((a,s)=>a+s.used,0),allowed=p.reduce((a,s)=>a+s.base,0);
  $('#sTaken').innerHTML=`${p.filter(s=>s.done).length} <small>of ${p.length}</small>`;$('#sUsed').innerHTML=`${Math.round(used/60)} <small>of ${tidy(allowed)} min</small>`;$('#sUsed').classList.toggle('bad',p.some(s=>s.over));
  if(end){const left=Math.max(0,(end-at)/1000),unused=p.reduce((a,s)=>a+(s.done?0:s.left),0);$('#sLeft').textContent=durHM(left);$('#sWork').textContent=durHM(Math.max(0,left-unused))}else{$('#sLeft').textContent='–';$('#sWork').textContent='–'}
  const j=isPro()?proNote(at,r,pct,p[0]?.spare||0):jokeFor(at,r,pct);if($('#joke').textContent!==j.text){$('#joke').textContent=j.text;$('#pepK').textContent=j.kicker;const bb=$('#bubble');bb.classList.remove('pop');void bb.offsetWidth;bb.classList.add('pop')}
  
  if(r.active){const s=p.find(x=>x.act);document.title=s.over>0?`−${mmss(Math.ceil(s.over))} · ${s.label}`:`${mmss(Math.ceil(s.left>0?s.left:s.spare))} · ${s.label}`}}

/* ---------- Breakathon ---------- */
let week=0,raceT=null,mine=null,picking=false;
async function loadMine(){try{mine=await myRewards(code)}catch{mine=null}$('#custAv').innerHTML=avatar(code,{look:mine});tick();drawLook()}
/* the little "Customise your mascot" button on My day: jumps to the mascot panel on the Breakathon tab */
let showTab=null;
$('#custBtn').addEventListener('click',()=>{history.replaceState(null,'','#race');showTab?.('race');setTimeout(()=>$('#look').scrollIntoView({behavior:'smooth',block:'start'}),350)});
function drawLook(){if(tab!=='race')return;setHtml($('#prize'),prizeHTML(mine,picking,isPro()));setHtml($('#look'),lookPanelHTML(code,mine,picking))}
$('#prize').addEventListener('click',async e=>{const b=e.target.closest('[data-prize]');if(!b)return;const k=b.dataset.prize;
  if(k==='look'||k==='cancel'){picking=k==='look';return drawLook()}
  if(!confirm(`Take a ${CONFIG.breakathon.rewardMinutes} min extra break as your prize? Your team lead will add it to your day.`))return;
  try{await claimReward(code,'break');toast('Prize claimed. Your team lead will add your extra break.')}catch(err){toast(err.message)}await loadMine();drawRace()});
$('#look').addEventListener('click',async e=>{const b=e.target.closest('.sw');if(!b||b.disabled)return;
  const kind=b.dataset.colour?'colour':'accessory',key=b.dataset.colour||b.dataset.accessory,item=(kind==='colour'?'colour:':'acc:')+key;
  try{if(b.classList.contains('locked')){if(!picking)return;if(!confirm(`Unlock ${itemName(item)} as your prize? It's yours for good.`))return;await claimReward(code,'look',item);picking=false;toast(`You unlocked ${itemName(item)}.`)}
    else{const look={colour:mine?.colour||'teal',accessory:mine?.accessory||'none',[kind]:key};await setLook(code,look.colour,look.accessory)}}
  catch(err){toast(err.message)}await loadMine();drawRace()});
async function drawRace(){if(tab!=='race')return;try{
    const [rows,last]=await Promise.all([breakathon(weekOf(TODAY,week).from,weekOf(TODAY,week).to),breakathon(weekOf(TODAY,1).from,weekOf(TODAY,1).to)]);
    const champion=last[0]?.points>0?last[0]:null;
    setHtml($('#race'),raceHTML({rows,me:code,isManager:false,pro:isPro(),champion,prize:champion?.code===code&&mine?{choice:mine.claimed,item:mine.claimed_item}:null}));drawLook()}
  catch(err){$('#race').innerHTML=`<p class="empty">${esc(err.message)}</p>`}}
$('#weekSel').addEventListener('click',e=>{const b=e.target.closest('button[data-week]');if(!b)return;week=Number(b.dataset.week);document.querySelectorAll('#weekSel button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawRace()});

let t1,t2,clock,tabsReady=false;const ideas=setupIdeas($('#ideas'),{who:()=>code});
function boot(){if(!code||!USERS[code])return showGate();db=load();TODAY=workDayOf(db,code,now());$('#gate').classList.add('hidden');$('#app').classList.remove('hidden');ensureRec();renderAll();loadMine();syncUi(code);ideas.peek();
  clearInterval(clock);clock=startClock();if(!tabsReady){tabsReady=true;showTab=setupTabs(t=>{tab=t;clearInterval(raceT);ideas.show(t==='ideas');if(t==='race'){drawRace();raceT=setInterval(drawRace,60000)}})}
  clearInterval(t1);clearInterval(t2);t1=setInterval(tick,1000);t2=setInterval(async()=>{if(Date.now()%60000<CONFIG.refreshSeconds*1000&&tab!=='ideas')ideas.peek();if(API){try{if(await refresh()){db=load();renderAll()}setLive(true)}catch{setLive(false)}return}const s=localStorage.getItem(STORAGE_KEY);if(s!==JSON.stringify(db)){db=load();renderAll()}},CONFIG.refreshSeconds*1000)}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&code){db=load();renderAll()}});
setupPassword();setupTheme();setupApp();wireRacers($('#race'));
setupUi(()=>{if(code&&rec())renderAll();drawRace();drawLook()});
(async()=>{if(API)$('#pw').classList.remove('hidden');try{await init();if(API){const m=me();code=m&&m.role==='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
