# Break Point

Live break tracking for a contact-centre team: agents start, pause and resume breaks, managers see who is on what and who has run over, and **Breakathon** ranks punctuality.

**Status:** pilot build. Runs on demo data in the browser (one browser only). No real database or login yet. See `docs/DATABASE.md`.

## Run it

You need Python 3 (already on a Mac) or any static web server. Opening `index.html` by double-click does **not** work, because browsers block modules on `file://`.

```
npm start            # or: python3 -m http.server 8080
```

Open http://localhost:8080

| Page | Who | Demo code |
|---|---|---|
| `/index.html` | agents | `EE-1001` to `EE-1005` |
| `/manager.html` | team lead | `MGR-7777` |
| `/breakathon.html` | agents see Breakathon; managers see the Punctuality report | sign in on the other pages first |

On the manager page press **Load demo team** to fill in a team and six days of history.

## What it does

- **Agents:** shift start/end, a work-time headline, a ring and list of today's breaks, one tile per break (pause and resume until the minutes are used), a friendly note when an overrun comes off the next break, the Breakathon board.
- **Managers:** live team table, +/- 5 minute adjustments, **View more** per person (full history, edit or remove recorded times, log a missed break), **Custom 1 to 5** extra breaks (today only, selected weekdays or every day), and the Punctuality report.

## What it stores, and what it never stores

- Stores: first name, break start and end times, allowance adjustments in minutes, custom break rules.
- Never stores: the **reason** for a break or an adjustment. There is no such field anywhere and a test fails if one appears in the config.
- Retention: records older than `retentionDays` (14) are deleted when a page loads.

## Layout

```
index.html, manager.html, breakathon.html   thin page shells (and the content-security policy)
src/config.js     every adjustable value
src/core.js       storage + break maths + scoring
src/pages/        one script per page
src/jokes.js, dom.js, pilot.js, styles.css
tests/            npm test  (engine.test.js; e2e/smoke.py is the optional browser test)
db/schema.sql     the database, ready for Supabase
docs/             ARCHITECTURE.md, DATABASE.md
legacy/stage1/    the earlier modular version, archived (npm run test:legacy)
```

## Ground rules for this repo

1. **No data, no secrets in git.** Git never forgets. `.gitignore` covers `.env`, data folders and exports.
2. **No free-text reason fields**, anywhere, ever.
3. **Security lives in the database**, not in hidden buttons. The pilot codes in `src/pilot.js` are for demos only.
4. Anything adjustable goes in `src/config.js`, not in the code.
