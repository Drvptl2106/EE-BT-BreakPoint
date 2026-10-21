import { CONFIG } from '../config.js?v=30c8b36143';
import { PILOT_USERS, MANAGER_CODES, SESSION_USER } from '../pilot.js?v=30c8b36143';
import { myRewards, claimReward, setLook } from '../core.js?v=30c8b36143';
import { load, save, purge, dayKey, hhmm, mmss, durHM, fmtMin, tidy, atTime, slotsFor, plan, STORAGE_KEY, init, refresh, me, signIn, signOut, now, breakathon, weekOf } from '../core.js?v=30c8b36143';
import { jokeFor } from '../jokes.js?v=30c8b36143';
import { esc, setHtml } from '../dom.js?v=30c8b36143';
import { startClock, setLive, setupTabs, setupPassword, setupTheme } from '../chrome.js?v=30c8b36143';
import { raceHTML, placeRacers, wireRacers, avatar, prizeHTML, lookPanelHTML, itemName } from '../race.js?v=30c8b36143';
import { toast } from '../chrome.js?v=30c8b36143';

const $=s=>document.querySelector(s),SESSION=SESSION_USER,USERS=PILOT_USERS,API=CONFIG.backend==='api';
let TODAY=dayKey(new Date(now())),code=API?null:localStorage.getItem(SESSION),db=load(),tab='day';
const rec=()=>db.days[TODAY]?.[code],P=at=>plan(rec(),db.adj[TODAY]?.[code],at,slotsFor(db,code,TODAY));
const hms=sec=>{const s=Math.max(0,Math.floor(sec));return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};

/* ---------- sign in / out ---------- */
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(API){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role!=='agent'){await signOut();$('#gateErr').textContent="That's a manager code. Team leads sign in on the manager page (link below).";return}code=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!USERS[c]){$('#gateErr').textContent=MANAGER_CODES[c]?"That's a manager code. Team leads sign in on the manager page (link below).":"That code isn't on the pilot list. Check it with your team lead.";return}code=c;localStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{localStorage.removeItem(SESSION);code=null;document.title='breakpoint';await signOut();showGate()});

/* ---------- changes ---------- */
function ensureRec(){db=load();purge(db);const d=(db.days[TODAY]??={});if(!d[code])d[code]={name:USERS[code],shiftStart:Math.floor(now()/60000)*60000,shiftEnd:null,breaks:[],active:null};save(db)}
function commit(fn){db=load();const r=db.days[TODAY]?.[code];if(r)fn(r);save(db);renderAll()}
$('#startIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{r.shiftStart=atTime(e.target.value,now());if(r.shiftEnd&&r.shiftEnd<=r.shiftStart)r.shiftEnd+=864e5})});
$('#endIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{let t=atTime(e.target.value,r.shiftStart);if(t<=r.shiftStart)t+=864e5;r.shiftEnd=t})});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>commit(r=>{r.shiftEnd=r.shiftStart+Number(c.dataset.len)*36e5})));
$('#bars').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='tStop')return endBreak(false);
  if(b.dataset.slot&&rec().active?.slot!==b.dataset.slot){commit(r=>{r.active={slot:b.dataset.slot,start:now()}});toast('Break started. Enjoy it, the timer is running.')}});
function endBreak(auto){const a=rec()?.active;if(!a)return;const key=a.slot;
  commit(r=>{const x=r.active;if(!x)return;r.breaks.push({slot:x.slot,start:x.start,end:auto?x.start+CONFIG.forgotToStopMinutes*6e4:now(),...(auto?{flag:'forgot'}:{})});r.active=null});
  document.title='breakpoint';showResult(key,auto)}
/* after a break: a short message that doesn't get in the way */
function showResult(key,auto){const p=P(now()),i=p.findIndex(s=>s.key===key),s=p[i],n=p[i+1];let body;
  if(auto)body=`Your break was left running for ${CONFIG.forgotToStopMinutes} minutes, so we closed it. Your manager will see it flagged.`;
  else if(s.over>0)body=`${s.label}: ${fmtMin(s.over)} over. `+(n?`That's come off ${n.label}, which is now ${tidy(n.allowed)} min. Sorry mate.`:'There was no later break to take it from, so your manager will see it.');
  else if(s.left>=10)body=`Welcome back. You still have ${fmtMin(s.left)} of ${s.label} for later.`;
  else body=`Welcome back. ${s.label} done, right on time.`;
  toast(body,7000)}

