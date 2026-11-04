import { CONFIG } from '../config.js?v=6b9fa1564c';
import { PILOT_USERS, MANAGER_CODES, SESSION_USER } from '../pilot.js?v=6b9fa1564c';
import { myRewards, claimReward, setLook } from '../core.js?v=6b9fa1564c';
import { load, save, purge, dayKey, hhmm, hm24, mmss, atTime, slotsFor, plan, streakOf, workDayOf, STORAGE_KEY, init, refresh, me, signIn, signOut, now, breakathon, weekOf } from '../core.js?v=6b9fa1564c';
import { offerAlerts, checkAlerts, setupAlertSwitch } from '../notify.js?v=6b9fa1564c';
import { halfGauge, dayDetail, mins } from '../dayview.js?v=6b9fa1564c';
import { openWheel } from '../wheel.js?v=6b9fa1564c';
import { setupIdeas } from '../ideas.js?v=6b9fa1564c';
import { setupUi, syncUi, isPro } from '../ui.js?v=6b9fa1564c';
import { jokeFor, proNote } from '../jokes.js?v=6b9fa1564c';
import { esc, setHtml } from '../dom.js?v=6b9fa1564c';
import { startClock, setLive, setupTabs, setupPassword, setupTheme, setupApp, setupMenu } from '../chrome.js?v=6b9fa1564c';
import { raceHTML, wireRacers, prizeHTML, lookPanelHTML, itemName } from '../race.js?v=6b9fa1564c';
import { toast } from '../chrome.js?v=6b9fa1564c';

const $=s=>document.querySelector(s),SESSION=SESSION_USER,USERS=PILOT_USERS,API=CONFIG.backend==='api';
let TODAY=dayKey(new Date(now())),code=API?null:localStorage.getItem(SESSION),db=load(),tab='day';
const rec=()=>db.days[TODAY]?.[code],P=at=>plan(rec(),db.adj[TODAY]?.[code],at,slotsFor(db,code,TODAY));

/* ---------- sign in / out ---------- */
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(API){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role!=='agent'){await signOut();$('#gateErr').textContent="That's a manager code. Team leads sign in on the manager page (link below).";return}code=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!USERS[c]){$('#gateErr').textContent=MANAGER_CODES[c]?"That's a manager code. Team leads sign in on the manager page (link below).":"That code isn't on the pilot list. Check it with your team lead.";return}code=c;localStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{$('#meOv').classList.add('hidden');ideas.show(false);localStorage.removeItem(SESSION);code=null;document.title='breakpoint';await signOut();showGate()});

