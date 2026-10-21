// Breakathon view, shared by both pages: an illustrated island where everyone's character runs along the road to the
// Champion's Keep, the further the more punctual points they have, plus the ranking table.
// Also the characters themselves (used on the dashboard cards and as the agent's pep-talk buddy).
import { CONFIG } from './config.js';
import { esc } from './dom.js';

const COLOURS = ['#17A09F', '#FFC93C', '#FF7A9A', '#8B6CFF', '#3CCB8C', '#FF9F43', '#3D8BFF', '#F06CC0', '#22C1E6', '#A3CB38', '#FF6B5E', '#B07CFF'];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A little round character, always the same colour and accessory for the same code.
    mood: happy (default), sleepy (on a break), worried (running over), wow (shift complete). */
export function avatar(code, { crown = false, mood = 'happy' } = {}) {
  const h = hash(code), c = COLOURS[h % COLOURS.length], acc = (h >> 4) % 4;
  const top = crown ? '<path d="M20 9l6 6 6-9 6 9 6-6v10H20z" fill="#FFE03C" stroke="#A8860A" stroke-width="1.6" stroke-linejoin="round"/><circle cx="32" cy="6" r="2" fill="#FF7A9A"/>'
    : ['<path d="M32 12c0-6 3-9 8-9-1 5-4 8-8 9z" fill="#3CCB8C"/><path d="M32 12c0-5-3-7-7-7 1 4 3 6 7 7z" fill="#2EA36E"/>',
       '<path d="M32 12V5" stroke="#333" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="4" r="3.2" fill="#FFE03C" stroke="#333" stroke-width="1.2"/>',
       '<path d="M32 11l-8-5v9zM32 11l8-5v9z" fill="#FF7A9A" stroke="#C94F6E" stroke-width="1.2" stroke-linejoin="round"/><circle cx="32" cy="11" r="2.4" fill="#C94F6E"/>',
       '<path d="M27 12q1-6 4-7M32 12q0-6 2-8M37 12q-1-5-4-6" stroke="' + c + '" stroke-width="3" fill="none" stroke-linecap="round" style="filter:brightness(.8)"/>'][acc];
  const eyes = mood === 'sleepy'
    ? '<path d="M19.5 33q4.5 4 9 0M35.5 33q4.5 4 9 0" stroke="#1B1B1B" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : `<g class="blink" style="transform-box:fill-box;transform-origin:center"><ellipse cx="24" cy="32" rx="5" ry="6.4" fill="#1B1B1B"/><ellipse cx="40" cy="32" rx="5" ry="6.4" fill="#1B1B1B"/>
       <circle cx="25.9" cy="29.6" r="1.9" fill="#fff"/><circle cx="41.9" cy="29.6" r="1.9" fill="#fff"/><circle cx="22.6" cy="34.4" r=".9" fill="#fff"/><circle cx="38.6" cy="34.4" r=".9" fill="#fff"/></g>`;
  const brows = mood === 'worried' ? '<path d="M18 23l9 2.5M46 23l-9 2.5" stroke="#1B1B1B" stroke-width="2.4" stroke-linecap="round"/>' : '';
  const mouth = { happy: '<path d="M28 41.5q4 4 8 0" stroke="#1B1B1B" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    sleepy: '<ellipse cx="32" cy="43" rx="2.4" ry="1.8" fill="#1B1B1B"/><text x="47" y="16" font-size="9" font-weight="800" fill="#fff" stroke="#1B1B1B" stroke-width=".6">z</text>',
    worried: '<ellipse cx="32" cy="43.5" rx="3" ry="3.6" fill="#1B1B1B"/>',
    wow: '<path d="M26 40h12q0 7-6 7t-6-7z" fill="#1B1B1B"/><path d="M29 44.5q3 2 6 0" stroke="#FF7A9A" stroke-width="2" fill="none"/>' }[mood] || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${top}
    <path d="M32 11c14.5 0 25 10.5 25 25 0 13-10.5 21-25 21S7 49 7 36c0-14.5 10.5-25 25-25z" fill="${c}"/>
    <ellipse cx="22" cy="21" rx="7" ry="4.5" fill="#fff" opacity=".35" transform="rotate(-25 22 21)"/>
    <ellipse cx="32" cy="50" rx="16" ry="5" fill="#000" opacity=".08"/>
    ${brows}${eyes}<ellipse cx="16.5" cy="40.5" rx="4.2" ry="2.7" fill="#FF8FA3" opacity=".75"/><ellipse cx="47.5" cy="40.5" rx="4.2" ry="2.7" fill="#FF8FA3" opacity=".75"/>${mouth}</svg>`;
}

