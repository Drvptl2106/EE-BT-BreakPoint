# Break Point

Live break tracking for a contact-centre team. Agents start, pause and resume their breaks; team leads see who is where, who is running over and who still needs a break; and **Breakathon** turns punctuality into a weekly game.

**Status:** pilot, running on a Supabase database (`backend: 'api'` in `src/config.js`), so everyone sees the same live data.
Setting up a project: **docs/DATABASE.md**.

## Run it

You need Python 3 (already on a Mac) or any static web server. Opening `index.html` by double-click does **not** work, because browsers block modules on `file://`.

```
npm start            # or: python3 -m http.server 8080
```

Open http://localhost:8080

| Page | Who | Sign in with |
|---|---|---|
| `/index.html` | agents | their code (e.g. `EE-001`) and password |
| `/manager.html` | team leads | their manager code (e.g. `MGR-001`) and password |

Demo mode: set `backend: 'fake'` in `src/config.js` to try it without a database. Data then stays in **one browser only**;
the demo codes are `EE-001` to `EE-006` and `MGR-001`, and **Manage > Load demo team** fills in a team.

## On a phone (the app)

Break Point is built to be used on a phone. Both pages install to the home screen as their own app, with no app store:

| | Staff app | Manager app |
|---|---|---|
| Open | https://drvptl2106.github.io/EE-BT-BreakPoint/ | https://drvptl2106.github.io/EE-BT-BreakPoint/manager.html |
| iPhone (Safari) | Share > **Add to Home Screen** | same |
| Android (Chrome) | tap **Install** on the card that appears (or menu > Install app) | same |

Once installed it opens full screen with its own icon (teal for staff, white for managers), stays signed in, and has a
bottom tab bar. The manager's tables turn into one card per person. It always shows live data; `sw.js` only keeps the app's
own files on the phone so it opens fast on a weak signal. Every update to this repo reaches everyone the next time they open it.

## What it does

**Agents (My day)**
- One horizontal bar per break (Break 1, Break 2, Lunch, plus any **OH Break** the manager adds), with Start / Resume.
  The running break grows into a big loading bar with the countdown and a running commentary ("10 min done, only 5 left",
  "2 min over, that's coming off Lunch"), and the rest of the page stays usable. The tab title shows the countdown too.
- The day's breaks are one pot. Running past a break's own minutes borrows from the breaks that still have time: the ones
  after it first (Break 1 → Break 2 → Lunch → OH breaks), then from the start (a long Lunch taken first comes off Break 1,
  then Break 2). That shows in amber. Someone is only **over** (red, for them and their manager) once the whole day's
  break time is used up, including any OH break the manager added.
- The shift pie: time worked, breaks, overruns and time still to go, with the worked time ticking to the second.
- A sales-floor pep talk that changes with the time of day (and is different every time you open the page), a live clock and a Live indicator.
- **Breakathon:** a simple platform-game climb: every 25 points lifts your mascot one platform, the highest racer wins the week, and the star at the top (level 8) is a perfect week. Tap a racer to see how close they are to the next platform.
- **Mascots and prizes:** everyone has a little hooded mascot with headphones in their own colour (any colour, any time). It delivers
  the pep talk and reacts quietly to your day. Last week's champion picks a prize: a 15 min extra break, or an accessory
  (cap, scarf, boots, bow, glasses, sprout) that's theirs for good.

**Two looks, same features**
- A **briefcase / smile** button in the header of both pages (next to the sun/moon button) switches between the two looks. Playful has the mascots, pep talks and the
  Breakathon game map; Professional uses the calmer manager-page styling, plain wording and shows the weekly scores as a table.
- Everyone is asked which look they want the first time they sign in, and can switch any time. The choice is saved with their
  login, and team leads see who picked which (Manage > **Interface choice**, with a CSV export) to show what people prefer.

**Team leads**
- **Dashboard** (view only): filters for everyone / on a break / running over / taken a break / no break yet / not clocked in,
  a "team pulse" in plain English ("Almost everyone has had Break 1, still to go: User 3", "User 4 is 6 min over, go wake User 4 up"),
  and a live card per person.
- **Manage:** +/- 5 minute adjustments, and per person: shift start and end, break history (edit, remove, log a missed break),
  OH breaks (today, chosen weekdays or every day), break names, and the change history. Export the last 14 days as CSV.
- **Breakathon:** the race with minutes over, what last week's champion picked, and a button to give the extra break if they chose it.

## Security in one paragraph

All rules live in the database (`db/schema.sql`), not in the page. Agents see only their own data and can only add breaks for today;
they can't change or delete a recorded break. Break start and stop times are stamped by the database's clock, not the phone's.
Team leads see and change only their own team, and every change they make (and any agent changing their own shift times) goes into an
audit trail nobody can edit. Breakathon gives agents names and points only, never anyone's break times. Data is deleted after 14 days.
`npm run test:db` proves all of this on a local copy of the database.

## What it stores, and what it never stores

- Stores: first name, shift and break times, allowance adjustments in minutes, OH break rules, break names a manager chose, the audit trail,
  and which look (Playful or Professional) each person picked, with their first pick and how often they switched.
- Never stores: the **reason** for a break, an adjustment or an edit. There is no such field anywhere, and tests fail if one appears.

## Layout

```
index.html, manager.html     the two pages (and their content-security policy)
app.webmanifest, manager.webmanifest, icons/, sw.js   what makes each page an installable phone app
src/config.js                every adjustable value: breaks, OH break names, Breakathon points and reward
src/core.js                  break rules, Breakathon scoring, dashboard status and team pulse
src/backend/api.js           the Supabase connection, clock sync and plain-English errors
src/pages/user.js, manager.js   one script per page
src/chrome.js                header: live clock, Live pill, tabs, change password
src/race.js                  the Breakathon island map and the characters (also the pep-talk buddy)
src/ui.js                    the Playful / Professional switch, the first-sign-in picker and saving the choice
src/theme.js                 applies the saved light/dark choice and look before the page draws
src/jokes.js                 the pep talks          src/dom.js, pilot.js, styles.css
scripts/create_logins.mjs    creates everyone's login and profile      scripts/stamp.mjs   the version stamp
db/schema.sql                the database (safe to re-run)      db/cleanup_job.sql   nightly 14-day cleanup
tests/                       npm test (rules and set-up), npm run test:db (database security on a local Postgres),
                             npm run test:security (the live project), e2e/smoke.py (browser, demo mode)
docs/                        ARCHITECTURE.md, DATABASE.md
```

## Two bits of housekeeping

- **Version stamp.** After changing anything in `src/` or the two pages, run `npm run stamp` before committing. It adds `?v=...`
  to every file reference, so browsers load the new version instead of mixing old and new files. `npm test` fails if you forget.
- **Keep-awake.** `.github/workflows/keep-awake.yml` pings the database once a day, because a free Supabase project pauses
  after a week without traffic (a quiet holiday week would do it).

## Ground rules for this repo

1. **No data, no secrets in git.** `.gitignore` covers `.env`, `people.csv` and the generated `logins-*.csv`.
2. **No free-text reason fields**, anywhere, ever.
3. **Security lives in the database**, not in hidden buttons.
4. Anything adjustable goes in `src/config.js` (colours in `src/styles.css`), not in the code.
