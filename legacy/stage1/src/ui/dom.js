export const $ = (sel, root = document) => root.querySelector(sel);

// Names are typed by people, so anything placed into markup must be escaped.
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Only touch the page when the markup actually changed, so a click is never
// lost because the element under the pointer was replaced a moment earlier.
export function setHtml(el, html) {
  if (el.__html === html) return;
  el.innerHTML = html;
  el.__html = html;
}
