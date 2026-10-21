// The engine: storage and break maths. Used by both pages.
// Nothing here touches the page. Storage is only touched inside load() and save(),
// so this file imports fine in Node (that is how tests/engine.test.js runs it).
import { CONFIG } from './config.js';
import * as api from './backend/api.js';
import { PILOT_USERS } from './pilot.js';
export const pad = n => String(n).padStart(2,'0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const STORAGE_KEY = 'bt-break-tracker:v1';
const KEY = STORAGE_KEY;
const API = CONFIG.backend === 'api';
const blank = () => ({ days:{}, adj:{}, custom:{}, names:{} });
/* STORAGE LAYER. 'fake' = this browser's localStorage (demo). 'api' = the Supabase database (src/backend/api.js).
   Pages only ever call load / save / init / refresh / me / signIn / signOut, so they don't care which is active. */
const fakeLoad = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); } };
const fakeSave = db => localStorage.setItem(KEY, JSON.stringify(db));
export const load = () => API ? api.load() : fakeLoad();
export const save = db => API ? api.save(db) : fakeSave(db);
export const init = async () => { if (API) await api.init(); };                 // call once before drawing a page
export const refresh = async () => API ? api.refresh() : false;                 // true = data changed, redraw
export const me = () => API ? api.me() : null;                                  // { code, name, role } once signed in
export const signIn = (code, password) => api.signIn(code, password);
export const signOut = async () => { if (API) await api.signOut(); };
export const history = async (code, day) => API ? api.history(code, day) : null;  // managers: audit trail rows (null = not kept in demo mode)
export const changePassword = pw => api.changePassword(pw);                       // database mode only
/* The time to show and to stamp breaks with: the device clock corrected to the database clock, so a phone that is
   a few minutes out shows the same time as everyone else. (The database also stamps break start/stop itself.) */
export const now = () => Date.now() + (API ? api.clockOffset() : 0);
/* Breakathon scores for the team between two days (inclusive). The database works them out in 'api' mode, so agents
   only ever receive names and points, never anyone's break times. */
export const breakathon = async (from, to) => API ? api.breakathon(from, to)
  : teamScores(fakeLoad(), Object.keys(PILOT_USERS), from, to, true).map(r => ({ ...r, ...lookOf(fakeLooks().avatars[r.code]) }));

