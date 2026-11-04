// A time picker like the iPhone alarm: scrolling wheels for hour, minute (and am/pm in 12-hour mode) that snap into place.
// It uses the phone's own scrolling (scroll-snap), so the momentum and the "click" into place feel native.
// openWheel({ title, value: 'HH:MM' (24-hour), quick: [{ label, value }] , note: v => text, onSet: 'HH:MM' => void })
import { clock12 } from './core.js?v=6b9fa1564c';
import { esc } from './dom.js?v=6b9fa1564c';

const ROW = 44, pad = n => String(n).padStart(2, '0');
const $ = s => document.querySelector(s);

function column(items, sel, name, w) {
  return `<div class="wcol" data-col="${name}" style="width:${w}px" tabindex="0" role="listbox" aria-label="${name}">
    <div class="wpad"></div>${items.map((t, i) => `<div class="witem${i === sel ? ' on' : ''}" role="option">${t}</div>`).join('')}<div class="wpad"></div></div>`;
}
const pick = el => Math.max(0, Math.min(el.querySelectorAll('.witem').length - 1, Math.round(el.scrollTop / ROW)));

export function openWheel({ title, value, quick = [], note, onSet }) {
  $('#wheelOv')?.remove();
  const twelve = clock12(), [h0, m0] = (value || '09:00').split(':').map(Number);
  const hours = twelve ? [...Array(12)].map((_, i) => String(i + 1)) : [...Array(24)].map((_, i) => pad(i));
  const hSel = twelve ? (h0 + 11) % 12 : h0;
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay sheet-ov" id="wheelOv"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grab"></div><div class="sheethd"><button class="lnk mute" id="wCancel">Cancel</button><b>${esc(title)}</b><button class="lnk" id="wSet">Set</button></div>
    <div class="wheel">${column(hours, hSel, 'hour', 76)}${column([...Array(60)].map((_, i) => pad(i)), m0, 'minute', 64)}${twelve ? column(['am', 'pm'], h0 < 12 ? 0 : 1, 'am/pm', 64) : ''}</div>
    ${quick.length ? `<div class="wquick">${quick.map((q, i) => `<button class="chipb" data-q="${i}">${esc(q.label)}</button>`).join('')}</div>` : ''}
    <p class="wnote" id="wNote"></p></div></div>`);
  const ov = $('#wheelOv'), cols = [...ov.querySelectorAll('.wcol')];
  const value24 = () => { const [h, m, ap] = cols.map(pick); const hh = twelve ? ((h + 1) % 12) + (ap === 1 ? 12 : 0) : h; /* hour row 0 is 1 o'clock, row 11 is 12 */ return `${pad(hh)}:${pad(m)}`; };
  const refresh = () => { cols.forEach(c => { const i = pick(c); c.querySelectorAll('.witem').forEach((el, k) => el.classList.toggle('on', k === i)); }); if (note) $('#wNote').textContent = note(value24()); };
  const close = () => ov.remove();
  cols.forEach(c => {
    c.scrollTop = (c.querySelector('.witem.on') ? [...c.querySelectorAll('.witem')].indexOf(c.querySelector('.witem.on')) : 0) * ROW;
    let t; c.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(refresh, 60); });
    c.addEventListener('click', e => { const it = e.target.closest('.witem'); if (it) c.scrollTo({ top: [...c.querySelectorAll('.witem')].indexOf(it) * ROW, behavior: 'smooth' }); });
    c.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); c.scrollTop += e.key === 'ArrowDown' ? ROW : -ROW; } });
  });
  refresh();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  $('#wCancel').addEventListener('click', close);
  $('#wSet').addEventListener('click', () => { const v = value24(); close(); onSet(v); });
  ov.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { close(); onSet(quick[b.dataset.q].value); }));
  setTimeout(() => cols[0].focus({ preventScroll: true }), 50);
}
