// Break alerts (staff page): a heads-up shortly before a running break's own time is up, and again before the day's
// break time runs out (going "over"), so nobody has to watch the clock. Each alert fires once per break sitting.
// It shows a phone notification when allowed (through the installed app's service worker, sw.js), vibrates where the
// phone supports it, and always shows the in-app toast. Asked for once, the first time someone starts a break.
// Limit: without a push server the page has to be running, so an iPhone only alerts while the app is open; Android also
// alerts for a while after the app goes to the background.
import { CONFIG } from './config.js?v=fbf0dd54c0';
import { fmtMin } from './core.js?v=fbf0dd54c0';
import { toast } from './chrome.js?v=fbf0dd54c0';

const ASKED_KEY = 'bt-alerts-asked', fired = new Set();
const $ = s => document.querySelector(s);
const supported = () => typeof Notification !== 'undefined';

async function show(title, body) {
  try { if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.([200, 100, 200]); } catch {}   // phones only buzz after a tap
  toast(`${title} ${body}`, 7000);
  if (!supported() || Notification.permission !== 'granted') return;
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: 'bt-break', renotify: true };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification(title, opts); } catch {}
  try { new Notification(title, opts); } catch {}
}

/** The first time someone starts a break: offer to turn the alerts on (the browser only asks after a tap).
    Returns true when the offer is showing, so the caller can skip its own toast. */
export function offerAlerts() {
  if (!supported() || Notification.permission !== 'default' || $('#alertAsk')) return false;
  try { if (localStorage.getItem(ASKED_KEY)) return false; localStorage.setItem(ASKED_KEY, '1'); } catch {}
  const lead = CONFIG.alertBeforeMinutes;
  document.body.insertAdjacentHTML('beforeend', `<div class="install" id="alertAsk" role="dialog" aria-label="Break alerts"><p><b>Want a heads-up?</b> We'll buzz you ${lead} minutes before your break time is up, so you don't have to watch the clock.</p>
    <div class="row"><button class="btn teal sm" id="alertYes">Turn on</button><button class="btn ghost sm" id="alertNo">No thanks</button></div></div>`);
  $('#alertNo').addEventListener('click', () => $('#alertAsk').remove());
  $('#alertYes').addEventListener('click', async () => { $('#alertAsk').remove();
    const r = await Notification.requestPermission().catch(() => 'denied');
    toast(r === 'granted' ? `Alerts on. We'll buzz you ${lead} minutes before your break time is up.` : "No problem. You'll still see the reminder in the app."); });
  return true;
}

/** Call every second with the running break (a plan() slot, see src/core.js). */
export function checkAlerts(s, pro) {
  if (!s?.act) return;
  const lead = CONFIG.alertBeforeMinutes * 60, id = `${s.key}|${s.act.start}`, once = (k, fn) => { if (!fired.has(id + k)) { fired.add(id + k); fn(); } };
  const away = pro ? '' : ' 🏃';
  if (s.left > 0 && s.left <= lead && s.spare > s.left)
    once('own', () => show(`${fmtMin(s.left)} left on ${s.label}.`, `Time to start heading back.${away}`));
  else if (s.over <= 0 && s.spare > 0 && s.spare <= lead)
    once('day', () => show(`${fmtMin(s.spare)} of break time left today.`, `After that you'll be over today's break time.${away}`));
  else if (s.over > 0)
    once('over', () => show("You've used today's break time.", 'Head back when you can.'));
}