/* ---------- the break bars: one row per break (plus any OH break the manager adds). The running one grows and talks. ---------- */
function liveLine(s,n,at){const left=s.allowed*60-s.used,m=Math.floor(s.used/60);
  if(left<=0)return n?`${fmtMin(-left)} over. That's coming off ${n.label}. Leg it!`:`${fmtMin(-left)} over. There's no break after this to take it from, so your manager will see it.`;
  if(left<=60)return 'Under a minute left. Put the biscuit down and head back.';
  if(left<=s.allowed*60/3)return `${m} min done, only ${Math.ceil(left/60)} left. Start heading back.`;
  if(s.used<60)return "Clock's running. Enjoy it, you've earned it.";
  return `${m} min done, ${Math.ceil(left/60)} min to go. Back at ${hhmm(at+left*1000)}.`}
function renderBars(at){const r=rec(),p=P(at),anyA=!!r.active;
  const tot=p.reduce((a,s)=>a+s.base,0),used=p.reduce((a,s)=>a+s.used,0);
  $('#brkSum').textContent=`${Math.round(used/60)} of ${tidy(tot)} min used today`;
  setHtml($('#bars'),p.map((s,i)=>{
    const cap=Math.max(s.allowed*60,1),fill=s.allowed>0?Math.min(100,s.used/cap*100):(s.used>0?100:0),over=s.over>0;
    const src=p.slice(0,i).reverse().find(x=>x.over>0),note=s.deducted>0&&src?`<small class="bad">${tidy(s.allowed)} min today because ${esc(src.label)} ran ${fmtMin(src.over)} over. Sorry mate.</small>`:s.adjust?`<small>${s.adjust>0?'+':''}${s.adjust} min from your manager</small>`:'';
    if(s.act){const left=s.allowed*60-s.used,sh=left>=0?Math.ceil(left):Math.floor(-left);
      return `<div class="brow on${over?' over':''}"><div class="bl"><b>${esc(s.label)}</b><span>${tidy(s.allowed)} min</span></div>
        <div class="btrack big" role="timer" aria-label="${esc(s.label)}: ${left>=0?mmss(sh)+' left':mmss(sh)+' over'}"><i style="width:${over?100:fill}%"></i><span class="bt">${left<0?'−':''}${mmss(sh)} <small>${left>=0?'left':'over'}</small></span><span class="bu">${mmss(s.used)} / ${mmss(s.allowed*60)}</span></div>
        <div class="br"><button class="btn teal" id="tStop">I'm back</button></div><p class="say">${esc(liveLine(s,p[i+1],at))}</p></div>`}
    const st=s.done?(over?`Done · +${fmtMin(s.over)} over`:'Done'):s.used>0?`${Math.ceil(s.left/60)} min left`:`${tidy(s.allowed)} min`;
    const btn=s.done||s.allowed<=0?`<button class="btn ghost sm" disabled>${s.allowed<=0?'No time left':'Done'}</button>`:`<button class="btn yellow sm" data-slot="${s.key}" ${anyA?'disabled':''}>${s.used>0?'Resume':'Start'}</button>`;
    return `<div class="brow${s.done?' done':''}${over?' over':''}"><div class="bl"><b>${esc(s.label)}</b><span>${st}</span></div>
      <div class="btrack" role="meter" aria-label="${esc(s.label)}: ${Math.round(s.used/60)} of ${tidy(s.allowed)} minutes used" aria-valuemin="0" aria-valuemax="${tidy(s.allowed)}" aria-valuenow="${Math.min(tidy(s.allowed),Math.round(s.used/60))}"><i style="width:${fill}%"></i><span class="bu">${Math.floor(s.used/60)} / ${tidy(s.allowed)} min</span></div>
      <div class="br">${btn}</div>${note?`<p class="say">${note}</p>`:''}</div>`}).join(''))}

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
  $('#startHint').textContent=r.shiftEnd?'':`Started ${hhmm(r.shiftStart)}. Add your end time or pick a shift length.`;tick()}

