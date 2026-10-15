import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createFakeDataLayer } from '../src/data/fakeData.js';
import { createMemoryStorage } from '../src/data/storage.js';
import { assertDataLayer } from '../src/data/contract.js';
import { dayKey } from '../src/core/time.js';
import { runDataContract } from './helpers/contract.js';

const DAY = 86400000;

function make({ seedDemo = false, start = Date.parse('2026-10-14T09:00:00Z'), storage = createMemoryStorage() } = {}) {
  let t = start;
  const layer = createFakeDataLayer({ storage, config: CONFIG, now: () => t, seedDemo });
  return { layer, storage, advance: (min) => { t += min * 60000; }, advanceDays: (d) => { t += d * DAY; }, now: () => t };
}

test('fake layer satisfies the contract shape', () => {
  assertDataLayer(make().layer);
});

runDataContract('fake', make);

test('daily job: a clean day extends the streak, an over day resets it', async () => {
  const m = make();
  // day 1: clean 10-minute break
  let s = await m.layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
  m.advance(10); await m.layer.endBreak({ sessionId: s.id });
  m.advanceDays(1);                                   // day 2 starts, day 1 is folded in
  assert.equal((await m.layer.getStreaks()).find((x) => x.userId === 'EE1').streak, 1);
  // day 2: 25-minute "15 minute" break = over
  s = await m.layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
  m.advance(25); await m.layer.endBreak({ sessionId: s.id });
  m.advanceDays(1);
  assert.equal((await m.layer.getStreaks()).find((x) => x.userId === 'EE1').streak, 0);
});

test('daily job: records are deleted after the retention period but the streak number survives', async () => {
  const m = make();
  const s = await m.layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
  m.advance(10); await m.layer.endBreak({ sessionId: s.id });
  m.advanceDays(1);
  assert.equal((await m.layer.getSessions({ userId: 'EE1' })).length, 1);
  m.advanceDays(CONFIG.retentionDays + 1);
  assert.equal((await m.layer.getSessions({ userId: 'EE1' })).length, 0);
  assert.equal((await m.layer.getStreaks()).find((x) => x.userId === 'EE1').streak, 1);
});

test('a break left running overnight is closed, so nobody is locked out', async () => {
  const m = make();
  await m.layer.startBreak({ userId: 'EE1', slotKey: 'lunch' });
  m.advanceDays(1);
  const [s] = await m.layer.getSessions({ userId: 'EE1' });
  assert.equal(s.autoClosed, true);
  await m.layer.startBreak({ userId: 'EE1', slotKey: 'break1' });   // allowed again
});

test('data survives a reload because it is persisted', async () => {
  const m = make();
  await m.layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
  const again = createFakeDataLayer({ storage: m.storage, config: CONFIG, now: m.now, seedDemo: false });
  assert.equal((await again.getSessions({ userId: 'EE1' })).length, 1);
});

test('demo seeding produces varied streaks and never exceeds the retention window', async () => {
  const m = make({ seedDemo: true });
  const streaks = (await m.layer.getStreaks()).map((s) => s.streak);
  assert.equal(streaks.length, 15);
  assert.ok(new Set(streaks).size > 1, 'streaks should vary');
  const oldest = dayKey(m.now() - CONFIG.retentionDays * DAY);
  for (const s of await m.layer.getSessions()) assert.ok(s.day >= oldest);
});

test('ensureUser stores the name but never lets a client change the role', async () => {
  const m = make();
  const u = await m.layer.ensureUser({ id: 'EE3', name: 'Priya', role: 'manager' });
  assert.equal(u.name, 'Priya');
  assert.equal(u.role, 'agent');
});
