// FAKE DATA LAYER: demo data kept in the browser. It exists so the app can be
// shown and tested with no database. It deliberately behaves like the real
// backend will: it enforces the same rules, runs the same daily job (streaks,
// then deletion after the retention period) and writes the same audit trail.
// Contains no real people.

import { buildAllowance, summariseDay } from '../core/allowance.js';
import { dayResult, nextStreak } from '../core/streaks.js';
import { dayKey, addDays, dayStartMs } from '../core/time.js';
import { FAKE_ROSTER } from './fakeRoster.js';

const KEY = 'bt_fake_db_v1';
const clone = (x) => structuredClone(x);
const initialsOf = (name, fallback) =>
  name ? name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : fallback;

function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1103515245 + 12345) >>> 0; return (h % 1000) / 1000; };
}

export function createFakeDataLayer({ storage, config, now = () => Date.now(), seedDemo = true }) {
  let db = null;

  // ---------- setup ----------
  function seed() {
    const fresh = {
      users: FAKE_ROSTER.map((r) => ({ ...r, name: null, initials: r.id, claimed: false })),
      adjustments: [], sessions: [], streaks: {}, audit: [],
      meta: { lastJobDay: null, todaySeededDay: null },
    };
    if (seedDemo) seedHistory(fresh);
    return fresh;
  }

  function seedHistory(d) {
    const today = dayKey(now());
    for (const u of d.users.filter((x) => x.role === 'agent')) {
      const rand = seededRandom(u.id);
      for (let back = config.retentionDays - 1; back >= 1; back--) {
        if (rand() < 0.15) continue;                       // a day off
        const day = addDays(today, -back);
        const goesOver = rand() < 0.2;
        config.defaultSlots.forEach((slot, idx) => {
          if (rand() < 0.1) return;                        // skipped one break
          const over = goesOver && rand() < 0.5;
          const mins = over
            ? slot.minutes + 3 + Math.round(rand() * 10)
            : Math.round(slot.minutes * (0.6 + rand() * 0.4));
          const start = dayStartMs(day) + (9 + idx * 2) * 3600000;
          d.sessions.push({ id: `seed-${u.id}-${day}-${slot.key}`, userId: u.id, slotKey: slot.key, start, end: start + mins * 60000, day });
        });
      }
    }
  }

  // Puts two people mid-break today so a fresh demo looks alive.
  function seedToday() {
    const today = dayKey(now());
    if (!seedDemo || db.meta.todaySeededDay === today) return false;
    const demo = [['EE5', 'break1', 4], ['EE9', 'lunch', 32]];
    for (const [userId, slotKey, minsAgo] of demo) {
      if (db.users.some((u) => u.id === userId) && !db.sessions.some((s) => s.userId === userId && s.day === today)) {
        db.sessions.push({ id: `seed-live-${userId}-${today}`, userId, slotKey, start: now() - minsAgo * 60000, end: null, day: today });
      }
    }
    db.meta.todaySeededDay = today;
    return true;
  }

  // The daily job (BT-2.5 / BT-2.6): fold each finished day into the streak
  // number, then delete anything older than the retention period.
  function runDailyJob() {
    const today = dayKey(now());
    const yesterday = addDays(today, -1);
    let changed = false;

    // Safety net: a break left running from an earlier day is closed so the
    // person is not locked out. The full rule is Stage 7 (BT-7.1).
    for (const s of db.sessions) {
      if (s.end == null && s.day < today) {
        s.end = s.start + config.forgotToStopMinutes * 60000;
        s.autoClosed = true;
        changed = true;
      }
    }

    const earliest = db.sessions.reduce((m, s) => (s.day < m ? s.day : m), today);
    const start = db.meta.lastJobDay ? addDays(db.meta.lastJobDay, 1) : earliest;
    for (let day = start; day <= yesterday; day = addDays(day, 1)) {
      for (const u of db.users.filter((x) => x.role === 'agent')) {
        const sessions = db.sessions.filter((s) => s.userId === u.id && s.day === day);
        const allowance = buildAllowance(config.defaultSlots, db.adjustments.filter((a) => a.userId === u.id));
        const summary = summariseDay(allowance, sessions, dayStartMs(addDays(day, 1)), config.overToleranceMinutes);
        const prev = db.streaks[u.id]?.count ?? 0;
        db.streaks[u.id] = { count: nextStreak(prev, dayResult(summary), config.streakGapPolicy), lastDay: day };
      }
      changed = true;
    }
    if (db.meta.lastJobDay !== yesterday) { db.meta.lastJobDay = yesterday; changed = true; }

    const cutoff = addDays(today, -config.retentionDays);
    const before = db.sessions.length + db.audit.length;
    db.sessions = db.sessions.filter((s) => s.day >= cutoff);
    db.audit = db.audit.filter((a) => dayKey(a.at) >= cutoff);
    if (db.sessions.length + db.audit.length !== before) changed = true;
    return changed;
  }

  function ready() {
    if (!db) {
      const raw = storage.getItem(KEY);
      db = raw ? JSON.parse(raw) : seed();
      persist();
    }
    const a = runDailyJob();
    const b = seedToday();
    if (a || b) persist();
  }
  function persist() { storage.setItem(KEY, JSON.stringify(db)); }

  const userOf = (id) => db.users.find((u) => u.id === id);
  const adjustmentsOf = (id) => db.adjustments.filter((a) => a.userId === id);

  // ---------- the contract ----------
  return {
    async getUsers() { ready(); return clone(db.users); },

    // Called after sign-in. In the real backend the identity provider supplies
    // the name, and the SERVER decides the role; a client-sent role is ignored.
    async ensureUser({ id, name, role = 'agent', team = 'pilot' }) {
      ready();
      let u = userOf(id);
      if (!u) { u = { id, role: 'agent', team, name: null, initials: id, claimed: false }; db.users.push(u); }
      u.name = name; u.team = team; u.claimed = true; u.initials = initialsOf(name, id);
      persist();
      return clone(u);
    },

    async getSessions({ userId, sinceDay } = {}) {
      ready();
      return clone(db.sessions.filter((s) => (!userId || s.userId === userId) && (!sinceDay || s.day >= sinceDay)));
    },

    async startBreak({ userId, slotKey }) {
      ready();
      if (!userOf(userId)) throw new Error('Unknown user');
      const allowance = buildAllowance(config.defaultSlots, adjustmentsOf(userId));
      if (!allowance.slots.some((s) => s.key === slotKey)) throw new Error('Unknown break type');
      if (db.sessions.some((s) => s.userId === userId && s.end == null)) throw new Error('Already on a break');
      const t = now();
      const session = { id: `s-${t}-${db.sessions.length}`, userId, slotKey, start: t, end: null, day: dayKey(t) };
      db.sessions.push(session);
      persist();
      return clone(session);
    },

    async endBreak({ sessionId }) {
      ready();
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s) throw new Error('Break not found');
      if (s.end == null) { s.end = now(); persist(); }
      return clone(s);
    },

    async getAdjustments({ userId } = {}) {
      ready();
      return clone(db.adjustments.filter((a) => !userId || a.userId === userId));
    },

    async setAdjustment({ userId, slotKey, deltaMinutes, setBy }) {
      ready();
      const actor = userOf(setBy);
      if (!actor || !['manager', 'admin'].includes(actor.role)) throw new Error('Only managers can change allowances');
      if (!userOf(userId)) throw new Error('Unknown user');
      const { min, max } = config.adjustmentLimits;
      if (!Number.isInteger(deltaMinutes) || deltaMinutes < min || deltaMinutes > max) {
        throw new Error(`Adjustment must be a whole number between ${min} and ${max}`);
      }
      const isDefault = config.defaultSlots.some((s) => s.key === slotKey);
      if (!isDefault && !/^extra[1-9]\d*$/.test(slotKey)) throw new Error('Unknown break type');
      if (!isDefault && deltaMinutes < 0) throw new Error('An extra break cannot be negative');

      const existing = db.adjustments.find((a) => a.userId === userId && a.slotKey === slotKey);
      const before = existing ? existing.deltaMinutes : 0;
      db.adjustments = db.adjustments.filter((a) => a !== existing);
      const t = now();
      if (deltaMinutes !== 0) db.adjustments.push({ userId, slotKey, deltaMinutes, setBy, setAt: t });
      db.audit.push({ id: `a-${t}-${db.audit.length}`, at: t, actorId: setBy, action: 'adjust_allowance', targetId: userId, slotKey, before, after: deltaMinutes });
      persist();
      return clone(adjustmentsOf(userId));
    },

    async getStreaks() {
      ready();
      return db.users.filter((u) => u.role === 'agent').map((u) => ({ userId: u.id, streak: db.streaks[u.id]?.count ?? 0 }));
    },

    async getAuditLog() { ready(); return clone([...db.audit].sort((a, b) => b.at - a.at)); },
  };
}
