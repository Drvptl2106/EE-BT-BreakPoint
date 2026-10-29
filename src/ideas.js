// The Ideas tab on both pages: anyone can suggest an idea, a change or a bug fix (optionally anonymously), everyone in the
// team sees them all and votes for the ones they want, and team leads mark them planned / done / not now. So what gets
// built next is what the people using it asked for. The rules live in the database (db/schema.sql, suggestions).
import { suggestionsList, suggest, voteSuggestion, setSuggestionStatus, removeSuggestion } from './core.js?v=fbf0dd54c0';
import { esc, setHtml } from './dom.js?v=fbf0dd54c0';
import { toast } from './chrome.js?v=fbf0dd54c0';

const KINDS = { idea: ['💡', 'Idea'], change: ['✏️', 'Change'], bug: ['🐞', 'Bug'], other: ['💬', 'Other'] };
const STATUS = { new: 'New', planned: 'Planned', done: 'Done', not_now: 'Not now' };
const MAX = 500, REFRESH_MS = 15000, SEEN_KEY = 'bt-ideas-seen';
const seen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };
const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

/** root = the element to draw into. who() = the signed-in code. manager = team lead page. Returns { show(on) } for the tab switch
    and peek(), which puts a red dot on the Ideas tab when someone else posted since you last looked. */
export function setupIdeas(root, { who, manager = false }) {
  let rows = [], sort = 'top', kind = 'idea', timer = null, sending = false;
  root.innerHTML = `<section class="panel ideas"><div class="phead"><h2>Ideas</h2><span class="hint">Make Break Point better</span></div>
    <p class="hint" style="margin-top:0">Something you'd love to see, something to change, or something broken? Tell us here. Everyone can see it and vote,
      and the most wanted ones get built first.</p>
    <form id="ideaForm" class="ideaform"><div class="kinds" role="radiogroup" aria-label="What is it?">${Object.entries(KINDS).map(([k, [e, l]]) =>
      `<button type="button" role="radio" class="kind" data-kind="${k}" aria-checked="${k === kind}"><span aria-hidden="true">${e}</span> ${l}</button>`).join('')}</div>
      <textarea id="ideaBody" rows="3" maxlength="${MAX}" placeholder="e.g. A buzz one minute before my break ends" aria-label="Your suggestion"></textarea>
      <div class="ideabar"><label class="anon"><input type="checkbox" id="ideaAnon"> Post anonymously</label><span class="hint" id="ideaCount">0 / ${MAX}</span>
        <button class="btn teal sm" id="ideaSend">Send</button></div>
      <p class="hint" style="margin:6px 0 0">About the app only, please. No personal or health details.</p></form></section>
    <section class="panel"><div class="phead"><h2 id="ideaListH">Suggestions</h2><div class="seg2" id="ideaSort"><button data-sort="top" aria-pressed="true">Most wanted</button><button data-sort="new" aria-pressed="false">Newest</button></div></div>
      <div id="ideaList"><p class="empty">Loading…</p></div></section>`;
  const $ = s => root.querySelector(s);

  function draw() {
    const list = [...rows].sort(sort === 'new' ? (a, b) => b.at.localeCompare(a.at)
      : (a, b) => (a.status === 'done') - (b.status === 'done') || b.votes - a.votes || b.at.localeCompare(a.at));
    $('#ideaListH').textContent = `Suggestions (${rows.length})`;
    setHtml($('#ideaList'), list.length ? `<ul class="idealist">${list.map(s => { const [e, l] = KINDS[s.kind] || KINDS.other;
      return `<li class="idea st-${s.status}"><button class="vote${s.voted ? ' on' : ''}" data-vote="${s.id}" aria-pressed="${s.voted}" aria-label="${s.voted ? 'Remove your vote' : 'Vote for this'} (${s.votes} vote${s.votes === 1 ? '' : 's'})"><span aria-hidden="true">👍</span><b>${s.votes}</b></button>
        <div class="ibody"><div class="imeta"><span class="ikind"><span aria-hidden="true">${e}</span> ${l}</span>${s.status !== 'new' ? `<span class="istatus">${STATUS[s.status]}</span>` : ''}</div>
          <p>${esc(s.body)}</p>
          <div class="imeta"><span>${s.mine ? 'You' : s.author ? esc(s.author) : 'Anonymous'} · ${ago(s.at)}</span>
            ${manager ? `<select data-status="${s.id}" aria-label="Status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
            ${s.mine || manager ? `<button class="link" data-rm="${s.id}">Remove</button>` : ''}</div></div></li>`; }).join('')}</ul>`
      : '<p class="empty">No suggestions yet. Be the first!</p>');
  }
  async function load() { try { rows = await suggestionsList(who()); draw(); } catch (err) { $('#ideaList').innerHTML = `<p class="empty">${esc(err.message)}</p>`; } }

  $('#ideaForm .kinds').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind;
    root.querySelectorAll('.kind').forEach(x => x.setAttribute('aria-checked', x === b)); });
  $('#ideaBody').addEventListener('input', e => { $('#ideaCount').textContent = `${e.target.value.length} / ${MAX}`; });
  $('#ideaForm').addEventListener('submit', async e => {
    e.preventDefault(); if (sending) return;
    const body = $('#ideaBody').value, anon = $('#ideaAnon').checked;
    sending = true; $('#ideaSend').disabled = true;
    try { await suggest(who(), kind, body, anon); $('#ideaBody').value = ''; $('#ideaCount').textContent = `0 / ${MAX}`;
      toast(anon ? 'Thanks! Posted anonymously.' : 'Thanks! Your suggestion is up.'); sort = 'new'; markSort(); await load(); }
    catch (err) { toast(err.message); }
    finally { sending = false; $('#ideaSend').disabled = false; }
  });
  const markSort = () => root.querySelectorAll('#ideaSort button').forEach(x => x.setAttribute('aria-pressed', x.dataset.sort === sort));
  $('#ideaSort').addEventListener('click', e => { const b = e.target.closest('[data-sort]'); if (!b) return; sort = b.dataset.sort; markSort(); draw(); });
  $('#ideaList').addEventListener('click', async e => {
    const v = e.target.closest('[data-vote]'), r = e.target.closest('[data-rm]');
    try {
      if (v) { const s = rows.find(x => x.id === v.dataset.vote); s.voted = !s.voted; s.votes += s.voted ? 1 : -1; draw();   // feels instant
        await voteSuggestion(who(), s.id, s.voted); }
      else if (r) { if (!confirm('Remove this suggestion?')) return; await removeSuggestion(r.dataset.rm); toast('Removed.'); }
      else return;
    } catch (err) { toast(err.message); }
    load();
  });
  $('#ideaList').addEventListener('change', async e => { const s = e.target.closest('[data-status]'); if (!s) return;
    try { await setSuggestionStatus(s.dataset.status, s.value); toast(`Marked as ${STATUS[s.value].toLowerCase()}.`); } catch (err) { toast(err.message); }
    load(); });

  const dot = on => document.querySelector('.tabs [data-tab="ideas"]')?.classList.toggle('has-new', on);
  return {
    show(on) { clearInterval(timer); if (on) { load(); timer = setInterval(load, REFRESH_MS); try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch {} dot(false); } },
    async peek() { try { const list = await suggestionsList(who()), last = seen(); dot(list.some(s => !s.mine && (!last || s.at > last))); } catch {} },
  };
}
