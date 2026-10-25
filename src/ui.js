// Two looks, same features. 'fun' = Playful (mascots, the Breakathon map, pep talks). 'pro' = Professional (the calmer
// manager-page styling, formal wording, scores as a plain table). Everyone picks their own with the button in the header,
// and is asked once, the first time they sign in. The choice is saved with their login (db/schema.sql, ui_prefs), so the
// pilot can show which look people actually prefer, and on this device, so src/theme.js applies it before the page draws.
import { myUiStyle, setUiStyle } from './core.js?v=9318095bf0';
import { toast } from './chrome.js?v=9318095bf0';

const $ = s => document.querySelector(s), root = document.documentElement, KEY = 'bt-ui';
export const LOOK_NAMES = { fun: 'Playful', pro: 'Professional' };
export const uiStyle = () => root.dataset.ui === 'pro' ? 'pro' : 'fun';
export const isPro = () => uiStyle() === 'pro';
let onChange = () => {}, who = null;
// The header button shows where it takes you, like the sun/moon button: a briefcase for Professional, a smile for Playful.
const ICONS = {
  pro: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6V5a2 2 0 012-2h2a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="6.5" width="18" height="13.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12.5h18" stroke="currentColor" stroke-width="2"/></svg>',
  fun: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.4" fill="currentColor"/><circle cx="15" cy="10" r="1.4" fill="currentColor"/><path d="M8 14.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
};

function apply(style) {
  root.dataset.ui = style; try { localStorage.setItem(KEY, style); } catch {}
  const other = style === 'pro' ? 'fun' : 'pro', btn = $('#uiBtn');
  if (btn) { btn.innerHTML = ICONS[other]; btn.title = `Switch to the ${LOOK_NAMES[other].toLowerCase()} view`; btn.setAttribute('aria-label', btn.title); }
  document.querySelectorAll('[data-race-name]').forEach(el => { el.textContent = style === 'pro' ? 'Weekly scores' : 'Breakathon'; });
  onChange(style);
}
async function choose(style, note) {
  apply(style);
  try { await setUiStyle(who, style); if (note) toast(note, 5000); }
  catch { toast(`${note ? note + ' ' : ''}(Saved on this device only for now.)`, 5000); }
}

/** Call once per page, before signing in. redraw(style) redraws whatever depends on the look. */
export function setupUi(redraw) {
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay hidden" id="uiPick"><div class="dialog small" role="dialog" aria-modal="true" aria-labelledby="uiPickT">
    <h3 id="uiPickT" style="margin-top:0">How would you like Break Point to look?</h3>
    <p class="hint" style="margin:0 0 14px">Both work exactly the same. You can switch any time with the briefcase / smile button at the top of the page.</p>
    <div class="uipick"><button type="button" class="uiopt" data-pick="fun"><b>Playful</b><span>Mascots, pep talks and the Breakathon game map.</span></button>
    <button type="button" class="uiopt" data-pick="pro"><b>Professional</b><span>A plain, formal layout. Weekly scores as a table.</span></button></div></div></div>`);
  $('#uiPick').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; $('#uiPick').classList.add('hidden'); choose(b.dataset.pick); });
  $('#uiBtn')?.addEventListener('click', () => { const s = isPro() ? 'fun' : 'pro';
    choose(s, `Switched to the ${LOOK_NAMES[s].toLowerCase()} view. Everything works the same, and you can switch back any time.`); });
  apply(uiStyle());
  onChange = redraw || onChange;
}
/** After sign-in: use the look this person saved, or ask them to pick one the first time. */
export async function syncUi(code) {
  who = code;
  let saved;
  try { saved = await myUiStyle(code); } catch { return; }      // an older database without ui_prefs: keep this device's look
  if (saved) { if (saved !== uiStyle()) apply(saved); return; }
  $('#uiPick').classList.remove('hidden'); $('#uiPick [data-pick]').focus();
}
