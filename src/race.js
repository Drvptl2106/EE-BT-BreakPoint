// Breakathon view, shared by both pages: an illustrated island where everyone's character runs along the road to the
// Champion's Keep, the further the more punctual points they have, plus the ranking table.
// Also the characters themselves (used on the dashboard cards and as the agent's pep-talk buddy).
import { CONFIG } from './config.js';
import { esc } from './dom.js';

/* ---------------- the mascot ----------------
   A fuzzy, egg-shaped plush with tiny eyes, a big smile and a waving arm. Everyone starts the same (teal, nothing on);
   Breakathon champions unlock new colours and accessories (db/schema.sql: look_items(), claim_reward(), set_look()). */
export const LOOKS = {
  colours: { teal: ['Teal', '#17A09F'], blue: ['Blue', '#3D7BF2'], pink: ['Pink', '#FF7FAE'], yellow: ['Sunshine', '#FFC93C'],
             purple: ['Purple', '#9B7BFF'], green: ['Mint', '#3CCB8C'], orange: ['Orange', '#FF9447'] },
  accessories: { none: ['Nothing', ''], headset: ['Headset', '🎧'], cap: ['Cap', '🧢'], bow: ['Bow', '🎀'], glasses: ['Glasses', '👓'], scarf: ['Scarf', '🧣'], flower: ['Flower', '🌼'] },
};
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))).map(v => v.toString(16).padStart(2, '0')).join('');
/** The fur filter and colour gradients, added to the page once and shared by every mascot. */
function ensureDefs() {
  if (typeof document === 'undefined' || document.getElementById('bt-mascot-defs')) return;
  const grads = Object.entries(LOOKS.colours).map(([k, [, c]]) => `<radialGradient id="bt-g-${k}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${shade(c, 1.28)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, .72)}"/></radialGradient>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<svg id="bt-mascot-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${grads}
    <filter id="bt-fuzz" filterUnits="userSpaceOnUse" x="-12" y="-12" width="88" height="88"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>`);
}
const ACC = {
  headset: '<path d="M13 24Q13 5 32 5T51 24" stroke="#2B2B2B" stroke-width="2.6" fill="none"/><rect x="9" y="20" width="7" height="10" rx="3" fill="#2B2B2B"/><rect x="48" y="20" width="7" height="10" rx="3" fill="#2B2B2B"/><path d="M13 29q2 7 10 6" stroke="#2B2B2B" stroke-width="2" fill="none"/><circle cx="24" cy="35" r="2" fill="#2B2B2B"/>',
  cap: '<path d="M17 15Q19 4 32 4T47 15z" fill="#0E6E77"/><path d="M30 14h21q1 3-5 4H30z" fill="#0A5960"/><circle cx="32" cy="4.5" r="1.6" fill="#FFE03C"/>',
  bow: '<path d="M41 9l-8-6v12zM41 9l8-6v12z" fill="#FF5C8A" stroke="#C93A66" stroke-width="1.1" stroke-linejoin="round"/><circle cx="41" cy="9" r="2.3" fill="#C93A66"/>',
  glasses: '<circle cx="27" cy="21" r="4.6" fill="#fff" fill-opacity=".25" stroke="#222" stroke-width="1.6"/><circle cx="37" cy="21" r="4.6" fill="#fff" fill-opacity=".25" stroke="#222" stroke-width="1.6"/><path d="M31.6 21h.8" stroke="#222" stroke-width="1.6"/>',
  scarf: '<path d="M14 38q18 8 36 0v5q-18 8-36 0z" fill="#E8434F"/><path d="M40 42l3 11 5-2-3-10z" fill="#C7313C"/><path d="M18 40.5q14 5.5 28 0" stroke="#fff" stroke-width="1" stroke-dasharray="2 3" fill="none" opacity=".6"/>',
  flower: '<g transform="translate(20 10)">' + [0, 72, 144, 216, 288].map(a => `<ellipse rx="2.6" ry="4.2" fill="#fff" transform="rotate(${a}) translate(0 -3.6)"/>`).join('') + '<circle r="2.4" fill="#FFC93C"/></g>',
};
/** The mascot. look = { colour, accessory } (defaults to teal with nothing on).
    mood: happy (default, waving), sleepy (on a break), worried (running over), wow (celebrating). */
