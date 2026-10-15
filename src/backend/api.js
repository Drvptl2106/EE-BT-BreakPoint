// Supabase backend for break.track. No library needed: this talks to Supabase's two
// plain web APIs (login + tables) with fetch, so the page security policy only needs
// ONE extra allowed address (connect-src). Nothing here touches the page at import time,
// so core.js still imports fine in Node for the tests.
//
// How it works: the pages keep using one in-memory object (`db`) exactly as they do today.
//   load()    -> hands the pages that object
//   save(db)  -> works out what changed since the last sync and sends only that
//   refresh() -> re-reads the database every refreshSeconds and rebuilds `db`
import { CONFIG } from '../config.js';
import { PILOT_USERS, MANAGER_CODES } from '../pilot.js';

const SKEY = 'bt-sb-session';
const EMAIL_DOMAIN = '@pilot.local';            // code EE-1001  ->  ee-1001@pilot.local
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = ms => new Date(ms).toISOString();
const uuid = () => (globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const blank = () => ({ days: {}, adj: {}, custom: {} });
const emptyRows = () => ({ shifts: new Map(), segs: new Map(), adj: new Map(), custom: new Map() });
const lsGet = k => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? globalThis.localStorage?.removeItem(k) : globalThis.localStorage?.setItem(k, v); } catch {} };

let session = null, profile = null, people = {}, idToCode = {};
let cache = blank(), snapshot = emptyRows(), lastSig = '';
const shiftIds = new Map();                      // "userId|day" -> shifts.id
let busy = false, dirty = false, retry = null, refreshing = null;

/* ---------------- small status banner (only shown when saving fails) ---------------- */
function banner(msg) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('bt-sync');
  if (!msg) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'bt-sync'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#9E1219;color:#fff;padding:10px 16px;border-radius:12px;z-index:50;font:500 14px system-ui,sans-serif';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

/* ---------------- key safety ---------------- */
function keyCheck() {
  const k = CONFIG.supabaseKey || '';
  if (/^sb_secret_|service_role/.test(k)) throw new Error('A SECRET key is in src/config.js. Remove it and use the publishable key (sb_publishable_…).');
  if (!CONFIG.supabaseUrl || !k || k.startsWith('PASTE')) throw new Error('The database key is not set yet. Paste the publishable key into src/config.js.');
}

/* ---------------- http ---------------- */
const httpError = (status, data) => Object.assign(new Error(data?.message || data?.msg || data?.error_description || `Request failed (${status})`), { status });
const netError = e => e.status ? e : Object.assign(new Error("Can't reach the database. Check your connection."), { network: true });
const isAuthErr = e => [400, 401, 403].includes(e.status) || e.setup;

