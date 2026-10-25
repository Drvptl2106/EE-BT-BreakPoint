// Supabase backend for breakpoint. No library needed: this talks to Supabase's two
// plain web APIs (login + tables) with fetch, so the page security policy only needs
// ONE extra allowed address (connect-src). Nothing here touches the page at import time,
// so core.js still imports fine in Node for the tests.
//
// How it works: the pages keep using one in-memory object (`db`) exactly as they do today.
//   load()    -> hands the pages that object
//   save(db)  -> works out what changed since the last sync and sends only that
//   refresh() -> re-reads the database every refreshSeconds and rebuilds `db`
//
// Every failure is turned into a sentence that says WHAT is wrong and WHERE to fix it (see explain()),
// so "wrong password" only ever means a wrong code or password.
import { CONFIG } from '../config.js?v=f1a49e4a85';
import { PILOT_USERS, MANAGER_CODES } from '../pilot.js?v=f1a49e4a85';

const EMAIL_DOMAIN = '@pilot.local';            // code EE-1001  ->  ee-1001@pilot.local (same as scripts/create_logins.mjs)
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = ms => new Date(ms).toISOString();
const uuid = () => (globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const blank = () => ({ days: {}, adj: {}, custom: {}, names: {} });
const emptyRows = () => ({ shifts: new Map(), segs: new Map(), adj: new Map(), custom: new Map(), names: new Map() });
const lsGet = k => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? globalThis.localStorage?.removeItem(k) : globalThis.localStorage?.setItem(k, v); } catch {} };

/* ---------------- settings, tidied ----------------
   Keys and URLs pasted from the Supabase dashboard often carry a space, a line break, quotes or an invisible
   character. Strip all of that, and the trailing slash, so a paste that LOOKS right also IS right. */