/* Mascots and prizes. Database mode: the database decides (db/schema.sql). Demo mode: the same rules, kept in this browser. */
const LOOKS_KEY = 'bt-looks:v1', FREE = ['colour:teal', 'acc:none'];
const lookOf = a => ({ colour: a?.colour || 'teal', accessory: a?.accessory || 'none' });
const fakeLooks = () => { try { return { avatars: {}, rewards: {}, ...JSON.parse(localStorage.getItem(LOOKS_KEY)) }; } catch { return { avatars: {}, rewards: {} }; } };
const saveLooks = v => localStorage.setItem(LOOKS_KEY, JSON.stringify(v));
const lastWeek = () => weekOf(dayKey(new Date(now())), 1);
function fakeChampion() { const w = lastWeek(), top = teamScores(fakeLoad(), Object.keys(PILOT_USERS), w.from, w.to, true)[0]; return top?.points > 0 ? top.code : null; }
const unlockedOf = (L, code) => Object.values(L.rewards[code] || {}).filter(x => x.choice === 'look').map(x => x.item);
/** { colour, accessory, unlocked[], week, champion (won last week?), claimed: 'break'|'look'|null, claimed_item } */
export async function myRewards(code) {
  if (API) return api.myRewards();
  const L = fakeLooks(), w = lastWeek().from, r = L.rewards[code]?.[w];
  return { ...lookOf(L.avatars[code]), unlocked: unlockedOf(L, code), week: w, champion: fakeChampion() === code, claimed: r?.choice || null, claimed_item: r?.item || null };
}
export async function claimReward(code, choice, item) {
  if (API) return api.claimReward(choice, item);
  const L = fakeLooks(), w = lastWeek().from;
  if (fakeChampion() !== code) throw new Error("Only last week's champion can claim the prize.");
  if (L.rewards[code]?.[w]) throw new Error("You have already claimed last week's prize.");
  if (choice === 'look' && (!item || FREE.includes(item) || unlockedOf(L, code).includes(item))) throw new Error("Pick a colour or accessory you don't have yet.");
  (L.rewards[code] ??= {})[w] = { choice, item: choice === 'look' ? item : null };
  if (choice === 'look') { const [k, v] = item.split(':'); L.avatars[code] = { ...lookOf(L.avatars[code]), [k === 'colour' ? 'colour' : 'accessory']: v }; }
  saveLooks(L);
}
export async function setLook(code, colour, accessory) {
  if (API) return api.setLook(colour, accessory);
  const L = fakeLooks(), ok = item => FREE.includes(item) || unlockedOf(L, code).includes(item);
  if (!ok('colour:' + colour) || !ok('acc:' + accessory)) throw new Error('You can only wear colours and accessories you have unlocked.');
  L.avatars[code] = { colour, accessory }; saveLooks(L);
}
export const teamLooks = async () => API ? api.teamLooks() : fakeLooks().avatars;
export async function teamRewards(week) {
  if (API) return api.teamRewards(week);
  const L = fakeLooks(), out = {}; for (const [c, w] of Object.entries(L.rewards)) if (w[week]) out[c] = w[week]; return out;
}
export function purge(db){
  if (API) return;                                                              // the database deletes old rows itself (db/cleanup_job.sql)
  const c = new Date(); c.setDate(c.getDate() - CONFIG.retentionDays); const ck = dayKey(c);
  for (const m of [db.days, db.adj]) for (const k of Object.keys(m)) if (k < ck) delete m[k];
  for (const u of Object.keys(db.custom)) db.custom[u] = db.custom[u].filter(x => x.scope !== 'today' || x.date >= ck);
}
export const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const mmss = sec => { const s = Math.max(0, Math.round(sec)); return pad(Math.floor(s/60)) + ':' + pad(s%60); };
export const durHM = sec => { const m = Math.max(0, Math.round(sec/60)), h = Math.floor(m/60); return h ? `${h}h ${pad(m%60)}m` : `${m}m`; };
export const fmtMin = sec => sec < 60 ? `${Math.max(1,Math.round(sec))} sec` : `${Math.round(sec/60)} min`;
export const tidy = n => Math.round(n*10)/10;
export const atTime = (v, base) => { const [h,m] = v.split(':').map(Number); const d = new Date(base); d.setHours(h,m,0,0); return d.getTime(); };
/* A break name typed by a manager: trimmed, single spaces, at most CONFIG.breakNameMaxLength characters. '' = use the default. */
export const cleanName = v => String(v ?? '').replace(/\s+/g,' ').trim().slice(0, CONFIG.breakNameMaxLength);

/* Default slots + any custom breaks the manager added that apply on this date.
   A manager can rename any break for one person (db.names[code][slot]); `defaultLabel` keeps the original name. */
export function slotsFor(db, code, date = dayKey()){
  const dow = new Date(date + 'T12:00:00').getDay();
  const extra = (db.custom[code] || [])
    .filter(c => c.scope === 'daily' || (c.scope === 'today' && c.date === date) || (c.scope === 'days' && c.days.includes(dow)))
    .sort((a,b) => a.key.localeCompare(b.key))
    .map(c => ({ key:c.key, label:CONFIG.customLabels[c.key], minutes:c.minutes, tone:'custom' }));
  const names = db.names?.[code] || {};
  return [...CONFIG.defaultSlots, ...extra].map(s => ({ ...s, defaultLabel:s.label, label:names[s.key] || s.label }));
}
/* The name a person sees for a slot, whether or not it applies today (used for history rows and the custom break list). */
export const labelFor = (db, code, key) => db.names?.[code]?.[key] || CONFIG.defaultSlots.find(s => s.key === key)?.label || CONFIG.customLabels[key] || key;
/* A slot can be taken in several sittings; it only closes when all its minutes are used.
   Overrun comes off the NEXT slot. */
