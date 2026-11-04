// The parts both pages share: the live clock (to the second), the Live pill, tabs, a small toast and "change password".
import { CONFIG } from './config.js?v=6b9fa1564c';
import { now, changePassword, hhmm, clock12, setClock12 } from './core.js?v=6b9fa1564c';

const $ = s => document.querySelector(s);
const API = CONFIG.backend === 'api';

/** The clock in the header, ticking every second on the database-corrected time. */
export function startClock() {
  const el = $('#clock'), tick = () => { el.textContent = hhmm(now(), true); };
  tick(); return setInterval(tick, 1000);
}
/** Live (green, pulsing) while updates arrive; Reconnecting (amber) when the last update failed. */
export function setLive(ok) {
  const el = $('#live'); if (!el) return;
  el.classList.toggle('off', !ok); el.querySelector('b').textContent = ok ? 'Live' : 'Reconnecting';
  el.title = ok ? `Updates every ${CONFIG.refreshSeconds} seconds` : 'Lost the connection for a moment. Trying again…';
}
/** Tabs in the header: buttons with data-tab="x" show <main id="tab-x">. The choice is kept in the address (#x). */
export function setupTabs(onChange) {
  const btns = [...document.querySelectorAll('.tabs [data-tab]')];
  const show = name => {
    if (!btns.some(b => b.dataset.tab === name)) name = btns[0].dataset.tab;
    btns.forEach(b => { const on = b.dataset.tab === name; b.setAttribute('aria-selected', on); document.getElementById('tab-' + b.dataset.tab).classList.toggle('hidden', !on); });
    onChange?.(name);
  };
  btns.forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); show(b.dataset.tab); }));
  show(location.hash.slice(1));
  return show;
}
export function toast(msg, ms = 3500) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);max-width:min(520px,calc(100% - 32px));text-align:center;background:var(--ee-black);color:#fff;padding:10px 16px;border-radius:12px;z-index:40;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3)';
    document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, ms);
}
/** "Password" link in the header (database mode only): a small dialog to change your own password. */
export function setupPassword() {
  const btn = $('#pwBtn'); if (!btn) return;
  if (!API) { btn.remove(); return; }
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay hidden" id="pwOv"><form class="dialog small" id="pwForm" role="dialog" aria-modal="true" aria-labelledby="pwTitle">
    <h3 id="pwTitle" style="margin-top:0">Change your password</h3><p class="hint" style="margin:0 0 12px">At least 8 characters. Only you should know it.</p>
    <input type="password" id="pw1" placeholder="New password" aria-label="New password" autocomplete="new-password" required minlength="8">
    <input type="password" id="pw2" placeholder="New password again" aria-label="New password again" autocomplete="new-password" required minlength="8">
    <p class="err" id="pwErr" role="alert"></p><div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" id="pwCancel">Cancel</button><button class="btn teal">Change password</button></div></form></div>`);
  const close = () => $('#pwOv').classList.add('hidden');
  btn.addEventListener('click', () => { $('#pwOv').classList.remove('hidden'); $('#pw1').value = $('#pw2').value = ''; $('#pwErr').textContent = ''; $('#pw1').focus(); });
  $('#pwCancel').addEventListener('click', close);
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#pw1').value !== $('#pw2').value) { $('#pwErr').textContent = "The two passwords don't match."; return; }
    const b = e.submitter; b.disabled = true;
    try { await changePassword($('#pw1').value); close(); toast('Password changed'); }
    catch (err) { $('#pwErr').textContent = err.message; }
    finally { b.disabled = false; }
  });
}
/* ---------------- the phone app ----------------
   Both pages can be installed on a phone's home screen (app.webmanifest, manager.webmanifest): they then open full screen
   with their own icon, and stay signed in. sw.js keeps the app's own files on the phone so it opens fast on a weak signal.
   A small card offers to install it: Android shows the system Install button, iPhone explains Share > Add to Home Screen. */
const INSTALL_KEY = 'bt-install-later', LATER_DAYS = 7;
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export function setupApp() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
    navigator.serviceWorker.register('sw.js').catch(() => {});      // the app works the same without it
  if (installed() || !matchMedia('(max-width: 700px), (pointer: coarse)').matches) return;
  try { if (Date.now() - Number(localStorage.getItem(INSTALL_KEY) || 0) < LATER_DAYS * 864e5) return; } catch {}
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const show = (text, action) => {
    if ($('#install')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="install" id="install" role="dialog" aria-label="Install the app"><p>${text}</p>
      <div class="row">${action ? '<button class="btn teal sm" id="installGo">Install</button>' : ''}<button class="btn ghost sm" id="installLater">Not now</button></div></div>`);
    $('#installLater').addEventListener('click', () => { try { localStorage.setItem(INSTALL_KEY, Date.now()); } catch {} $('#install').remove(); });
    $('#installGo')?.addEventListener('click', async () => { $('#install').remove(); await action(); });
  };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); show('<b>Install Break Point</b> on your phone: one tap from your home screen, full screen, and you stay signed in.', () => e.prompt()); });
  if (ios) show('<b>Add Break Point to your home screen:</b> tap <b>Share</b> <span aria-hidden="true">⬆︎</span> at the bottom of Safari, then <b>Add to Home Screen</b>.');
}

/** The menu behind the initials button in the header (#meBtn opens #meOv): time format, dark mode, look, alerts,
    password and sign out. onClock() redraws the page after switching between 12-hour and 24-hour times. */
export function setupMenu(onClock) {
  const ov = $('#meOv'); if (!ov) return;
  const open = () => { ov.classList.remove('hidden'); paintClock(); $('#meClose')?.focus(); }, close = () => ov.classList.add('hidden');
  const paintClock = () => ov.querySelectorAll('[data-clock]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.clock === '12') === clock12()));
  $('#meBtn')?.addEventListener('click', open);
  $('#meClose')?.addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  ov.querySelectorAll('[data-clock]').forEach(b => b.addEventListener('click', () => { setClock12(b.dataset.clock === '12'); paintClock();
    const el = $('#clock'); if (el) el.textContent = hhmm(now(), true); onClock?.(); }));
  $('#pwBtn')?.addEventListener('click', close);
  paintClock();
}

/** Dark mode switch in the menu. Starts from the device setting; the choice is remembered on this device. */
export function setupTheme() {
  const btn = $('#themeBtn'); if (!btn) return;
  const root = document.documentElement, sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : sysDark();
  const paint = () => btn.setAttribute('aria-checked', isDark());
  btn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; root.dataset.theme = t; try { localStorage.setItem('bt-theme', t); } catch {} paint(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paint);
  paint();
}
