import { CONFIG } from '../config.js';
import { MANAGER_CODES, PILOT_USERS, SESSION_MGR } from '../pilot.js';
import { teamLooks, teamRewards } from '../core.js';
import { load, save, purge, dayKey, hhmm, mmss, tidy, atTime, slotsFor, labelFor, cleanName, plan, STORAGE_KEY, init, refresh, me, signIn, signOut, history, now, statusOf, FILTERS, teamPulse, breakathon, weekOf } from '../core.js';
import { esc, setHtml } from '../dom.js';
import { startClock, setLive, setupTabs, setupPassword, setupTheme, toast } from '../chrome.js';
import { raceHTML, avatar, placeRacers, wireRacers } from '../race.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],U=PILOT_USERS,SESSION=SESSION_MGR,DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let TODAY=dayKey(new Date(now())),db=load(),mgr=CONFIG.backend==='api'?null:sessionStorage.getItem(SESSION),lastSig='',det=null;
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').value='';$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(CONFIG.backend==='api'){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role==='agent'){await signOut();$('#gateErr').textContent="That's a staff code. Staff sign in on the main page (link below).";return}mgr=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!MANAGER_CODES[c]){$('#gateErr').textContent=PILOT_USERS[c]?"That's a staff code. Staff sign in on the main page (link below).":"That code isn't recognised. Check it and try again.";return}mgr=c;sessionStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{sessionStorage.removeItem(SESSION);mgr=null;await signOut();showGate()});
const adjUI=(c,s,dt,name)=>{const l=CONFIG.adjustmentLimits,d=dt===TODAY?'':` data-date="${dt}"`,lb=esc(s.label),nm=esc(name);return `<div class="adj"><button data-u="${c}" data-s="${s.key}" data-d="-5"${d} aria-label="Take 5 minutes off ${lb} for ${nm}" ${s.adjust<=l.min?'disabled':''}>−</button><output class="${s.adjust?'on':''}">${s.adjust>0?'+':''}${s.adjust} min</output><button data-u="${c}" data-s="${s.key}" data-d="5"${d} aria-label="Add 5 minutes to ${lb} for ${nm}" ${s.adjust>=l.max?'disabled':''}>+</button></div>`};
document.addEventListener('click',e=>{const b=e.target.closest('button[data-u]');if(!b)return;db=load();const dt=b.dataset.date||TODAY,u=((db.adj[dt]??={})[b.dataset.u]??={}),l=CONFIG.adjustmentLimits;
  const v=Math.max(l.min,Math.min(l.max,(u[b.dataset.s]||0)+Number(b.dataset.d)));if(v)u[b.dataset.s]=v;else delete u[b.dataset.s];save(db);render(true);if(det)draw()});
$('#demo').addEventListener('click',()=>{db=load();const at=now();let i=0;
  for(const [c,name] of Object.entries(U)){const d=(db.days[TODAY]??={});
    if(!d[c]&&i%5!==4){const st=Math.floor((at-(3+i*.4)*36e5)/6e4)*6e4,r={name,shiftStart:st,shiftEnd:st+9*36e5,breaks:[],active:null},b1=st+90*6e4;
      if(i%5===0)r.breaks.push({slot:'break1',start:b1,end:b1+14*6e4});if(i%5===1)r.breaks.push({slot:'break1',start:b1,end:b1+17*6e4});
      if(i%5===3){r.breaks.push({slot:'break1',start:b1,end:b1+15*6e4});r.active={slot:'break2',start:at-(i===3?19:5)*6e4}}d[c]=r}
    for(let k=1;k<=6;k++){const t=new Date();t.setDate(t.getDate()-k);const dk=dayKey(t);if(db.days[dk]?.[c])continue;t.setHours(9,0,0,0);const s=t.getTime(),o=(x)=>((i+k)%(i+3)===0?x:0);
      (db.days[dk]??={})[c]={name,shiftStart:s,shiftEnd:s+9*36e5,active:null,breaks:[{slot:'break1',start:s+90*6e4,end:s+(105+o(3))*6e4},{slot:'lunch',start:s+240*6e4,end:s+(270+o(4))*6e4},{slot:'break2',start:s+420*6e4,end:s+(435+(i===4?2:0))*6e4}]}}
    i++}save(db);render(true)});
