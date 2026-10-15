// A reusable test-suite that ANY data layer must pass: the fake one today, the
// hosted one in Stage 2, and whatever IT builds later. Pass a factory that
// returns a fresh, empty-of-demo-data layer and a controllable clock.

import test from 'node:test';
import assert from 'node:assert/strict';

export function runDataContract(name, makeLayer) {
  const fresh = () => makeLayer();

  test(`${name}: one running break per person`, async () => {
    const { layer } = fresh();
    await layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
    await assert.rejects(layer.startBreak({ userId: 'EE1', slotKey: 'lunch' }), /Already on a break/);
  });

  test(`${name}: ending a break records an end time`, async () => {
    const { layer, advance } = fresh();
    const s = await layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
    advance(10);
    const done = await layer.endBreak({ sessionId: s.id });
    assert.equal(done.end - done.start, 10 * 60000);
  });

  test(`${name}: agents cannot change allowances`, async () => {
    const { layer } = fresh();
    await assert.rejects(
      layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 10, setBy: 'EE2' }),
      /Only managers/);
  });

  test(`${name}: manager adjustments are range-checked and audited`, async () => {
    const { layer } = fresh();
    await assert.rejects(layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 500, setBy: 'MGR1' }), /between/);
    await assert.rejects(layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 2.5, setBy: 'MGR1' }), /whole number/);
    await layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 15, setBy: 'MGR1' });
    const log = await layer.getAuditLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].before, 0);
    assert.equal(log[0].after, 15);
    assert.equal(log[0].actorId, 'MGR1');
  });

  test(`${name}: setting an adjustment to 0 removes it`, async () => {
    const { layer } = fresh();
    await layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 15, setBy: 'MGR1' });
    await layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 0, setBy: 'MGR1' });
    assert.equal((await layer.getAdjustments({ userId: 'EE1' })).length, 0);
  });

  test(`${name}: an extra break must exist before it can be started`, async () => {
    const { layer } = fresh();
    await assert.rejects(layer.startBreak({ userId: 'EE1', slotKey: 'extra1' }), /Unknown break type/);
    await layer.setAdjustment({ userId: 'EE1', slotKey: 'extra1', deltaMinutes: 10, setBy: 'MGR1' });
    const s = await layer.startBreak({ userId: 'EE1', slotKey: 'extra1' });
    assert.equal(s.slotKey, 'extra1');
  });

  test(`${name}: no record has a reason field`, async () => {
    const { layer } = fresh();
    await layer.setAdjustment({ userId: 'EE1', slotKey: 'lunch', deltaMinutes: 15, setBy: 'MGR1' });
    const s = await layer.startBreak({ userId: 'EE1', slotKey: 'break1' });
    const records = [s, ...(await layer.getAdjustments()), ...(await layer.getAuditLog())];
    for (const r of records) {
      for (const k of Object.keys(r)) assert.ok(!/reason|note|comment|medical|prayer/i.test(k), `unexpected field ${k}`);
    }
  });
}
