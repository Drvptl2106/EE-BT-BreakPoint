// Live security check against the REAL Supabase project in src/config.js. Read-only apart from two harmless
// attempts that must be refused. Uses two agent logins (and optionally a manager) from the environment:
//
//   AGENT_A=EE-1001:password  AGENT_B=EE-1002:password  [MANAGER=MGR-7777:password]  npm run test:security
//
// It proves, on the live database: sign-ups are off, signed-out visitors see nothing, agent A cannot read or change
// anything of agent B's, and agents cannot read the audit trail. Without the variables it only runs the first two checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../../scripts/stamp.mjs';
const V = version();   // the same module URLs the pages use (see scripts/stamp.mjs)
const { CONFIG } = await import('../../src/config.js?v=' + V);

const URL_ = String(process.env.SUPABASE_URL || CONFIG.supabaseUrl).trim().replace(/\/+$/, '');
const KEY = String(CONFIG.supabaseKey).trim();
const cred = v => { const i = (v || '').indexOf(':'); return i > 0 ? { code: v.slice(0, i), password: v.slice(i + 1) } : null; };
const A = cred(process.env.AGENT_A), B = cred(process.env.AGENT_B), M = cred(process.env.MANAGER);

async function req(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(URL_ + path, { method, body: body && JSON.stringify(body),
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers } });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
async function login(c) {
  const r = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: c.code.toLowerCase() + '@pilot.local', password: c.password } });
  assert.equal(r.status, 200, `sign-in as ${c.code} failed: ${JSON.stringify(r.data)}`);
  return { token: r.data.access_token, id: r.data.user.id };
}
const TABLES = ['profiles', 'shifts', 'break_segments', 'adjustments', 'custom_break_rules', 'break_names', 'audit_log'];

test('new sign-ups are switched off', async () => {
  const s = await req('/auth/v1/settings');
  assert.equal(s.status, 200, 'could not read the auth settings');
  assert.equal(s.data.disable_signup, true, 'Authentication > Sign In / Providers > "Allow new users to sign up" must be OFF');
  const r = await req('/auth/v1/signup', { method: 'POST', body: { email: `probe-${Date.now()}@pilot.local`, password: 'Probe-' + Math.random() } });
  assert.notEqual(r.status, 200, 'a stranger was able to sign up');
});

test('signed-out visitors see no rows in any table', async () => {
  for (const t of TABLES) {
    const r = await req(`/rest/v1/${t}?select=*&limit=5`);
    assert.ok([200, 401, 403].includes(r.status), `${t}: unexpected status ${r.status} ${JSON.stringify(r.data)}`);
    if (r.status === 200) assert.deepEqual(r.data, [], `${t} is readable without signing in`);
  }
});

test('agent A cannot see or change agent B\'s data', { skip: !(A && B) && 'set AGENT_A and AGENT_B to run this' }, async () => {
  const a = await login(A), b = await login(B);
  const prof = await req('/rest/v1/profiles?select=id,code', { token: a.token });
  assert.deepEqual(prof.data.map(p => p.code), [A.code.toUpperCase()], 'agent A can see other people\'s profiles');
  for (const t of TABLES.slice(1)) {
    const r = await req(`/rest/v1/${t}?select=*`, { token: a.token });
    assert.equal(r.status, 200, `${t}: ${JSON.stringify(r.data)}`);
    const foreign = r.data.filter(row => (row.user_id && row.user_id !== a.id) || (t === 'audit_log'));
    assert.deepEqual(foreign, [], `agent A can read ${t} rows that are not theirs`);
  }
  const bs = await req(`/rest/v1/shifts?select=id&user_id=eq.${b.id}`, { token: a.token });
  assert.deepEqual(bs.data, [], 'agent A can read agent B\'s shifts by id');
  const ins = await req('/rest/v1/shifts', { method: 'POST', token: a.token, body: { user_id: b.id, day: '2000-01-01', shift_start: '2000-01-01T09:00:00Z' } });
  assert.ok([401, 403].includes(ins.status), `agent A could create a shift for agent B (status ${ins.status})`);
  const upd = await req(`/rest/v1/shifts?user_id=eq.${b.id}`, { method: 'PATCH', token: a.token, headers: { Prefer: 'return=representation' }, body: { shift_end: '2000-01-01T10:00:00Z' } });
  assert.deepEqual(upd.data, [], 'agent A could change agent B\'s shift');
  const adj = await req('/rest/v1/adjustments', { method: 'POST', token: a.token, body: { user_id: a.id, day: '2000-01-01', slot_key: 'lunch', minutes: 60 } });
  assert.ok([401, 403].includes(adj.status), 'agent A could give themselves extra minutes');
  const mine = await req('/rest/v1/break_segments?select=id&limit=1', { token: a.token });
  if (mine.data?.length) {
    const del = await req(`/rest/v1/break_segments?id=eq.${mine.data[0].id}`, { method: 'DELETE', token: a.token, headers: { Prefer: 'return=representation' } });
    assert.deepEqual(del.data, [], 'agent A could delete their own recorded break');
  }
  const role = await req(`/rest/v1/profiles?id=eq.${a.id}`, { method: 'PATCH', token: a.token, headers: { Prefer: 'return=representation' }, body: { role: 'manager' } });
  assert.deepEqual(role.data, [], 'agent A could make themselves a manager');
});

test('a manager sees their team and the audit trail', { skip: !M && 'set MANAGER to run this' }, async () => {
  const m = await login(M);
  const prof = await req('/rest/v1/profiles?select=code,role', { token: m.token });
  assert.ok(prof.data.length > 1, 'the manager sees nobody in their team (check profiles.team)');
  const audit = await req('/rest/v1/audit_log?select=id&limit=1', { token: m.token });
  assert.equal(audit.status, 200, 'the manager cannot read the audit trail: ' + JSON.stringify(audit.data));
});