/* ---------------- the island ---------------- */
const ROAD = 'M70 392 C150 400 200 330 250 318 S350 352 420 330 S470 240 540 236 S650 284 700 236 S730 150 800 140 S880 128 905 96';
const tree = (x, y, s = 1, col = '#2F7D3A') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="4" width="6" height="12" rx="2" fill="#6B4A2B"/><circle r="13" fill="${col}"/><circle cx="-5" cy="-5" r="5" fill="#fff" opacity=".18"/></g>`;
const pine = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2.5" y="8" width="5" height="9" fill="#6B4A2B"/><path d="M0-18L13 10H-13z" fill="#245C33"/><path d="M0-18L5-8H-5z" fill="#fff" opacity=".25"/></g>`;
const MAP = `<svg viewBox="0 0 1000 460" aria-hidden="true">
  <rect width="1000" height="460" fill="#5B8FD6"/>
  ${[60, 150, 420, 880].map((y, i) => `<path class="wave" style="animation-delay:-${i}s" d="M${20 + i * 230} ${y} q12-8 24 0 t24 0" stroke="#8FB6EA" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}
  <path d="M40 420 C20 330 60 250 140 230 C170 140 300 70 450 80 C560 40 700 50 800 60 C900 40 975 110 965 200 C990 290 930 380 820 410 C690 450 520 440 400 445 C260 452 90 460 40 420z" fill="#EBD8A0"/>
  <path d="M62 405 C48 330 84 262 156 246 C190 160 310 96 452 104 C562 66 698 74 796 84 C890 70 950 128 940 205 C962 282 910 360 812 388 C690 424 520 418 402 422 C266 428 104 434 62 405z" fill="#58A84E"/>
  <path d="M62 405 C48 330 84 262 156 246 C190 200 230 190 260 205 C250 270 200 300 170 330 C150 360 120 400 62 405z" fill="#7B57C9"/>
  <path d="M452 104 C562 66 698 74 796 84 C820 130 760 170 700 160 C640 150 600 120 540 140 C500 150 470 140 452 104z" fill="#C9874A"/>
  <path d="M640 300 C700 290 760 300 780 340 C800 380 740 400 690 395 C640 390 610 360 615 335 C618 315 625 303 640 300z" fill="#3E7FD0" stroke="#9CC4F2" stroke-width="5"/>
  <path d="M330 110 C340 170 300 210 330 260 C350 300 400 300 420 360 C430 390 420 410 430 430" stroke="#3E7FD0" stroke-width="16" fill="none" stroke-linecap="round"/>
  <path d="M330 110 C340 170 300 210 330 260 C350 300 400 300 420 360 C430 390 420 410 430 430" stroke="#7FB0EC" stroke-width="4" fill="none" stroke-dasharray="10 14" stroke-linecap="round"/>
  ${[[575, 118], [612, 106], [650, 120], [690, 100]].map(([x, y]) => `<path d="M${x - 28} ${y + 22}L${x} ${y - 24}L${x + 28} ${y + 22}z" fill="#8C7A6B"/><path d="M${x} ${y - 24}l10 16-10-4-10 4z" fill="#fff"/>`).join('')}
  <path d="${ROAD}" stroke="#B88A55" stroke-width="30" fill="none" stroke-linecap="round"/>
  <path id="road" d="${ROAD}" stroke="#EAD09A" stroke-width="22" fill="none" stroke-linecap="round"/>
  <path d="${ROAD}" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" fill="none" stroke-dasharray="10 12"/>
  <rect x="395" y="322" width="44" height="34" rx="4" fill="#8B5A2B" transform="rotate(-18 417 339)"/><path d="M398 330l40-14M402 344l40-14" stroke="#5E3A1A" stroke-width="2" transform="rotate(0)"/>
  ${[[110, 300], [135, 335], [95, 360], [190, 280], [215, 300]].map(([x, y]) => tree(x, y, 1, '#4B2F8F')).join('')}
  ${[[300, 400], [480, 400], [520, 380], [560, 330], [360, 200], [230, 380], [760, 210], [850, 230], [880, 300], [820, 330], [500, 180], [460, 300], [600, 410]].map(([x, y], i) => tree(x, y, i % 3 ? 1 : 1.2)).join('')}
  ${[[880, 180], [910, 220], [780, 90], [740, 120], [260, 150], [290, 130]].map(([x, y]) => pine(x, y)).join('')}
  <g transform="translate(905 88)"><rect x="-42" y="-10" width="84" height="44" fill="#E9E2D2" stroke="#8A7F6A" stroke-width="2"/>
    <rect x="-52" y="-34" width="24" height="68" fill="#DCD3BF" stroke="#8A7F6A" stroke-width="2"/><rect x="28" y="-34" width="24" height="68" fill="#DCD3BF" stroke="#8A7F6A" stroke-width="2"/>
    <path d="M-56-34h32l-16-20zM24-34h32l-16-20z" fill="#0E6E77"/><path d="M-12 34v-22a12 12 0 0124 0v22z" fill="#6B4A2B"/>
    <path d="M-40-34v-6M-44-34v-4" stroke="#8A7F6A"/><line x1="40" y1="-54" x2="40" y2="-80" stroke="#555" stroke-width="2"/><path class="flagw" d="M40-80h24l-6 7 6 7H40z" fill="#FFE03C"/>
    <text x="0" y="-16" text-anchor="middle" font-size="22">🏆</text></g>
  <g transform="translate(58 378)"><rect x="-4" y="-46" width="5" height="50" fill="#555"/><rect x="34" y="-46" width="5" height="50" fill="#555"/>
    <rect x="-4" y="-50" width="43" height="16" fill="#fff" stroke="#333" stroke-width="1.5"/><text x="17.5" y="-38" text-anchor="middle" font-size="11" font-weight="800" fill="#1B1B1B">START</text></g>
  <text class="lbl" x="92" y="268">Warm-up Woods</text><text class="lbl" x="500" y="300">On-time Meadows</text>
  <text class="lbl" x="560" y="182">Upgrade Peaks</text><text class="lbl" x="640" y="365">Lunch Lagoon</text><text class="lbl" x="790" y="50">Champion's Keep</text>
  <g class="cloud" opacity=".85"><ellipse cx="0" cy="40" rx="42" ry="14" fill="#fff"/><ellipse cx="22" cy="30" rx="26" ry="14" fill="#fff"/></g>
  <g class="cloud c2" opacity=".7"><ellipse cx="0" cy="120" rx="34" ry="11" fill="#fff"/><ellipse cx="-16" cy="112" rx="20" ry="11" fill="#fff"/></g>
  <g id="milestones"></g>
