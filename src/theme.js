// Applies a saved light/dark choice and the Playful/Professional look before the page is drawn, so it never flashes the
// wrong one. Loaded as a plain (non-module) script in <head>. The sun/moon button changes the first (src/chrome.js),
// the view button the second (src/ui.js).
(function () { try { var t = localStorage.getItem('bt-theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  var u = localStorage.getItem('bt-ui'); if (u === 'pro' || u === 'fun') document.documentElement.setAttribute('data-ui', u); } catch (e) {} })();
