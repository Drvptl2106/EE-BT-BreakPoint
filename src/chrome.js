// The parts both pages share: the live clock (to the second), the Live pill, tabs, a small toast and "change password".
import { CONFIG } from './config.js?v=fbf0dd54c0';
import { now, changePassword } from './core.js?v=fbf0dd54c0';

const $ = s => document.querySelector(s);
const API = CONFIG.backend === 'api';

/** The clock in the header, ticking every second on the database-corrected time. */
export function startClock() {
  const el = $('#clock'), tick = () => { el.textContent = new Date(now()).toLocaleTimeString('en-GB', { hour12: false }); };
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

const SUN ='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>';
const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" fill="currentColor"/></svg>';
/** Sun/moon button: switches light and dark. Starts from the device setting; the choice is remembered on this device. */
export function setupTheme() {
  const btn = $('#themeBtn'); if (!btn) return;
  const root = document.documentElement, sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : sysDark();
  const paint = () => { btn.innerHTML = isDark() ? SUN : MOON; btn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode'); };
  btn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; root.dataset.theme = t; try { localStorage.setItem('bt-theme', t); } catch {} paint(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paint);
  paint();
}
