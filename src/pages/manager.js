import { CONFIG } from '../config.js';
import { MANAGER_CODES, PILOT_USERS, SESSION_MGR } from '../pilot.js';
import { load, save, purge, dayKey, hhmm, mmss, tidy, atTime, slotsFor, plan, STORAGE_KEY, init, refresh, me, signIn, signOut } from '../core.js';
import { esc } from '../dom.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],U=PILOT_USERS,SESSION=SESSION_MGR,DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let TODAY=dayKey(),db=load(),mgr=CONFIG.backend==='api'?null:sessionStorage.getItem(SESSION),lastSig='',det=null;
function showGate(){$('#gate').classList.remove('hidden');$('#app').classList.add('hidden');$('#code').value='';$('#code').focus()}
$('#gateForm').addEventListener('submit',async e=>{e.preventDefault();const c=$('#code').value.trim().toUpperCase();
  if(CONFIG.backend==='api'){const btn=e.submitter;if(btn)btn.disabled=true;try{const m=await signIn(c,$('#pw').value);if(m.role==='agent'){await signOut();$('#gateErr').textContent="That's a staff code. Staff sign in on the main page (link below).";return}mgr=m.code;$('#pw').value='';$('#gateErr').textContent='';boot()}catch(err){$('#gateErr').textContent=err.message}finally{if(btn)btn.disabled=false}return}
  if(!MANAGER_CODES[c]){$('#gateErr').textContent=PILOT_USERS[c]?"That's a staff code. Staff sign in on the main page (link below).":"That code isn't recognised. Check it and try again.";return}mgr=c;sessionStorage.setItem(SESSION,c);$('#gateErr').textContent='';boot()});
$('#signout').addEventListener('click',async()=>{sessionStorage.removeItem(SESSION);mgr=null;await signOut();showGate()});
const adjUI=(c,s,dt,name)=>{const l=CONFIG.adjustmentLimits,d=dt===TODAY?'':` data-date="${dt}"`;return `<div class="adj"><button data-u="${c}" data-s="${s.key}" data-d="-5"${d} aria-label="Take 5 minutes off ${s.label} for ${name}" ${s.adjust<=l.min?'disabled':''}>−</button><output class="${s.adjust?'on':''}">${s.adjust>0?'+':''}${s.adjust} min</output><button data-u="${c}" data-s="${s.key}" data-d="5"${d} aria-label="Add 5 minutes to ${s.label} for ${name}" ${s.adjust>=l.max?'disabled':''}>+</button></div>`};
document.addEventListener('click',e=>{const b=e.target.closest('button[data-u]');if(!b)return;db=load();const dt=b.dataset.date||TODAY,u=((db.adj[dt]??={})[b.dataset.u]??={}),l=CONFIG.adjustmentLimits;
  const v=Math.max(l.min,Math.min(l.max,(u[b.dataset.s]||0)+Number(b.dataset.d)));if(v)u[b.dataset.s]=v;else delete u[b.dataset.s];save(db);render(true);if(det)draw()});
$('#demo').addEventListener('click',()=>{db=load();const now=Date.now();let i=0;
  for(const [c,name] of Object.entries(U)){const d=(db.days[TODAY]??={});
    if(!d[c]&&i%5!==4){const st=Math.floor((now-(3+i*.4)*36e5)/6e4)*6e4,r={name,shiftStart:st,shiftEnd:st+9*36e5,breaks:[],active:null},b1=st+90*6e4;
      if(i%5===0)r.breaks.push({slot:'break1',start:b1,end:b1+14*6e4});if(i%5===1)r.breaks.push({slot:'break1',start:b1,end:b1+17*6e4});
      if(i%5===3){r.breaks.push({slot:'break1',start:b1,end:b1+15*6e4});r.active={slot:'break2',start:now-5*6e4}}d[c]=r}
    for(let k=1;k<=6;k++){const t=new Date();t.setDate(t.getDate()-k);const dk=dayKey(t);if(db.days[dk]?.[c])continue;t.setHours(9,0,0,0);const s=t.getTime(),o=(x)=>((i+k)%(i+3)===0?x:0);
      (db.days[dk]??={})[c]={name,shiftStart:s,shiftEnd:s+9*36e5,active:null,breaks:[{slot:'break1',start:s+90*6e4,end:s+(105+o(3))*6e4},{slot:'lunch',start:s+240*6e4,end:s+(270+o(4))*6e4},{slot:'break2',start:s+420*6e4,end:s+(435+(i===4?2:0))*6e4}]}}
    i++}save(db);render(true)});
