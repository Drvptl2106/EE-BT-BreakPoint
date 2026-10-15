// Small browser helpers shared by the page scripts.

// Anything typed by a person must be escaped before it goes into markup.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only touch the page when the markup really changed, so a click is never lost
// because the button under the pointer was replaced a moment earlier.
export function setHtml(el, html) { if (el.__html === html) return; el.innerHTML = html; el.__html = html; }
