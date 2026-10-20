# Break Point

Live break tracking for a contact-centre team: agents start, pause and resume breaks, and managers see who is on what and who has run over.

**Status:** pilot build, connected to a Supabase database (`backend: 'api'` in `src/config.js`), so every manager and agent sees the same data.
Setting up a new project takes four steps: see **docs/DATABASE.md**.

## Run it

You need Python 3 (already on a Mac) or any static web server. Opening `index.html` by double-click does **not** work, because browsers block modules on `file://`.

```
npm start            # or: python3 -m http.server 8080
```

Open http://localhost:8080

| Page | Who | Sign in with |
|---|---|---|
| `/index.html` | agents | their code (e.g. `EE-1001`) and the password from the login script |
| `/manager.html` | team lead | their manager code and password |

Demo mode: set `backend: 'fake'` in `src/config.js` to try it without a database. Data then stays in **one browser only**
(nobody else can see it), the demo codes are `EE-1001` to `EE-1005` and `MGR-7777`, and **Load demo team** fills in a team.

## What it does

- **Agents:** shift start/end, a work-time headline, a ring and list of today's breaks, one tile per break (pause and resume until the minutes are used), and a friendly note when an overrun comes off the next break.
- **Managers:** live team table, +/- 5 minute adjustments, and **View more** per person: edit the shift start and end, full break history (edit or remove recorded times, log a missed break), **Custom 1 to 5** extra breaks (today only, selected weekdays or every day), **rename** any break for that person, and the **change history** of every manager edit.

## What it stores, and what it never stores

- Stores: first name, shift and break start and end times, allowance adjustments in minutes, custom break rules, break names a manager chose, and an audit trail of manager changes (who, when, before, after).
- Never stores: the **reason** for a break, an adjustment or an edit. There is no such field anywhere, and tests fail if one appears.
- Retention: everything older than `retentionDays` (14) is deleted by a nightly database job (`db/cleanup_job.sql`).

## Layout

```
index.html, manager.html   thin page shells (and the content-security policy)
src/config.js     every adjustable value
src/core.js       storage + break maths
src/backend/api.js the Supabase connection (clear error messages for every set-up mistake)
src/pages/        one script per page
src/jokes.js, dom.js, pilot.js, styles.css
scripts/create_logins.mjs   one-time: logins + profiles for everyone, a random password each
db/schema.sql     the database (safe to re-run)     db/cleanup_job.sql   the nightly 14-day cleanup
tests/            npm test (rules + set-up checks), npm run test:db (security rules on a local Postgres),
                  npm run test:security (the same on the live project), e2e/smoke.py (browser, demo mode)
docs/             ARCHITECTURE.md, DATABASE.md
legacy/stage1/    the earlier modular version, archived (npm run test:legacy)
```

## Ground rules for this repo

1. **No data, no secrets in git.** Git never forgets. `.gitignore` covers `.env`, `people.csv` and the generated `logins-*.csv`.
2. **No free-text reason fields**, anywhere, ever.
3. **Security lives in the database**, not in hidden buttons. The pilot codes in `src/pilot.js` are for demo mode only.
4. Anything adjustable goes in `src/config.js`, not in the code.