export function avatar(code, { look, crown = false, mood = 'happy' } = {}) {
  ensureDefs();
  const colour = LOOKS.colours[look?.colour] ? look.colour : 'teal', acc = ACC[look?.accessory] || '', fill = `url(#bt-g-${colour})`;
  const wave = mood === 'happy' || mood === 'wow';
  const arms = (wave ? `<g class="arm-wave"><ellipse cx="11" cy="21" rx="4.8" ry="9.5" transform="rotate(-24 11 21)" fill="${fill}" filter="url(#bt-fuzz)"/></g>`
                     : `<ellipse cx="11.5" cy="40" rx="4.6" ry="8.5" transform="rotate(18 11.5 40)" fill="${fill}" filter="url(#bt-fuzz)"/>`)
    + `<ellipse cx="52.5" cy="40" rx="4.6" ry="8.5" transform="rotate(-18 52.5 40)" fill="${fill}" filter="url(#bt-fuzz)"/>`;
  const eyes = mood === 'sleepy' ? '<path d="M25.5 21q2.5 2 5 0M33.5 21q2.5 2 5 0" stroke="#151515" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    : '<g class="blink" style="transform-box:fill-box;transform-origin:center"><ellipse cx="28" cy="21" rx="1.7" ry="2.3" fill="#151515"/><ellipse cx="36" cy="21" rx="1.7" ry="2.3" fill="#151515"/></g>';
  const face = { happy: '<path d="M25 26.5h14q0 8.5-7 8.5t-7-8.5z" fill="none" stroke="#151515" stroke-width="1.8" stroke-linejoin="round"/>',
    wow: '<path d="M24.5 26h15q0 10-7.5 10t-7.5-10z" fill="#2A1416"/><path d="M28 33.2q4 2.2 8 0" stroke="#FF7FAE" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    sleepy: '<ellipse cx="32" cy="29" rx="2" ry="1.6" fill="#151515"/><text x="45" y="12" font-size="8" font-weight="800" fill="#fff" stroke="#151515" stroke-width=".6">z</text><text x="50" y="6" font-size="6" font-weight="800" fill="#fff" stroke="#151515" stroke-width=".5">z</text>',
    worried: '<path d="M23.5 16.5l5-2M40.5 16.5l-5-2" stroke="#151515" stroke-width="1.5" stroke-linecap="round"/><path d="M27.5 30q2.2-2 4.5 0t4.5 0" stroke="#151515" stroke-width="1.6" fill="none" stroke-linecap="round"/>' }[mood] || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="overflow:visible">
    <ellipse cx="32" cy="61.5" rx="15" ry="2.4" fill="#000" opacity=".16"/>
    <ellipse cx="25" cy="57.5" rx="6.5" ry="4.2" fill="${fill}" filter="url(#bt-fuzz)"/><ellipse cx="39" cy="57.5" rx="6.5" ry="4.2" fill="${fill}" filter="url(#bt-fuzz)"/>
    ${arms}<path d="M32 6C46.5 6 53 19 53 33c0 15-8.5 25-21 25S11 48 11 33C11 19 17.5 6 32 6z" fill="${fill}" filter="url(#bt-fuzz)"/>
    ${look?.accessory === 'scarf' ? acc : ''}<ellipse cx="22.5" cy="27" rx="3.2" ry="2" fill="#FF6F91" opacity=".5"/><ellipse cx="41.5" cy="27" rx="3.2" ry="2" fill="#FF6F91" opacity=".5"/>
    ${eyes}${face}${look?.accessory && look.accessory !== 'scarf' ? acc : ''}
    ${crown ? '<path d="M23 3l4.5 4.5L32-1l4.5 8.5L41 3v7H23z" fill="#FFE03C" stroke="#A8860A" stroke-width="1.3" stroke-linejoin="round" transform="translate(0 -3)"/>' : ''}</svg>`;
}
const lookOf = r => ({ colour: r.colour, accessory: r.accessory });

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
export function raceHTML({ rows, me, isManager, champion, grant, prize }) {
  const B = CONFIG.breakathon, goal = Math.max(50, Math.ceil((rows[0]?.points || 0) * 1.12));
  const prizeTxt = !prize ? `prize: a ${B.rewardMinutes} min extra break or a new look` : !prize.choice ? 'still choosing their prize'
    : prize.choice === 'break' ? `picked a ${B.rewardMinutes} min extra break` : `unlocked ${itemName(prize.item)}`;
  const btn = grant && prize?.choice === 'break' ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Extra break given ✓' : `Give the ${B.rewardMinutes} min break`}</button>` : '';
  const champ = champion
    ? `<div class="champ"><span style="width:50px;height:50px;flex:none">${avatar(champion.code, { crown: true, mood: 'wow', look: lookOf(champion) })}</span><div>Last week's champion: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you! 🎉)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · ${prizeTxt}</span></div>${btn}</div>`
    : `<div class="champ"><div>🏆 No champion from last week yet. This week is wide open.</div></div>`;
  // runners bunched on the same score step aside a little so nobody hides behind someone else
  let prev = -1;
  const runners = rows.map((r, i) => { let f = Math.min(.97, r.points / goal); if (prev >= 0 && prev - f < .05) f = Math.max(0, prev - .05); prev = f;
    return `<button class="racer${r.code === me ? ' me' : ''}" data-f="${f}" data-code="${esc(r.code)}" style="left:7%;top:85%" aria-label="${esc(r.name)}, ${r.points} points, rank ${i + 1}">
      <span class="av">${avatar(r.code, { crown: i === 0 && r.points > 0, look: lookOf(r) })}</span><span class="tag">${esc(r.name)}${r.code === me ? ' (you)' : ''}</span>
      <span class="tip"><b>${i + 1}. ${esc(r.name)}</b><br>${r.points} points · ${r.onTime}/${r.breaks} on time${r.cleanDays ? ` · 🔥 ${r.cleanDays} clean day${r.cleanDays > 1 ? 's' : ''}` : ''}${isManager ? `<br>${r.overMinutes ?? 0} min over` : ''}</span></button>`; }).join('');
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>Racer</th><th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}" data-code="${esc(r.code)}"><td>${i < 3 && r.points > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td class="person">${avatar(r.code, { look: lookOf(r) })}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td><td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays ? '🔥 ' + r.cleanDays : '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
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

