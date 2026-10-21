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
  accessories: { none: ['Nothing'], cap: ['Cap'], scarf: ['Scarf'], boots: ['Boots'], bow: ['Bow'], glasses: ['Glasses'], sprout: ['Sprout'] },
};
const COLOUR_KEYS = Object.keys(LOOKS.colours);
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** A well-mixed hash (FNV-1a), so neighbouring codes like EE-001 and EE-002 still get different shapes. */
const mix = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** Numbered codes (EE-001, EE-002 ...) rotate evenly through the options so a team never clumps; anything else is hashed. */
const pick = (code, salt, k, step) => { const n = String(code).match(/(\d+)$/); return n ? (Number(n[1]) * step + salt.length) % k : mix(code + salt) % k; };
/** The colour someone's mascot actually shows ('auto' or unknown = picked from their code, so a team looks varied). */
export const colourOf = (code, colour) => LOOKS.colours[colour] ? colour : COLOUR_KEYS[hash(code) % COLOUR_KEYS.length];
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))).map(v => v.toString(16).padStart(2, '0')).join('');
/** Soft felt shading per colour, added to the page once and shared by every mascot. */
function ensureDefs() {
  if (typeof document === 'undefined' || document.getElementById('bt-mascot-defs')) return;
  const grads = Object.entries(LOOKS.colours).map(([k, [, c]]) => `<radialGradient id="bt-g-${k}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${shade(c, 1.07)}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, .9)}"/></radialGradient>`).join('');
  // the felt: fine speckles of light, kept inside the shape
  document.body.insertAdjacentHTML('beforeend', `<svg id="bt-mascot-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${grads}
    <filter id="bt-felt" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.1 -.55" result="a"/><feComposite in="a" in2="SourceAlpha" operator="in"/></filter></defs></svg>`);
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
/* Each person has a fixed personality face (picked from their code), like a family where everyone is a bit different:
   bright, bored, sly (with lashes), dreamy (pink lids), cheeky (side-eye and a lopsided grin).
   A mood, when there is one, sits on top: sleepier lids on a break, wide eyes and an "o" when over, a happy squint when done. */
const FACES = [
  { name: 'bright', lid: 0,   dx: 0,    dy: -.8, mouth: 'smile' },
  { name: 'bored',  lid: .5,  dx: 0,    dy: .8,  mouth: 'flat' },
  { name: 'sly',    lid: .42, dx: 2.2,  dy: .4,  mouth: 'smirk', lashes: true },
  { name: 'dreamy', lid: .38, dx: -.6,  dy: -1,  mouth: 'smile', pink: true },
  { name: 'cheeky', lid: 0,   dx: -2.2, dy: 0,   mouth: 'grin', odd: true },
];
/** The mascot. look = { colour, accessory }. mood: happy (their own face) | sleepy | worried | wow. */
export function avatar(code, { look, crown = false, mood = 'happy' } = {}) {
  ensureDefs();
  const col = colourOf(code, look?.colour), f = SHAPES[pick(code, 'shape', SHAPES.length, 3)], face = FACES[pick(code, 'face', FACES.length, 1)];
  const e = 6.4, y = f.y - 1.5, gap = e + .5, L = f.x - gap, R = f.x + gap;
  const lidCol = face.pink ? '#F2A7BA' : shade(LOOKS.colours[col][1], .84);
  const m = mood === 'happy' ? null : mood;
  const lidAmt = m === 'sleepy' ? .64 : m === 'worried' || m === 'wow' ? 0 : face.lid;
  const er = (side) => m === 'worried' ? e + .5 : face.odd && !m ? (side < 0 ? e - .4 : e + .5) : e;
  const pr = m === 'worried' ? 2.2 : 3.2, dx = m ? 0 : face.dx, dy = m === 'sleepy' ? 1.6 : m ? 0 : face.dy;
  const eye = (x, side) => {
    const r = er(side);
    if (m === 'wow') return `<path d="M${x - 5.2} ${y + 1.8}q5.2-6.4 10.4 0" stroke="#141414" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
    let g = `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1B1B1B" stroke-opacity=".14" stroke-width=".8"/>`
      + `<circle cx="${x + dx}" cy="${y + dy}" r="${pr}" fill="#141414"/><circle cx="${x + dx + 1}" cy="${y + dy - 1.1}" r="${pr * .3}" fill="#fff"/>`;
    if (lidAmt > 0) {   // the eyelid: the top part of the eye, cut by a straight line
      const yl = y - r + 2 * r * lidAmt, hw = Math.sqrt(Math.max(0, r * r - (yl - y) ** 2)) + .3;
      g += `<path d="M${x - hw} ${yl}A${r + .3} ${r + .3} 0 ${yl > y ? 1 : 0} 1 ${x + hw} ${yl}z" fill="${lidCol}"/><path d="M${x - hw} ${yl}H${x + hw}" stroke="#141414" stroke-width="1.3" stroke-linecap="round"/>`;
      if (face.lashes && !m) { const o = side * hw; g += `<path d="M${x + o} ${yl}l${side * 2.6} -1.6M${x + o - side * 1.6} ${yl - .3}l${side * 1.8} -2.4" stroke="#141414" stroke-width="1" stroke-linecap="round"/>`; }
    }
    return g;
  };
  const my = y + 11, X = f.x;
  const mouth = m === 'sleepy' ? `<path d="M${X - 2.5} ${my}h5" stroke="#141414" stroke-width="1.5" stroke-linecap="round"/>`
    : m === 'worried' ? `<ellipse cx="${X}" cy="${my + .4}" rx="1.7" ry="2.2" fill="#141414"/>`
    : m === 'wow' ? `<path d="M${X - 4.2} ${my - .6}q4.2 4.6 8.4 0" stroke="#141414" stroke-width="1.7" fill="none" stroke-linecap="round"/>`
    : { smile: `<path d="M${X - 3} ${my}q3 2.6 6 0" stroke="#141414" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
        flat: `<path d="M${X - 4} ${my + .4}h8" stroke="#141414" stroke-width="1.5" stroke-linecap="round"/>`,
        smirk: `<path d="M${X - 2.5} ${my + .6}q3.4 1.4 5.6-1.6" stroke="#141414" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
        grin: `<path d="M${X - 4} ${my - .4}q3.4 4.4 7.6-.8" stroke="#141414" stroke-width="1.6" fill="none" stroke-linecap="round"/>` }[face.mouth];
  const acc = ACC[look?.accessory]?.({ ...f, y, w: gap }) || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="overflow:visible">
    <ellipse cx="32" cy="61" rx="22" ry="2.6" fill="#000" opacity=".12"/>
    ${look?.accessory === 'boots' ? acc : ''}<path d="${f.d}" fill="url(#bt-g-${col})"/><path d="${f.d}" fill="#fff" filter="url(#bt-felt)" opacity=".55"/>
    ${eye(L, -1)}${eye(R, 1)}${mouth}${look?.accessory !== 'boots' ? acc : ''}
    ${crown ? `<path d="M${f.x - 8} ${f.top - 1}l3.8-6.5 4.2 4.2 4.2-4.2 3.8 6.5z" fill="#FFE03C" stroke="#A8860A" stroke-width="1.1" stroke-linejoin="round"/>` : ''}</svg>`;
}
const lookOf = r => ({ colour: r.colour, accessory: r.accessory });

/* ---------------- the obstacle course ----------------
   A bright, silly obstacle course in the spirit of a party game show: a striped track over pink slime, moving obstacles
   named after the job, and a FINISH arch with confetti. Racers run along it; the further, the more punctual points.
   Tap an obstacle for its joke, tap a racer for their score. Everything stands still for people who prefer less motion. */
const ROAD = 'M70 392 C150 400 200 330 250 318 S350 352 420 330 S470 240 540 236 S650 284 700 236 S730 150 800 140 S880 128 905 96';
const OBSTACLES = [   // f = how far along the course
  { id: 'spinner', f: .2, name: 'Hold Music Spinner', joke: 'Duck under it like a customer dodging the satisfaction survey.' },
  { id: 'bounce', f: .41, name: 'Upgrade Bounce', joke: 'Every jump is an upgrade. Every fall is "I\'ll think about it".' },
  { id: 'hammer', f: .6, name: 'Discount Hammer', joke: 'Swings at anyone giving money away like they own the company.' },
  { id: 'hex', f: .8, name: 'Hexa-Lunch', joke: 'The tiles sink if you stand still. Just like lunch breaks that run over.' },
];
const cloud = (x, y, s, cls = '') => `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse rx="40" ry="14" fill="#fff"/><ellipse cx="-18" cy="-8" rx="20" ry="13" fill="#fff"/><ellipse cx="16" cy="-10" rx="24" ry="15" fill="#fff"/></g>`;
const MAP = `<svg viewBox="0 -50 1000 510" aria-hidden="true">
  <defs><linearGradient id="bt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD8FF"/><stop offset=".65" stop-color="#C9E9FF"/><stop offset="1" stop-color="#FFD3EC"/></linearGradient></defs>
  <rect y="-50" width="1000" height="510" fill="url(#bt-sky)"/>
  ${cloud(140, 70, 1)}${cloud(520, 50, .8, 'c2')}${cloud(760, 190, .7)}${cloud(330, 150, .6, 'c2')}
  <g opacity=".55"><path d="M600 120h70l-8 14h-54z" fill="#B48CF2"/><path d="M180 200h60l-7 12h-46z" fill="#FFB86B"/><path d="M820 300h80l-9 14h-62z" fill="#7CD992"/></g>
  <path class="slime" d="M0 420 q25-12 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V460 H0z" fill="#FF6FB1"/>
  <rect y="436" width="1000" height="24" fill="#F0479B"/>
  <path d="${ROAD}" stroke="#6C3BB5" stroke-width="44" fill="none" stroke-linecap="round" transform="translate(0 11)"/>
  <path d="${ROAD}" stroke="#FF8CC6" stroke-width="44" fill="none" stroke-linecap="round"/>
  <path d="${ROAD}" stroke="#FFD84A" stroke-width="44" fill="none" stroke-dasharray="28 28"/>
  <path d="${ROAD}" stroke="#fff" stroke-opacity=".75" stroke-width="44" fill="none" stroke-dasharray="2 54" stroke-dashoffset="-27"/>
  <path id="road" d="${ROAD}" fill="none"/>
  <g transform="translate(70 392)"><rect x="-30" y="-64" width="8" height="66" rx="3" fill="#6C3BB5"/><rect x="22" y="-64" width="8" height="66" rx="3" fill="#6C3BB5"/>
    <rect x="-34" y="-78" width="68" height="20" rx="10" fill="#fff" stroke="#6C3BB5" stroke-width="3"/><text y="-63.5" text-anchor="middle" font-size="12" font-weight="800" fill="#6C3BB5">START</text>
    ${[0, 1, 2].map(i => `<circle class="lamp l${i}" cx="${-12 + i * 12}" cy="-48" r="4" fill="#FFD84A" stroke="#6C3BB5" stroke-width="1.5"/>`).join('')}</g>
  <g transform="translate(905 96)"><rect x="-46" y="-80" width="12" height="86" rx="4" fill="#6C3BB5"/><rect x="34" y="-80" width="12" height="86" rx="4" fill="#6C3BB5"/>
    <path d="M-52-80q52-42 104 0v18q-52-38-104 0z" fill="#fff" stroke="#6C3BB5" stroke-width="3"/>
    <g>${[...Array(12)].map((_, i) => `<rect x="${-48 + i * 8}" y="${-84 + (i % 2) * 6}" width="8" height="6" fill="#1B1B1B" opacity=".85"/>`).join('')}</g>
    <text y="-66" text-anchor="middle" font-size="14" font-weight="900" fill="#6C3BB5" letter-spacing="1">FINISH</text>
    <path d="M-8-112h16v5a8 8 0 01-16 0zM-8-110h-4a4 4 0 004 6M8-110h4a4 4 0 01-4 6M-2-99h4v4h-4zM-6-95h12v3H-6z" fill="#FFD84A" stroke="#A8860A" stroke-width="1.2" stroke-linejoin="round"/>
    ${[...Array(14)].map((_, i) => `<rect class="confetti" x="${-60 + i * 9}" y="-130" width="4" height="7" rx="1" fill="${['#FF5C8A', '#FFD84A', '#5B8DEF', '#3CCB8C', '#B48CF2'][i % 5]}" style="animation-delay:-${(i * .37).toFixed(2)}s"/>`).join('')}</g>
  <g id="obstacles"></g>
</svg>`;
/* the moving parts, drawn at their spot on the course */
const OBSTACLE_ART = {
  spinner: '<g class="spin"><rect x="-46" y="-5" width="92" height="10" rx="5" fill="#5B3BD6"/><rect x="-46" y="-5" width="92" height="4" rx="2" fill="#8F72FF"/></g><circle r="8" fill="#FFD84A" stroke="#5B3BD6" stroke-width="3"/>',
  bounce: [-24, 0, 24].map((x, i) => `<g transform="translate(${x} 0)"><ellipse rx="11" ry="4.5" fill="#E0B200"/><ellipse class="pad" style="animation-delay:-${i * .25}s" cy="-3" rx="11" ry="4.5" fill="#FFE03C" stroke="#fff" stroke-width="1.5"/></g>`).join(''),
  hammer: '<rect x="-38" y="-86" width="7" height="86" rx="3" fill="#6C3BB5"/><rect x="31" y="-86" width="7" height="86" rx="3" fill="#6C3BB5"/><rect x="-42" y="-90" width="84" height="9" rx="4.5" fill="#8F72FF" stroke="#6C3BB5" stroke-width="2"/><g class="swing"><line x1="0" y1="-82" x2="0" y2="-20" stroke="#5B3BD6" stroke-width="4"/><rect x="-24" y="-28" width="48" height="24" rx="10" fill="#FF5C8A" stroke="#C93A66" stroke-width="2.5"/><rect x="-24" y="-28" width="48" height="8" rx="4" fill="#fff" opacity=".35"/></g>',
  hex: [-30, -10, 10, 30].map((x, i) => `<path class="hexa" style="animation-delay:-${i * .7}s" transform="translate(${x} ${i % 2 ? 6 : -4})" d="M-9 0l4.5-8h9L9 0l-4.5 8h-9z" fill="${i % 2 ? '#5B8DEF' : '#3CCB8C'}" stroke="#fff" stroke-width="1.5"/>`).join(''),
};

/** rows: ranked [{ code, name, breaks, onTime, cleanDays, overMinutes, points }]. Call placeRacers() after inserting. */
export function raceHTML({ rows, me, isManager, champion, grant, prize }) {
  const B = CONFIG.breakathon, goal = Math.max(50, Math.ceil((rows[0]?.points || 0) * 1.12));
  const prizeTxt = !prize ? `prize: a ${B.rewardMinutes} min extra break or a new accessory` : !prize.choice ? 'still choosing their prize'
    : prize.choice === 'break' ? `picked a ${B.rewardMinutes} min extra break` : `unlocked ${itemName(prize.item)}`;
  const btn = grant && prize?.choice === 'break' ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Extra break given' : `Give the ${B.rewardMinutes} min break`}</button>` : '';
  const champ = champion
    ? `<div class="champ"><span style="width:50px;height:50px;flex:none">${avatar(champion.code, { crown: true, mood: 'wow', look: lookOf(champion) })}</span><div>Last week's champion: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you!)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · ${prizeTxt}</span></div>${btn}</div>`
    : `<div class="champ"><div>${isManager ? '' : ' '}No champion from last week yet. This week is wide open.</div></div>`;
  // runners bunched on the same score step aside a little so nobody hides behind someone else
  let prev = -1;
  const runners = rows.map((r, i) => { let f = Math.min(.97, r.points / goal); if (prev >= 0 && prev - f < .05) f = Math.max(0, prev - .05); prev = f;
    return `<button class="racer${r.code === me ? ' me' : ''}" data-f="${f}" data-code="${esc(r.code)}" style="left:7%;top:85%" aria-label="${esc(r.name)}, ${r.points} points, rank ${i + 1}">
      <span class="av"><span class="trip" style="animation-delay:-${(i * 1.7) % 7}s">${avatar(r.code, { crown: i === 0 && r.points > 0, look: lookOf(r) })}</span></span><span class="tag">${i < 3 && r.points > 0 ? '<i>Qualified</i>' : ''}${esc(r.name)}${r.code === me ? ' (you)' : ''}</span>
      <span class="tip"><b>${i + 1}. ${esc(r.name)}</b><br>${r.points} points · ${r.onTime}/${r.breaks} on time${r.cleanDays ? ` · ${r.cleanDays} clean day${r.cleanDays > 1 ? 's' : ''}` : ''}${isManager ? `<br>${r.overMinutes ?? 0} min over` : ''}</span></button>`; }).join('');
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>Racer</th><th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}" data-code="${esc(r.code)}"><td>${i + 1}</td><td class="person">${avatar(r.code, { look: lookOf(r) })}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td><td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays || '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  const obstacles = OBSTACLES.map(o => `<button class="obst" data-ob="${o.id}" data-f="${o.f}" style="left:50%;top:50%"><span class="pill">${esc(o.name)}</span><span class="tip"><b>${esc(o.name)}</b><br>${esc(o.joke)}</span></button>`).join('');
  return `${champ}<div class="mapwrap"><div class="map" data-goal="${goal}">${MAP}<div class="racers">${obstacles}${runners || ''}</div></div></div>
    ${rows.length ? '' : '<p class="empty">Nobody in the race yet.</p>'}${table}
    <p class="hint">Everyone races to the finish (${goal} points). The top three qualify. ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute over. Monday to Sunday. The weekly winner picks a ${B.rewardMinutes} min extra break or a new accessory. Tap a racer to see their score, or an obstacle for its story.</p>`;
}

