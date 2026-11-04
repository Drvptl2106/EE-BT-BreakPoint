// My day's break pictures (staff page): the half circle on the main screen and "How today adds up" behind its arrow.
// The day's breaks are one pot (plan() in src/core.js): each break has its own part of the pot (15 / 15 / 30 by default,
// plus any OH break). Sittings are placed the same way plan() counts them: a sitting uses its own break's time first, and
// anything past that comes from the next break that still has time (grey stripes in that break's part). Past the whole
// day's total it is "over" (red). The main screen shows only the picture and one number; the pop-up shows the working.
import { CONFIG } from './config.js?v=6b9fa1564c';
import { hhmm } from './core.js?v=6b9fa1564c';
import { esc } from './dom.js?v=6b9fa1564c';

export const COLS = ['#0B6E72', '#14958F', '#3DB9B0', '#5FA8D3', '#7C8FD6', '#A47BE0', '#46B36B', '#F08A4B'];
export const mins = sec => Math.round(Math.max(0, sec) / 60);
const STRIPES = '<pattern id="bt-cov" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#B9C5C8"/><rect width="3.2" height="7" fill="#8E9DA1"/></pattern>';

/** Where each sitting lands, in the order they happened: [{ slot (index), from (sec into that part), secs, own, sitting }],
    plus overSecs. p = plan() slots, r = the day's record, at = now (for a running break). Mirrors plan() in src/core.js. */
export function placements(p, r, at) {
  const cap = p.map(s => Math.max(0, s.base) * 60), fill = p.map(() => 0), out = [];
  const sit = [...(r?.breaks || []).map(b => ({ slot: b.slot, start: b.start, secs: (b.end - b.start) / 1000 })),
    ...(r?.active ? [{ slot: r.active.slot, start: r.active.start, secs: Math.max(0, (at - r.active.start) / 1000), running: true }] : [])]
    .sort((a, b) => a.start - b.start);
  let over = 0;
  sit.forEach((x, n) => {
    const i = p.findIndex(s => s.key === x.slot); if (i < 0) return;
    const own = Math.min(x.secs, cap[i]); let need = x.secs - own;
    if (own > 0) { out.push({ slot: i, from: fill[i], secs: own, own: true, sitting: n, running: x.running }); fill[i] += own; cap[i] -= own; }
    for (const o of [...p.keys()].slice(i + 1).concat([...p.keys()].slice(0, i))) {
      if (need <= 0) break; const take = Math.min(need, cap[o]); if (take <= 0) continue;
      out.push({ slot: o, from: fill[o], secs: take, own: false, sitting: n, running: x.running }); fill[o] += take; cap[o] -= take; need -= take;
    }
    over += need;
  });
  return { list: out, overSecs: over >= CONFIG.overToleranceMinutes * 60 ? over : 0 };
}
const parts = p => { const tot = p.reduce((a, s) => a + Math.max(0, s.base), 0) * 60 || 1; let a = 0;
  return { tot, at: p.map(s => { const f0 = a / tot; a += Math.max(0, s.base) * 60; return [f0, a / tot]; }) }; };