export function plan(rec, adj, now, slots){
  let carry = 0;
  return slots.map(s => {
    const adjust = adj?.[s.key] || 0, raw = s.minutes + adjust - carry, allowed = Math.max(0, raw), deducted = carry;
    const segs = (rec?.breaks || []).filter(b => b.slot === s.key);
    const act = rec?.active?.slot === s.key ? rec.active : null;
    const used = segs.reduce((a,b) => a + (b.end - b.start)/1000, 0) + (act ? (now - act.start)/1000 : 0);
    let over = Math.max(0, used - allowed*60); if (over < CONFIG.overToleranceMinutes*60) over = 0;
    const left = Math.max(0, allowed*60 - used);
    /* overBase = minutes over the NORMAL allowance. This is what the manager totals use, so an overrun that is
       passed on to the next break is not counted again there. `over` (against the reduced allowance) only drives the timer. */
    let overBase = Math.max(0, used - (s.minutes + adjust)*60); if (overBase < CONFIG.overToleranceMinutes*60) overBase = 0;
    carry = over/60 + Math.max(0, -raw); /* overrun the next slot couldn't absorb keeps rolling forward */
    return { ...s, base: s.minutes + adjust, adjust, allowed, deducted, segs, act, used, over, overBase, left, done: !act && used > 0 && left < 10 };
  });
}

/* ---------------- Breakathon (weekly punctuality) ----------------
   A break counts when it was used; it is on time when it stayed within its OWN allowance (+ any manager adjustment).
   Minutes passed on to the next break are not counted twice (that is plan()'s overBase). Same maths as breakathon() in db/schema.sql. */
export function weekScore(db, code, from, to){
  const B = CONFIG.breakathon; let breaks = 0, onTime = 0, overSec = 0, cleanDays = 0;
  for (const [day, byCode] of Object.entries(db.days || {})) {
    if (day < from || day > to || !byCode[code]) continue;
    const p = plan({ ...byCode[code], active:null }, db.adj?.[day]?.[code], 0, slotsFor(db, code, day)).filter(s => s.segs.length);
    if (!p.length) continue;
    breaks += p.length; onTime += p.filter(s => !s.overBase).length; overSec += p.reduce((a,s) => a + s.overBase, 0);
    if (p.every(s => !s.overBase)) cleanDays++;
  }
  const overMinutes = Math.round(overSec/60);
  return { breaks, onTime, cleanDays, overMinutes, points: Math.max(0, onTime*B.pointsOnTime + cleanDays*B.pointsCleanDay - overMinutes*B.penaltyPerMinuteOver) };
}
/** Ranked rows like the database returns: { code, name, breaks, onTime, cleanDays, overMinutes (managers only), points }. */
export function teamScores(db, codes, from, to, showOver){
  return codes.map(code => { const s = weekScore(db, code, from, to);
    return { code, name: PILOT_USERS[code] || code, ...s, overMinutes: showOver ? s.overMinutes : null }; })
    .sort((a,b) => b.points - a.points || b.onTime - a.onTime || a.name.localeCompare(b.name));
}
/** Monday-to-Sunday week containing `date` (a day key), as day keys. weeksBack = 1 gives last week. */
export function weekOf(date = dayKey(), weeksBack = 0){
  const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7*weeksBack);
  const end = new Date(d); end.setDate(d.getDate() + 6);
  return { from: dayKey(d), to: dayKey(end) };
}