async function authCall(path, body) {
  let res;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, { method: 'POST', headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw netError(e); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, data);
  return data;
}
function setSession(s) {
  session = s ? { access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    user: { id: s.user?.id ?? session?.user?.id } } : null;
  lsSet(SKEY, session ? JSON.stringify(session) : null);
}
async function ensureFresh(force) {
  if (!session) return;
  if (!force && session.expires_at * 1000 - Date.now() > 60000) return;
  refreshing ??= authCall('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then(setSession).finally(() => { refreshing = null; });
  await refreshing;
}
async function call(path, { method = 'GET', body, headers = {} } = {}, retried = false) {
  await ensureFresh();
  let res;
  try {
    res = await fetch(CONFIG.supabaseUrl + path, { method,
      headers: { apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw netError(e); }
  if (res.status === 401 && !retried && session) { await ensureFresh(true); return call(path, { method, body, headers }, true); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw httpError(res.status, data);
  return data;
}

/* ---------------- people (who am I, who can I see) ---------------- */
async function loadPeople() {
  const rows = await call('/rest/v1/profiles?select=id,code,name,role');
  people = {}; idToCode = {};
  rows.forEach(r => { people[r.code] = { id: r.id, name: r.name, role: r.role }; idToCode[r.id] = r.code; });
  const mine = rows.find(r => r.id === session.user.id);
  if (!mine) throw Object.assign(new Error("Your account isn't set up yet. Ask your team lead."), { setup: true });
  profile = { id: mine.id, code: mine.code, name: mine.name, role: mine.role };
  // The pages read these two objects, so we fill them in place instead of replacing them.
  Object.keys(PILOT_USERS).forEach(k => delete PILOT_USERS[k]);
  Object.keys(MANAGER_CODES).forEach(k => delete MANAGER_CODES[k]);
  rows.forEach(r => { (r.role === 'agent' ? PILOT_USERS : MANAGER_CODES)[r.code] = r.name; });
}
export const me = () => profile && { ...profile };

/* ---------------- database rows <-> the page's db shape ---------------- */
function rowsOf(db) {
  const R = emptyRows();
  for (const [day, byCode] of Object.entries(db.days || {})) for (const [code, rec] of Object.entries(byCode)) {
    const p = people[code]; if (!p) continue;
    const sk = p.id + '|' + day;
    R.shifts.set(sk, { user_id: p.id, day, shift_start: iso(rec.shiftStart), shift_end: rec.shiftEnd ? iso(rec.shiftEnd) : null,
      active_slot: rec.active?.slot ?? null, active_started: rec.active ? iso(rec.active.start) : null });
    for (const b of rec.breaks || []) {
      b._id ||= uuid();
      R.segs.set(b._id, { id: b._id, shift_key: sk, slot_key: b.slot, started_at: iso(b.start), ended_at: iso(b.end), flag: b.flag ?? null });
    }
  }
  for (const [day, byCode] of Object.entries(db.adj || {})) for (const [code, slots] of Object.entries(byCode)) {
    const p = people[code]; if (!p) continue;
    for (const [slot, minutes] of Object.entries(slots)) if (minutes) R.adj.set(`${p.id}|${day}|${slot}`, { user_id: p.id, day, slot_key: slot, minutes });
  }
  for (const [code, list] of Object.entries(db.custom || {})) {
    const p = people[code]; if (!p) continue;
    for (const c of list) R.custom.set(`${p.id}|${c.key}`, { user_id: p.id, slot_key: c.key, minutes: c.minutes, scope: c.scope,
      day: c.scope === 'today' ? c.date : null, weekdays: c.scope === 'days' ? c.days : null });
  }
  return R;
}

async function pull() {
  const c = new Date(); c.setDate(c.getDate() - CONFIG.retentionDays); const from = dayKey(c);
  const [shifts, adjs, rules] = await Promise.all([
    call(`/rest/v1/shifts?select=id,user_id,day,shift_start,shift_end,active_slot,active_started,break_segments(id,slot_key,started_at,ended_at,flag)&day=gte.${from}&order=day`),
    call(`/rest/v1/adjustments?select=user_id,day,slot_key,minutes&day=gte.${from}`),
    call('/rest/v1/custom_break_rules?select=user_id,slot_key,minutes,scope,day,weekdays'),
  ]);
  const db = blank();
  shiftIds.clear();
  for (const s of shifts) {
    const code = idToCode[s.user_id]; if (!code) continue;
    shiftIds.set(s.user_id + '|' + s.day, s.id);
    (db.days[s.day] ??= {})[code] = {
      _id: s.id, name: people[code].name, shiftStart: Date.parse(s.shift_start), shiftEnd: s.shift_end ? Date.parse(s.shift_end) : null,
      active: s.active_slot ? { slot: s.active_slot, start: Date.parse(s.active_started) } : null,
      breaks: (s.break_segments || []).map(b => ({ _id: b.id, slot: b.slot_key, start: Date.parse(b.started_at), end: Date.parse(b.ended_at), ...(b.flag ? { flag: b.flag } : {}) }))
        .sort((a, b) => a.start - b.start),
    };
  }
  for (const a of adjs) { const code = idToCode[a.user_id]; if (code) ((db.adj[a.day] ??= {})[code] ??= {})[a.slot_key] = a.minutes; }
  for (const r of rules) {
    const code = idToCode[r.user_id]; if (!code) continue;
    (db.custom[code] ??= []).push({ key: r.slot_key, minutes: r.minutes, scope: r.scope, date: r.day || undefined, days: r.weekdays || [] });
  }
  return { db, rows: rowsOf(db) };
}
async function fullPull() { const n = await pull(); cache = n.db; snapshot = n.rows; lastSig = JSON.stringify(n.db); }

/* ---------------- sending changes ---------------- */
const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
const UP = { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } };
async function pushDiff() {
  const now = rowsOf(cache), old = snapshot;
  // 1. shifts first (breaks hang off them). Ask for the id back, in case the row already existed.
  for (const [k, row] of now.shifts) if (!old.shifts.has(k) || differs(row, old.shifts.get(k))) {
    const out = await call('/rest/v1/shifts?on_conflict=user_id,day&select=id',
      { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: row });
    shiftIds.set(k, out[0].id);
  }
  for (const [k, row] of old.shifts) if (!now.shifts.has(k)) {
    await call(`/rest/v1/shifts?user_id=eq.${row.user_id}&day=eq.${row.day}`, { method: 'DELETE' }); shiftIds.delete(k);
  }
  // 2. break segments
  const segUp = [...now.segs].filter(([id, r]) => !old.segs.has(id) || differs(r, old.segs.get(id)))
    .map(([, r]) => ({ id: r.id, shift_id: shiftIds.get(r.shift_key), slot_key: r.slot_key, started_at: r.started_at, ended_at: r.ended_at, flag: r.flag }));
  if (segUp.some(r => !r.shift_id)) throw new Error('A break has no shift to belong to yet.');
  if (segUp.length) await call('/rest/v1/break_segments?on_conflict=id', { ...UP, body: segUp });
  const segDel = [...old.segs.keys()].filter(id => !now.segs.has(id));
  if (segDel.length) await call(`/rest/v1/break_segments?id=in.(${segDel.join(',')})`, { method: 'DELETE' });
  // 3. adjustments
  const adjUp = [...now.adj].filter(([k, r]) => !old.adj.has(k) || differs(r, old.adj.get(k))).map(([, r]) => r);
  if (adjUp.length) await call('/rest/v1/adjustments?on_conflict=user_id,day,slot_key', { ...UP, body: adjUp });
  for (const [k, r] of old.adj) if (!now.adj.has(k))
    await call(`/rest/v1/adjustments?user_id=eq.${r.user_id}&day=eq.${r.day}&slot_key=eq.${r.slot_key}`, { method: 'DELETE' });
  // 4. custom break rules
  const cuUp = [...now.custom].filter(([k, r]) => !old.custom.has(k) || differs(r, old.custom.get(k))).map(([, r]) => r);
  if (cuUp.length) await call('/rest/v1/custom_break_rules?on_conflict=user_id,slot_key', { ...UP, body: cuUp });
  for (const [k, r] of old.custom) if (!now.custom.has(k))
    await call(`/rest/v1/custom_break_rules?user_id=eq.${r.user_id}&slot_key=eq.${r.slot_key}`, { method: 'DELETE' });
  snapshot = now;
}
async function flush() {
  if (busy) return;
  busy = true; clearTimeout(retry);
  try { while (dirty) { dirty = false; await pushDiff(); } banner(null); }
  catch (e) {
    dirty = true;
    if (e.status === 401 || e.status === 403) banner("You've been signed out. Reload the page and sign in again.");
    else { banner("Couldn't save. Retrying…"); retry = setTimeout(flush, 5000); }
  } finally { busy = false; }
}

/* ---------------- what core.js exposes to the pages ---------------- */
export const load = () => cache;
export function save(db) { cache = db; dirty = true; Promise.resolve().then(flush); }
/** Re-read the database. Returns true if anything changed. Skips while our own changes are still being sent. */
export async function refresh() {
  if (!session || busy || dirty) return false;
  await ensureFresh();
  const n = await pull();
  if (busy || dirty) return false;                // the user changed something while we were reading
  const sig = JSON.stringify(n.db), changed = sig !== lastSig;
  cache = n.db; snapshot = n.rows; lastSig = sig;
  return changed;
}
export async function init() {
  keyCheck();
  const saved = (() => { try { return JSON.parse(lsGet(SKEY)); } catch { return null; } })();
  if (!saved?.refresh_token) return;
  session = saved;
  try { await ensureFresh(); await loadPeople(); await fullPull(); }
  catch (e) { if (isAuthErr(e)) { setSession(null); profile = null; } else throw e; }
}
export async function signIn(code, password) {
  keyCheck();
  try {
    setSession(await authCall('/auth/v1/token?grant_type=password', { email: code.trim().toLowerCase() + EMAIL_DOMAIN, password }));
  } catch (e) {
    if (e.status === 400 || e.status === 401) throw new Error('That code or password is not right.');
    throw e;
  }
  try { await loadPeople(); await fullPull(); } catch (e) { await signOut(); throw e; }
  return me();
}
export async function signOut() {
  const token = session?.access_token;
  setSession(null); profile = null; people = {}; idToCode = {}; cache = blank(); snapshot = emptyRows(); lastSig = ''; dirty = false;
  Object.keys(PILOT_USERS).forEach(k => delete PILOT_USERS[k]);
  Object.keys(MANAGER_CODES).forEach(k => delete MANAGER_CODES[k]);
  if (token) { try { await fetch(CONFIG.supabaseUrl + '/auth/v1/logout', { method: 'POST', headers: { apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + token } }); } catch {} }
}
