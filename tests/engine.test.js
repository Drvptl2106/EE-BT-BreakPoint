import test from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../scripts/stamp.mjs';
const V = version();   // the same module URLs the pages use (see scripts/stamp.mjs)
const { CONFIG } = await import('../src/config.js?v=' + V);
const { plan, slotsFor, labelFor, cleanName, dayKey, weekScore, weekOf, statusOf, teamPulse, FILTERS } = await import('../src/core.js?v=' + V);

const MIN = 60000, NOW = new Date(2026, 9, 14, 15, 0).getTime();   // Wed 14 Oct 2026, 15:00 local
const TODAY = dayKey(new Date(NOW));
const rec = (...breaks) => ({ breaks: breaks.map(([slot, startMin, lenMin]) => ({ slot, start: NOW - 8 * 60 * MIN + startMin * MIN, end: NOW - 8 * 60 * MIN + (startMin + lenMin) * MIN })), active: null });
const base = () => ({ days: {}, adj: {}, custom: {}, names: {} });
const P = (r, adj = {}, slots = CONFIG.defaultSlots) => plan(r, adj, NOW, slots);

test('config: the allowance is 15 + 15 + 30 and there are five neutral custom labels', () => {
  assert.deepEqual(CONFIG.defaultSlots.map(s => s.minutes), [15, 15, 30]);
  assert.deepEqual(Object.keys(CONFIG.customLabels), ['c1', 'c2', 'c3', 'c4', 'c5']);
});

test('config: there is no reason field anywhere', () => {
  assert.ok(!/reason/i.test(JSON.stringify(CONFIG)));
});

test('a part-used break stays open and can be resumed', () => {
  const [b1] = P(rec(['break1', 0, 5]));
  assert.equal(b1.left, 10 * 60); assert.equal(b1.done, false); assert.equal(b1.over, 0);
});

test('two sittings add up, and the slot only closes when all minutes are used', () => {
  const [b1] = P(rec(['break1', 0, 5], ['break1', 60, 10]));
  assert.equal(b1.used, 15 * 60); assert.equal(b1.done, true);
});

test('17 minutes on a 15 minute break: 2 minutes come off the next break', () => {
  const p = P(rec(['break1', 0, 17]));
  assert.equal(p[0].over, 2 * 60);
  assert.equal(p[1].allowed, 13); assert.equal(p[1].deducted, 2);
  assert.equal(p[2].allowed, 30);
});

test('an overrun bigger than the next break keeps rolling forward', () => {
  const p = P(rec(['break1', 0, 60]));                  // 45 over
  assert.equal(p[1].allowed, 0); assert.equal(p[2].allowed, 0);
});

test('a few seconds over is forgiven (overToleranceMinutes)', () => {
  const r = { breaks: [{ slot: 'break1', start: NOW - 3600000, end: NOW - 3600000 + 15 * MIN + 10000 }], active: null };
  assert.equal(P(r)[0].over, 0);
});

test('a manager adjustment changes only that slot and shows as base + adjust', () => {
  const p = P(rec(), { lunch: 15 });
  assert.equal(p[2].allowed, 45); assert.equal(p[2].adjust, 15); assert.equal(p[0].allowed, 15);
});

test('a running break counts up to now', () => {
  const r = { breaks: [], active: { slot: 'break1', start: NOW - 4 * MIN } };
  const [b1] = P(r);
  assert.equal(b1.used, 4 * 60); assert.equal(b1.act.slot, 'break1');
});

test('custom breaks: today-only, selected days and every day', () => {
  const db = base(); const mk = (key, scope, extra = {}) => ({ key, minutes: 10, scope, date: TODAY, days: [], ...extra });
  db.custom['EE-1001'] = [mk('c1', 'today'), mk('c2', 'days', { days: [3] }), mk('c3', 'days', { days: [1] }), mk('c4', 'daily')];
  const labels = d => slotsFor(db, 'EE-1001', d).map(s => s.label);
  assert.deepEqual(labels(TODAY), ['Break 1', 'Break 2', 'Lunch', 'OH Break 1', 'OH Break 2', 'OH Break 4']);   // Wednesday
  assert.deepEqual(labels('2026-10-15'), ['Break 1', 'Break 2', 'Lunch', 'OH Break 4']);                      // Thursday
  assert.deepEqual(labels('2026-10-12'), ['Break 1', 'Break 2', 'Lunch', 'OH Break 3', 'OH Break 4']);          // Monday
  assert.deepEqual(slotsFor(db, 'EE-1002', TODAY).length, 3);                                                // other people unaffected
});

test('chained carry-over is not counted twice in the manager totals', () => {
  const r = rec(['break1', 0, 17], ['break2', 60, 15], ['lunch', 120, 30]);   // only 2 minutes are truly extra (62 used of 60)
  const p = P(r);
  assert.equal(p.reduce((a, s) => a + s.overBase, 0), 2 * 60);
  assert.equal(p[1].allowed, 13);                                              // the reduced allowance still drives the timer
});

test('break names: a manager can rename a break for one person only', () => {
  const db = base(); db.custom['EE-1001'] = [{ key: 'c1', minutes: 10, scope: 'daily', days: [] }];
  db.names['EE-1001'] = { break1: 'Morning', c1: 'Quiet time' };
  const s = slotsFor(db, 'EE-1001', TODAY);
  assert.deepEqual(s.map(x => x.label), ['Morning', 'Break 2', 'Lunch', 'Quiet time']);
  assert.deepEqual(s.map(x => x.defaultLabel), ['Break 1', 'Break 2', 'Lunch', 'OH Break 1']);
  assert.deepEqual(slotsFor(db, 'EE-1002', TODAY).map(x => x.label), ['Break 1', 'Break 2', 'Lunch']);
  assert.equal(labelFor(db, 'EE-1001', 'c1'), 'Quiet time');
  assert.equal(labelFor(db, 'EE-1002', 'c1'), 'OH Break 1');
  assert.equal(P(rec(['break1', 0, 17]), {}, s)[1].allowed, 13);            // renaming never changes the maths
});

