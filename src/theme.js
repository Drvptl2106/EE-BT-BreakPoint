// Applies a saved light/dark choice before the page is drawn, so it never flashes the wrong colours.
// Loaded as a plain (non-module) script in <head>. The sun/moon button in the header changes it (src/chrome.js).
(function () { try { var t = localStorage.getItem('bt-theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (e) {} })();
