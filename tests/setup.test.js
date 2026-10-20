// Guards against the set-up mistakes that make the app say "can't connect" or "wrong password" for the wrong reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CONFIG } from '../src/config.js';
import { settings, checkSetup, explain } from '../src/backend/api.js';
import { parsePeople, newPassword } from '../scripts/create_logins.mjs';

const PAGES = ['index.html', 'manager.html'];
const cspOf = html => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const fakeDoc = html => ({ querySelector: () => ({ getAttribute: () => cspOf(html) }) });
const withConfig = (patch, fn) => { const keep = { ...CONFIG }; Object.assign(CONFIG, patch); try { return fn(); } finally { Object.assign(CONFIG, keep); } };

test('every page\'s security line allows the database address in src/config.js', () => {
  for (const p of PAGES) {
    const csp = cspOf(readFileSync(p, 'utf8'));
    assert.ok(csp.includes(settings().url), `${p}: connect-src does not allow ${settings().url}`);
    assert.doesNotThrow(() => checkSetup(fakeDoc(readFileSync(p, 'utf8'))), p);
  }
});

test('a page that allows a different (old) project is caught with a clear message', () => {
  const html = readFileSync('index.html', 'utf8').replace(settings().url, 'https://cintsnddjtehyhwdlddn.supabase.co');
  assert.throws(() => checkSetup(fakeDoc(html)), /security line doesn't allow the database address/);
});

test('the database is switched on and no secret key is in the config', () => {
  assert.equal(CONFIG.backend, 'api');
  assert.match(settings().key, /^sb_publishable_/);
  assert.ok(!/sb_secret_[\w-]{6,}|eyJ[\w-]{20,}/.test(readFileSync('src/config.js', 'utf8')), 'a secret key value is in src/config.js');
});

test('pasted keys and addresses are tidied (spaces, line breaks, quotes, invisible characters, trailing slash)', () => {
  withConfig({ supabaseUrl: ' https://abcd1234.supabase.co/ \n', supabaseKey: '​"sb_publishable_abc\n "' }, () => {
    assert.deepEqual(settings(), { url: 'https://abcd1234.supabase.co', key: 'sb_publishable_abc', host: 'abcd1234.supabase.co', ref: 'abcd1234' });
  });
});

test('a secret key in the config stops the app', () => {
  withConfig({ supabaseKey: 'sb_secret_abc' }, () => assert.throws(() => checkSetup(), /SECRET key/));
});

test('error messages say what is wrong, and only a real bad password says "not right"', () => {
  assert.equal(explain(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }, 'login'), 'That code or password is not right.');
  assert.equal(explain(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 'login'), 'That code or password is not right.');
  assert.match(explain(401, { message: 'Invalid API key' }, 'login'), /rejected the key/);
  assert.match(explain(400, { error_code: 'email_not_confirmed' }, 'login'), /confirmed/);
  assert.match(explain(429, { error_code: 'over_request_rate_limit' }, 'login'), /Too many/);
  assert.match(explain(404, { code: 'PGRST205', message: "Could not find the table 'public.profiles' in the schema cache" }), /Run db\/schema\.sql/);
  assert.match(explain(403, { code: '42501', message: 'new row violates row-level security policy' }), /permission/);
  assert.match(explain(503, {}), /isn't answering/);
});

test('login list: codes, names and roles are checked', () => {
  const p = parsePeople('# comment\ncode,name,role\nee-1001, Alex ,\nMGR-1,Lead,manager\n\n');
  assert.deepEqual(p.map(x => [x.code, x.name, x.role, x.email]), [['EE-1001', 'Alex', 'agent', 'ee-1001@pilot.local'], ['MGR-1', 'Lead', 'manager', 'mgr-1@pilot.local']]);
  assert.throws(() => parsePeople('EE-1,A\nee-1,B'), /twice/);
  assert.throws(() => parsePeople('EE-1,A,boss'), /role/);
  assert.throws(() => parsePeople('EE 1,A'), /not a valid code/);
  assert.throws(() => parsePeople('EE-1,'), /first name/);
});

test('login passwords are random, unique and easy to read out', () => {
  const all = new Set(Array.from({ length: 500 }, newPassword));
  assert.equal(all.size, 500);
  for (const pw of all) assert.match(pw, /^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);  // 12 of 51 characters: about 68 bits
  assert.ok(![...all].join('').match(/[01ilIoOS5BZ]/), 'look-alike characters are left out');
});

test('Breakathon is fully removed', () => {
  assert.ok(!existsSync('breakathon.html') && !existsSync('src/pages/breakathon.js'));
  for (const f of [...PAGES, 'src/core.js', 'src/config.js', 'src/pages/user.js', 'src/pages/manager.js', 'README.md', 'docs/ARCHITECTURE.md', 'docs/DATABASE.md'])
    assert.ok(!/breakathon|leaderboard|score\(|punctuality/i.test(readFileSync(f, 'utf8')), f);
  assert.ok(!/create\s+(or\s+replace\s+)?(function|table)\s+(if\s+not\s+exists\s+)?(leaderboard|day_results)\b/i.test(readFileSync('db/schema.sql', 'utf8')), 'the schema must only DROP the old Breakathon parts');
});

test('secrets and the generated password files are ignored by git', () => {
  const gi = readFileSync('.gitignore', 'utf8');
  for (const f of ['.env', 'people.csv', 'logins-*.csv']) assert.ok(gi.split('\n').includes(f), f);
});