test('break names are tidied and kept short', () => {
  assert.equal(cleanName('  Quiet    time \n'), 'Quiet time');
  assert.equal(cleanName('x'.repeat(100)).length, CONFIG.breakNameMaxLength);
  assert.equal(cleanName('   '), '');
});

test('older saved data without names still works', () => {
  const db = { days: {}, adj: {}, custom: {} };
  assert.equal(slotsFor(db, 'EE-1001', TODAY)[0].label, 'Break 1');
});

test('PM rule 2: 17 minutes on Break 1 takes 2 minutes off Break 2 (lunch untouched)', () => {
  const p = P(rec(['break1', 0, 17]));
  assert.deepEqual(p.map(s => s.allowed), [15, 13, 30]);
});

test('PM rule 3: Break 1 on time, then 17 minutes on Break 2 takes 2 minutes off lunch', () => {
  const p = P(rec(['break1', 0, 15], ['break2', 120, 17]));
  assert.deepEqual(p.map(s => s.allowed), [15, 15, 28]);
  assert.equal(p[2].deducted, 2);
});

test('a break the manager adds appears as its own break, after lunch, with its own allowance', () => {
  const db = base(); db.custom['EE-001'] = [{ key: 'c1', minutes: 10, scope: 'today', date: TODAY, days: [] }];
  const s = slotsFor(db, 'EE-001', TODAY);
  assert.deepEqual(s.map(x => [x.label, x.minutes]), [['Break 1', 15], ['Break 2', 15], ['Lunch', 30], ['OH Break 1', 10]]);
});

test('Breakathon score: on-time breaks, clean days and minutes over (same numbers as the database test)', () => {
  const db = base(), day = (back, ...b) => { const d = new Date(NOW); d.setDate(d.getDate() - back); (db.days[dayKey(d)] ??= {}).A = rec(...b); };
  day(0, ['break1', 0, 15]);                         // on time
  day(1, ['break1', 0, 20], ['lunch', 120, 30]);     // 5 over, lunch on time
  const s = weekScore(db, 'A', '2000-01-01', '2100-01-01');
  assert.deepEqual(s, { breaks: 3, onTime: 2, cleanDays: 1, overMinutes: 5, points: 2 * 10 + 5 - 5 * 2 });
  assert.equal(weekScore(db, 'A', TODAY, TODAY).points, 15);
});

test("Breakathon: a manager's extra minutes count toward being on time", () => {
  const db = base(); (db.days[TODAY] ??= {}).A = rec(['lunch', 0, 40]); db.adj[TODAY] = { A: { lunch: 10 } };
  assert.equal(weekScore(db, 'A', TODAY, TODAY).onTime, 1);
});

test('weeks run Monday to Sunday', () => {
  assert.deepEqual(weekOf('2026-10-21'), { from: '2026-10-19', to: '2026-10-25' });
  assert.deepEqual(weekOf('2026-10-19', 1), { from: '2026-10-12', to: '2026-10-18' });
});

test('dashboard status and filters', () => {
  const slots = CONFIG.defaultSlots, at = NOW;
  const st = r => statusOf(r, plan(r, {}, at, slots), at);
  assert.equal(st(undefined).key, 'off');
  assert.equal(st({ shiftStart: NOW - 3600000, breaks: [], active: null }).key, 'none');
  assert.equal(st({ shiftStart: NOW - 3600000, breaks: [], active: { slot: 'break1', start: NOW - 5 * MIN } }).key, 'onbreak');
  assert.equal(st({ shiftStart: NOW - 3600000, breaks: [], active: { slot: 'break1', start: NOW - 20 * MIN } }).key, 'over');
  assert.equal(st(rec(['break1', 0, 20])).key, 'over');
  assert.equal(st(rec(['break1', 0, 10])).key, 'taken');
  assert.deepEqual(FILTERS.map(f => f.key), ['all', 'onbreak', 'over', 'taken', 'none', 'off']);
});

test('team pulse: who is over, who is still waiting, and who has gone too long without a break', () => {
  const slots = CONFIG.defaultSlots, mk = (name, r) => ({ name, rec: r, p: plan(r, {}, NOW, slots) });
  const done = n => mk(n, rec(['break1', 0, 15]));
  const team = [done('Alex'), done('Priya'), done('Sam'), mk('Jordan', { shiftStart: NOW - 4 * 3600000, breaks: [], active: null }),
    mk('Mo', { shiftStart: NOW - 3600000, breaks: [], active: { slot: 'break2', start: NOW - 25 * MIN } }), mk('Chris', undefined)];
  const text = teamPulse(team, NOW).map(m => m.tone + ': ' + m.text).join('\n');
  assert.match(text, /^bad: Mo is 10 min over on Break 2\. Go wake Mo up/m);
  assert.match(text, /warn: Jordan has been working 4h 00m without a break/);
  assert.match(text, /Almost everyone has had Break 1\. Still to go: Jordan and Mo\./);
  assert.match(text, /1 on a break right now · 4 working · 1 not clocked in/);
  assert.match(teamPulse([done('Alex'), done('Priya')], NOW).map(m => m.text).join(), /Everyone clocked in has had Break 1\./);
});
