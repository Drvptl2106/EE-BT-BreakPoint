// Pure logic: how much break a person is entitled to, and how much they used.
// No browser, no storage, no network. This is the part IT will want to review.

import { minutesBetween } from './time.js';

/**
 * Build one person's allowance from the default slots plus their adjustments.
 * An adjustment is { slotKey, deltaMinutes }. The latest one per slot wins.
 * A slot key not in the defaults (e.g. 'extra1') with a positive delta becomes
 * an extra break. Its label is generic on purpose: no reason is ever stored.
 */
export function buildAllowance(defaultSlots, adjustments = []) {
  const latest = new Map();
  for (const a of adjustments) latest.set(a.slotKey, a.deltaMinutes);

  const slots = defaultSlots.map((s) => {
    const delta = latest.get(s.key) || 0;
    return {
      ...s,
      baseMinutes: s.minutes,
      minutes: Math.max(0, s.minutes + delta),
      adjusted: delta !== 0,
    };
  });

  const defaultKeys = new Set(defaultSlots.map((s) => s.key));
  let n = 0;
  for (const [key, delta] of latest) {
    if (defaultKeys.has(key) || delta <= 0) continue;
    n += 1;
    slots.push({
      key,
      label: `Extra break ${n}`,
      tone: 'break',
      baseMinutes: 0,
      minutes: delta,
      adjusted: true,
      isExtra: true,
    });
  }

  return { slots, totalMinutes: slots.reduce((sum, s) => sum + s.minutes, 0) };
}

/** Minutes used on one slot. A running break counts up to `nowMs`. */
export function usedMinutes(sessions, slotKey, nowMs) {
  return sessions
    .filter((s) => s.slotKey === slotKey)
    .reduce((sum, s) => sum + minutesBetween(s.start, s.end ?? nowMs), 0);
}

/** Summarise one person's day against their allowance. */
export function summariseDay(allowance, sessions, nowMs, toleranceMinutes = 0.4) {
  const slots = allowance.slots.map((slot) => {
    const mine = sessions.filter((s) => s.slotKey === slot.key);
    const used = usedMinutes(mine, slot.key, nowMs);
    return {
      ...slot,
      used,
      over: used > slot.minutes + toleranceMinutes,
      sessions: mine,
      active: mine.find((s) => s.end == null) || null,
    };
  });
  return {
    slots,
    totalUsed: slots.reduce((sum, s) => sum + s.used, 0),
    totalMinutes: allowance.totalMinutes,
    anyOver: slots.some((s) => s.over),
    hasActivity: slots.some((s) => s.sessions.length > 0),
  };
}
