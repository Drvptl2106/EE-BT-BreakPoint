import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { buildAllowance, summariseDay, usedMinutes } from '../src/core/allowance.js';
import { dayResult, nextStreak } from '../src/core/streaks.js';
import { dayKey, addDays } from '../src/core/time.js';

const MIN = 60000;
const T0 = Date.parse('2026-10-14T09:00:00Z');

test('default allowance is 60 minutes (15 + 15 + 30)', () => {
  const a = buildAllowance(CONFIG.defaultSlots, []);
  assert.equal(a.totalMinutes, 60);
  assert.deepEqual(a.slots.map((s) => s.minutes), [15, 15, 30]);
});

test('an adjustment extends one slot and marks it adjusted', () => {
  const a = buildAllowance(CONFIG.defaultSlots, [{ slotKey: 'lunch', deltaMinutes: 15 }]);
  assert.equal(a.slots.find((s) => s.key === 'lunch').minutes, 45);
  assert.equal(a.slots.find((s) => s.key === 'lunch').adjusted, true);
  assert.equal(a.totalMinutes, 75);
});

test('a reduction never goes below zero', () => {
  const a = buildAllowance(CONFIG.defaultSlots, [{ slotKey: 'break1', deltaMinutes: -30 }]);
  assert.equal(a.slots[0].minutes, 0);
});

test('an extra break gets a generic label, never a reason', () => {
  const a = buildAllowance(CONFIG.defaultSlots, [{ slotKey: 'extra1', deltaMinutes: 10 }]);
  const extra = a.slots.find((s) => s.key === 'extra1');
  assert.equal(extra.label, 'Extra break 1');
  assert.equal(a.totalMinutes, 70);
});

test('the latest adjustment per slot wins', () => {
  const a = buildAllowance(CONFIG.defaultSlots, [
    { slotKey: 'lunch', deltaMinutes: 5 }, { slotKey: 'lunch', deltaMinutes: 20 },
  ]);
  assert.equal(a.slots.find((s) => s.key === 'lunch').minutes, 50);
});

test('usedMinutes counts a running break up to now', () => {
  const sessions = [{ slotKey: 'break1', start: T0, end: null }];
  assert.equal(usedMinutes(sessions, 'break1', T0 + 7 * MIN), 7);
});

test('over is flagged only past the limit plus tolerance', () => {
  const allowance = buildAllowance(CONFIG.defaultSlots, []);
  const ok = summariseDay(allowance, [{ slotKey: 'break1', start: T0, end: T0 + 15 * MIN }], T0 + 99 * MIN);
  assert.equal(ok.anyOver, false);
  const over = summariseDay(allowance, [{ slotKey: 'break1', start: T0, end: T0 + 19 * MIN }], T0 + 99 * MIN);
  assert.equal(over.anyOver, true);
});

test('a longer allowance means the same time is no longer over', () => {
  const longer = buildAllowance(CONFIG.defaultSlots, [{ slotKey: 'break1', deltaMinutes: 10 }]);
  const s = summariseDay(longer, [{ slotKey: 'break1', start: T0, end: T0 + 22 * MIN }], T0 + 99 * MIN);
  assert.equal(s.anyOver, false);
});

test('day results and streaks', () => {
  const allowance = buildAllowance(CONFIG.defaultSlots, []);
  const none = summariseDay(allowance, [], T0);
  assert.equal(dayResult(none), 'none');
  assert.equal(nextStreak(4, 'clean'), 5);
  assert.equal(nextStreak(4, 'over'), 0);
  assert.equal(nextStreak(4, 'none', 'skip'), 4);
  assert.equal(nextStreak(4, 'none', 'reset'), 0);
});

test('date helpers', () => {
  assert.equal(dayKey(T0), '2026-10-14');
  assert.equal(addDays('2026-10-14', -14), '2026-09-30');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});
