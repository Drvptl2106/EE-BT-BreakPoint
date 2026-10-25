// Breakathon view, shared by both pages: an illustrated island where everyone's character runs along the road to the
// Champion's Keep, the further the more punctual points they have, plus the ranking table.
// Also the characters themselves (used on the dashboard cards and as the agent's pep-talk buddy).
import { CONFIG } from './config.js?v=fefe7db143';
import { esc } from './dom.js?v=fefe7db143';

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

/* ---------------- the climb ----------------
   A simple platform-game level: grassy platforms zig-zag up the screen, joined by ladders, with a star at the top.
   Every CONFIG.breakathon.pointsPerLevel points lifts you one platform; the top platform (level CONFIG.breakathon.levels)
   is a perfect week. Everyone stands on the platform they have reached, so the highest one is winning. */
const VB_H = 640;
const PLATFORMS = [   // one per level, bottom to top: x, y = top of the grass, w = width. Each overlaps the next, for its ladder.
  { x: 30, y: 590, w: 300 }, { x: 250, y: 528, w: 230 }, { x: 420, y: 466, w: 230 }, { x: 590, y: 404, w: 230 },
  { x: 730, y: 342, w: 230 }, { x: 560, y: 280, w: 230 }, { x: 360, y: 218, w: 250 }, { x: 170, y: 156, w: 250 }, { x: 40, y: 92, w: 330 },
];
const platform = ({ x, y, w }, i) => `<g>
  <rect x="${x}" y="${y + 6}" width="${w}" height="${i ? 30 : 50}" rx="6" fill="#8B5A2B"/>
  <path d="M${x + 8} ${y + 20}h${w - 16}M${x + 8} ${y + 30}h${w - 16}" stroke="#6E4520" stroke-width="2" stroke-dasharray="14 10"/>
  <rect x="${x - 3}" y="${y}" width="${w + 6}" height="11" rx="5.5" fill="#5DBB3F"/><rect x="${x + 4}" y="${y + 1.5}" width="${w - 8}" height="3" rx="1.5" fill="#8FDB5F"/>
  ${[.18, .62].map(t => `<path d="M${x + w * t} ${y}l3-8 2 8 3-6 2 6z" fill="#4EA334"/>`).join('')}</g>`;
const ladder = (x, top, bottom) => `<g stroke="#C98B3C" stroke-width="4" stroke-linecap="round"><path d="M${x - 9} ${top}V${bottom}M${x + 9} ${top}V${bottom}"/>
  ${[...Array(Math.max(1, Math.floor((bottom - top) / 13)))].map((_, k) => `<path d="M${x - 9} ${top + 9 + k * 13}h18"/>`).join('')}</g>`;
/* a ladder from each platform down to the one below, where they overlap (or at the nearer end) */
const LADDERS = PLATFORMS.slice(1).map((up, i) => { const lo = PLATFORMS[i], l = Math.max(up.x, lo.x) + 20, r = Math.min(up.x + up.w, lo.x + lo.w) - 20;
  const x = l <= r ? (l + r) / 2 : (up.x > lo.x ? up.x + 16 : up.x + up.w - 16); return ladder(x, up.y + 8, lo.y + 2); }).join('');