</svg>`;

/** rows: ranked [{ code, name, breaks, onTime, cleanDays, overMinutes, points }]. Call placeRacers() after inserting. */
export function raceHTML({ rows, me, isManager, champion, grant }) {
  const B = CONFIG.breakathon, goal = Math.max(50, Math.ceil((rows[0]?.points || 0) * 1.12));
  const champ = champion
    ? `<div class="champ"><span style="width:46px;height:46px;flex:none">${avatar(champion.code, { crown: true, mood: 'wow' })}</span><div>Last week's champion: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you! 🎉)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · reward: ${B.rewardMinutes} min extra break</span></div>${grant ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Reward given today ✓' : `Give ${B.rewardMinutes} min reward`}</button>` : ''}</div>`
    : `<div class="champ"><div>🏆 No champion from last week yet. This week is wide open.</div></div>`;
  // runners bunched on the same score step aside a little so nobody hides behind someone else
  let prev = -1;
  const runners = rows.map((r, i) => { let f = Math.min(.97, r.points / goal); if (prev >= 0 && prev - f < .05) f = Math.max(0, prev - .05); prev = f;
    return `<button class="racer${r.code === me ? ' me' : ''}" data-f="${f}" data-code="${esc(r.code)}" style="left:7%;top:85%" aria-label="${esc(r.name)}, ${r.points} points, rank ${i + 1}">
      <span class="av">${avatar(r.code, { crown: i === 0 && r.points > 0 })}</span><span class="tag">${esc(r.name)}${r.code === me ? ' (you)' : ''}</span>
      <span class="tip"><b>${i + 1}. ${esc(r.name)}</b><br>${r.points} points · ${r.onTime}/${r.breaks} on time${r.cleanDays ? ` · 🔥 ${r.cleanDays} clean day${r.cleanDays > 1 ? 's' : ''}` : ''}${isManager ? `<br>${r.overMinutes ?? 0} min over` : ''}</span></button>`; }).join('');
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>Racer</th><th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}" data-code="${esc(r.code)}"><td>${i < 3 && r.points > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td class="person">${avatar(r.code)}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td><td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays ? '🔥 ' + r.cleanDays : '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  return `${champ}<div class="map" data-goal="${goal}">${MAP}<div class="racers">${runners || ''}</div></div>
    ${rows.length ? '' : '<p class="empty">Nobody in the race yet.</p>'}${table}
    <p class="hint">Everyone runs to Champion's Keep 🏰 (${goal} points). ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute over. Monday to Sunday. The weekly winner gets a ${B.rewardMinutes} min extra break 🏆 Tap a racer to see their score.</p>`;
}