/* ---------------- your mascot and your prize (agent page) ---------------- */
export const itemName = item => { const [k, v] = String(item || '').split(':'); return k === 'colour' ? `${LOOKS.colours[v]?.[0] || v} colour` : `${LOOKS.accessories[v]?.[1] || ''} ${LOOKS.accessories[v]?.[0] || v}`.trim(); };
/** mine = my_rewards(): { colour, accessory, unlocked[], champion, claimed, claimed_item }. picking = choosing a look as the prize. */
export function prizeHTML(mine, picking) {
  const B = CONFIG.breakathon;
  if (!mine?.champion) return '';
  if (mine.claimed === 'break') return `<div class="prize done">🎉 You picked a <b>${B.rewardMinutes} min extra break</b> for winning last week. Your team lead will add it to your day.</div>`;
  if (mine.claimed === 'look') return `<div class="prize done">🎉 You unlocked <b>${esc(itemName(mine.claimed_item))}</b> for winning last week. Looking good!</div>`;
  if (picking) return `<div class="prize"><b>✨ Pick your new look:</b> tap any 🔒 colour or accessory below to unlock it. <button class="btn ghost sm" data-prize="cancel">Back</button></div>`;
  return `<div class="prize"><div><b>🏆 You won last week!</b> Pick your prize:</div><div class="row"><button class="btn yellow" data-prize="break">⏰ ${B.rewardMinutes} min extra break</button><button class="btn teal" data-prize="look">✨ Unlock a new look</button></div></div>`;
}
export function lookPanelHTML(code, mine, picking) {
  const has = item => item === 'colour:teal' || item === 'acc:none' || (mine?.unlocked || []).includes(item), cur = { colour: mine?.colour || 'teal', accessory: mine?.accessory || 'none' };
  const sw = (kind, key, label, inner) => { const item = `${kind === 'colour' ? 'colour' : 'acc'}:${key}`, open = has(item), on = cur[kind] === key;
    return `<button class="sw${on ? ' on' : ''}${open ? '' : ' locked'}${!open && picking ? ' pick' : ''}" data-${kind}="${key}" aria-pressed="${on}" ${!open && !picking ? 'disabled' : ''} title="${esc(open ? label : picking ? `Unlock ${label}` : `${label}: win a week of Breakathon to unlock`)}">${inner}${open ? '' : '<i>🔒</i>'}<small>${esc(label)}</small></button>`; };
  return `<section class="panel"><div class="phead"><h2>Your mascot</h2><span class="hint">Everyone starts the same. Win a week to unlock a new colour or accessory.</span></div>
    <div class="lookgrid"><div class="lookprev">${avatar(code, { look: cur, mood: 'wow' })}</div><div>
    <h3 style="margin-top:0">Colour</h3><div class="swatches">${Object.entries(LOOKS.colours).map(([k, [l, c]]) => sw('colour', k, l, `<span class="dot" style="background:${c}"></span>`)).join('')}</div>
    <h3>Accessory</h3><div class="swatches">${Object.entries(LOOKS.accessories).map(([k, [l, e]]) => sw('accessory', k, l, `<span class="mini-av">${avatar(code, { look: { colour: cur.colour, accessory: k } })}</span>`)).join('')}</div>
    </div></div></section>`;
}
