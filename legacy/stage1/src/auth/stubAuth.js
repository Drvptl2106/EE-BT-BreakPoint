// TEMPORARY pilot login: a typed name plus a code from the demo roster.
// This is NOT real security: anyone who knows a code can use it.
// It is deleted in Stage 3 (BT-3.1) and replaced by an invite-only login.

import { FAKE_ROSTER } from '../data/fakeRoster.js';

const KEY = 'bt_stub_session_v1';

export function createStubAuth({ storage }) {
  return {
    async getCurrentUser() {
      const raw = storage.getItem(KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },

    async signIn({ name, code }) {
      const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const cleanCode = String(code || '').trim().toUpperCase();
      const entry = FAKE_ROSTER.find((r) => r.id === cleanCode);
      if (!entry) return { ok: false, error: 'That code isn\u2019t recognised. Check with your manager.' };
      if (!cleanName) return { ok: false, error: 'Enter your name.' };
      const user = { id: entry.id, name: cleanName, role: entry.role, team: entry.team };
      storage.setItem(KEY, JSON.stringify(user));
      return { ok: true, user };
    },

    async signOut() { storage.setItem(KEY, ''); },
  };
}
