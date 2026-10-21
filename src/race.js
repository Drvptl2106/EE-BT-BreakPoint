// Breakathon view, shared by both pages: an illustrated island where everyone's character runs along the road to the
// Champion's Keep, the further the more punctual points they have, plus the ranking table.
// Also the characters themselves (used on the dashboard cards and as the agent's pep-talk buddy).
import { CONFIG } from './config.js';
import { esc } from './dom.js';

/* ---------------- the mascot ----------------
   A soft felt pebble with big googly eyes and a tiny mouth. No body, no fuss: personality comes from the SHAPE
   (each person gets one of five, picked from their code) and the eyelids. Moods: happy, sleepy (half-closed lids, on a break),
   worried (wide eyes, little "o", running over), wow (happy squint, shift done).
   Everyone has their own colour from day one; Breakathon champions unlock accessories (db/schema.sql: look_items()).
   The 'body' option is accepted for older callers and ignored. */
export const LOOKS = {
  colours: { teal: ['Teal', '#2FB5B0'], blue: ['Blue', '#8DB2F2'], pink: ['Pink', '#F370B0'], yellow: ['Sunshine', '#F7D65E'], purple: ['Lilac', '#BBA8EC'],
             green: ['Lime', '#9DD35C'], orange: ['Peach', '#F8AE6E'], coral: ['Blush', '#F7C3CD'], sky: ['Sky', '#93D5EE'], lilac: ['Plum', '#C98BD8'] },
  accessories: { none: ['Nothing', ''], cap: ['Cap', '🧢'], scarf: ['Scarf', '🧣'], boots: ['Boots', '🥾'], bow: ['Bow', '🎀'], glasses: ['Glasses', '👓'], sprout: ['Sprout', '🌱'] },
};
const COLOUR_KEYS = Object.keys(LOOKS.colours);
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** A well-mixed hash (FNV-1a), so neighbouring codes like EE-001 and EE-002 still get different shapes. */
const mix = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** The colour someone's mascot actually shows ('auto' or unknown = picked from their code, so a team looks varied). */
export const colourOf = (code, colour) => LOOKS.colours[colour] ? colour : COLOUR_KEYS[hash(code) % COLOUR_KEYS.length];
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))).map(v => v.toString(16).padStart(2, '0')).join('');
/** Soft felt shading per colour, added to the page once and shared by every mascot. */
function ensureDefs() {
  if (typeof document === 'undefined' || document.getElementById('bt-mascot-defs')) return;
  const grads = Object.entries(LOOKS.colours).map(([k, [, c]]) => `<radialGradient id="bt-g-${k}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${shade(c, 1.07)}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, .9)}"/></radialGradient>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<svg id="bt-mascot-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${grads}</defs></svg>`);
}
/* Five pebble shapes. top = where the head is (for hats), y = eye line, w = how far apart the eyes sit, x = face centre. */
const SHAPES = [
  { d: 'M32 12C48 12 58 25 58 41c0 13-10 19-26 19S6 54 6 41C6 25 16 12 32 12z', top: 12, x: 32, y: 32, w: 7.5 },          // round pebble
  { d: 'M32 4c11 0 18 9 18 22v19c0 10-7 15-18 15S14 55 14 45V26C14 13 21 4 32 4z', top: 4, x: 32, y: 21, w: 6.8 },           // tall
  { d: 'M32 7c9 0 14 8 14 17 0 6 11 11 11 22 0 9-10 14-25 14S7 55 7 46c0-11 11-16 11-22 0-9 5-17 14-17z', top: 7, x: 32, y: 22, w: 6.5 }, // pear
  { d: 'M32 13c6 0 10 6 15 15 6 11 11 17 11 23 0 7-11 9-26 9S6 58 6 51c0-6 5-12 11-23 5-9 9-15 15-15z', top: 13, x: 32, y: 37, w: 7 },  // soft triangle
  { d: 'M27 6c12-2 23 8 23 21 0 6 8 12 8 21 0 8-10 12-26 12S6 56 6 47c0-9 4-14 6-20C14 15 17 8 27 6z', top: 6, x: 30, y: 23, w: 7 },     // leaning bean
];
const ACC = {   // f = the chosen shape
  cap: f => `<path d="M${f.x - 14} ${f.top + 9}Q${f.x - 13} ${f.top - 4} ${f.x} ${f.top - 4}T${f.x + 14} ${f.top + 9}z" fill="#E8434F"/><path d="M${f.x - 2} ${f.top + 7.5}h18q.5 3.2-5 3.6H${f.x - 2}z" fill="#B92F3A"/><circle cx="${f.x}" cy="${f.top - 3.6}" r="1.6" fill="#B92F3A"/>`,
  bow: f => `<g transform="translate(${f.x + 10} ${f.top + 4}) rotate(18)"><path d="M0 0l-6-4.5v9zM0 0l6-4.5v9z" fill="#FF5C8A" stroke="#C93A66" stroke-width="1" stroke-linejoin="round"/><circle r="2" fill="#C93A66"/></g>`,
  sprout: f => `<path d="M${f.x} ${f.top + 1}V${f.top - 4}" stroke="#2E8B57" stroke-width="1.6" stroke-linecap="round"/><path d="M${f.x} ${f.top - 3}q0-5 6-5-1 5-6 5z" fill="#45C08A"/><path d="M${f.x} ${f.top - 3}q0-4-5-4 1 4 5 4z" fill="#2E8B57"/>`,
  glasses: f => `<circle cx="${f.x - f.w}" cy="${f.y}" r="7.3" fill="#fff" fill-opacity=".12" stroke="#2B2B2B" stroke-width="1.5"/><circle cx="${f.x + f.w}" cy="${f.y}" r="7.3" fill="#fff" fill-opacity=".12" stroke="#2B2B2B" stroke-width="1.5"/><path d="M${f.x - f.w + 7.3} ${f.y - 1}q${f.w - 7.3} -2 ${2 * (f.w - 7.3) + .6} 0" stroke="#2B2B2B" stroke-width="1.5" fill="none"/>`,
  scarf: f => `<path d="M${f.x - 17} ${f.y + 15}q17 6 34 0v5q-17 6-34 0z" fill="#E8434F"/><path d="M${f.x + 8} ${f.y + 19}l2 8 4.5-1.6-2-7.4z" fill="#B92F3A"/>`,
  boots: () => '<rect x="19" y="57.5" width="10" height="5.5" rx="2.6" fill="#8B5A2B"/><rect x="35" y="57.5" width="10" height="5.5" rx="2.6" fill="#8B5A2B"/><path d="M20.5 59h7M36.5 59h7" stroke="#C99A62" stroke-width="1.1"/>',
};
/** The mascot. look = { colour, accessory }. mood: happy | sleepy | worried | wow. */
export function avatar(code, { look, crown = false, mood = 'happy' } = {}) {
  ensureDefs();
  const col = colourOf(code, look?.colour), f = SHAPES[mix(code + 'shape') % SHAPES.length], lid = shade(LOOKS.colours[col][1], .82);
  const L = f.x - f.w, R = f.x + f.w, y = f.y, look2 = mix(code + 'eyes') % 3 - 1;   // each one glances a little differently
  const white = (x, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1B1B1B" stroke-opacity=".12" stroke-width=".8"/>`;
  const pupil = (x, r = 2.9) => `<circle cx="${x + look2 * 1.2}" cy="${y + .6}" r="${r}" fill="#141414"/><circle cx="${x + look2 * 1.2 + .9}" cy="${y - .4}" r=".8" fill="#fff"/>`;
  const eyes = {
    happy: white(L) + white(R) + pupil(L) + pupil(R),
    sleepy: white(L) + white(R) + pupil(L, 2.6) + pupil(R, 2.6)
      + `<path d="M${L - 6.4} ${y + .6}a6.4 6.4 0 0 1 12.8 0z" fill="${lid}"/><path d="M${R - 6.4} ${y + .6}a6.4 6.4 0 0 1 12.8 0z" fill="${lid}"/>`
      + `<path d="M${L - 6} ${y + .6}h12M${R - 6} ${y + .6}h12" stroke="#1B1B1B" stroke-width="1.2" stroke-linecap="round"/>`,
    worried: white(L, 6.6) + white(R, 6.6) + `<circle cx="${L}" cy="${y}" r="2.3" fill="#141414"/><circle cx="${R}" cy="${y}" r="2.3" fill="#141414"/>`,
    wow: `<path d="M${L - 5} ${y + 1.5}q5-6 10 0M${R - 5} ${y + 1.5}q5-6 10 0" stroke="#141414" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  }[mood] || '';
  const my = y + 10.5, mouth = {
    happy: `<path d="M${f.x - 3} ${my}q3 2.6 6 0" stroke="#141414" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    sleepy: `<path d="M${f.x - 2.5} ${my + .5}h5" stroke="#141414" stroke-width="1.5" stroke-linecap="round"/>`,
    worried: `<ellipse cx="${f.x}" cy="${my + .5}" rx="1.6" ry="2.1" fill="#141414"/>`,
    wow: `<path d="M${f.x - 4} ${my - .5}q4 4.2 8 0" stroke="#141414" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  }[mood] || '';
  const acc = ACC[look?.accessory]?.(f) || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="overflow:visible">
    <ellipse cx="32" cy="61" rx="22" ry="2.6" fill="#000" opacity=".12"/>
    ${look?.accessory === 'boots' ? acc : ''}<path d="${f.d}" fill="url(#bt-g-${col})"/>
    ${eyes}${mouth}${look?.accessory !== 'boots' ? acc : ''}
    ${crown ? `<path d="M${f.x - 8} ${f.top - 1}l3.8-6.5 4.2 4.2 4.2-4.2 3.8 6.5z" fill="#FFE03C" stroke="#A8860A" stroke-width="1.1" stroke-linejoin="round"/>` : ''}</svg>`;
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
  const prizeTxt = !prize ? `prize: a ${B.rewardMinutes} min extra break or a new accessory` : !prize.choice ? 'still choosing their prize'
    : prize.choice === 'break' ? `picked a ${B.rewardMinutes} min extra break` : `unlocked ${itemName(prize.item)}`;
  const btn = grant && prize?.choice === 'break' ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Extra break given ✓' : `Give the ${B.rewardMinutes} min break`}</button>` : '';
  const champ = champion
    ? `<div class="champ"><span style="width:50px;height:50px;flex:none">${avatar(champion.code, { crown: true, mood: 'wow', look: lookOf(champion) })}</span><div>Last week's champion: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you! 🎉)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · ${prizeTxt}</span></div>${btn}</div>`
    : `<div class="champ"><div>${isManager ? '' : '🏆 '}No champion from last week yet. This week is wide open.</div></div>`;
  // runners bunched on the same score step aside a little so nobody hides behind someone else
  let prev = -1;
  const runners = rows.map((r, i) => { let f = Math.min(.97, r.points / goal); if (prev >= 0 && prev - f < .05) f = Math.max(0, prev - .05); prev = f;
    return `<button class="racer${r.code === me ? ' me' : ''}" data-f="${f}" data-code="${esc(r.code)}" style="left:7%;top:85%" aria-label="${esc(r.name)}, ${r.points} points, rank ${i + 1}">
      <span class="av">${avatar(r.code, { crown: i === 0 && r.points > 0, look: lookOf(r) })}</span><span class="tag">${esc(r.name)}${r.code === me ? ' (you)' : ''}</span>
      <span class="tip"><b>${i + 1}. ${esc(r.name)}</b><br>${r.points} points · ${r.onTime}/${r.breaks} on time${r.cleanDays ? ` · 🔥 ${r.cleanDays} clean day${r.cleanDays > 1 ? 's' : ''}` : ''}${isManager ? `<br>${r.overMinutes ?? 0} min over` : ''}</span></button>`; }).join('');
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>Racer</th><th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}" data-code="${esc(r.code)}"><td>${!isManager && i < 3 && r.points > 0 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td class="person">${avatar(r.code, { look: lookOf(r) })}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td><td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays ? (isManager ? '' : '🔥 ') + r.cleanDays : '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  return `${champ}<div class="map" data-goal="${goal}">${MAP}<div class="racers">${runners || ''}</div></div>
    ${rows.length ? '' : '<p class="empty">Nobody in the race yet.</p>'}${table}
    <p class="hint">Everyone runs to Champion's Keep${isManager ? '' : ' 🏰'} (${goal} points). ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute over. Monday to Sunday. The weekly winner picks a ${B.rewardMinutes} min extra break or a new accessory${isManager ? '.' : ' 🏆'} Tap a racer to see their score.</p>`;
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
  if (picking) return `<div class="prize"><b>✨ Pick your prize:</b> tap any 🔒 accessory below to unlock it. <button class="btn ghost sm" data-prize="cancel">Back</button></div>`;
  return `<div class="prize"><div><b>🏆 You won last week!</b> Pick your prize:</div><div class="row"><button class="btn yellow" data-prize="break">⏰ ${B.rewardMinutes} min extra break</button><button class="btn teal" data-prize="look">🎁 Unlock an accessory</button></div></div>`;
}
export function lookPanelHTML(code, mine, picking) {
  const has = item => item.startsWith('colour:') || item === 'acc:none' || (mine?.unlocked || []).includes(item), cur = { colour: colourOf(code, mine?.colour), accessory: mine?.accessory || 'none' };
  const sw = (kind, key, label, inner) => { const item = `${kind === 'colour' ? 'colour' : 'acc'}:${key}`, open = has(item), on = cur[kind] === key;
    return `<button class="sw${on ? ' on' : ''}${open ? '' : ' locked'}${!open && picking ? ' pick' : ''}" data-${kind}="${key}" aria-pressed="${on}" ${!open && !picking ? 'disabled' : ''} title="${esc(open ? label : picking ? `Unlock ${label}` : `${label}: win a week of Breakathon to unlock`)}">${inner}${open ? '' : '<i>🔒</i>'}<small>${esc(label)}</small></button>`; };
  return `<section class="panel"><div class="phead"><h2>Your mascot</h2><span class="hint">Pick any colour. Win a week of Breakathon to unlock accessories.</span></div>
    <div class="lookgrid"><div class="lookprev">${avatar(code, { look: cur, mood: 'wow', body: true })}</div><div>
    <h3 style="margin-top:0">Colour</h3><div class="swatches">${Object.entries(LOOKS.colours).map(([k, [l, c]]) => sw('colour', k, l, `<span class="dot" style="background:${c}"></span>`)).join('')}</div>
    <h3>Accessories <small style="font:500 13px var(--body);color:var(--muted)">(prizes)</small></h3><div class="swatches">${Object.entries(LOOKS.accessories).map(([k, [l, e]]) => sw('accessory', k, l, `<span class="mini-av">${avatar(code, { look: { colour: cur.colour, accessory: k }, body: true })}</span>`)).join('')}</div>
    </div></div></section>`;
}