$('#clear').addEventListener('click',()=>{if(!confirm("Clear today's data for everyone? This can't be undone."))return;db=load();delete db.days[TODAY];delete db.adj[TODAY];save(db);render(true)});
/* ---------- details dialog ---------- */
document.addEventListener('click',e=>{const b=e.target.closest('button[data-det]');if(b){det={c:b.dataset.det,date:TODAY};db=load();draw();$('#dOv').classList.remove('hidden')}});
$('#dClose').addEventListener('click',()=>{det=null;$('#dOv').classList.add('hidden')});
function draw(){const {c,date}=det,r=db.days[date]?.[c],p=plan(r,db.adj[date]?.[c],Date.now(),slotsFor(db,c,date)),L=k=>p.find(s=>s.key===k)?.label||k;
  const dates=[...new Set([TODAY,...Object.keys(db.days).filter(d=>db.days[d][c])])].sort().reverse(),cust=db.custom[c]||[];
  $('#dTitle').textContent=`${U[c]} · ${c}`;
  $('#dBody').innerHTML=`<div class="field"><label for="dDate">Day</label><select id="dDate">${dates.map(d=>`<option ${d===date?'selected':''}>${d}</option>`).join('')}</select></div>
  <h3>Break history</h3>${r&&(r.breaks.length||r.active)?`<div class="scroll"><table><thead><tr><th>Break</th><th>Started</th><th>Ended</th><th>Length</th><th></th></tr></thead><tbody>${r.breaks.map((b,i)=>`<tr><td>${L(b.slot)}</td><td><input type="time" data-i="${i}" data-f="start" value="${hhmm(b.start)}"></td><td><input type="time" data-i="${i}" data-f="end" value="${hhmm(b.end)}"></td><td>${tidy((b.end-b.start)/6e4)} min${b.flag?' · auto-closed':''}</td><td><button class="btn ghost sm" data-rm="${i}">Remove</button></td></tr>`).join('')}${r.active?`<tr><td>${L(r.active.slot)}</td><td>${hhmm(r.active.start)}</td><td colspan="3">In progress</td></tr>`:''}</tbody></table></div>`:'<p class="hint">No breaks recorded for this day.</p>'}
  <h3>Allowances for this day</h3><div class="scroll"><table><tbody>${p.map(s=>`<tr><td><b>${s.label}</b></td><td>${tidy(s.used/60)} / ${tidy(s.allowed)} min${s.over?` <span class="bad">(+${tidy(s.over/60)} over)</span>`:''}</td><td>${adjUI(c,s,date,U[c])}</td></tr>`).join('')}</tbody></table></div>
  ${r?`<h3>Log a missed break</h3><div class="row"><div class="field"><label>Break</label><select id="lSlot">${p.map(s=>`<option value="${s.key}">${s.label}</option>`).join('')}</select></div><div class="field"><label>Start</label><input type="time" id="lS"></div><div class="field"><label>End</label><input type="time" id="lE"></div><button class="btn teal sm" id="lAdd">Add</button></div>`:''}
  <h3>Custom breaks for ${U[c]}</h3>${cust.length?cust.map(x=>`<p style="margin:4px 0"><b>${CONFIG.customLabels[x.key]}</b> · ${x.minutes} min · ${x.scope==='daily'?'every day':x.scope==='today'?'only '+x.date:x.days.map(d=>DN[d]).join(', ')} <button class="btn ghost sm" data-cdel="${x.key}">Remove</button></p>`).join(''):'<p class="hint">None yet.</p>'}
  <div class="row" style="margin-top:10px"><div class="field"><label>Break</label><select id="cKey">${Object.entries(CONFIG.customLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field"><label>Minutes</label><input type="number" id="cMin" value="15" min="1" max="120" style="width:80px"></div><button class="btn teal sm" id="cAdd">Add custom break</button></div>
  <div class="opt" style="margin-top:10px"><label><input type="radio" name="sc" value="today" checked> Only ${date}</label><label><input type="radio" name="sc" value="days"> Selected days</label><label><input type="radio" name="sc" value="daily"> Every day</label></div>
  <div class="opt">${DN.map((n,i)=>`<label><input type="checkbox" class="dchk" value="${i}"> ${n}</label>`).join('')}</div>`}
$('#dBody').addEventListener('change',e=>{const t=e.target;if(t.id==='dDate'){det.date=t.value;return draw()}
  if(t.dataset.i===undefined||!t.value)return;db=load();const b=db.days[det.date][det.c].breaks[t.dataset.i],v=atTime(t.value,b.start);
  if(t.dataset.f==='start'?v<b.end:v>b.start){b[t.dataset.f]=v;save(db)}render(true);draw()});
$('#dBody').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;db=load();const {c,date}=det,r=db.days[date]?.[c];
  if(t.dataset.rm!==undefined)r.breaks.splice(Number(t.dataset.rm),1);
  else if(t.dataset.cdel)db.custom[c]=(db.custom[c]||[]).filter(x=>x.key!==t.dataset.cdel);
  else if(t.id==='lAdd'){const s=$('#lS').value,en=$('#lE').value;if(!s||!en)return;const a=atTime(s,r.shiftStart),b=atTime(en,r.shiftStart);if(b<=a)return;r.breaks.push({slot:$('#lSlot').value,start:a,end:b})}
  else if(t.id==='cAdd'){const sc=document.querySelector('input[name=sc]:checked').value,days=$$('.dchk:checked').map(x=>Number(x.value));if(sc==='days'&&!days.length)return alert('Pick at least one day.');
    const key=$('#cKey').value;db.custom[c]=[...(db.custom[c]||[]).filter(x=>x.key!==key),{key,minutes:Math.max(1,Number($('#cMin').value)||15),scope:sc,date,days}]}
  else return;save(db);render(true);draw()});