/* ---------------- manager dashboard: who is where ---------------- */
/** One person's state today. p = plan() for today. Statuses: off (not clocked in), onbreak, over, taken, none. */
export function statusOf(rec, p, at){
  if (!rec) return { key:'off', label:'Not clocked in' };
  const act = p.find(s => s.act), overToday = p.some(s => s.overBase > 0);
  if (act) return act.left <= 0 && act.used > act.allowed*60 + CONFIG.overToleranceMinutes*60
    ? { key:'over', label:`Over on ${act.label}`, onBreak:true, slot:act }
    : { key:'onbreak', label:`On ${act.label}`, onBreak:true, slot:act };
  if (overToday) return { key:'over', label:'Went over today' };
  if (p.some(s => s.used > 0)) return { key:'taken', label: rec.shiftEnd && at >= rec.shiftEnd ? 'Finished' : 'Working' };
  return { key:'none', label:'No break yet' };
}
/** The filters on the manager dashboard and who matches each. */
export const FILTERS = [
  { key:'all',     label:'Everyone',        test: () => true },
  { key:'onbreak', label:'On a break now',  test: st => !!st.onBreak },
  { key:'over',    label:'Running over',    test: st => st.key === 'over' },
  { key:'taken',   label:'Taken a break',   test: (st, p) => p.some(s => s.used > 0) },
  { key:'none',    label:'No break yet',    test: st => st.key === 'none' },
  { key:'off',     label:'Not clocked in',  test: st => st.key === 'off' },
];
const names = list => list.length <= 3 ? list.join(list.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1') : `${list.slice(0,3).join(', ')} and ${list.length-3} more`;
/** Plain-English team summary for the manager. team = [{ name, rec, p }] for everyone; returns [{ tone: bad|warn|good|info, text }]. */
export function teamPulse(team, at){
  const inn = team.filter(t => t.rec), out = [];
  if (!inn.length) return [{ tone:'info', text:'Nobody has clocked in yet today. Quiet before the storm ☕' }];
  for (const t of inn) { const a = t.p.find(s => s.act); if (!a) continue;
    const over = a.used - a.allowed*60;
    if (over >= 5*60) out.push({ tone:'bad', text:`${t.name} is ${Math.round(over/60)} min over on ${a.label}. Go wake ${t.name} up 😴` });
    else if (over > CONFIG.overToleranceMinutes*60) out.push({ tone:'bad', text:`${t.name} has just gone over on ${a.label}. A friendly nudge? ⏰` });
  }
  for (const t of inn) if (!t.p.some(s => s.used > 0) && at - t.rec.shiftStart >= CONFIG.noBreakWarnHours*36e5)
    out.push({ tone:'warn', text:`${t.name} has been working ${durHM((at - t.rec.shiftStart)/1000)} without a break. Worth a check-in 👀` });
  for (const slot of CONFIG.defaultSlots) {
    const st = inn.map(t => ({ t, s: t.p.find(x => x.key === slot.key) })).filter(x => x.s);
    const done = st.filter(x => x.s.used > 0 && !x.s.act), waiting = st.filter(x => !x.s.used);
    if (!st.length || !done.length) continue;
    if (!waiting.length && done.length === st.length) out.push({ tone:'good', text:`Everyone clocked in has had ${slot.label} 🎉` });
    else if (done.length >= Math.ceil(st.length*0.6)) out.push({ tone:'info', text:`Almost everyone has had ${slot.label}. Still to go: ${names(waiting.map(x => x.t.name))}.` });
  }
  const onB = inn.filter(t => t.p.some(s => s.act)).length, off = team.length - inn.length;
  out.push({ tone:'info', text:`${onB ? `${onB} on a break right now` : 'Nobody on a break right now'} · ${inn.length - onB} working${off ? ` · ${off} not clocked in` : ''}.` });
  const order = { bad:0, warn:1, good:2, info:3 };
  return out.sort((a,b) => order[a.tone] - order[b.tone]).slice(0, 7);
}