$('#clear').addEventListener('click',()=>{if(!confirm("Clear today's data for everyone? This can't be undone."))return;db=load();delete db.days[TODAY];delete db.adj[TODAY];save(db);render(true)});
/* ---------- details dialog ---------- */
document.addEventListener('click',e=>{const b=e.target.closest('button[data-det]');if(b){det={c:b.dataset.det,date:TODAY};db=load();draw();$('#dOv').classList.remove('hidden')}});
$('#dClose').addEventListener('click',()=>{det=null;$('#dOv').classList.add('hidden')});
function draw(){const {c,date}=det,r=db.days[date]?.[c],p=plan(r,db.adj[date]?.[c],now(),slotsFor(db,c,date)),L=k=>esc(labelFor(db,c,k)),N=esc(U[c]);
  const dates=[...new Set([TODAY,...Object.keys(db.days).filter(d=>db.days[d][c])])].sort().reverse(),cust=db.custom[c]||[];
  const named=[...CONFIG.defaultSlots.map(s=>[s.key,s.label]),...cust.map(x=>[x.key,CONFIG.customLabels[x.key]])];
  $('#dTitle').textContent=`${U[c]} · ${c}`;
  $('#dBody').innerHTML=`<div class="field"><label for="dDate">Day</label><select id="dDate">${dates.map(d=>`<option ${d===date?'selected':''}>${d}</option>`).join('')}</select></div>
  <h3>Shift</h3>${r?`<div class="row"><div class="field"><label for="dSs">Start</label><input type="time" id="dSs" value="${hhmm(r.shiftStart)}"></div><div class="field"><label for="dSe">End</label><input type="time" id="dSe" value="${r.shiftEnd?hhmm(r.shiftEnd):''}"></div></div>${r.shiftEnd?'':'<p class="hint">No end time set yet.</p>'}`:'<p class="hint">Not started on this day.</p>'}
  <h3>Break history</h3>${r&&(r.breaks.length||r.active)?`<div class="scroll"><table><thead><tr><th>Break</th><th>Started</th><th>Ended</th><th>Length</th><th></th></tr></thead><tbody>${r.breaks.map((b,i)=>`<tr><td>${L(b.slot)}</td><td><input type="time" data-i="${i}" data-f="start" value="${hhmm(b.start)}" aria-label="Start of ${L(b.slot)}"></td><td><input type="time" data-i="${i}" data-f="end" value="${hhmm(b.end)}" aria-label="End of ${L(b.slot)}"></td><td>${tidy((b.end-b.start)/6e4)} min${b.flag?' · auto-closed':''}</td><td><button class="btn ghost sm" data-rm="${i}">Remove</button></td></tr>`).join('')}${r.active?`<tr><td>${L(r.active.slot)}</td><td>${hhmm(r.active.start)}</td><td colspan="3">In progress</td></tr>`:''}</tbody></table></div>`:'<p class="hint">No breaks recorded for this day.</p>'}
  <h3>Allowances for this day</h3><div class="scroll"><table><tbody>${p.map(s=>`<tr><td><b>${esc(s.label)}</b></td><td>${tidy(s.used/60)} / ${tidy(s.allowed)} min${s.over?` <span class="bad">(+${tidy(s.over/60)} over)</span>`:''}</td><td>${adjUI(c,s,date,U[c])}</td></tr>`).join('')}</tbody></table></div>
  ${r?`<h3>Log a missed break</h3><div class="row"><div class="field"><label for="lSlot">Break</label><select id="lSlot">${p.map(s=>`<option value="${s.key}">${esc(s.label)}</option>`).join('')}</select></div><div class="field"><label for="lS">Start</label><input type="time" id="lS"></div><div class="field"><label for="lE">End</label><input type="time" id="lE"></div><button class="btn teal sm" id="lAdd">Add</button></div>`:''}
  <h3>Custom breaks for ${N}</h3>${cust.length?cust.map(x=>`<p style="margin:4px 0"><b>${L(x.key)}</b> · ${x.minutes} min · ${x.scope==='daily'?'every day':x.scope==='today'?'only '+x.date:x.days.map(d=>DN[d]).join(', ')} <button class="btn ghost sm" data-cdel="${x.key}">Remove</button></p>`).join(''):'<p class="hint">None yet.</p>'}
  <div class="row" style="margin-top:10px"><div class="field"><label for="cKey">Break</label><select id="cKey">${Object.entries(CONFIG.customLabels).map(([k,v])=>`<option value="${k}">${esc(db.names?.[c]?.[k]?`${db.names[c][k]} (${v})`:v)}</option>`).join('')}</select></div><div class="field"><label for="cMin">Minutes</label><input type="number" id="cMin" value="15" min="1" max="120" style="width:80px"></div><button class="btn teal sm" id="cAdd">Add custom break</button></div>
  <div class="opt" style="margin-top:10px"><label><input type="radio" name="sc" value="today" checked> Only ${date}</label><label><input type="radio" name="sc" value="days"> Selected days</label><label><input type="radio" name="sc" value="daily"> Every day</label></div>
  <div class="opt">${DN.map((n,i)=>`<label><input type="checkbox" class="dchk" value="${i}"> ${n}</label>`).join('')}</div>
  <h3>Break names for ${N}</h3><p class="hint" style="margin:0 0 8px">${N} sees these names too. Leave a box empty for the standard name. A name, not a reason: up to ${CONFIG.breakNameMaxLength} characters.</p>
  <div class="scroll"><table><tbody>${named.map(([k,def])=>`<tr><td>${esc(def)}</td><td><input type="text" data-name="${k}" maxlength="${CONFIG.breakNameMaxLength}" value="${esc(db.names?.[c]?.[k]||'')}" placeholder="${esc(def)}" aria-label="Name for ${esc(def)}"></td></tr>`).join('')}</tbody></table></div>
  <h3>Change history</h3><div id="dHist"><p class="hint">${CONFIG.backend==='api'?'Loading…':'The change history is kept by the database, so it is not available in demo mode.'}</p></div>`;
  loadHist()}