/** Sends each racer running along the road to their spot, and puts milestone flags on the road. Safe to call repeatedly. */
export function placeRacers(root) {
  const road = root.querySelector('#road'); if (!road?.getTotalLength) return;
  const L = road.getTotalLength(), at = f => road.getPointAtLength(L * f), goal = Number(root.querySelector('.map')?.dataset.goal || 50);
  const ms = root.querySelector('#milestones');
  if (ms && !ms.childElementCount) ms.innerHTML = [.25, .5, .75].map(f => { const p = at(f);
    return `<g transform="translate(${p.x} ${p.y - 14})"><line y1="0" y2="-26" stroke="#5E3A1A" stroke-width="2.5"/><path d="M0-26h18l-4 5 4 5H0z" fill="#FFE03C" stroke="#A8860A"/><text x="2" y="-29" font-size="13" font-weight="800" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${Math.round(goal * f)}</text></g>`; }).join('');
  requestAnimationFrame(() => root.querySelectorAll('.racer[data-f]').forEach((el, i) => {
    const p = at(Number(el.dataset.f)), wobble = (i % 2 ? 1 : -1) * 9;
    el.style.left = `${p.x / 10}%`; el.style.top = `${(p.y + wobble) / 4.6}%`;
  }));
}
/** Tapping a racer shows their card and highlights their row in the table. */
export function wireRacers(root) {
  root.addEventListener('click', e => {
    const r = e.target.closest('.racer'); if (!r) return;
    const on = !r.classList.contains('sel');
    root.querySelectorAll('.racer.sel').forEach(x => x.classList.remove('sel')); root.querySelectorAll('tr.hl').forEach(x => x.classList.remove('hl'));
    if (on) { r.classList.add('sel'); root.querySelector(`tr[data-code="${CSS.escape(r.dataset.code)}"]`)?.classList.add('hl'); }
  });
}
