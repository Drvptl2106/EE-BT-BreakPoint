import { esc } from './dom.js';
import { fmtMMSS } from './format.js';
import { donutMarkup } from './donut.js';

/** The three (or more) start/stop buttons. The markup is stable from second to
 *  second; only the live timer text changes, via tickTimers(). */
export function controlsHtml(summary) {
  const anyActive = summary.slots.some((s) => s.active);
  return summary.slots.map((slot) => {
    const isActive = Boolean(slot.active);
    const locked = anyActive && !isActive;
    const state = isActive ? `state-active${slot.tone === 'lunch' ? ' type-lunch' : ''}` : locked ? 'state-locked' : 'state-idle';
    const sub = isActive
      ? `<div class="sub live-timer" data-live-slot="${esc(slot.key)}" data-start="${slot.active.start}" data-limit="${slot.minutes}">--:--</div>`
      : `<div class="sub">${slot.minutes} min allowed${slot.used > 0.4 ? ` \u00b7 ${Math.round(slot.used)}m used` : ''}</div>`;
    return `
      <button class="control-btn ${state}" data-action="toggle-break" data-slot="${esc(slot.key)}" ${locked ? 'disabled' : ''}>
        <div>
          <div class="label">${esc(slot.label)}</div>
          ${sub}
        </div>
        <div class="action">${isActive ? 'Stop' : 'Start'}</div>
      </button>`;
  }).join('');
}

/** Updates the running countdown text in place, once per second. */
export function tickTimers(root, nowMs) {
  root.querySelectorAll('[data-live-slot]').forEach((el) => {
    const remaining = Number(el.dataset.limit) * 60000 - (nowMs - Number(el.dataset.start));
    const over = remaining < 0;
    el.textContent = `${over ? '+' : ''}${fmtMMSS(Math.abs(remaining))} ${over ? 'over' : 'left'}`;
    el.classList.toggle('over', over);
  });
}

export function agentDonut(summary) {
  return donutMarkup(summary);
}
