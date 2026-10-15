import { esc } from './dom.js';
import { fmtClock } from './format.js';
import { toneOf } from './tones.js';

const R = 80;
const C = 2 * Math.PI * R;

/** Returns the inner markup of the donut <svg> and the legend. */
export function donutMarkup(summary) {
  const total = summary.totalMinutes || 1;
  let cumulative = 0;
  const arcs = summary.slots.map((slot) => {
    const shareDeg = (slot.minutes / total) * 360;
    const arc = { slot, startDeg: cumulative, shareDeg, frac: slot.minutes ? Math.min(1, slot.used / slot.minutes) : 1 };
    cumulative += shareDeg;
    return arc;
  });

  const rotate = (deg) => `rotate(${-90 + deg} 100 100)`;
  const bg = arcs.map((a) => {
    const len = (a.shareDeg / 360) * C;
    return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--paper-dim)" stroke-opacity="0.15" stroke-width="20" stroke-dasharray="${len} ${C - len}" transform="${rotate(a.startDeg)}" />`;
  }).join('');

  const fg = arcs.map((a) => {
    const len = (a.shareDeg / 360) * C;
    const filled = a.slot.over ? len : len * a.frac;
    if (filled < 0.5) return '';
    const color = a.slot.over ? 'var(--alert)' : toneOf(a.slot).color;
    return `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${filled} ${C - filled}" transform="${rotate(a.startDeg)}" />`;
  }).join('');

  const svg = `${bg}${fg}
    <text x="100" y="96" class="donut-center-num">${Math.round(summary.totalUsed)}</text>
    <text x="100" y="118" class="donut-center-label">of ${summary.totalMinutes} min</text>`;

  const legend = summary.slots.map((slot) => {
    const finished = slot.sessions.filter((s) => s.end != null);
    let time;
    if (slot.active) time = `${fmtClock(slot.active.start)} \u2013 in progress`;
    else if (finished.length) time = finished.map((s) => `${fmtClock(s.start)}\u2013${fmtClock(s.end)}`).join(', ');
    else time = 'not taken yet';
    if (slot.over) time += ` (+${Math.round(slot.used - slot.minutes)}m over)`;
    const dot = slot.over ? 'over' : toneOf(slot).dot;
    return `
      <div class="legend-row">
        <div class="legend-dot ${dot}"></div>
        <div>
          <div class="legend-name">${esc(slot.label)}${slot.adjusted ? ' \u2022' : ''}</div>
          <div class="legend-time ${slot.over ? 'over-text' : ''}">${esc(time)}</div>
        </div>
      </div>`;
  }).join('');

  return { svg, legend };
}