/* ---------- change history (audit trail, newest first) ---------- */
let histTimer=null;
function loadHist(){if(CONFIG.backend!=='api')return;clearTimeout(histTimer);const want=det&&`${det.c}|${det.date}`;
  histTimer=setTimeout(async()=>{let rows;try{rows=await history(det.c,det.date)}catch(err){if($('#dHist'))$('#dHist').innerHTML=`<p class="hint">${esc(err.message)}</p>`;return}
    if(!det||`${det.c}|${det.date}`!==want||!$('#dHist'))return;
    $('#dHist').innerHTML=rows.length?`<div class="scroll"><table class="audit"><tbody>${rows.map(h=>`<tr><td>${esc(h.at.slice(0,10))} ${hhmm(Date.parse(h.at))}</td><td>${esc(h.actor)}</td><td>${describe(h)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">No manager changes for this person on this day.</p>'},800)}
const tm=v=>v?hhmm(Date.parse(v)):'none',span=v=>v?v.split('/').map(tm).join('–'):'none';
function describe(h){const {c}=det,sl=h.slot_key?esc(labelFor(db,c,h.slot_key)):'',b=h.before_value,a=h.after_value;
  switch(h.action){
    case 'adjust_allowance':return `${sl}: allowance ${b??0} → ${a??0} min`;
    case 'edit_shift_start':return `Shift start ${tm(b)} → ${tm(a)}`;
    case 'edit_shift_end':return `Shift end ${tm(b)} → ${tm(a)}`;
    case 'add_shift':return `Started a shift ${span(a)}`;
    case 'remove_shift':return `Removed the shift ${span(b)}`;
    case 'add_break':return `Added ${sl} ${span(a)}`;
    case 'remove_break':return `Removed ${sl} ${span(b)}`;
    case 'edit_break':{const [was,t]=b.includes(' ')?b.split(' '):[null,b];return `Changed ${was?esc(labelFor(db,c,was))+' → ':''}${sl} ${span(t)} → ${span(a)}`}
    case 'add_custom_break':return `Added ${sl}: ${esc(a)}`;
    case 'remove_custom_break':return `Removed ${sl} (was ${esc(b)})`;
    case 'edit_custom_break':return `Changed ${sl}: ${esc(b)} → ${esc(a)}`;
    case 'rename_break':{const def=esc(CONFIG.defaultSlots.find(s=>s.key===h.slot_key)?.label||CONFIG.customLabels[h.slot_key]);return `Renamed ${def}: “${b?esc(b):def}” → “${a?esc(a):def}”`}
    default:return esc(h.action)}}
$('#dBody').addEventListener('change',e=>{const t=e.target;if(t.id==='dDate'){det.date=t.value;return draw()}
  if(t.dataset.name){db=load();const n=cleanName(t.value),m=(db.names??={})[det.c]??={};if(n&&n!==CONFIG.defaultSlots.find(s=>s.key===t.dataset.name)?.label&&n!==CONFIG.customLabels[t.dataset.name])m[t.dataset.name]=n;else delete m[t.dataset.name];
    if(!Object.keys(m).length)delete db.names[det.c];save(db);render(true);return draw()}
  if((t.id==='dSs'||t.id==='dSe')&&t.value){db=load();const r=db.days[det.date]?.[det.c];if(!r)return;
    if(t.id==='dSs'){r.shiftStart=atTime(t.value,r.shiftStart);if(r.shiftEnd&&r.shiftEnd<=r.shiftStart)r.shiftEnd+=864e5}
    else{let v=atTime(t.value,r.shiftStart);if(v<=r.shiftStart)v+=864e5;r.shiftEnd=v}
    save(db);render(true);return draw()}
  if(t.dataset.i===undefined||!t.value)return;db=load();const b=db.days[det.date][det.c].breaks[t.dataset.i],v=atTime(t.value,b.start);
  if(t.dataset.f==='start'?v<b.end:v>b.start){b[t.dataset.f]=v;save(db)}render(true);draw()});
$('#dBody').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;db=load();const {c,date}=det,r=db.days[date]?.[c];
  if(t.dataset.rm!==undefined)r.breaks.splice(Number(t.dataset.rm),1);
  else if(t.dataset.cdel)db.custom[c]=(db.custom[c]||[]).filter(x=>x.key!==t.dataset.cdel);
  else if(t.id==='lAdd'){const s=$('#lS').value,en=$('#lE').value;if(!s||!en)return;const a=atTime(s,r.shiftStart),b=atTime(en,r.shiftStart);if(b<=a)return;r.breaks.push({slot:$('#lSlot').value,start:a,end:b})}
  else if(t.id==='cAdd'){const sc=document.querySelector('input[name=sc]:checked').value,days=$$('.dchk:checked').map(x=>Number(x.value));if(sc==='days'&&!days.length)return alert('Pick at least one day.');
    const key=$('#cKey').value;db.custom[c]=[...(db.custom[c]||[]).filter(x=>x.key!==key),{key,minutes:Math.max(1,Number($('#cMin').value)||15),scope:sc,date,days}]}
  else return;save(db);render(true);draw()});
/* ---------- dashboard (view only): filters, team pulse, one card per person ---------- */
let filter='all',tab='dash',lastDash='',LOOKS={};
async function loadLooks(){try{const l=await teamLooks();if(JSON.stringify(l)!==JSON.stringify(LOOKS)){LOOKS=l;renderDash(now(),true)}}catch{}}
const teamNow=at=>Object.entries(U).map(([c,name])=>{const r=db.days[TODAY]?.[c],p=plan(r,db.adj[TODAY]?.[c],at,slotsFor(db,c,TODAY));return {c,name,rec:r,p,st:statusOf(r,p,at)}});
function renderDash(at,force){if(tab!=='dash'&&!force)return;const sig=JSON.stringify(db)+filter+Math.floor(at/1e4);if(!force&&sig===lastDash)return;lastDash=sig;
  const team=teamNow(at),f=FILTERS.find(x=>x.key===filter),list=team.filter(t=>f.test(t.st,t.p));
  setHtml($('#filters'),FILTERS.map(x=>{const n=team.filter(t=>x.test(t.st,t.p)).length;return `<button class="fbtn${x.key==='over'&&n?' bad':''}" data-f="${x.key}" aria-pressed="${filter===x.key}"><span>${x.label}</span><b>${n}</b></button>`}).join(''));
  const pulse=teamPulse(team.map(t=>({name:t.name,rec:t.rec,p:t.p})),at);
  setHtml($('#pulse'),pulse.map(m=>`<li class="${m.tone}">${esc(m.text)}</li>`).join(''));
  // the mascot peeking over the summary reacts to the team: worried if someone's over, sparkly if everyone's had their breaks
  const mood=pulse.some(m=>m.tone==='bad')?'worried':pulse.some(m=>m.tone==='good')&&!pulse.some(m=>m.tone==='warn')?'wow':team.some(t=>t.st.onBreak)?'happy':'happy';
  if($('#peek').dataset.mood!==mood){$('#peek').dataset.mood=mood;$('#peek').innerHTML=avatar('pip',{mood,look:{colour:'teal'}})}
  CONFIG.defaultSlots.forEach((x,i)=>$('#t'+i).textContent=`${x.label} (${x.minutes})`);
  $('#cardsH').textContent=`${f.label} (${list.length})`;
  setHtml($('#cards'),list.length?list.map(t=>card(t,at)).join(''):`<tr><td colspan="7" class="empty"><span class="av" style="width:44px;height:44px;display:inline-block;vertical-align:middle;margin-right:8px">${avatar('pip',{mood:'sleepy',look:{colour:'teal'}})}</span>Nobody here right now.</td></tr>`)}
function card({c,name,rec:r,p,st},at){
  const shift=r?(r.shiftEnd?`${hhmm(r.shiftStart)}–${hhmm(r.shiftEnd)}`:`from ${hhmm(r.shiftStart)}`):'–',pct=r&&r.shiftEnd?Math.max(0,Math.min(100,(at-r.shiftStart)/(r.shiftEnd-r.shiftStart)*100)):0;
  const status=st.onBreak?`<span class="st ${st.key}" data-live data-left="${st.slot.allowed*60-st.slot.used}" data-label="${esc(st.slot.label)}">${esc(liveText(st.slot.label,st.slot.allowed*60-st.slot.used))}</span>`:`<span class="st ${st.key}">${esc(st.label)}</span>`;
  const brk=s=>s?`<td class="b${s.over||s.overBase?' over':s.act?' act':''}"><div class="tr"><i style="width:${s.allowed?Math.min(100,s.used/(s.allowed*60)*100):s.used?100:0}%"></i></div><span>${Math.round(s.used/60)} / ${tidy(s.allowed)} min</span></td>`:'<td>–</td>';
  const extra=p.slice(3),ex=extra.length?`${extra.filter(s=>s.used>0).length}/${extra.length} used`:'–';
  return `<tr class="${st.key}"><td><div class="person"><span class="av">${avatar(c,{look:LOOKS[c],mood:st.key==='over'?'worried':st.onBreak?'sleepy':'happy'})}</span><span><b>${esc(name)}</b><small>${c}</small></span></div></td><td>${status}</td><td>${shift}${r&&r.shiftEnd?`<div class="mini" title="${Math.floor(pct)}% of the shift done"><i style="width:${pct}%"></i></div>`:''}</td>${r?[0,1,2].map(i=>brk(p[i])).join(''):'<td>–</td><td>–</td><td>–</td>'}<td>${ex}</td></tr>`}
$('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;filter=b.dataset.f;renderDash(now(),true)});

/* ---------- export: one row per person, day and break, for the pilot write-up ---------- */
const csvCell=v=>{let t=String(v??'');if(/^[=+\-@]/.test(t))t="'"+t;return /[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};
$('#csv').addEventListener('click',()=>{db=load();const out=[['date','code','name','break','sittings','minutes_used','allowance_minutes','minutes_over','auto_closed']];
  for(const day of Object.keys(db.days).sort())for(const [c,r] of Object.entries(db.days[day])){const p=plan({...r,active:null},db.adj[day]?.[c],now(),slotsFor(db,c,day));
    for(const s of p)if(s.segs.length)out.push([day,c,U[c]||r.name,s.label,s.segs.map(b=>`${hhmm(b.start)}-${hhmm(b.end)}`).join(' '),tidy(s.used/60),s.base,tidy(s.overBase/60),s.segs.some(b=>b.flag)?'yes':''])}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out.map(x=>x.map(csvCell).join(',')).join('\r\n')],{type:'text/csv'}));a.download=`breaks-${TODAY}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)});

/* ---------- Breakathon, and the weekly reward ---------- */
const REWARD='Breakathon reward';
let week=0,raceT=null,champ=null;
async function drawRace(){if(tab!=='race')return;try{
    const w=weekOf(TODAY,week),l=weekOf(TODAY,1),[rows,last]=await Promise.all([breakathon(w.from,w.to),breakathon(l.from,l.to)]);
    champ=last[0]?.points>0?last[0]:null;
    const prize=champ?(await teamRewards(l.from))[champ.code]||{}:null;
    const done=!!champ&&(db.custom[champ.code]||[]).some(x=>x.scope==='today'&&x.date===TODAY&&db.names?.[champ.code]?.[x.key]===REWARD);
    setHtml($('#race'),raceHTML({rows,me:null,isManager:true,champion:champ,grant:champ?{done}:null,prize}));placeRacers($('#race'))}
  catch(err){$('#race').innerHTML=`<p class="empty">${esc(err.message)}</p>`}}
$('#weekSel').addEventListener('click',e=>{const b=e.target.closest('button[data-week]');if(!b)return;week=Number(b.dataset.week);$$('#weekSel button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawRace()});
$('#race').addEventListener('click',e=>{if(e.target.id!=='grantBtn'||!champ)return;const c=champ.code;db=load();
  const taken=new Set((db.custom[c]||[]).map(x=>x.key)),key=Object.keys(CONFIG.customLabels).find(k=>!taken.has(k));
  if(!key)return alert(`${champ.name} already has all 5 OH breaks set up. Remove one on the Manage tab first.`);
  db.custom[c]=[...(db.custom[c]||[]),{key,minutes:CONFIG.breakathon.rewardMinutes,scope:'today',date:TODAY,days:[]}];((db.names??={})[c]??={})[key]=REWARD;
  save(db);render(true);toast(`${champ.name} has a ${CONFIG.breakathon.rewardMinutes} min reward break today 🏆`);drawRace()});

/* ---------- team table (Manage tab) ---------- */
function render(force){const at=now();if(dayKey(new Date(at))!==TODAY)TODAY=dayKey(new Date(at));renderDash(at,force);const sig=JSON.stringify(db)+Math.floor(at/6e4);if(!force&&sig===lastSig)return;lastSig=sig;
  const day=db.days[TODAY]||{},adj=db.adj[TODAY]||{};CONFIG.defaultSlots.forEach((s,i)=>$('#h'+i).textContent=`${s.label} (${s.minutes} min)`);
  $('#rows').innerHTML=Object.entries(U).map(([c,name])=>{const r=day[c],p=plan(r,adj[c],at,slotsFor(db,c,TODAY));let shift='<span style="color:var(--muted)">Not started</span>',pct=0,status='<span class="pill">Not started</span>';
    if(r){shift=r.shiftEnd?`${hhmm(r.shiftStart)} – ${hhmm(r.shiftEnd)}`:`${hhmm(r.shiftStart)} – <span style="color:var(--muted)">no end set</span>`;pct=r.shiftEnd?Math.max(0,Math.min(100,(at-r.shiftStart)/(r.shiftEnd-r.shiftStart)*100)):0;status=pct>=100?'<span class="pill">Finished</span>':'<span class="pill work">Working</span>';
      if(r.active){const s=p.find(x=>x.act);status=`<span class="pill brk" data-live data-left="${s.allowed*60-s.used}" data-label="${esc(s.label)}"></span>`}}
    const cells=p.slice(0,3).map(s=>{const nm=s.label!==s.defaultLabel?`<span class="of">${esc(s.label)} · </span>`:'',main=s.act?`<span class="u" data-cell data-start="${s.act.start}" data-prior="${s.used-(at-s.act.start)/1000}"></span> <span class="of">/ ${tidy(s.allowed)} min</span>`:s.used>0?`<span class="u${s.over?' bad':''}">${tidy(s.used/60)}</span> <span class="of">/ ${tidy(s.allowed)} min${s.segs.some(b=>b.flag)?' · auto-closed':''}</span>`:`<span class="of">Not taken · ${tidy(s.allowed)} min</span>`;return `<td class="cell">${nm}${main}${adjUI(c,s,TODAY,name)}</td>`}).join('');
    return `<tr><td class="person"><b>${esc(name)}</b><span>${c}${p.length>3?` · +${p.length-3} custom`:''}</span></td><td>${shift}</td><td><div class="mini"><i style="width:${pct}%"></i></div>${r&&r.shiftEnd?Math.floor(pct)+'%':'–'}</td><td>${status}</td>${cells}<td><button class="btn ghost sm" data-det="${c}">View more</button></td></tr>`}).join('');
  liveTick()}
const liveText=(label,left)=>`${label} · ${left>=0?mmss(Math.ceil(left))+' left':'−'+mmss(Math.floor(-left))+' over'}`;
function liveTick(){const at=now();$$('[data-live]').forEach(el=>{const t=Number(el.dataset.rt||(el.dataset.rt=at)),r2=Number(el.dataset.left)-(at-t)/1000;
    el.textContent=liveText(el.dataset.label,r2);el.classList.toggle('over',r2<0)});
  $$('[data-cell]').forEach(el=>el.textContent=mmss(Number(el.dataset.prior)+(at-Number(el.dataset.start))/1000))}
let t1,t2,clock,tabsReady=false;
function boot(){if(!mgr||!MANAGER_CODES[mgr])return showGate();$('#gate').classList.add('hidden');$('#app').classList.remove('hidden');$('#who').textContent=MANAGER_CODES[mgr];if(CONFIG.backend==='api'){$('#demo')?.remove();$('#clear')?.remove()}db=load();purge(db);save(db);render(true);
  clearInterval(clock);clock=startClock();if(!tabsReady){tabsReady=true;setupTabs(t=>{tab=t;clearInterval(raceT);if(t==='dash')renderDash(now(),true);if(t==='race'){drawRace();raceT=setInterval(drawRace,60000)}})}
  clearInterval(t1);clearInterval(t2);t1=setInterval(liveTick,1000);loadLooks();t2=setInterval(async()=>{if(det)return;if(Date.now()%60000<CONFIG.refreshSeconds*1000)loadLooks();if(CONFIG.backend==='api'){try{await refresh();setLive(true)}catch{setLive(false)}}db=load();render()},CONFIG.refreshSeconds*1000)}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&mgr&&!det){db=load();render()}});
setupPassword();setupTheme();wireRacers($('#race'));
(async()=>{if(CONFIG.backend==='api')$('#pw').classList.remove('hidden');try{await init();if(CONFIG.backend==='api'){const m=me();mgr=m&&m.role!=='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
