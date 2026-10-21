// Version stamp: adds ?v=<hash> to every script, stylesheet and import, so browsers fetch the new files after a
// change instead of mixing old and new ones from their cache. One hash for the whole site, worked out from the
// file contents (ignoring the stamps themselves), so running it twice changes nothing.
//   npm run stamp          update the stamps (run before committing a change to src/ or the pages)
//   npm run stamp -- --check   exit 1 if a stamp is out of date (the tests run this)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
export const FILES = [join(ROOT, 'index.html'), join(ROOT, 'manager.html'),
  ...walk(join(ROOT, 'src')).filter(f => /\.(js|css)$/.test(f)).sort()];

const STAMP = /\?v=[0-9a-f]+/g;
// relative imports in JS, and src/ references in the pages
const JS_REF = /((?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"?]+\.js)(\?v=[0-9a-f]+)?(['"])/g;
const HTML_REF = /((?:src|href)=")(src\/[^"?]+\.(?:js|css))(\?v=[0-9a-f]+)?(")/g;

export function version() {
  const h = createHash('sha256');
  for (const f of FILES) h.update(readFileSync(f, 'utf8').replace(STAMP, ''));
  return h.digest('hex').slice(0, 10);
}

export function stamped(file, text, v) {
  return text.replace(file.endsWith('.html') ? HTML_REF : JS_REF, (_, a, path, _old, b) => `${a}${path}?v=${v}${b}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const v = version(), check = process.argv.includes('--check');
  let stale = [];
  for (const f of FILES) {
    const before = readFileSync(f, 'utf8'), after = stamped(f, before, v);
    if (after !== before) { stale.push(f.slice(ROOT.length + 1)); if (!check) writeFileSync(f, after); }
  }
  if (check && stale.length) { console.error(`Out of date stamps (run npm run stamp): ${stale.join(', ')}`); process.exit(1); }
  console.log(check ? `Stamps up to date (v=${v})` : `Stamped v=${v}${stale.length ? ` in ${stale.length} files` : ', nothing to change'}`);
}