/** Puts the obstacles on the course and sends each racer running to their spot. Safe to call repeatedly. */
export function placeRacers(root) {
  const road = root.querySelector('#road'); if (!road?.getTotalLength) return;
  const L = road.getTotalLength(), at = f => road.getPointAtLength(L * f);
  const ob = root.querySelector('#obstacles');
  if (ob && !ob.childElementCount) ob.innerHTML = OBSTACLES.map(o => { const p = at(o.f); return `<g transform="translate(${p.x} ${p.y})"><g class="ob-${o.id}" data-art="${o.id}">${OBSTACLE_ART[o.id]}</g></g>`; }).join('');
  root.querySelectorAll('.obst[data-f]').forEach(el => { const p = at(Number(el.dataset.f)); el.style.left = `${p.x / 10}%`; el.style.top = `${(p.y + 34 + 50) / 5.1}%`; });
  requestAnimationFrame(() => root.querySelectorAll('.racer[data-f]').forEach((el, i) => {
    const p = at(Number(el.dataset.f)), wobble = (i % 2 ? 1 : -1) * 12;
    el.style.left = `${p.x / 10}%`; el.style.top = `${(p.y + wobble + 50) / 5.1}%`;
  }));
}
/** Tapping a racer shows their card and highlights their row in the table. */
export function wireRacers(root) {
  root.addEventListener('click', e => {
    const o = e.target.closest('.obst');
    if (o) {   // an obstacle: show its joke and give it a wobble
      const on = !o.classList.contains('sel');
      root.querySelectorAll('.obst.sel').forEach(x => x.classList.remove('sel')); if (on) o.classList.add('sel');
      const art = root.querySelector(`[data-art="${o.dataset.ob}"]`); art?.classList.remove('poke'); void art?.getBBox(); art?.classList.add('poke');
      return;
    }
    const r = e.target.closest('.racer'); if (!r) return;
    const on = !r.classList.contains('sel');
    root.querySelectorAll('.racer.sel').forEach(x => x.classList.remove('sel')); root.querySelectorAll('tr.hl').forEach(x => x.classList.remove('hl'));
    r.classList.remove('jump'); void r.offsetWidth; r.classList.add('jump');   // a happy little jump
    if (on) { r.classList.add('sel'); root.querySelector(`tr[data-code="${CSS.escape(r.dataset.code)}"]`)?.classList.add('hl'); }
  });
}