/* ---------- changes ---------- */
function ensureRec(){db=load();purge(db);const d=(db.days[TODAY]??={});if(!d[code])d[code]={name:USERS[code],shiftStart:Math.floor(now()/60000)*60000,shiftEnd:null,breaks:[],active:null};save(db)}
function commit(fn){db=load();const r=db.days[TODAY]?.[code];if(r)fn(r);save(db);renderAll()}
$('#startIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{r.shiftStart=atTime(e.target.value,now());if(r.shiftEnd&&r.shiftEnd<=r.shiftStart)r.shiftEnd+=864e5})});
$('#endIn').addEventListener('change',e=>{if(!e.target.value)return;commit(r=>{let t=atTime(e.target.value,r.shiftStart);if(t<=r.shiftStart)t+=864e5;r.shiftEnd=t})});
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
/* ---------- My day: the break card ----------
   The day's breaks are one pot (plan() in src/core.js). The half circle (src/dayview.js) shows each break's part of the pot,
   one number in the middle, one button under it that moves on to the next break by itself, and one line of plain words.
   The working ("How today adds up") is behind the arrow next to the heading. */
const ini=n=>{const w=String(n||'').trim().split(/\s+/);if(w.length<2)return (w[0]||'·').slice(0,2).toUpperCase();const l=w.at(-1);return (w[0][0]+(/^\d+$/.test(l)?l:l[0])).toUpperCase()};
function renderBars(at){const p=P(at),run=p.find(s=>s.act);
  const total=p.reduce((a,s)=>a+Math.max(0,s.base),0)*60,used=p.reduce((a,s)=>a+s.used,0),left=Math.max(0,total-used),over=Math.max(0,used-total),
    isOver=over>=CONFIG.overToleranceMinutes*60;
  $('#brkSum').textContent=`${mins(used)} of ${mins(total)} min used`;
  const big=run?mmss((at-run.act.start)/1000):isOver?`+${mins(over)}`:String(mins(left)),
    small=run?`on ${run.label}`:isOver?'min over today':'min left today';
  let act,under='';
  if(run){act=`<button class="btn end big" id="tStop">End ${esc(run.label)}</button>`;
    under=isOver?`<span class="bad"><b>${mins(over)} min</b> over today. Head back when you can.</span>`
      :run.left>0?`<b>${mins(run.left)} min</b> left in ${esc(run.label)} · back by ${hhmm(at+run.left*1000)}`
      :`Using time from your other breaks · <b>${mins(left)} min</b> left today`}
  else{const open=p.filter(s=>s.left>0&&s.allowed>0&&!s.done),nx=open[0];
    if(nx){act=`<button class="btn yellow big" data-next="${nx.key}">${nx.used>0?'Resume':'Start'} ${esc(nx.label)}</button>`;
      under=`<b>${mins(nx.left)} min</b> left in ${esc(nx.label)}`+(open.length>1?`<div class="alt">${open.slice(1).map(s=>`<button class="chipb" data-slot="${s.key}">${s.used>0?'Resume':'Start'} ${esc(s.label)} instead</button>`).join('')}</div>`:'')}
    else act=`<p class="say">${isOver?`All your breaks are taken. You're <b>${mins(over)} min</b> over today.`:`All your breaks are taken${left>0?`. <b>${mins(left)} min</b> left today if you need it.`:'.'}`}</p>`}
  setHtml($('#bars'),`<div class="gwrap${run?' on':''}" role="timer" aria-live="off">${halfGauge(p,rec(),at,{big,small,red:isOver})}</div>${act}${under?`<div class="under">${under}</div>`:''}`);
  if(!$('#dayOv').classList.contains('hidden')&&at-dayAt>30000)drawDay(at,false)}

/* "How today adds up": the pop-up behind the arrow. It draws itself once when opened; while open it refreshes quietly. */
let dayAt=0;
function drawDay(at,animate){dayAt=at;const b=$('#dayBody');b.classList.toggle('still',!animate);setHtml(b,dayDetail(P(at),rec(),at))}
$('#dayBtn').addEventListener('click',()=>{$('#dayOv').classList.remove('hidden');drawDay(now(),true);$('#dayClose').focus()});
const closeDay=()=>$('#dayOv').classList.add('hidden');
$('#dayClose').addEventListener('click',closeDay);$('#dayOv').addEventListener('click',e=>{if(e.target.id==='dayOv')closeDay()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDay();$('#meOv').classList.add('hidden')}});

/* ---------- the shift card: start and end chips with a simple bar between them ---------- */
const hm=ms=>{const m=Math.max(0,Math.round(ms/6e4)),h=Math.floor(m/60);return h?`${h}h${m%60?` ${m%60}m`:''}`:`${m}m`};
const chip=ms=>{const t=hhmm(ms),m=t.match(/^(.*) (am|pm)$/);return m?`${m[1]}<small>${m[2]}</small>`:t};
function renderShift(at){const r=rec(),start=r.shiftStart,end=r.shiftEnd;
  setHtml($('#startChip'),chip(start));setHtml($('#endChip'),end?chip(end):'<span class="add">Add</span>');
  $('#startChip').setAttribute('aria-label',`Shift start, ${hhmm(start)}. Tap to change`);$('#endChip').setAttribute('aria-label',end?`Shift end, ${hhmm(end)}. Tap to change`:'Add your shift end time');
  const W=200,X=t=>3+Math.max(0,Math.min(1,(t-start)/((end||start+1)-start)))*(W-6);
  let g=`<rect x="3" y="8" width="${W-6}" height="14" rx="7" class="s-track"/>`;
  if(end){if(at>start)g+=`<rect x="3" y="8" width="${Math.max(0,X(at)-3)}" height="14" rx="7" class="s-done"/>`;
    for(const b of [...(r.breaks||[]),...(r.active?[{start:r.active.start,end:at}]:[])])g+=`<rect x="${X(b.start)}" y="5" width="${Math.max(3,X(b.end)-X(b.start))}" height="20" rx="3" class="s-brk"/>`;
    if(at>start&&at<end)g+=`<rect x="${X(at)-1.25}" y="1" width="2.5" height="28" rx="1.25" class="s-now"/>`}
  setHtml($('#shiftLine'),`<svg viewBox="0 0 ${W} 30" preserveAspectRatio="none">${g}</svg>`);
  setHtml($('#shiftNote'),!end?'<span>Tap <b>Add</b> to set your shift end time</span>'
    :at<start?`<span>Your shift starts at <b>${hhmm(start)}</b></span>`
    :at>=end?`<span><b>${hm(end-start)}</b> worked</span><span>Shift complete</span>`
    :`<span><b>${hm(at-start)}</b> worked</span><span>${hm(end-at)} to go</span>`)}
const setVal=(id,v)=>{const el=$(id);el.value=v;el.dispatchEvent(new Event('change'))};
$('#startChip').addEventListener('click',()=>{const r=rec();if(!r)return;openWheel({title:'Shift start',value:hm24(r.shiftStart),
  note:v=>r.shiftEnd?`${hm(((r.shiftEnd-atTime(v,r.shiftStart))%864e5+864e5)%864e5)} shift, to ${hhmm(r.shiftEnd)}`:'',onSet:v=>setVal('#startIn',v)})});
$('#endChip').addEventListener('click',()=>{const r=rec();if(!r)return;const len=v=>{let t=atTime(v,r.shiftStart);if(t<=r.shiftStart)t+=864e5;return t-r.shiftStart};
  openWheel({title:'Shift end',value:hm24(r.shiftEnd||r.shiftStart+8.5*36e5),quick:[8,8.5,9].map(h=>({label:`${String(h).replace('.5','½')}h shift`,value:hm24(r.shiftStart+h*36e5)})),
    note:v=>`${hm(len(v))} shift, from ${hhmm(r.shiftStart)}`,onSet:v=>setVal('#endIn',v)})});

function renderAll(){const r=rec();if(!r)return;$('#who').textContent=r.name;$('#meIni').textContent=$('#meIni2').textContent=ini(r.name);
  $('#startIn').value=hm24(r.shiftStart);$('#endIn').value=r.shiftEnd?hm24(r.shiftEnd):'';
  const k=streakOf(db,code,TODAY);$('#meSub').textContent=k>=2?`${code} · ${k} on-time days in a row`:code;
  if(!$('#dayOv').classList.contains('hidden'))drawDay(now(),false);tick()}

function tick(){const at=now(),wd=workDayOf(db,code,at);if(wd!==TODAY){TODAY=wd;ensureRec();renderAll();return}   // a new working day (not just midnight)
  const r=rec();if(!r)return;if(r.active&&at-r.active.start>CONFIG.forgotToStopMinutes*6e4){endBreak(true);return}
  renderBars(at);renderShift(at);checkAlerts(P(at).find(x=>x.act),isPro());
  const p=P(at),end=r.shiftEnd,pct=end?(at-r.shiftStart)/(end-r.shiftStart)*100:null;
  const j=isPro()?proNote(at,r,pct,p[0]?.spare||0):jokeFor(at,r,pct);if($('#joke').textContent!==j.text){$('#joke').textContent=j.text;$('#pepK').textContent=j.kicker;const bb=$('#bubble');bb.classList.remove('pop');void bb.offsetWidth;bb.classList.add('pop')}
  if(r.active){const s=p.find(x=>x.act);document.title=s.over>0?`−${mmss(Math.ceil(s.over))} · ${s.label}`:`${mmss(Math.ceil(s.left>0?s.left:s.spare))} · ${s.label}`}}

/* ---------- Breakathon ---------- */
let week=0,raceT=null,mine=null,picking=false;
async function loadMine(){try{mine=await myRewards(code)}catch{mine=null}tick();drawLook()}
let showTab=null;
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
setupPassword();setupTheme();setupApp();setupAlertSwitch();setupMenu(()=>{if(code&&rec())renderAll()});wireRacers($('#race'));
setupUi(()=>{if(code&&rec())renderAll();drawRace();drawLook()});
(async()=>{if(API)$('#pw').classList.remove('hidden');try{await init();if(API){const m=me();code=m&&m.role==='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