/** The main screen's half circle: names only, own time in the break's colour, borrowed time striped, one number inside. */
export function halfGauge(p, r, at, { big, small, red = false }) {
  const W = 400, H = 232, cx = 200, cy = 196, R = 132, SW = 36, gap = .003;
  const pt = (f, rr = R) => { const a = Math.PI * (1 - f); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (f0, f1, col, w = SW, rr = R) => { if (f1 <= f0 + 1e-4) return ''; const [x0, y0] = pt(f0, rr), [x1, y1] = pt(f1, rr);
    return `<path d="M${x0} ${y0}A${rr} ${rr} 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
  const { tot, at: span } = parts(p), { list, overSecs } = placements(p, r, at);
  const pos = (i, sec) => { const [f0, f1] = span[i], len = Math.max(0, p[i].base) * 60 || 1; return f0 + gap + (f1 - f0 - 2 * gap) * Math.min(1, sec / len); };
  let g = span.map(([f0, f1]) => arc(f0 + gap, f1 - gap, 'var(--g-track)')).join(''), mark = null, lab = '';
  for (const x of list) { g += arc(pos(x.slot, x.from), pos(x.slot, x.from + x.secs), x.own ? COLS[x.slot % COLS.length] : 'url(#bt-cov)'); if (x.running) mark = pos(x.slot, x.from + x.secs); }
  if (overSecs) g += arc(Math.max(0, 1 - overSecs / tot), 1, 'var(--danger)', 6, R + 21);
  p.forEach((s, i) => { const side = i === 0 ? 'end' : i === p.length - 1 ? 'start' : 'middle', [lx, ly] = pt((span[i][0] + span[i][1]) / 2, R + (side === 'middle' ? 30 : 24));
    lab += `<text x="${lx}" y="${side === 'middle' ? ly - 2 : ly + 5}" text-anchor="${side}" class="g-lab">${esc(s.label)}</text>`; });
  if (mark !== null) { const [mx, my] = pt(mark); g += `<circle cx="${mx}" cy="${my}" r="10" class="g-mark"/>`; }
  return `<svg class="gauge" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(big)} ${esc(small)}"><defs>${STRIPES}</defs>${lab}${g}
    <text x="${cx}" y="${cy - 12}" text-anchor="middle" class="g-big${red ? ' bad' : ''}">${esc(big)}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" class="g-small">${esc(small)}</text></svg>`;
}

/** "How today adds up": the whole day as a full circle that draws itself break by break, then the working underneath. */
export function dayDetail(p, r, at) {
  const { tot, at: span } = parts(p), { list, overSecs } = placements(p, r, at), Rr = 88, C = 2 * Math.PI * Rr;
  const used = p.reduce((a, s) => a + s.used, 0), left = Math.max(0, tot - used), deg = f => f * 360 - 90;
  const track = ([f0, f1]) => `<circle cx="120" cy="120" r="${Rr}" fill="none" stroke="var(--g-track)" stroke-width="26" stroke-dasharray="${Math.max(0, (f1 - f0) * C - 2.5)} ${C}" transform="rotate(${deg(f0)} 120 120)"/>`;
  const seg = (f0, f1, col, k) => { const len = Math.max(0, (f1 - f0) * C - .6);
    return `<circle class="d-seg" cx="120" cy="120" r="${Rr}" fill="none" stroke="${col}" stroke-width="26" stroke-dasharray="${len} ${C}" style="--len:${len};animation-delay:${(.2 + k * .38).toFixed(2)}s" transform="rotate(${deg(f0)} 120 120)"/>`; };
  const pos = (i, sec) => { const [f0, f1] = span[i], len = Math.max(0, p[i].base) * 60 || 1; return f0 + (f1 - f0) * Math.min(1, sec / len); };
  const segs = list.map((x, k) => seg(pos(x.slot, x.from), pos(x.slot, x.from + x.secs), x.own ? COLS[x.slot % COLS.length] : 'url(#bt-cov2)', k)).join('');
  const labs = p.map((s, i) => { const a = deg((span[i][0] + span[i][1]) / 2) * Math.PI / 180;
    return `<text x="${120 + 124 * Math.cos(a)}" y="${120 + 124 * Math.sin(a) + 4}" text-anchor="middle" class="g-lab sm">${esc(s.label)}</text>`; }).join('');
  const done = (.2 + list.length * .38 + .2).toFixed(2);
  const circle = `<svg class="donut" viewBox="-36 -12 312 264" role="img" aria-label="${mins(used)} of ${mins(tot)} minutes used today">
    <defs>${STRIPES.replace('bt-cov', 'bt-cov2')}</defs>${span.map(track).join('')}${segs}${labs}
    <g class="d-mid" style="animation-delay:${done}s"><text x="120" y="118" text-anchor="middle" class="g-big sm${overSecs ? ' bad' : ''}">${overSecs ? `+${mins(overSecs)}` : mins(left)} min</text>
    <text x="120" y="142" text-anchor="middle" class="g-small">${overSecs ? 'over today' : `left of ${mins(tot)} today`}</text></g></svg>`;
  const legend = `<div class="d-legend">${p.map((s, i) => `<span><i style="background:${COLS[i % COLS.length]}"></i>${esc(s.label)}</span>`).join('')}<span><i class="cov"></i>Ran into the next break</span></div>`;
  const tiles = `<div class="d-tiles"><div><b>${mins(tot)}</b><span>min allowed</span></div><div><b>${mins(used)}</b><span>min used</span></div>
    <div class="${overSecs ? 'bad' : 'hi'}"><b>${overSecs ? '+' + mins(overSecs) : mins(left)}</b><span>${overSecs ? 'min over' : 'min left'}</span></div></div>`;
  const rows = p.map(s => {
    const sits = s.segs.map(b => `${hhmm(b.start)}–${hhmm(b.end)} (${mins((b.end - b.start) / 1000)})`);
    if (s.act) sits.push(`on now since ${hhmm(s.act.start)} (${mins((at - s.act.start) / 1000)} so far)`);
    const notes = [...s.from.map(x => `${mins(x.secs)} min over, so it came from ${esc(x.label)}`), ...s.to.map(x => `${mins(x.secs)} min used by ${esc(x.label)}`),
      s.adjust ? `${s.adjust > 0 ? '+' : ''}${s.adjust} min from your team lead` : '', s.segs.some(b => b.flag) ? 'closed automatically' : '', s.over > 0 ? `${mins(s.over)} min past today's total` : ''].filter(Boolean);
    const base = Math.max(0, s.base), right = !s.used ? `<span class="r mute">${base} min · not taken yet</span>`
      : s.act ? `<span class="r hi">${mins(Math.max(0, s.left))} min left</span>`
      : `<span class="r${s.overBase > 0 ? ' warn' : ''}">${mins(s.used)} of ${base} min${s.overBase > 0 ? '' : ' ✓'}</span>`;
    return `<div class="d-row${s.done ? ' done' : ''}"><div class="d-top"><b>${esc(s.label)}</b>${right}</div>${sits.length || notes.length ? `<small>${[sits.join(' · '), ...notes].filter(Boolean).join('<br>')}</small>` : ''}</div>`;
  }).join('');
  return `${circle}${legend}${tiles}${rows}<p class="d-rule"><b>How it works:</b> your breaks share one pot of ${mins(tot)} minutes. If a break runs long, the extra comes from the next break. You're only "over" once all ${mins(tot)} minutes are used.</p>`;
}