/* ---------------- your mascot and your prize (agent page) ---------------- */
export const itemName = item => { const [k, v] = String(item || '').split(':'); return k === 'colour' ? `${LOOKS.colours[v]?.[0] || v} colour` : `the ${(LOOKS.accessories[v]?.[0] || v).toLowerCase()}`; };
/** mine = my_rewards(): { colour, accessory, unlocked[], champion, claimed, claimed_item }. picking = choosing a look as the prize. */
export function prizeHTML(mine, picking) {
  const B = CONFIG.breakathon;
  if (!mine?.champion) return '';
  if (mine.claimed === 'break') return `<div class="prize done">You picked a <b>${B.rewardMinutes} min extra break</b> for winning last week. Your team lead will add it to your day.</div>`;
  if (mine.claimed === 'look') return `<div class="prize done">You unlocked <b>${esc(itemName(mine.claimed_item))}</b> for winning last week. Looking good!</div>`;
  if (picking) return `<div class="prize"><b>Pick your prize:</b> tap any locked accessory below to unlock it. <button class="btn ghost sm" data-prize="cancel">Back</button></div>`;
  return `<div class="prize"><div><b>You won last week!</b> Pick your prize:</div><div class="row"><button class="btn" data-prize="break">${B.rewardMinutes} min extra break</button><button class="btn teal" data-prize="look">Unlock an accessory</button></div></div>`;
}
export function lookPanelHTML(code, mine, picking) {
  const has = item => item.startsWith('colour:') || item === 'acc:none' || (mine?.unlocked || []).includes(item), cur = { colour: colourOf(code, mine?.colour), accessory: mine?.accessory || 'none' };
  const sw = (kind, key, label, inner) => { const item = `${kind === 'colour' ? 'colour' : 'acc'}:${key}`, open = has(item), on = cur[kind] === key;
    return `<button class="sw${on ? ' on' : ''}${open ? '' : ' locked'}${!open && picking ? ' pick' : ''}" data-${kind}="${key}" aria-pressed="${on}" ${!open && !picking ? 'disabled' : ''} title="${esc(open ? label : picking ? `Unlock ${label}` : `${label}: win a week of Breakathon to unlock`)}">${inner}${open ? '' : '<i aria-hidden="true"><svg viewBox="0 0 12 14" width="11" height="13"><rect x="1" y="6" width="10" height="7.5" rx="1.6" fill="currentColor"/><path d="M3.3 6V4.3a2.7 2.7 0 015.4 0V6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></i>'}<small>${esc(label)}</small></button>`; };
  return `<section class="panel"><div class="phead"><h2>Your mascot</h2><span class="hint">Pick any colour. Win a week of Breakathon to unlock accessories.</span></div>
    <div class="lookgrid"><div class="lookprev">${avatar(code, { look: cur, mood: 'wow', body: true })}</div><div>
    <h3 style="margin-top:0">Colour</h3><div class="swatches">${Object.entries(LOOKS.colours).map(([k, [l, c]]) => sw('colour', k, l, `<span class="dot" style="background:${c}"></span>`)).join('')}</div>
    <h3>Accessories <small style="font:500 13px var(--body);color:var(--muted)">(prizes)</small></h3><div class="swatches">${Object.entries(LOOKS.accessories).map(([k, [l, e]]) => sw('accessory', k, l, `<span class="mini-av">${avatar(code, { look: { colour: cur.colour, accessory: k }, body: true })}</span>`)).join('')}</div>
    </div></div></section>`;
}
