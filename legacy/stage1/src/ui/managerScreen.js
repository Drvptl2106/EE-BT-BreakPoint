import { esc } from './dom.js';
import { donutMarkup } from './donut.js';
import { displayName } from './selectors.js';

export function headerHtml(config) {
  const cols = config.defaultSlots.map((s) => `<th>${esc(s.label)}</th>`).join('');
  return `<tr><th>Name</th>${cols}<th>Flag</th></tr>`;
}

/** rows: [{ user, summary }] for the agents the manager is allowed to see. */
export function rosterHtml(rows, config, expandedId) {
  const colspan = config.defaultSlots.length + 2;
  return rows.map(({ user, summary }) => {
    const cells = config.defaultSlots.map((def) => {
      const slot = summary.slots.find((s) => s.key === def.key);
      return `<td class="cell-mins ${slot.over ? 'over' : ''}">${Math.round(slot.used)}/${slot.minutes}m${slot.adjusted ? ' \u2022' : ''}</td>`;
    }).join('');
    const open = expandedId === user.id;
    const detail = open ? (() => {
      const { svg, legend } = donutMarkup(summary);
      return `
      <tr class="detail-row">
        <td colspan="${colspan}">
          <div class="detail-panel">
            <div class="employee-grid">
              <div class="card" style="display:flex;align-items:center;justify-content:center;">
                <svg class="donut-svg" viewBox="0 0 200 200">${svg}</svg>
              </div>
              <div class="card">
                <h3 class="section-title">${esc(displayName(user))} \u2014 today</h3>
                <div class="legend">${legend}</div>
              </div>
            </div>
          </div>
        </td>
      </tr>`;
    })() : '';
    return `
      <tr class="employee-row" data-action="toggle-row" data-user="${esc(user.id)}">
        <td class="roster-name-cell">
          <span class="avatar">${esc(user.initials)}</span>
          ${esc(displayName(user))}
          <span class="chevron">${open ? '\u25be' : '\u25b8'}</span>
        </td>
        ${cells}
        <td>${summary.anyOver ? '<span class="flag-badge">\u26a0 over</span>' : '<span class="flag-none">\u2013</span>'}</td>
      </tr>${detail}`;
  }).join('');
}
