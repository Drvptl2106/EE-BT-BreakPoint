# Architecture

```
 Agent's browser (index.html)        Team lead's browser (manager.html)
        │  sign in: code + password            │
        ▼                                      ▼
 ┌──────────────────────── Supabase ─────────────────────────┐
 │ Login        checks the password, hands out a 1-hour pass │
 │ Database     tables, who-can-see-what rules, audit trail, │
 │              break time stamping, Breakathon scores       │
 │ Nightly job  deletes everything older than 14 days        │
 └───────────────────────────────────────────────────────────┘
```

There is no server of our own: the pages are plain files and talk straight to Supabase with the public (publishable) key.
Every `refreshSeconds` (10) each page re-reads the database; a change is sent as soon as it is made, and only the change.

## Files

```
index.html        agent page: tabs "My day" and "Breakathon"            src/pages/user.js
manager.html      team lead: tabs "Dashboard", "Manage", "Breakathon"     src/pages/manager.js

src/config.js     every adjustable value
src/core.js       storage switch (load/save) + break maths (plan, slotsFor) + Breakathon (weekScore, weekOf)
                  + dashboard (statusOf, FILTERS, teamPulse). Pure functions, tested in tests/engine.test.js
src/backend/api.js Supabase: sign-in, sync, clock offset, Breakathon call, password change, plain-English errors
src/chrome.js     shared header: clock to the second, Live pill, tabs, toast, change password
src/race.js       Breakathon track and characters
src/jokes.js      pep talks          src/dom.js  esc() and setHtml()          src/pilot.js  demo logins
src/styles.css    the one stylesheet; EE-style colours are the variables at the top
```

## The break rules (all in `plan()` in `src/core.js`)

- A break can be taken in several sittings. It only closes when all its minutes are used.
- Going over takes the extra minutes off the **next** break: 17 minutes on Break 1 leaves Break 2 with 13; 17 on Break 2 leaves Lunch with 28.
  If the next break is too short, the rest rolls on to the one after.
- A few seconds over (`overToleranceMinutes`) is forgiven.
- A manager adjustment is +/- minutes for one person, one day, one break (bounded by `adjustmentLimits`).
- OH Break 1 to 5 are extra breaks a manager adds to one person (today, chosen weekdays, or every day). Each shows as its own bar.
- A manager can rename any break for one person. It only changes the name shown, never the maths.
- A break left running for `forgotToStopMinutes` is closed automatically and flagged.
- No reason is stored for anything.

## Time

Each page asks the database for its time (`server_time()`) every few minutes and shows that, so all screens agree.
The database also stamps a break's start and stop itself (triggers in `db/schema.sql`), so a wrong phone clock can't shorten a break.

## Breakathon

Monday to Sunday. A break is on time when it stays within its own allowance (+ adjustment); minutes passed on to the next break are not
counted twice. Points = 10 per on-time break + 5 per clean day − 2 per minute over (never below 0), set in `CONFIG.breakathon`.
In database mode the database works the scores out (`breakathon()`), so agents receive names and points only. The JavaScript
`weekScore()` is the same maths for demo mode, and both are tested on the same example.
Last week's top scorer is the champion; the team lead can give them a reward break (an OH break for today, logged like any other change).

## Audit trail

Database triggers write `audit_log` for every change someone makes to another person's data (shift times, breaks added, edited or removed,
allowances, OH breaks, names) and for an agent moving their own shift start or an end time already set. Who, when, what, before, after;
no reason column. Team leads see it per person and day under **Manage > View more > Change history**. Nobody can edit or delete an entry.

## Tests

`npm test` (break rules incl. the overrun chain, Breakathon scoring, dashboard status and pulse, set-up checks),
`npm run test:db` (installs the schema on a throwaway local Postgres and proves the security rules, time stamping, audit trail,
Breakathon and cleanup), `npm run test:security` (key checks on the live project), `npm run test:e2e` (real browser, demo mode).
