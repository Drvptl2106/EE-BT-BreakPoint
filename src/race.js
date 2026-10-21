// Breakathon view, shared by both pages: a race track where each person's character runs further the more
// punctual points they have, plus the ranking table. Pure markup; the pages fetch the scores (core.breakathon).
import { CONFIG } from './config.js';
import { esc } from './dom.js';

const COLOURS = ['#00B2A9', '#FFD200', '#FF6B8B', '#7C5CFF', '#3CCB8C', '#FF9F1C', '#2E86DE', '#E84393', '#00A8E8', '#A3CB38', '#F25F5C', '#9B5DE5'];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A little character, always the same colour and face for the same code. */
export function avatar(code, { crown = false } = {}) {
  const h = hash(code), c = COLOURS[h % COLOURS.length], grin = h % 3;
  const mouth = ['<path d="M25 45q7 6 14 0" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    '<ellipse cx="32" cy="46" rx="4.5" ry="3.5" fill="#111"/>',
    '<path d="M26 46h12" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>'][grin];
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${crown ? '<path d="M21 13l5.5 6 5.5-9 5.5 9 5.5-6v9H21z" fill="#FFD200" stroke="#9C7A00" stroke-width="1.5" stroke-linejoin="round"/>' : ''}
    <rect x="22" y="53" width="6" height="8" rx="3" fill="#333"/><rect x="36" y="53" width="6" height="8" rx="3" fill="#333"/>
    <ellipse cx="32" cy="39" rx="20" ry="18" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
    <ellipse cx="25" cy="35" rx="5" ry="6" fill="#fff"/><ellipse cx="39" cy="35" rx="5" ry="6" fill="#fff"/>
    <circle cx="26.5" cy="36" r="2.6" fill="#111"/><circle cx="40.5" cy="36" r="2.6" fill="#111"/>${mouth}</svg>`;
}

/** rows: ranked [{ code, name, breaks, onTime, cleanDays, overMinutes, points }]. */
export function raceHTML({ rows, me, isManager, champion, grant }) {
  const B = CONFIG.breakathon, max = Math.max(30, ...rows.map(r => r.points));
  const champ = champion
    ? `<div class="champ">${avatar(champion.code, { crown: true }).replace('<svg', '<svg style="width:42px;height:42px"')}<div>Last week's champion: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you! 🎉)' : ''}<br><span style="opacity:.8;font-size:14px">${champion.points} points · reward: ${B.rewardMinutes} min extra break</span></div>${grant ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Reward given today ✓' : `Give ${B.rewardMinutes} min reward`}</button>` : ''}</div>`
    : `<div class="champ"><div>🏆 No champion from last week yet. This week is wide open.</div></div>`;
  const lanes = rows.length ? rows.map((r, i) => `<div class="lane"><div class="racer${r.code === me ? ' me' : ''}" style="left:${8 + (r.points / max) * 78}%">${avatar(r.code, { crown: i === 0 && r.points > 0 })}<span>${esc(r.name)}${r.code === me ? ' (you)' : ''} · ${r.points}</span></div></div>`).join('')
    : '<p class="empty">Nobody in the race yet.</p>';
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>Racer</th><th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] && r.points > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td class="person">${avatar(r.code)}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td><td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays ? '🔥 ' + r.cleanDays : '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  return `${champ}<div class="track" role="img" aria-label="Breakathon race: ${rows.map(r => `${esc(r.name)} ${r.points} points`).join(', ')}">${lanes}</div>${table}
    <p class="hint">${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute over. Monday to Sunday. The weekly winner gets a ${B.rewardMinutes} min extra break 🏆</p>`;
}
