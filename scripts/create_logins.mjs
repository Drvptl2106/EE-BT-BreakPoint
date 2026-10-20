#!/usr/bin/env node
// One-time set-up: creates a Supabase login AND a profile for every person in a list, each with its own random password.
// Replaces the old db/create_pilot_logins.sql (and any fix_pilot_logins.sql): no clicking in the dashboard, no shared passwords.
//
//   1. Copy db/people.example.csv to people.csv (in the repo root; git ignores it) and fill in one line per person:
//        code,name,role            role is agent or manager (empty = agent). First names only.
//   2. Get the SECRET key: Supabase > Project Settings > API Keys > Secret keys (starts sb_secret_). Never commit it,
//      never paste it into src/config.js. It only lives in your terminal for this one command.
//   3. Run (Node 18 or newer):
//        SUPABASE_SECRET_KEY=sb_secret_... node scripts/create_logins.mjs people.csv
//      Add --dry-run to only check the list. Add --reset-passwords to give people who already have a login a NEW password.
//   4. It writes logins-<date>.csv (code, name, role, password). Hand each person their own line, privately,
//      then DELETE the file. git ignores it, but do not keep it.
//
// The project address is read from src/config.js (override with SUPABASE_URL=...).
// Safe to run again: existing logins keep their password (unless --reset-passwords) and their profile is updated.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { CONFIG } from '../src/config.js';

const args = process.argv.slice(2), flag = f => args.includes(f), file = args.find(a => !a.startsWith('--'));
const DRY = flag('--dry-run'), RESET = flag('--reset-passwords');
const URL_ = String(process.env.SUPABASE_URL || CONFIG.supabaseUrl).trim().replace(/\/+$/, '');
const KEY = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s/g, '');
const EMAIL_DOMAIN = '@pilot.local';                      // must match src/backend/api.js
const die = msg => { console.error('\n✗ ' + msg + '\n'); process.exit(1); };

/* ---------- the list ---------- */
export function parsePeople(text) {
  const out = [], seen = new Set();
  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.replace(/#.*/, '').trim(); if (!raw) return;
    const [code = '', name = '', role = ''] = raw.split(',').map(s => s.trim());
    if (/^code$/i.test(code)) return;                     // header row
    const c = code.toUpperCase(), r = (role || 'agent').toLowerCase(), where = `line ${i + 1}`;
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(c)) throw new Error(`${where}: "${code}" is not a valid code (letters, digits and dashes only).`);
    if (!name || name.length > 40) throw new Error(`${where}: a first name is needed (at most 40 characters).`);
    if (!['agent', 'manager'].includes(r)) throw new Error(`${where}: role must be agent or manager, not "${role}".`);
    if (seen.has(c)) throw new Error(`${where}: ${c} is in the list twice.`);
    seen.add(c); out.push({ code: c, name, role: r, email: c.toLowerCase() + EMAIL_DOMAIN });
  });
  return out;
}
/* ---------- passwords: 12 random characters out of 51 that can't be mistaken for each other (about 68 bits) ---------- */
const ALPHA = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY2346789';
export const newPassword = () => Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join('')).join('-');

/* ---------- Supabase admin calls ---------- */
async function admin(path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) };
  if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY;    // legacy service_role key
  let res;
  try { res = await fetch(URL_ + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new Error(`Can't reach ${URL_} (${e.cause?.code || e.message}). Check the address and your connection.`); }
  const text = await res.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) throw Object.assign(new Error(data?.msg || data?.message || data?.error_description || `HTTP ${res.status}`), { status: res.status, code: data?.code || data?.error_code });
  return data;
}
async function allUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page++) {
    const d = await admin(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    (d.users || []).forEach(u => byEmail.set(String(u.email).toLowerCase(), u));
    if ((d.users || []).length < 1000) return byEmail;
  }
}

async function main() {
  if (!file) die('Say which list to read: node scripts/create_logins.mjs people.csv   (see db/people.example.csv)');
  let people; try { people = parsePeople(readFileSync(file, 'utf8')); } catch (e) { die(e.code === 'ENOENT' ? `No file called ${file}.` : e.message); }
  if (!people.length) die(`${file} has nobody in it.`);
  console.log(`${people.length} people in ${file}: ${people.filter(p => p.role === 'agent').length} agents, ${people.filter(p => p.role === 'manager').length} managers.`);
  if (!people.some(p => p.role === 'manager')) console.log('  Note: nobody in the list is a manager, so nobody will be able to use the manager page.');
  if (DRY) { people.forEach(p => console.log(`  ${p.code.padEnd(12)} ${p.name.padEnd(16)} ${p.role}   -> ${p.email}`)); console.log('\nDry run: nothing was changed.'); return; }

  if (!KEY) die('Set SUPABASE_SECRET_KEY to the project\'s secret key (Supabase > Project Settings > API Keys > Secret keys).');
  if (KEY.startsWith('sb_publishable_')) die('That is the PUBLISHABLE key. This script needs the SECRET key (starts sb_secret_).');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(URL_)) die(`The project address "${URL_}" doesn't look right.`);
  console.log(`Project: ${URL_}`);

  try { await admin('/rest/v1/profiles?select=id&limit=1'); }
  catch (e) {
    if (e.status === 401 || e.status === 403) die(`The secret key was refused by ${URL_}. Is it the key for THIS project?`);
    if (e.status === 404 || e.code === 'PGRST205' || e.code === '42P01') die(`There is no profiles table on ${URL_}. Run db/schema.sql in this project's SQL editor first.`);
    die(e.message);
  }
  const existing = await allUsers().catch(e => die(`Couldn't list the existing logins: ${e.message}`)), fresh = [], problems = [];
  let ok = 0;
  for (const p of people) {
    let user = existing.get(p.email);
    try {
      if (!user) {
        const password = newPassword();
        user = await admin('/auth/v1/admin/users', { method: 'POST', body: { email: p.email, password, email_confirm: true, user_metadata: { code: p.code } } });
        user = user.user || user; fresh.push({ ...p, password });      // recorded at once, so a later failure never loses it
        console.log(`  + ${p.code}  new login`);
      } else if (RESET) {
        const password = newPassword();
        await admin(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: { password, email_confirm: true } });
        fresh.push({ ...p, password });
        console.log(`  ~ ${p.code}  new password`);
      } else {
        if (!user.email_confirmed_at) await admin(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: { email_confirm: true } });
        console.log(`  = ${p.code}  login already exists, password unchanged`);
      }
      await admin('/rest/v1/profiles?on_conflict=id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: { id: user.id, code: p.code, name: p.name, role: p.role } });
      ok++;
    } catch (e) {
      problems.push(`${p.code}: ${e.code === '23505' ? 'that code already belongs to a different login (check the profiles table)' : e.message}`);
    }
  }
  if (fresh.length) {
    const name = `logins-${new Date().toISOString().slice(0, 10)}-${Date.now() % 100000}.csv`;
    writeFileSync(name, 'code,name,role,password\n' + fresh.map(p => [p.code, p.name, p.role, p.password].join(',')).join('\n') + '\n', { mode: 0o600 });
    console.log(`\n✓ ${fresh.length} password(s) written to ${name}. Give each person ONLY their own line, then delete the file.`);
  } else console.log('\n✓ No new passwords (everyone already had a login). Use --reset-passwords to issue new ones.');
  console.log(`✓ ${ok} profile(s) set up.`);
  if (problems.length) { console.error('\n✗ Problems:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log('\nNext: check Authentication > Sign In / Providers > "Allow new users to sign up" is OFF (see docs/DATABASE.md).');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