/* ---------- team table ---------- */
function render(force){const now=Date.now();if(dayKey(new Date(now))!==TODAY)TODAY=dayKey();const sig=JSON.stringify(db)+Math.floor(now/6e4);if(!force&&sig===lastSig)return;lastSig=sig;
  const day=db.days[TODAY]||{},adj=db.adj[TODAY]||{};CONFIG.defaultSlots.forEach((s,i)=>$('#h'+i).textContent=`${s.label} (${s.minutes} min)`);
  let inn=0,onB=0,overP=0,overS=0;
  $('#rows').innerHTML=Object.entries(U).map(([c,name])=>{const r=day[c],p=plan(r,adj[c],now,slotsFor(db,c,TODAY));let shift='<span style="color:var(--muted)">Not started</span>',pct=0,status='<span class="pill">Not started</span>';
    if(r){inn++;shift=r.shiftEnd?`${hhmm(r.shiftStart)} – ${hhmm(r.shiftEnd)}`:`${hhmm(r.shiftStart)} – <span style="color:var(--muted)">no end set</span>`;pct=r.shiftEnd?Math.max(0,Math.min(100,(now-r.shiftStart)/(r.shiftEnd-r.shiftStart)*100)):0;status=pct>=100?'<span class="pill">Finished</span>':'<span class="pill work">Working</span>';
      if(r.active){onB++;const s=p.find(x=>x.act);status=`<span class="pill brk" data-live data-start="${r.active.start}" data-left="${s.left}" data-label="${s.label}"></span>`}}
    const tot=p.reduce((a,s)=>a+s.overBase,0);if(tot>0){overP++;overS+=tot}
    const cells=p.slice(0,3).map(s=>{const main=s.act?`<span class="u" data-cell data-start="${s.act.start}" data-prior="${s.used-(now-s.act.start)/1000}"></span> <span class="of">/ ${tidy(s.allowed)} min</span>`:s.used>0?`<span class="u${s.over?' bad':''}">${tidy(s.used/60)}</span> <span class="of">/ ${tidy(s.allowed)} min${s.segs.some(b=>b.flag)?' · auto-closed':''}</span>`:`<span class="of">Not taken · ${tidy(s.allowed)} min</span>`;return `<td class="cell">${main}${adjUI(c,s,TODAY,name)}</td>`}).join('');
    return `<tr><td class="person"><b>${esc(name)}</b><span>${c}${p.length>3?` · +${p.length-3} custom`:''}</span></td><td>${shift}</td><td><div class="mini"><i style="width:${pct}%"></i></div>${r&&r.shiftEnd?Math.floor(pct)+'%':'–'}</td><td>${status}</td>${cells}<td><button class="btn ghost sm" data-det="${c}">View more</button></td></tr>`}).join('');
  $('#kIn').textContent=inn;$('#kBrk').textContent=onB;$('#kOver').textContent=overP;$('#kMin').textContent=Math.round(overS/60);$('#kOver').classList.toggle('bad',overP>0);$('#kMin').classList.toggle('bad',overS>0);liveTick()}
function liveTick(){const now=Date.now();$$('[data-live]').forEach(el=>{const t=Number(el.dataset.rt||(el.dataset.rt=now)),r2=Number(el.dataset.left)-(now-t)/1000;
    el.textContent=`${el.dataset.label} · ${r2>=0?mmss(Math.ceil(r2))+' left':'−'+mmss(Math.floor(-r2))+' over'}`;el.classList.toggle('over',r2<0)});
  $$('[data-cell]').forEach(el=>el.textContent=mmss(Number(el.dataset.prior)+(now-Number(el.dataset.start))/1000));$('#live').textContent='Live · updated '+hhmm(now)}
let t1,t2;
function boot(){if(!mgr||!MANAGER_CODES[mgr])return showGate();$('#gate').classList.add('hidden');$('#app').classList.remove('hidden');$('#who').textContent=MANAGER_CODES[mgr];if(CONFIG.backend==='api'){$('#demo')?.remove();$('#clear')?.remove()}db=load();purge(db);save(db);render(true);
  clearInterval(t1);clearInterval(t2);t1=setInterval(liveTick,1000);t2=setInterval(async()=>{if(det)return;if(CONFIG.backend==='api'){try{await refresh()}catch{}}db=load();render()},CONFIG.refreshSeconds*1000)}
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&mgr&&!det){db=load();render()}});
(async()=>{if(CONFIG.backend==='api')$('#pw').classList.remove('hidden');try{await init();if(CONFIG.backend==='api'){const m=me();mgr=m&&m.role!=='agent'?m.code:null}boot()}catch(err){showGate();$('#gateErr').textContent=err.message}})();
