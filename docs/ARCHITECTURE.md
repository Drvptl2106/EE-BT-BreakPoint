# Architecture

```
index.html        agent page                      src/pages/user.js
manager.html      manager page                    src/pages/manager.js

                  both use:
src/config.js     every adjustable value
src/core.js       storage (load/save/purge) + break maths (plan, slotsFor, labelFor)
src/backend/api.js Supabase: sign-in, sync, set-up checks and plain-English errors
src/jokes.js      agent page one-liners
src/dom.js        esc() and setHtml()
src/pilot.js      demo-mode logins; in database mode it is filled from the profiles table after sign-in
src/styles.css    the one stylesheet (light and dark)
```

Each page is a thin HTML shell with one script. No page contains its own copy of the rules.

## The rules (all in `plan()` in `src/core.js`)

- A break can be taken in several sittings. It only closes when all its minutes are used.
- Going over takes the extra minutes off the **next** break; if that is too short, the rest rolls on to the one after.
- A few seconds over (`overToleranceMinutes`) is forgiven.
- A manager adjustment is +/- minutes for one person, one day, one break (bounded by `adjustmentLimits`).
- Custom 1 to 5 are extra breaks a manager adds to one person: today only, selected weekdays, or every day.
- A manager can rename any break for one person (`breakNameMaxLength` characters). It only changes the name shown, never the maths.
- A break left running for `forgotToStopMinutes` is closed automatically and flagged.
- No reason is stored for anything.

## Data flow in database mode

The pages keep working on one in-memory object (`db`). `save(db)` hands it to `src/backend/api.js`, which compares it with what it last
read and sends only the differences (a shift that already exists is patched field by field, so a manager's edit and an agent's
click on the same shift never overwrite each other). Every `refreshSeconds` it re-reads the database.

## Audit trail

Database triggers (in `db/schema.sql`) write `audit_log` whenever someone changes **another person's** data: shift start/end,
breaks added, edited or removed, allowance changes, custom breaks and break names. Each entry has who, when, what, before and after;
there is no reason column. Agents' own clicks are not logged. Managers see the trail per person and day under **View more > Change history**.
Nobody can edit or delete an entry (only the 14-day cleanup removes old ones).

## Tests

`npm test` (break rules, custom scopes, break names, set-up checks such as the page security line matching the config),
`npm run test:db` (installs the schema on a throwaway local Postgres and proves the security rules and the audit trail),
`npm run test:security` (the key checks against the live project), `npm run test:e2e` (real browser, demo mode; see the file header),
`npm run test:legacy` (archived Stage 1).

## Database

See `docs/DATABASE.md` and `db/schema.sql`.