function tick(){const at=now();if(dayKey(new Date(at))!==TODAY){TODAY=dayKey(new Date(at));ensureRec();renderAll();return}
  const r=rec();if(!r)return;if(r.active&&at-r.active.start>CONFIG.forgotToStopMinutes*6e4){endBreak(true);return}
  renderBars(at);renderShift(at);
  const p=P(at),end=r.shiftEnd,pct=end?(at-r.shiftStart)/(end-r.shiftStart)*100:null;
  const used=p.reduce((a,s)=>a+s.used,0),allowed=p.reduce((a,s)=>a+s.base,0);
  $('#sTaken').innerHTML=`${p.filter(s=>s.done).length} <small>of ${p.length}</small>`;$('#sUsed').innerHTML=`${Math.round(used/60)} <small>of ${tidy(allowed)} min</small>`;$('#sUsed').classList.toggle('bad',p.some(s=>s.over));
  if(end){const left=Math.max(0,(end-at)/1000),unused=p.reduce((a,s)=>a+(s.done?0:s.left),0);$('#sLeft').textContent=durHM(left);$('#sWork').textContent=durHM(Math.max(0,left-unused))}else{$('#sLeft').textContent='–';$('#sWork').textContent='–'}
  const j=jokeFor(at,r,pct);if($('#joke').textContent!==j.text){$('#joke').textContent=j.text;$('#pepK').textContent=j.kicker;const bb=$('#bubble');bb.classList.remove('pop');void bb.offsetWidth;bb.classList.add('pop')}
  
  if(r.active){const s=p.find(x=>x.act),left=s.allowed*60-s.used,sh=left>=0?Math.ceil(left):Math.floor(-left);document.title=`${left<0?'−':''}${mmss(sh)} · ${s.label}`}}

/* ---------- Breakathon ---------- */
let week=0,raceT=null,mine=null,picking=false;
async function loadMine(){try{mine=await myRewards(code)}catch{mine=null}$('#custAv').innerHTML=avatar(code,{look:mine});tick();drawLook()}
/* the little "Customise your mascot" button on My day: jumps to the mascot panel on the Breakathon tab */
let showTab=null;
$('#custBtn').addEventListener('click',()=>{history.replaceState(null,'','#race');showTab?.('race');setTimeout(()=>$('#look').scrollIntoView({behavior:'smooth',block:'start'}),350)});
function drawLook(){if(tab!=='race')return;setHtml($('#prize'),prizeHTML(mine,picking));setHtml($('#look'),lookPanelHTML(code,mine,picking))}
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
    setHtml($('#race'),raceHTML({rows,me:code,isManager:false,champion,prize:champion?.code===code&&mine?{choice:mine.claimed,item:mine.claimed_item}:null}));placeRacers($('#race'));drawLook()}
  catch(err){$('#race').innerHTML=`<p class="empty">${esc(err.message)}</p>`}}
$('#weekSel').addEventListener('click',e=>{const b=e.target.closest('button[data-week]');if(!b)return;week=Number(b.dataset.week);document.querySelectorAll('#weekSel button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawRace()});

let t1,t2,clock,tabsReady=false;
function boot(){if(!code||!USERS[code])return showGate();$('#gate').classList.add('hidden');$('#app').classList.remove('hidden');ensureRec();renderAll();loadMine();
  clearInterval(clock);clock=startClock();if(!tabsReady){tabsReady=true;showTab=setupTabs(t=>{tab=t;clearInterval(raceT);if(t==='race'){drawRace();raceT=setInterval(drawRace,60000)}})}
  clearInterval(t1);clearInterval(t2);t1=setInterval(tick,1000);t2=setInterval(async()=>{if(API){try{if(await refresh()){db=load();renderAll()}setLive(true)}catch{setLive(false)}return}const s=localStorage.getItem(STORAGE_KEY);if(s!==JSON.stringify(db)){db=load();renderAll()}},CONFIG.refreshSeconds*1000)}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&code){db=load();renderAll()}});
setupPassword();setupTheme();wireRacers($('#race'));
(async()=>{if(API)$('#pw').classList.remove('hidden');try{await init();if(API){const m=me();code=m&&m.role==='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
