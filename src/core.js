// The engine: storage and break maths. Used by both pages.
// Nothing here touches the page. Storage is only touched inside load() and save(),
// so this file imports fine in Node (that is how tests/engine.test.js runs it).
import { CONFIG } from './config.js';
import * as api from './backend/api.js';
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
