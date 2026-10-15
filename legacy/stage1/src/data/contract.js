// THE DATA CONTRACT.
// The screens only ever talk to an object with these methods. Today that object
// is the fake in-browser one. In Stage 2 it becomes a client for the hosted
// database or API. When IT takes over, they write a third one. The screens
// never change. tests/helpers/contract.js checks that any implementation
// behaves the same.
//
// Types (all methods are async and return plain data):
//   User        { id, name, role: 'agent'|'manager'|'admin', team, initials }
//   Session     { id, userId, slotKey, start, end|null, day }       (ms timestamps)
//   Adjustment  { userId, slotKey, deltaMinutes, setBy, setAt }
//   Audit       { id, at, actorId, action, targetId, slotKey, before, after }
//
// Rules every implementation must enforce itself (not the screens):
//   - an agent only reads and writes their own rows; a manager only their team's
//   - a person can have only one running break at a time
//   - adjustments stay inside CONFIG.adjustmentLimits and every one is audited
//   - there is no field anywhere for the reason behind a break

export const DATA_METHODS = [
  'getUsers',        // () => User[]
  'ensureUser',      // ({ id, name, role, team }) => User     (called after sign-in)
  'getSessions',     // ({ userId?, sinceDay? }) => Session[]
  'startBreak',      // ({ userId, slotKey }) => Session       (throws if one is running)
  'endBreak',        // ({ sessionId }) => Session
  'getAdjustments',  // ({ userId? }) => Adjustment[]
  'setAdjustment',   // ({ userId, slotKey, deltaMinutes, setBy }) => Adjustment[]
  'getStreaks',      // () => { userId, streak }[]
  'getAuditLog',     // () => Audit[]
];

export function assertDataLayer(layer) {
  const missing = DATA_METHODS.filter((m) => typeof layer[m] !== 'function');
  if (missing.length) {
    throw new Error(`Data layer is missing: ${missing.join(', ')}`);
  }
  return layer;
}
