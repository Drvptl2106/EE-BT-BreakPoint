// Breakathon view, shared by both pages: an illustrated island where everyone's character runs along the road to the
// Champion's Keep, the further the more punctual points they have, plus the ranking table.
// Also the characters themselves (used on the dashboard cards and as the agent's pep-talk buddy).
import { CONFIG } from './config.js?v=c85a4b0b52';
import { esc } from './dom.js?v=c85a4b0b52';

/* ---------------- the mascot ----------------
   One soft bean wearing a little headset (it's a contact centre): flat colour, dot eyes, a small smile and rosy cheeks,
   so it's cute but calm enough for work. Everyone has their own colour from day one (picked from their code, changeable
   any time) and Breakathon champions unlock accessories (db/schema.sql: look_items()).
   Moods: happy, sleepy (eyes closed, on a break), worried (a little "o", running over), wow (happy squint, a great week).
   The 'body' option is accepted for older callers and ignored. */
export const LOOKS = {
  colours: { teal: ['Teal', '#3CB4AE'], blue: ['Blue', '#7FA6E6'], pink: ['Pink', '#EE8CB4'], yellow: ['Sunshine', '#F4CE5A'], purple: ['Lilac', '#A898E4'],
             green: ['Lime', '#88C96A'], orange: ['Peach', '#F2A46C'], coral: ['Blush', '#F3B3BD'], sky: ['Sky', '#84CBE6'], lilac: ['Plum', '#C49AD6'] },
  accessories: { none: ['Nothing'], cap: ['Cap'], scarf: ['Scarf'], boots: ['Boots'], bow: ['Bow'], glasses: ['Glasses'], sprout: ['Sprout'] },
};
const COLOUR_KEYS = Object.keys(LOOKS.colours);
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** The colour someone's mascot actually shows ('auto' or unknown = picked from their code, so a team looks varied). */
export const colourOf = (code, colour) => LOOKS.colours[colour] ? colour : COLOUR_KEYS[hash(code) % COLOUR_KEYS.length];
const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))).map(v => v.toString(16).padStart(2, '0')).join('');
const INK = '#1D2A30';
const BODY = 'M32 7c12.7 0 21 8.6 21 21.5V43c0 10.5-8.6 17-21 17S11 53.5 11 43V28.5C11 15.6 19.3 7 32 7z';
const F = { x: 32, top: 7, y: 30, w: 7.5 };   // face centre, top of the head (for hats), eye line, half the gap between the eyes
const ACC = {
  cap: f => `<path d="M${f.x - 14} ${f.top + 9}Q${f.x - 13} ${f.top - 4} ${f.x} ${f.top - 4}T${f.x + 14} ${f.top + 9}z" fill="#E8434F"/><path d="M${f.x - 2} ${f.top + 7.5}h18q.5 3.2-5 3.6H${f.x - 2}z" fill="#B92F3A"/><circle cx="${f.x}" cy="${f.top - 3.6}" r="1.6" fill="#B92F3A"/>`,
  bow: f => `<g transform="translate(${f.x + 11} ${f.top + 3}) rotate(18)"><path d="M0 0l-6-4.5v9zM0 0l6-4.5v9z" fill="#FF5C8A" stroke="#C93A66" stroke-width="1" stroke-linejoin="round"/><circle r="2" fill="#C93A66"/></g>`,
  sprout: f => `<path d="M${f.x} ${f.top + 1}V${f.top - 4}" stroke="#2E8B57" stroke-width="1.6" stroke-linecap="round"/><path d="M${f.x} ${f.top - 3}q0-5 6-5-1 5-6 5z" fill="#45C08A"/><path d="M${f.x} ${f.top - 3}q0-4-5-4 1 4 5 4z" fill="#2E8B57"/>`,
  glasses: f => `<circle cx="${f.x - f.w}" cy="${f.y}" r="5.2" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.4"/><circle cx="${f.x + f.w}" cy="${f.y}" r="5.2" fill="#fff" fill-opacity=".15" stroke="${INK}" stroke-width="1.4"/><path d="M${f.x - f.w + 5.2} ${f.y - .5}h${2 * f.w - 10.4}" stroke="${INK}" stroke-width="1.4"/>`,
  scarf: f => `<path d="M${f.x - 20} ${f.y + 15}q20 6 40 0v5.5q-20 6-40 0z" fill="#E8434F"/><path d="M${f.x + 9} ${f.y + 19.5}l2 8 4.5-1.6-2-7.4z" fill="#B92F3A"/>`,
  boots: () => '<rect x="18" y="56.5" width="11" height="6" rx="3" fill="#8B5A2B"/><rect x="35" y="56.5" width="11" height="6" rx="3" fill="#8B5A2B"/>',
};
/** The mascot. look = { colour, accessory }. mood: happy | sleepy | worried | wow. */
export function avatar(code, { look, crown = false, mood = 'happy' } = {}) {
  const c = LOOKS.colours[colourOf(code, look?.colour)][1], { x, y, w } = F, L = x - w, R = x + w, my = y + 8.5;
  const eye = ex => mood === 'sleepy' ? `<path d="M${ex - 2.6} ${y}q2.6 2.4 5.2 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    : mood === 'wow' ? `<path d="M${ex - 2.8} ${y + 1.2}q2.8-3.6 5.6 0" stroke="${INK}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${ex}" cy="${y}" rx="${mood === 'worried' ? 2.5 : 2.2}" ry="${mood === 'worried' ? 3.3 : 2.9}" fill="${INK}"/><circle cx="${ex + .8}" cy="${y - 1.1}" r=".8" fill="#fff"/>`;
  const brows = mood === 'worried' ? `<path d="M${L - 2.6} ${y - 5.2}l4.2-1.4M${R + 2.6} ${y - 5.2}l-4.2-1.4" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>` : '';
  const mouth = mood === 'worried' ? `<ellipse cx="${x}" cy="${my + .5}" rx="1.6" ry="2" fill="${INK}"/>`
    : mood === 'wow' ? `<path d="M${x - 3.6} ${my - 1}q3.6 4.8 7.2 0z" fill="${INK}"/>`
    : `<path d="M${x - 2.8} ${my}q2.8 2.4 5.6 0" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  const acc = ACC[look?.accessory]?.(F) || '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="overflow:visible">
    <ellipse cx="32" cy="61.5" rx="19" ry="2.2" fill="#000" opacity=".12"/>${look?.accessory === 'boots' ? acc : ''}
    <path d="${BODY}" fill="${c}"/><path d="M11 41c0 9 8.6 13.6 21 13.6S53 50 53 41v2c0 10.5-8.6 17-21 17S11 53.5 11 43z" fill="${shade(c, .82)}"/>
    <ellipse cx="22.5" cy="17" rx="5.5" ry="3.4" fill="#fff" opacity=".28" transform="rotate(-28 22.5 17)"/>
    <path d="M13 27.5C13 15 21.2 10 32 10s19 5 19 17.5" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <rect x="8.6" y="23.5" width="6.6" height="11" rx="3.3" fill="${INK}"/><rect x="48.8" y="23.5" width="6.6" height="11" rx="3.3" fill="${INK}"/>
    <path d="M12 34c0 5.4 4.2 7.4 11.6 7.4" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="24.4" cy="41.4" r="2" fill="${INK}"/>
    <ellipse cx="${L - 3.4}" cy="${my - .8}" rx="2.9" ry="1.8" fill="#FF8FA3" opacity=".5"/><ellipse cx="${R + 3.4}" cy="${my - .8}" rx="2.9" ry="1.8" fill="#FF8FA3" opacity=".5"/>
    ${eye(L)}${eye(R)}${brows}${mouth}${look?.accessory !== 'boots' ? acc : ''}
    ${crown ? `<path d="M${x - 8} ${F.top - 1}l3.8-6.5 4.2 4.2 4.2-4.2 3.8 6.5z" fill="#FFE03C" stroke="#A8860A" stroke-width="1.1" stroke-linejoin="round"/>` : ''}</svg>`;
}
const lookOf = r => ({ colour: r.colour, accessory: r.accessory });

/* ---------------- the climb ----------------
   A simple platform-game level made for a phone: grassy floating islands zig-zag up the screen, joined by ladders, in
   front of soft mountains, from START at the bottom to a flag and a star at the top (level CONFIG.breakathon.levels, a
   perfect week). Every CONFIG.breakathon.pointsPerLevel points lifts you one island, everyone stands on the island they
   have reached, and the highest racer wins the week. A "you" card on top says where you are and how close the next level
   is. The Professional look keeps the "you" card and the table only. */
const SCENE_W = 360, SCENE_H = 640;
/* one island per level, bottom to top, alternating left and right so each overlaps the next one for its ladder */
const ISLANDS = Array.from({ length: CONFIG.breakathon.levels + 1 }, (_, i) => ({ x: i % 2 ? 168 : 22, y: 592 - i * 66, w: 170, left: !(i % 2) }));
const island = ({ x, y, w, left }, lv, top) => `<g>
  <path d="M${x + 6} ${y + 8}H${x + w - 6}q2 16-16 24-${(w - 32) / 2} 18-${w - 32} 0-18-8-16-24z" fill="#A86F3D"/>
  <path d="M${x + 22} ${y + 26}q${(w - 44) / 2} 12 ${w - 44} 0" stroke="#8A5A30" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="${x - 2}" y="${y}" width="${w + 4}" height="12" rx="6" fill="#62BC45"/><rect x="${x + 8}" y="${y + 2}" width="${w - 16}" height="3" rx="1.5" fill="#8EDB68"/>
  ${[.3, .7].map(t => `<path d="M${x + w * t} ${y}l3-7 2 7 3-5 2 5z" fill="#4FA236"/>`).join('')}
  ${top ? '' : (() => { const sx = left ? x + 14 : x + w - 14;   // a little wooden sign with the level, at the far end from the ladder
    return `<rect x="${sx - 1.5}" y="${y - 16}" width="3" height="16" fill="#7A4A26"/><rect x="${sx - 11}" y="${y - 30}" width="22" height="16" rx="3" fill="#E7B66B" stroke="#9C6B2E" stroke-width="1.5"/>
      <text x="${sx}" y="${y - 18.5}" text-anchor="middle" font-size="${lv ? 11 : 7.5}" font-weight="800" fill="#5A3A00">${lv || 'START'}</text>`; })()}</g>`;
const ladder = (x, top, bottom) => `<g stroke="#B9813F" stroke-width="3.2" stroke-linecap="round"><path d="M${x - 7} ${top}V${bottom}M${x + 7} ${top}V${bottom}"/>
  ${Array.from({ length: Math.floor((bottom - top - 6) / 11) }, (_, k) => `<path d="M${x - 7} ${top + 8 + k * 11}h14"/>`).join('')}</g>`;
const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".9"><ellipse rx="26" ry="9"/><ellipse cx="-11" cy="-6" rx="13" ry="9"/><ellipse cx="10" cy="-7" rx="15" ry="10"/></g>`;
const SCENE = (() => { const T = ISLANDS.at(-1);
  return `<svg viewBox="0 0 ${SCENE_W} ${SCENE_H}" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="bt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CCBF2"/><stop offset="1" stop-color="#DDF3FF"/></linearGradient></defs>
  <rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#bt-sky)"/>
  ${cloud(70, 70, 1)}${cloud(290, 150, .8)}${cloud(60, 300, .7)}${cloud(300, 420, .6)}
  <path d="M0 520L60 450L110 500L180 410L250 490L300 440L360 480V640H0z" fill="#B6DDF1"/><path d="M0 575L70 520L140 565L215 505L290 560L360 525V640H0z" fill="#9CCDE6"/>
  ${ISLANDS.slice(0, -1).map((lo, i) => ladder(i % 2 ? 175 : 185, ISLANDS[i + 1].y + 9, lo.y + 2)).join('')}
  ${ISLANDS.map((p, lv) => island(p, lv, lv === ISLANDS.length - 1)).join('')}
  <g transform="translate(${T.x + T.w - 24} ${T.y})"><rect x="-1.5" y="-52" width="3" height="52" fill="#5B6469"/><path d="M1.5-52h22l-6 7 6 7h-22z" fill="#E8544F"/></g>
  <g transform="translate(${T.x + 34} ${T.y - 40})"><circle r="15" fill="#FFF3A8" opacity=".7"/><path d="M0-11l3.2 6.7 7.3 1-5.3 5 1.3 7.3L0 5.6-6.5 9l1.3-7.3-5.3-5 7.3-1z" fill="#FFD84A" stroke="#C98A00" stroke-width="1.4" stroke-linejoin="round"/></g>
</svg>`; })();
const levelOf = points => Math.min(CONFIG.breakathon.levels, Math.floor(Math.max(0, points) / CONFIG.breakathon.pointsPerLevel));

/** rows: ranked [{ code, name, breaks, onTime, cleanDays, overMinutes, points }]. */
export function raceHTML({ rows, me, isManager, champion, grant, prize, pro = false }) {
  const B = CONFIG.breakathon;
  const prizeTxt = !prize ? `prize: a ${B.rewardMinutes} min extra break${pro ? '' : ' or a new accessory'}` : !prize.choice ? 'still choosing their prize'
    : prize.choice === 'break' ? `picked a ${B.rewardMinutes} min extra break` : `unlocked ${itemName(prize.item)}`;
  const btn = grant && prize?.choice === 'break' ? `<button class="btn yellow" id="grantBtn" ${grant.done ? 'disabled' : ''}>${grant.done ? 'Extra break given' : `Give the ${B.rewardMinutes} min break`}</button>` : '';
  const champ = champion
    ? `<div class="champ">${pro ? '' : `<span class="av">${avatar(champion.code, { crown: true, mood: 'wow', look: lookOf(champion) })}</span>`}<div>Last week's ${pro ? 'top score' : 'champion'}: <b>${esc(champion.name)}</b>${champion.code === me ? ' (that\'s you!)' : ''}<br><span style="opacity:.85;font-size:14px">${champion.points} points · ${prizeTxt}</span></div>${btn}</div>`
    : `<div class="champ"><div>${pro ? 'No scores from last week yet.' : 'No champion from last week yet. This week is wide open.'}</div></div>`;
  const i = rows.findIndex(r => r.code === me), r = rows[i];
  let you = '';
  if (r) {
    const lv = levelOf(r.points), toNext = lv >= B.levels ? 0 : (lv + 1) * B.pointsPerLevel - r.points, pct = lv >= B.levels ? 100 : (r.points % B.pointsPerLevel) / B.pointsPerLevel * 100;
    you = `<div class="you">${pro ? '' : `<span class="av">${avatar(r.code, { look: lookOf(r), mood: i === 0 && r.points > 0 ? 'wow' : 'happy' })}</span>`}<div class="you-b">
      <b>You're #${i + 1} of ${rows.length}</b><span>${pro ? '' : `Level ${lv} · `}${r.points} points · ${r.onTime}/${r.breaks} breaks on time</span>
      ${pro ? '' : `<div class="you-bar"><i style="width:${pct}%"></i></div><small>${toNext ? `${toNext} points to level ${lv + 1}` : 'Perfect week! You reached the star.'}</small>`}</div></div>`;
  }
  const racer = (x, k, cx, cy) => { const lv = levelOf(x.points), toNext = lv >= B.levels ? 0 : (lv + 1) * B.pointsPerLevel - x.points;
    return `<button class="racer${x.code === me ? ' me' : ''}${cx > SCENE_W * .66 ? ' tip-l' : cx < SCENE_W * .34 ? ' tip-r' : ''}" data-code="${esc(x.code)}" style="left:${(cx / SCENE_W * 100).toFixed(2)}%;top:${(cy / SCENE_H * 100).toFixed(2)}%" aria-label="${esc(x.name)}, level ${lv}, ${x.points} points, rank ${k + 1}">
      <span class="av">${avatar(x.code, { crown: k === 0 && x.points > 0, look: lookOf(x) })}</span>${x.code === me ? '<span class="tag">You</span>' : ''}
      <span class="tip"><b>${k + 1}. ${esc(x.name)}</b><br>${x.points} points${toNext ? ` · ${toNext} to level ${lv + 1}` : ' · at the star'}<br>${x.onTime}/${x.breaks} breaks on time${isManager ? ` · ${x.overMinutes ?? 0} min over` : ''}</span></button>`; };
  /* everyone stands on their island, spread out between the ladder and the sign; tap someone for their card */
  const climb = pro || !rows.length ? '' : `<div class="scene">${SCENE}<div class="racers">${ISLANDS.map((p, lv) => {
      const here = rows.map((x, n) => [x, n]).filter(([x]) => levelOf(x.points) === lv); if (!here.length) return '';
      const from = p.left ? p.x + 40 : p.x + 30, to = p.left ? p.x + p.w - 26 : p.x + p.w - 40, step = here.length > 1 ? Math.min(34, (to - from) / (here.length - 1)) : 0,
        mid = (from + to) / 2;
      return here.map(([x, n], k) => racer(x, n, mid + (k - (here.length - 1) / 2) * step, p.y)).join('');
    }).join('')}</div></div>`;
  const table = `<div class="scroll" style="margin-top:16px"><table class="rank"><thead><tr><th>#</th><th>${pro ? 'Name' : 'Racer'}</th>${pro ? '' : '<th class="opt">Level</th>'}<th>Points</th><th>On time</th><th class="opt">Clean days</th>${isManager ? '<th>Min over</th>' : ''}</tr></thead><tbody>${rows.map((x, k) =>
    `<tr class="${x.code === me ? 'me' : ''}" data-code="${esc(x.code)}"><td>${k + 1}</td><td class="person">${pro ? '' : avatar(x.code, { look: lookOf(x) })}<b style="display:inline">${esc(x.name)}${x.code === me ? ' (you)' : ''}</b></td>${pro ? '' : `<td class="opt">${levelOf(x.points)}</td>`}<td><b>${x.points}</b></td><td>${x.onTime}/${x.breaks}</td><td class="opt">${x.cleanDays || '–'}</td>${isManager ? `<td class="${x.overMinutes ? 'bad' : ''}">${x.overMinutes ?? 0}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  const rules = pro
    ? `Monday to Sunday. ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute past the day's total break time. The week's top score can take a ${B.rewardMinutes} min extra break.`
    : `Monday to Sunday. ${B.pointsOnTime} points for every break kept within its time, +${B.pointsCleanDay} for a day with every break on time, −${B.penaltyPerMinuteOver} per minute past the day's total. Every ${B.pointsPerLevel} points lifts you one level; the star at level ${B.levels} is a perfect week. The week's winner picks a ${B.rewardMinutes} min extra break or a new accessory. Tap someone to see how close they are.`;
  return `${champ}${you}${climb}${rows.length ? '' : `<p class="empty">${pro ? 'No scores yet.' : 'Nobody in the race yet.'}</p>`}${table}
    <details class="rules"><summary>How points work</summary><p>${rules}</p></details>`;
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