const coin = (x, y, d) => `<g transform="translate(${x} ${y})"><g class="coin" style="animation-delay:-${d}s"><ellipse rx="7" ry="9" fill="#FFC928" stroke="#C98A00" stroke-width="2"/><rect x="-1.4" y="-4.5" width="2.8" height="9" rx="1.4" fill="#FFE98A"/></g></g>`;
const cloud = (x, y, s, cls = '') => `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})"><ellipse rx="40" ry="14" fill="#fff"/><ellipse cx="-18" cy="-8" rx="20" ry="13" fill="#fff"/><ellipse cx="16" cy="-10" rx="24" ry="15" fill="#fff"/></g>`;
const MAP = `<svg viewBox="0 0 1000 ${VB_H}" aria-hidden="true">
  <defs><linearGradient id="bt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47B4F0"/><stop offset="1" stop-color="#BFE8FF"/></linearGradient></defs>
  <rect width="1000" height="${VB_H}" fill="url(#bt-sky)"/>
  <path d="M0 520Q120 440 240 500T480 480T720 470T1000 450V640H0z" fill="#9ED6F2"/><path d="M0 570Q160 510 300 560T620 540T1000 530V640H0z" fill="#7CC7E8"/>
  ${cloud(150, 70, 1)}${cloud(470, 40, .8, 'c2')}${cloud(860, 300, .7)}${cloud(250, 260, .6, 'c2')}
  ${LADDERS}${PLATFORMS.map(platform).join('')}
  ${PLATFORMS.slice(1, -1).map((p, i) => [.12, .24].map((t, k) => coin(p.x + p.w * t, p.y - 22, (i + k) * .3)).join('')).join('')}${[.35, .5, .65].map((t, k) => coin(PLATFORMS.at(-1).x + PLATFORMS.at(-1).w * t, PLATFORMS.at(-1).y - 24, k * .3)).join('')}
  <g transform="translate(${PLATFORMS[0].x + 22} ${PLATFORMS[0].y})"><rect x="-2.5" y="-34" width="5" height="34" fill="#7A4A26"/><path d="M-20-40h36l8 8-8 8h-36z" fill="#FFC928" stroke="#A8730A" stroke-width="2"/><text x="0" y="-27" text-anchor="middle" font-size="11" font-weight="800" fill="#5A3A00">START</text></g>
  <g transform="translate(${PLATFORMS.at(-1).x + PLATFORMS.at(-1).w - 40} ${PLATFORMS.at(-1).y})"><rect x="-2" y="-78" width="4" height="78" fill="#555"/><path d="M2-78h26l-7 8 7 8H2z" fill="#E84B4B"/></g>
  <g transform="translate(${PLATFORMS.at(-1).x + PLATFORMS.at(-1).w / 2} ${PLATFORMS.at(-1).y - 62})"><g class="star"><circle r="26" fill="#FFF3A8" opacity=".55"/><path d="M0-17l5 10.5 11.5 1.5-8.5 8 2 11.5L0 8.5-10 14l2-11.5-8.5-8 11.5-1.5z" fill="#FFD84A" stroke="#C98A00" stroke-width="2" stroke-linejoin="round"/></g></g>
  <g id="stops"></g>
</svg>`;
const levelOf = points => Math.min(CONFIG.breakathon.levels, Math.floor(Math.max(0, points) / CONFIG.breakathon.pointsPerLevel));

/** rows: ranked [{ code, name, breaks, onTime, cleanDays, overMinutes, points }]. Call placeRacers() after inserting.
    pro = the Professional view (src/ui.js): the same scores as a plain table, no map and no mascots. */
