// Wires the pieces together. Contains no business rules: those live in core/,
// storage lives behind data/, identity behind auth/, markup in ui/.

import { CONFIG } from './config.js';
import { createDataLayer } from './data/index.js';
import { createAuthLayer } from './auth/index.js';
import { dayKey, daysAgoKey } from './core/time.js';
import { $, setHtml } from './ui/dom.js';
import { displayName, summaryFor } from './ui/selectors.js';
import { controlsHtml, tickTimers, agentDonut } from './ui/agentScreen.js';
import { headerHtml, rosterHtml } from './ui/managerScreen.js';
import { leaderboardHtml } from './ui/leaderboardScreen.js';
import { historyHtml } from './ui/historyScreen.js';

const data = createDataLayer(CONFIG);
const auth = createAuthLayer(CONFIG);

const state = {
  user: null,
  users: [], sessions: [], adjustments: [], streaks: [],
  view: 'agent',
  expanded: null,
};

const isManager = () => state.user && ['manager', 'admin'].includes(state.user.role);
const notice = (msg = '') => { $('#notice').textContent = msg; };

// ---------- data ----------
async function refresh() {
  try {
    const sinceDay = daysAgoKey(CONFIG.retentionDays, Date.now());
    const [users, sessions, adjustments, streaks] = await Promise.all([
      data.getUsers(), data.getSessions({ sinceDay }), data.getAdjustments(), data.getStreaks(),
    ]);
    Object.assign(state, { users, sessions, adjustments, streaks });
    notice('');
  } catch (err) {
    notice('Could not load the latest data. Retrying\u2026');
    console.error(err);
  }
  render();
}

// ---------- drawing ----------
function render() {
  if (!state.user) return;
  const now = Date.now();

  $('#current-user-name').textContent = `${displayName(state.user)} (${state.user.id})`;
  $('#current-user-avatar').textContent = state.user.initials || state.user.id;

  // Hiding the tab is only a courtesy. Stage 3 enforces roles on the server.
  document.querySelectorAll('[data-needs="manager"]').forEach((b) => { b.hidden = !isManager(); });
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  for (const v of ['agent', 'manager', 'leaderboard', 'history']) {
    $(`#${v}-view`).classList.toggle('active', state.view === v);
  }

  if (state.view === 'agent') {
    const summary = summaryFor(state, state.user.id, now, CONFIG);
    setHtml($('#control-buttons'), controlsHtml(summary));
    const { svg, legend } = agentDonut(summary);
    setHtml($('#donut-svg'), svg);
    setHtml($('#legend'), legend);
    tickTimers($('#control-buttons'), now);
  } else if (state.view === 'manager' && isManager()) {
    setHtml($('#roster-head'), headerHtml(CONFIG));
    const rows = state.users
      .filter((u) => u.role === 'agent')
      .map((user) => ({ user, summary: summaryFor(state, user.id, now, CONFIG) }));
    setHtml($('#roster-body'), rosterHtml(rows, CONFIG, state.expanded));
  } else if (state.view === 'leaderboard') {
    const streakOf = new Map(state.streaks.map((s) => [s.userId, s.streak]));
    const rows = state.users.filter((u) => u.role === 'agent').map((user) => ({
      user,
      streak: streakOf.get(user.id) ?? 0,
      todayOver: summaryFor(state, user.id, now, CONFIG).anyOver,
    }));
    setHtml($('#leaderboard-list'), leaderboardHtml(rows, CONFIG));
  } else if (state.view === 'history') {
    $('#history-note').textContent =
      `Records are kept for ${CONFIG.retentionDays} days, then deleted automatically.`;
    const rows = [];
    for (let back = 0; back <= CONFIG.retentionDays; back++) {
      const day = dayKey(now - back * 86400000);
      const s = summaryFor(state, state.user.id, now, CONFIG, day);
      rows.push({
        day, isToday: back === 0,
        taken: s.slots.filter((x) => x.sessions.length).length, of: s.slots.length,
        totalMin: s.totalUsed, hasActivity: s.hasActivity, anyOver: s.anyOver,
      });
    }
    setHtml($('#history-body'), historyHtml(rows));
  }
}

// ---------- actions (one delegated click handler) ----------
const actions = {
  'set-view': (el) => { state.view = el.dataset.view; render(); },

  'toggle-row': (el) => {
    state.expanded = state.expanded === el.dataset.user ? null : el.dataset.user;
    render();
  },

  'toggle-break': async (el) => {
    const slotKey = el.dataset.slot;
    const running = state.sessions.find((s) => s.userId === state.user.id && s.end == null);
    try {
      if (running && running.slotKey === slotKey) await data.endBreak({ sessionId: running.id });
      else if (!running) await data.startBreak({ userId: state.user.id, slotKey });
      notice('');
    } catch (err) {
      notice(err.message || 'Something went wrong. Your change was not saved.');
    }
    await refresh();
  },

  logout: async () => {
    await auth.signOut();
    state.user = null;
    $('#login-screen').hidden = false;
    $('#login-name').value = '';
    $('#login-code').value = '';
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el);
});

// ---------- sign-in ----------
async function enter(user) {
  // The profile comes back from the data layer, so the role is whatever the
  // data layer says it is, never what the browser claims.
  state.user = await data.ensureUser(user);
  state.view = isManager() ? 'manager' : 'agent';
  $('#login-screen').hidden = true;
  await refresh();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await auth.signIn({ name: $('#login-name').value, code: $('#login-code').value });
  const err = $('#login-error');
  if (!result.ok) { err.textContent = result.error; err.classList.add('show'); return; }
  err.classList.remove('show');
  await enter(result.user);
});

// ---------- start ----------
(async function boot() {
  const existing = await auth.getCurrentUser();
  if (existing) await enter(existing);
  else $('#login-screen').hidden = false;
  setInterval(() => { if (state.user) render(); }, 1000);
  setInterval(() => { if (state.user) refresh(); }, CONFIG.refreshSeconds * 1000);
})();
