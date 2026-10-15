// Turns raw state into what the screens need. No markup here.
import { buildAllowance, summariseDay } from '../core/allowance.js';
import { dayKey } from '../core/time.js';

export const displayName = (u) => u.name || `Unclaimed (${u.id})`;

export function allowanceFor(state, userId, config) {
  return buildAllowance(config.defaultSlots, state.adjustments.filter((a) => a.userId === userId));
}

export function summaryFor(state, userId, nowMs, config, day = dayKey(nowMs)) {
  const sessions = state.sessions.filter((s) => s.userId === userId && s.day === day);
  return summariseDay(allowanceFor(state, userId, config), sessions, nowMs, config.overToleranceMinutes);
}
