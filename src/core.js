// The engine: storage and break maths. Used by both pages.
// Nothing here touches the page. Storage is only touched inside load() and save(),
// so this file imports fine in Node (that is how tests/engine.test.js runs it).
import { CONFIG } from './config.js?v=9318095bf0';
import * as api from './backend/api.js?v=9318095bf0';
import { PILOT_USERS } from './pilot.js?v=9318095bf0';
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
const LOOKS_KEY = 'bt-looks:v1', COLOURS = ['auto', 'teal', 'blue', 'pink', 'yellow', 'purple', 'green', 'orange', 'coral', 'sky', 'lilac'];   // = look_colours()
const lookOf = a => ({ colour: a?.colour || 'auto', accessory: a?.accessory || 'none' });
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
  if (choice === 'look' && (!/^acc:\w+$/.test(item || '') || item === 'acc:none' || unlockedOf(L, code).includes(item))) throw new Error("Pick an accessory you don't have yet.");
  (L.rewards[code] ??= {})[w] = { choice, item: choice === 'look' ? item : null };
  if (choice === 'look') L.avatars[code] = { ...lookOf(L.avatars[code]), accessory: item.slice(4) };
  saveLooks(L);
}
export async function setLook(code, colour, accessory) {
  if (API) return api.setLook(colour, accessory);
  const L = fakeLooks();
  if (!COLOURS.includes(colour)) throw new Error("That colour isn't available.");
  if (accessory !== 'none' && !unlockedOf(L, code).includes('acc:' + accessory)) throw new Error('You can only wear accessories you have unlocked.');
  L.avatars[code] = { colour, accessory }; saveLooks(L);
}
export const teamLooks = async () => API ? api.teamLooks() : fakeLooks().avatars;
export async function teamRewards(week) {
  if (API) return api.teamRewards(week);
  const L = fakeLooks(), out = {}; for (const [c, w] of Object.entries(L.rewards)) if (w[week]) out[c] = w[week]; return out;
}
/* Interface choice: 'fun' (Playful) or 'pro' (Professional), see src/ui.js. Database mode: saved with the login
   (db/schema.sql, ui_prefs). Demo mode: the same record, kept in this browser. */
const UI_KEY = 'bt-ui-prefs:v1';
const fakeUi = () => { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; } };
export const myUiStyle = async code => API ? api.myUiStyle() : fakeUi()[code]?.style || null;
export async function setUiStyle(code, style) {
  if (API) return api.setUiStyle(style);
  const all = fakeUi(), was = all[code], at = new Date(now()).toISOString();
  if (was?.style === style) return;
  all[code] = was ? { ...was, style, changed_at: at, switches: was.switches + 1 } : { style, first_style: style, first_at: at, changed_at: at, switches: 0 };
  localStorage.setItem(UI_KEY, JSON.stringify(all));
}
export const teamUiStyles = async () => API ? api.teamUiStyles() : fakeUi();
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
   The day's breaks are one pot. When a break runs past its own minutes, the extra comes out of the other breaks that still
   have time: the ones after it first (Break 1 -> Break 2 -> Lunch -> OH breaks), then from the start (a long Lunch taken
   first comes off Break 1, then Break 2). Sittings are worked through in the order they happened. Someone is only OVER once
   the whole day's allowance (including any OH break) is used up. */
export function plan(rec, adj, now, slots){
  const tol = CONFIG.overToleranceMinutes*60;
  const S = slots.map(s => { const adjust = adj?.[s.key] || 0, base = s.minutes + adjust;
    return { ...s, base, adjust, cap: Math.max(0, base)*60, segs: (rec?.breaks || []).filter(b => b.slot === s.key),
      act: rec?.active?.slot === s.key ? rec.active : null, used: 0, lent: 0, borrowed: 0, over: 0, from: [], to: [] }; });
  const sittings = [...(rec?.breaks || []).map(b => ({ slot:b.slot, start:b.start, secs:(b.end - b.start)/1000 })),
    ...(rec?.active ? [{ slot:rec.active.slot, start:rec.active.start, secs:Math.max(0, (now - rec.active.start)/1000) }] : [])]
    .sort((x, y) => x.start - y.start);
  const note = (list, label, secs) => { const e = list.find(x => x.label === label); e ? e.secs += secs : list.push({ label, secs }); };
  for (const r of sittings) { const i = S.findIndex(s => s.key === r.slot); if (i < 0) continue;
    const s = S[i], own = Math.min(r.secs, s.cap); let need = r.secs - own; s.used += r.secs; s.cap -= own;
    for (const o of [...S.slice(i + 1), ...S.slice(0, i)]) { if (need <= 0) break;
      const take = Math.min(need, o.cap); if (take <= 0) continue;
      o.cap -= take; o.lent += take; s.borrowed += take; need -= take; note(s.from, o.label, take); note(o.to, s.label, take); }
    s.over += need; }
  const spare = S.reduce((t, s) => t + s.cap, 0);
  return S.map(({ cap, lent, ...s }) => {
    const allowed = Math.max(0, s.base) - lent/60, over = s.over < tol ? 0 : s.over;
    /* overBase = minutes past this break's OWN allowance (whether or not other breaks covered it); Breakathon uses it */
    let overBase = Math.max(0, s.used - Math.max(0, s.base)*60); if (overBase < tol) overBase = 0;
    return { ...s, allowed, deducted: lent/60, over, overBase, left: cap, spare, done: !s.act && s.used > 0 && cap < 10 };
  });
}

