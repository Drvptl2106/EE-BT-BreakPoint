# Architecture

```
index.html        agent page                      src/pages/user.js
manager.html      manager page                    src/pages/manager.js
breakathon.html   Breakathon (agent) /            src/pages/breakathon.js
                  Punctuality report (manager)

                  all three use:
src/config.js     every adjustable value
src/core.js       storage (load/save/purge) + break maths (plan, slotsFor) + scoring (score)
src/jokes.js      agent page one-liners
src/dom.js        esc() and setHtml()
src/pilot.js      TEMPORARY demo logins (delete when real login arrives)
src/styles.css    the one stylesheet (light and dark)
```

Each page is a thin HTML shell with one script. No page contains its own copy of the rules.

## The rules (all in `plan()` in `src/core.js`)

- A break can be taken in several sittings. It only closes when all its minutes are used.
- Going over takes the extra minutes off the **next** break; if that is too short, the rest rolls on to the one after.
- A few seconds over (`overToleranceMinutes`) is forgiven.
- A manager adjustment is +/- minutes for one person, one day, one break (bounded by `adjustmentLimits`).
- Custom 1 to 5 are extra breaks a manager adds to one person: today only, selected weekdays, or every day.
- A break left running for `forgotToStopMinutes` is closed automatically and flagged.
- No reason is stored for anything.

## Punctuality (`score()`)

Over the last `retentionDays` days: a break is on time if it was used without going over.
Points = 10 per on-time break + 5 per streak day - 2 per minute over (never below 0). A day with no breaks follows
`streakGapPolicy`; today never breaks a streak.

## Tests

`npm test` (rules, custom scopes, scoring), `npm run test:legacy` (archived Stage 1),
`npm run test:e2e` (real browser; needs Playwright, see the file header).

## Database

See `docs/DATABASE.md` and `db/schema.sql`. `legacy/stage1/` holds the earlier modular version with a data and login contract;
its ideas (audit trail, stored streak number, contract tests) are still wanted for the database stage.