export function raceHTML({ rows, me, isManager, champion, grant, prize, pro = false }) {
  const B = CONFIG.breakathon, top = levelOf(rows[0]?.points || 0);
  const prizeTxt = !prize ? `prize: a ${B.rewardMinutes} min extra break${pro ? '' : ' or a new accessory'}` : !prize.choice ? 'still choosing their prize'
    : prize.choice === 'break' ? `picked a ${B.rewardMinutes} min extra break` : `unlocked ${itemName(prize.item)}`;
  const btn = grant && prize?.choice === 'break' ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Extra break given' : `Give the ${B.rewardMinutes} min break`}</button>` : '';
  const champ = champion
    ? `<div class="champ">${pro ? '' : `<span style="width:50px;height:50px;flex:none">${avatar(champion.code, { crown: true, mood: 'wow', look: lookOf(champion) })}</span>`}<div>Last week's ${pro ? 'top score' : 'champion'}: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you!)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · ${prizeTxt}</span></div>${btn}</div>`
    : `<div class="champ"><div>${pro ? 'No scores from last week yet.' : 'No champion from last week yet. This week is wide open.'}</div></div>`;
  // everyone stands on the level they've reached; people on the same level stand side by side
  const onLevel = {};
  const runners = rows.map((r, i) => {
    const lv = levelOf(r.points), k = (onLevel[lv] = (onLevel[lv] || 0) + 1) - 1, toNext = lv >= B.levels ? 0 : (lv + 1) * B.pointsPerLevel - r.points;
    return `<button class="racer${r.code === me ? ' me' : ''}" data-lv="${lv}" data-k="${k}" data-code="${esc(r.code)}" style="left:7%;top:85%" aria-label="${esc(r.name)}, level ${lv}, ${r.points} points, rank ${i + 1}">
      <span class="av">${avatar(r.code, { crown: i === 0 && r.points > 0, look: lookOf(r) })}</span><span class="tag">${esc(r.name)}${r.code === me ? ' (you)' : ''}</span>
      <span class="tip"><b>${i + 1}. ${esc(r.name)}</b> · level ${lv}${lv >= B.levels ? ', at the top' : ''}<br>${r.points} points${toNext ? ` · ${toNext} to level ${lv + 1}` : ''}<br>${r.onTime}/${r.breaks} breaks on time${isManager ? ` · ${r.overMinutes ?? 0} min over` : ''}</span></button>`; }).join('');
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>${pro ? 'Name' : 'Racer'}</th>${pro ? '' : '<th>Level</th>'}<th>Points</th><th>On time</th><th>Clean days</th>${isManager ? '<th>Minutes over</th>' : ''}</tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${r.code === me ? 'me' : ''}" data-code="${esc(r.code)}"><td>${i + 1}</td><td class="person">${pro ? '' : avatar(r.code, { look: lookOf(r) })}<b style="display:inline">${esc(r.name)}${r.code === me ? ' (you)' : ''}</b></td>${pro ? '' : `<td>${levelOf(r.points)}</td>`}<td><b>${r.points}</b></td><td>${r.onTime}/${r.breaks}</td><td>${r.cleanDays || '–'}</td>${isManager ? `<td class="${r.overMinutes ? 'bad' : ''}">${r.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  if (pro) return `${champ}${rows.length ? '' : '<p class="empty">No scores yet.</p>'}${table}
    <p class="hint">Monday to Sunday. ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute past the day's total break time. The week's top score can take a ${B.rewardMinutes} min extra break.</p>`;
  return `${champ}<div class="mapwrap"><div class="map" data-top="${top}">${MAP}<div class="racers">${runners || ''}</div></div></div>
    ${rows.length ? '' : '<p class="empty">Nobody in the race yet.</p>'}${table}
    <p class="hint">Every ${B.pointsPerLevel} points lifts you one platform; the highest racer wins the week, and the star at the top (level ${B.levels}) is a perfect week. ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute over. Monday to Sunday. The weekly winner picks a ${B.rewardMinutes} min extra break or a new accessory. Tap a racer to see how close they are to the next platform.</p>`;
}

/** Numbers each platform and sends each racer to the platform they have reached. Safe to call repeatedly. */
export function placeRacers(root) {
  const B = CONFIG.breakathon, map = root.querySelector('.map'); if (!map) return;
  const top = Number(map.dataset.top || 0), stops = root.querySelector('#stops');
  if (stops) stops.innerHTML = PLATFORMS.slice(1, -1).map((p, i) => { const lv = i + 1, done = top >= lv;   // a numbered block on each platform
    return `<g transform="translate(${p.x + p.w - 22} ${p.y - 22})"><rect x="-13" y="-13" width="26" height="26" rx="4" fill="${done ? '#E84B4B' : '#FFC928'}" stroke="${done ? '#9E2B2B' : '#A8730A'}" stroke-width="2.5"/><text y="5" text-anchor="middle" font-size="15" font-weight="800" fill="${done ? '#fff' : '#5A3A00'}">${lv}</text></g>`; }).join('');
  const count = {}; root.querySelectorAll('.racer[data-lv]').forEach(el => count[el.dataset.lv] = (count[el.dataset.lv] || 0) + 1);
  requestAnimationFrame(() => root.querySelectorAll('.racer[data-lv]').forEach(el => {
    const lv = Math.min(Number(el.dataset.lv), B.levels), p = PLATFORMS[Math.min(lv, PLATFORMS.length - 1)], k = Number(el.dataset.k), n = count[el.dataset.lv];
    const step = Math.min(56, (p.w - 70) / Math.max(1, n - 1)), x = p.x + p.w / 2 - 14 + (k - (n - 1) / 2) * step;
    el.style.left = `${x / 10}%`; el.style.top = `${(p.y + 14) / (VB_H / 100)}%`;   // feet on the grass
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
export const itemName = item => { const [k, v] = String(item || '').split(':'); return k === 'colour' ? `${LOOKS.colours[v]?.[0] || v} colour` : `the ${(LOOKS.accessories[v]?.[0] || v).toLowerCase()}`; };
/** mine = my_rewards(): { colour, accessory, unlocked[], champion, claimed, claimed_item }. picking = choosing a look as the prize. */
export function prizeHTML(mine, picking, pro = false) {
  const B = CONFIG.breakathon;
  if (!mine?.champion) return '';
  if (mine.claimed === 'break') return `<div class="prize done">You picked a <b>${B.rewardMinutes} min extra break</b> for winning last week. Your team lead will add it to your day.</div>`;
  if (mine.claimed === 'look') return `<div class="prize done">You unlocked <b>${esc(itemName(mine.claimed_item))}</b> for winning last week. Looking good!</div>`;
  if (picking) return `<div class="prize"><b>Pick your prize:</b> tap any locked accessory below to unlock it. <button class="btn ghost sm" data-prize="cancel">Back</button></div>`;
  return `<div class="prize"><div><b>${pro ? 'You had the top score last week.' : 'You won last week!'}</b> Pick your prize:</div><div class="row"><button class="btn" data-prize="break">${B.rewardMinutes} min extra break</button>${pro ? '' : '<button class="btn teal" data-prize="look">Unlock an accessory</button>'}</div></div>`;
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