/* ---------------- Breakathon (weekly punctuality) ----------------
   Same rule as the bars: a day only goes wrong once the whole day's break time is used up.
   On a day that stayed within its total, every break taken is on time and the day is clean.
   On a day that went past it, the breaks that ran past their own minutes are not on time, and the minutes past the
   day's total count against you. Same maths as breakathon() in db/schema.sql. */
export function weekScore(db, code, from, to){
  const B = CONFIG.breakathon; let breaks = 0, onTime = 0, overSec = 0, cleanDays = 0;
  for (const [day, byCode] of Object.entries(db.days || {})) {
    if (day < from || day > to || !byCode[code]) continue;
    const all = plan({ ...byCode[code], active:null }, db.adj?.[day]?.[code], 0, slotsFor(db, code, day)), p = all.filter(s => s.segs.length);
    if (!p.length) continue;
    const cap = all.reduce((a,s) => a + Math.max(0, s.base)*60, 0), used = all.reduce((a,s) => a + s.used, 0);
    let dayOver = Math.max(0, used - cap); if (dayOver < CONFIG.overToleranceMinutes*60) dayOver = 0;
    breaks += p.length; onTime += dayOver ? p.filter(s => !s.overBase).length : p.length; overSec += dayOver;
    if (!dayOver) cleanDays++;
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
  const act = p.find(s => s.act), overToday = p.some(s => s.over > 0);
  if (act) return act.over > 0
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
/** Plain-English team summary for the manager. team = [{ name, rec, p }] for everyone; returns [{ tone: bad|warn|good|info, text }].
    pro = the Professional view's plainer wording. */
export function teamPulse(team, at, pro = false){
  const inn = team.filter(t => t.rec), out = [];
  if (!inn.length) return [{ tone:'info', text:'Nobody has clocked in yet today.' }];
  for (const t of inn) { const a = t.p.find(s => s.act); if (!a) continue;
    const over = a.over;
    if (over >= 5*60) out.push({ tone:'bad', text:`${t.name} is ${Math.round(over/60)} min over on ${a.label}.${pro ? '' : ` Go wake ${t.name} up.`}` });
    else if (over > CONFIG.overToleranceMinutes*60) out.push({ tone:'bad', text:`${t.name} has just gone over on ${a.label}.` });
  }
  for (const t of inn) if (!t.p.some(s => s.used > 0) && at - t.rec.shiftStart >= CONFIG.noBreakWarnHours*36e5)
    out.push({ tone:'warn', text:`${t.name} has been working ${durHM((at - t.rec.shiftStart)/1000)} without a break. Worth a check-in.` });
  for (const slot of CONFIG.defaultSlots) {
    const st = inn.map(t => ({ t, s: t.p.find(x => x.key === slot.key) })).filter(x => x.s);
    const done = st.filter(x => x.s.used > 0 && !x.s.act), waiting = st.filter(x => !x.s.used);
    if (!st.length || !done.length) continue;
    if (!waiting.length && done.length === st.length) out.push({ tone:'good', text:`Everyone clocked in has had ${slot.label}.` });
    else if (done.length >= Math.ceil(st.length*0.6)) out.push({ tone:'info', text:`Almost everyone has had ${slot.label}. Still to go: ${names(waiting.map(x => x.t.name))}.` });
  }
  const onB = inn.filter(t => t.p.some(s => s.act)).length, off = team.length - inn.length;
  out.push({ tone:'info', text:`${onB ? `${onB} on a break right now` : 'Nobody on a break right now'} · ${inn.length - onB} working${off ? ` · ${off} not clocked in` : ''}.` });
  const order = { bad:0, warn:1, good:2, info:3 };
  return out.sort((a,b) => order[a.tone] - order[b.tone]).slice(0, 7);
}