const tidyPaste = v => String(v ?? '').replace(/[\s​-‍⁠﻿'"`]/g, '');
export const settings = () => {
  const url = tidyPaste(CONFIG.supabaseUrl).replace(/\/+$/, ''), key = tidyPaste(CONFIG.supabaseKey);
  return { url, key, host: url.replace(/^https?:\/\//, ''), ref: (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/) || [])[1] || '' };
};
// The saved login belongs to ONE project, so a login from an old project is never sent to a new one.
const skey = () => 'bt-sb-session:' + (settings().ref || settings().host);

let session = null, profile = null, people = {}, idToCode = {};
let cache = blank(), snapshot = emptyRows(), lastSig = '';
const shiftIds = new Map();                      // "userId|day" -> shifts.id
let busy = false, dirty = false, retry = null, refreshing = null;
let offset = 0, clockAt = 0;                      // database clock minus this device's clock, in ms

/* ---------------- one clock for everyone ----------------
   Asks the database for its time (every few minutes) so every screen shows the same time and a phone that is
   a few minutes out cannot make a break look shorter. Half the round trip is allowed for the network. */
export const clockOffset = () => offset;
async function syncClock(force) {
  if (!force && Date.now() - clockAt < 5 * 60000) return;
  try {
    const t0 = Date.now(), t = await call('/rest/v1/rpc/server_time', { method: 'POST', body: {} }), t1 = Date.now();
    const ms = Date.parse(t); if (Number.isFinite(ms) && t1 - t0 < 5000) { offset = ms - (t0 + t1) / 2; clockAt = t1; }
  } catch {}                                        // an older database without server_time(): keep the device clock
}

/* ---------------- small status banner (only shown when saving fails) ---------------- */
function banner(msg) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('bt-sync');
  if (!msg) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'bt-sync'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:calc(100% - 32px);background:#9E1219;color:#fff;padding:10px 16px;border-radius:12px;z-index:50;font:500 14px system-ui,sans-serif';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

/* ---------------- set-up checks (run before anything is sent) ---------------- */
const setupError = msg => Object.assign(new Error(msg), { setup: true });
export function checkSetup(doc = globalThis.document) {
  const { url, key, host } = settings();
  if (/^sb_secret_|service_role/.test(key) || /^eyJ/.test(key) && /service_role/.test(atobSafe(key.split('.')[1])))
    throw setupError('A SECRET key is in src/config.js. Remove it now and use the publishable key (starts sb_publishable_).');
  if (!url || /PASTE/i.test(url)) throw setupError('The database address is not set. Put the Project URL into supabaseUrl in src/config.js.');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(url)) throw setupError(`The database address in src/config.js doesn't look right ("${url}"). It should look like https://abcd1234.supabase.co`);
  if (!key || /PASTE/i.test(key)) throw setupError('The database key is not set. Paste the publishable key (starts sb_publishable_) into supabaseKey in src/config.js.');
  // The page's security line must allow the same address, or the browser blocks every request without saying why.
  const csp = doc?.querySelector?.('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content');
  if (csp) {
    const connect = (csp.split(';').map(s => s.trim()).find(s => s.startsWith('connect-src')) || '').split(/\s+/).slice(1);
    if (!connect.some(src => src === url || src === url + '/' || src === 'https:' || src === '*'))
      throw setupError(`This page's security line doesn't allow the database address. In the .html file, change connect-src to include ${url} (it currently allows: ${connect.join(' ') || 'nothing'}).`);
  }
  return { url, key, host };
}
function atobSafe(s) { try { return globalThis.atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } }

/* ---------------- turning failures into plain sentences ---------------- */
export function explain(status, data, where = 'data') {
  const msg = String(data?.message || data?.msg || data?.error_description || data?.error || '');
  const code = String(data?.code || data?.error_code || '');
  const { host } = settings();
  if (/invalid api key|no api key|api key.*(invalid|not found)|unregistered api key/i.test(msg) || code === 'invalid_api_key')
    return `The database rejected the key in src/config.js. Copy the publishable key for ${host} again (Supabase > Project Settings > API Keys).`;
  if (where === 'login') {
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'That code or password is not right.';
    if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return "This login hasn't been confirmed yet. Ask your team lead to run the login script again.";
    if (code === 'user_banned') return 'This login has been switched off. Ask your team lead.';
    if (status === 429 || /rate limit/i.test(msg)) return 'Too many sign-in attempts. Wait a minute and try again.';
    if (/refresh token/i.test(msg) || code.startsWith('refresh_token')) return 'You were signed out. Sign in again.';
  }
  if (code === 'P0001' && msg) return msg;                // our own rule messages from db/schema.sql are already plain English
  if (code === 'weak_password' || /password should|weak password/i.test(msg)) return 'That password is too weak. Use at least 8 characters, mixing letters and numbers.';
  if (code === 'same_password') return "That's your current password. Pick a new one.";
  if (/no running break/i.test(msg)) return 'That break was already closed on another screen. Showing the latest.';
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' || /could not find the (table|function)|relation .* does not exist|schema cache/i.test(msg))
    return `The database on ${host} isn't set up (or is an older version). Run db/schema.sql in that project's SQL editor.`;
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return "You don't have permission to change that.";
  if (code === '23514' || /violates check constraint/i.test(msg)) return "That value isn't allowed (for example a break name that is too long, or a time that ends before it starts).";
  if (status === 401 || status === 403 || code === 'PGRST301' || /jwt/i.test(msg)) return "You've been signed out. Reload the page and sign in again.";
  if (status >= 500) return `The database on ${host} isn't answering properly (error ${status}). If the project is paused, restore it in Supabase; otherwise try again in a minute.`;
  return msg ? `The database said: ${msg}` : `Request failed (${status}).`;
}

/* ---------------- http ---------------- */
const httpError = (status, data, where) => Object.assign(new Error(explain(status, data, where)), { status, code: data?.code || data?.error_code, raw: data });
const netError = e => e.status ? e : Object.assign(new Error(`Can't reach the database at ${settings().host}. Check your internet connection. ` +
  'If other sites work, the address in src/config.js may be wrong, or the page security line (connect-src in the .html file) may not allow it.'), { network: true });
const isAuthErr = e => [400, 401, 403].includes(e.status);
const parse = text => { try { return text ? JSON.parse(text) : null; } catch { return { message: text.slice(0, 200) }; } };

async function authCall(path, body, where = 'login') {
  const { url, key } = checkSetup();
  let res;
  try {
    res = await fetch(url + path, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw netError(e); }
  const data = parse(await res.text());
  if (!res.ok) throw httpError(res.status, data, where);
  return data;
}
function setSession(s) {
  session = s ? { access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    user: { id: s.user?.id ?? session?.user?.id } } : null;
  lsSet(skey(), session ? JSON.stringify(session) : null);
}
async function ensureFresh(force) {
  if (!session) return;
  if (!force && session.expires_at * 1000 - Date.now() > 60000) return;
  refreshing ??= authCall('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token }, 'refresh')
    .then(setSession).finally(() => { refreshing = null; });
  await refreshing;
}
async function call(path, { method = 'GET', body, headers = {} } = {}, retried = false) {
  const { url, key } = checkSetup();
  await ensureFresh();
  let res;
  try {
    res = await fetch(url + path, { method,
      headers: { apikey: key, 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw netError(e); }
  if (res.status === 401 && !retried && session) { await ensureFresh(true); return call(path, { method, body, headers }, true); }
  const data = parse(await res.text());
  if (!res.ok) throw httpError(res.status, data);
  return data;
}

/* ---------------- people (who am I, who can I see) ---------------- */
async function loadPeople() {
  const rows = await call('/rest/v1/profiles?select=id,code,name,role');
  people = {}; idToCode = {};
  rows.forEach(r => { people[r.code] = { id: r.id, name: r.name, role: r.role }; idToCode[r.id] = r.code; });
  const mine = rows.find(r => r.id === session.user.id);
  if (!mine) throw setupError(`Your login works, but it has no profile on ${settings().host}. Ask your team lead to run the login script for your code.`);
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
  for (const [code, slots] of Object.entries(db.names || {})) {
    const p = people[code]; if (!p) continue;
    for (const [slot, label] of Object.entries(slots)) if (label) R.names.set(`${p.id}|${slot}`, { user_id: p.id, slot_key: slot, label });
  }
  return R;
}

async function pull() {
  const c = new Date(); c.setDate(c.getDate() - CONFIG.retentionDays); const from = dayKey(c);
  const [shifts, adjs, rules, names] = await Promise.all([
    call(`/rest/v1/shifts?select=id,user_id,day,shift_start,shift_end,active_slot,active_started,break_segments(id,slot_key,started_at,ended_at,flag)&day=gte.${from}&order=day`),
    call(`/rest/v1/adjustments?select=user_id,day,slot_key,minutes&day=gte.${from}`),
    call('/rest/v1/custom_break_rules?select=user_id,slot_key,minutes,scope,day,weekdays'),
    call('/rest/v1/break_names?select=user_id,slot_key,label'),
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
  for (const n of names) { const code = idToCode[n.user_id]; if (code) (db.names[code] ??= {})[n.slot_key] = n.label; }
  return { db, rows: rowsOf(db) };
}
async function fullPull() { await syncClock(true); const n = await pull(); cache = n.db; snapshot = n.rows; lastSig = JSON.stringify(n.db); }

/* ---------------- sending changes ---------------- */
const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
const changedFields = (row, was) => Object.fromEntries(Object.entries(row).filter(([k, v]) => differs(v, was[k])));
const UP = { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } };
async function upsertAndDelete(table, conflict, now, old, keyCols) {
  const up = [...now].filter(([k, r]) => !old.has(k) || differs(r, old.get(k))).map(([, r]) => r);
  if (up.length) await call(`/rest/v1/${table}?on_conflict=${conflict}`, { ...UP, body: up });
  for (const [k, r] of old) if (!now.has(k))
    await call(`/rest/v1/${table}?${keyCols.map(c => `${c}=eq.${encodeURIComponent(r[c])}`).join('&')}`, { method: 'DELETE' });
}
async function pushDiff() {
  const now = rowsOf(cache), old = snapshot;
  // The ORDER matters: the database stamps a break with its own clock when it is closed, using the shift's running
  // break, so new breaks are sent BEFORE the shift that says "no break running any more".
  // 1. new shifts (breaks hang off them)
  const created = new Set();
  for (const [k, row] of now.shifts) if (!old.shifts.has(k) && !shiftIds.has(k)) {
    created.add(k);
    const out = await call('/rest/v1/shifts?on_conflict=user_id,day&select=id',
      { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: row });
    shiftIds.set(k, out[0].id);
  }
  // 2. break segments: new ones are inserted (agents may only add), changed ones updated (managers), removed ones deleted (managers)
  const seg = r => ({ id: r.id, shift_id: shiftIds.get(r.shift_key), slot_key: r.slot_key, started_at: r.started_at, ended_at: r.ended_at, flag: r.flag });
  const segNew = [...now.segs].filter(([id]) => !old.segs.has(id)).map(([, r]) => seg(r));
  const segChanged = [...now.segs].filter(([id, r]) => old.segs.has(id) && differs(r, old.segs.get(id))).map(([, r]) => seg(r));
  if ([...segNew, ...segChanged].some(r => !r.shift_id)) throw new Error('A break has no shift to belong to yet.');
  if (segNew.length) await call('/rest/v1/break_segments', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: segNew });
  if (segChanged.length) await call('/rest/v1/break_segments?on_conflict=id', { ...UP, body: segChanged });
  const segDel = [...old.segs.keys()].filter(id => !now.segs.has(id));
  if (segDel.length) await call(`/rest/v1/break_segments?id=in.(${segDel.join(',')})`, { method: 'DELETE' });
  // 3. shifts we already know are PATCHED with only the fields that changed, so a manager editing the shift times
  //    never overwrites the break the agent has just started (and vice versa).
  for (const [k, row] of now.shifts) {
    const was = old.shifts.get(k), id = shiftIds.get(k);
    if (!id || created.has(k)) continue;
    const patch = was ? changedFields(row, was) : row;   // a shift the database has but this screen hadn't seen yet
    if (Object.keys(patch).length) await call(`/rest/v1/shifts?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: patch });
  }
  for (const [k, row] of old.shifts) if (!now.shifts.has(k)) {
    await call(`/rest/v1/shifts?user_id=eq.${row.user_id}&day=eq.${row.day}`, { method: 'DELETE' }); shiftIds.delete(k);
  }
  // 4-6. allowances, custom breaks, break names
  await upsertAndDelete('adjustments', 'user_id,day,slot_key', now.adj, old.adj, ['user_id', 'day', 'slot_key']);
  await upsertAndDelete('custom_break_rules', 'user_id,slot_key', now.custom, old.custom, ['user_id', 'slot_key']);
  await upsertAndDelete('break_names', 'user_id,slot_key', now.names, old.names, ['user_id', 'slot_key']);
  snapshot = now;
}
async function flush() {
  if (busy) return;
  busy = true; clearTimeout(retry);
  try { while (dirty) { dirty = false; await pushDiff(); } banner(null); }
  catch (e) {
    const refused = e.code === '42501' || e.code === '23514' || e.code === '23503' || e.status === 400;
    if (!refused && (e.status === 401 || e.status === 403)) { dirty = true; banner("You've been signed out. Reload the page and sign in again."); }
    else if (refused) {
      // The database refused the change itself (not a connection problem): retrying would fail forever.
      // Say why, drop the change and show what is really stored.
      banner("Couldn't save: " + e.message);
      try { await fullPull(); } catch {}
      setTimeout(() => banner(null), 8000);
    }
    else { dirty = true; banner("Couldn't save. Retrying… (" + e.message + ')'); retry = setTimeout(flush, 5000); }
  } finally { busy = false; }
}

/* ---------------- what core.js exposes to the pages ---------------- */
export const load = () => cache;
export function save(db) { cache = db; dirty = true; Promise.resolve().then(flush); }
/** Re-read the database. Returns true if anything changed. Skips while our own changes are still being sent. */
export async function refresh() {
  if (!session || busy || dirty) return false;
  await ensureFresh(); await syncClock();
  const n = await pull();
  if (busy || dirty) return false;                // the user changed something while we were reading
  const sig = JSON.stringify(n.db), changed = sig !== lastSig;
  cache = n.db; snapshot = n.rows; lastSig = sig;
  return changed;
}
/** Managers: the audit trail for one person (newest first), optionally for one day. */
export async function history(code, day) {
  const p = people[code]; if (!p) return [];
  const rows = await call(`/rest/v1/audit_log?select=at,actor_id,action,slot_key,day,before_value,after_value&target_id=eq.${p.id}` +
    (day ? `&or=(day.eq.${day},day.is.null)` : '') + '&order=at.desc&limit=200');
  return rows.map(r => ({ ...r, actor: idToCode[r.actor_id] ? people[idToCode[r.actor_id]].name : 'another manager' }));
}
/** Breakathon scores for the signed-in person's team between two days. Agents get names and points only. */
export async function breakathon(from, to) {
  const rows = await call('/rest/v1/rpc/breakathon', { method: 'POST', body: { p_from: from, p_to: to } });
  return rows.map(r => ({ code: r.code, name: r.name, breaks: r.breaks, onTime: r.on_time, cleanDays: r.clean_days, overMinutes: r.over_minutes, points: r.points, colour: r.colour, accessory: r.accessory }));
}
/* Mascots and prizes. The database checks every rule (claim once, only the champion, only wear what you unlocked). */
const rpc = (fn, body = {}) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body });
export const myRewards = () => rpc('my_rewards');
export const claimReward = (choice, item) => rpc('claim_reward', { p_choice: choice, p_item: item ?? null });
export const setLook = (colour, accessory) => rpc('set_look', { p_colour: colour, p_accessory: accessory });
/** Managers: everyone's look { code: { colour, accessory } } and what each person picked for a week { code: { choice, item } }. */
export async function teamLooks() {
  const out = {}; (await call('/rest/v1/avatars?select=user_id,colour,accessory')).forEach(a => { if (idToCode[a.user_id]) out[idToCode[a.user_id]] = { colour: a.colour, accessory: a.accessory }; });
  return out;
}
export async function teamRewards(week) {
  const out = {}; (await call(`/rest/v1/rewards?select=user_id,choice,item&week=eq.${week}`)).forEach(a => { if (idToCode[a.user_id]) out[idToCode[a.user_id]] = { choice: a.choice, item: a.item }; });
  return out;
}
/** Change the signed-in person's password. */
export async function changePassword(password) {
  const pw = String(password ?? '');
  if (pw.length < 8) throw new Error('Use at least 8 characters.');
  if (/^(user|manager)\d+$/i.test(pw)) throw new Error("That's the simple trial pattern. Pick something only you know.");
  await ensureFresh();
  const { url, key } = checkSetup();
  let res;
  try { res = await fetch(url + '/auth/v1/user', { method: 'PUT', headers: { apikey: key, 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ password: pw }) }); }
  catch (e) { throw netError(e); }
  const data = parse(await res.text());
  if (!res.ok) throw httpError(res.status, data, 'login');
}
export async function init() {
  checkSetup();
  const saved = (() => { try { return JSON.parse(lsGet(skey())); } catch { return null; } })();
  if (!saved?.refresh_token) return;
  session = saved;
  try { await ensureFresh(); await loadPeople(); await fullPull(); }
  catch (e) {
    if (isAuthErr(e) || e.setup) { setSession(null); profile = null; }
    if (e.setup || !isAuthErr(e)) throw e;          // an expired login just shows the sign-in box; anything else says why
  }
}
export async function signIn(code, password) {
  checkSetup();
  const c = String(code ?? '').trim().toLowerCase(), pw = String(password ?? '').trim();
  if (!c || !pw) throw new Error('Enter your code and your password.');
  setSession(await authCall('/auth/v1/token?grant_type=password', { email: c + EMAIL_DOMAIN, password: pw }));
  try { await loadPeople(); await fullPull(); } catch (e) { await signOut(); throw e; }
  return me();
}
export async function signOut() {
  const token = session?.access_token, { url, key } = settings();
  setSession(null); profile = null; people = {}; idToCode = {}; cache = blank(); snapshot = emptyRows(); lastSig = ''; dirty = false; offset = 0; clockAt = 0;
  Object.keys(PILOT_USERS).forEach(k => delete PILOT_USERS[k]);
  Object.keys(MANAGER_CODES).forEach(k => delete MANAGER_CODES[k]);
  if (token) { try { await fetch(url + '/auth/v1/logout', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + token } }); } catch {} }
}
