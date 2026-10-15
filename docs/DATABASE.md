# Moving from browser storage to a real database

> **Status (Oct 2026):** the database layer is built. `src/backend/api.js` talks to Supabase, `src/core.js` picks it when
> `backend: 'api'` in `src/config.js`, and people sign in with code + password. To finish: paste the **publishable** key into
> `src/config.js`, create the logins (`db/create_pilot_logins.sql`), and add the nightly job below so agents can see the team
> Breakathon board. Everything underneath is the original plan and is still the reference.

Today every number lives in one browser (`localStorage`). That is why a manager on another PC sees
nothing. To share data you need a hosted database, and a login that the **database** trusts.

## What I recommend: Supabase

A static site on GitHub Pages cannot run server code, and you do not need to write any:
Supabase is Postgres plus login plus per-row security plus live updates, with a free tier.
The alternative (your own Node server + Postgres) works too but means you run and patch a server.

## Set-up, in order

1. **Create a project** at supabase.com (pick the London region). Keep the database password somewhere safe.
2. **Run `db/schema.sql`** in the SQL editor. This creates the tables, the "agent sees own rows, manager sees team" rules,
   the audit trigger and the leaderboard function. There is no reason column anywhere.
3. **Login**: Authentication > Providers > Email, and turn **off** "Allow new users to sign up". Invite people from the dashboard.
   Then insert one `profiles` row per person (id = their auth user id, code, first name, `role`). Making someone a manager
   is a row in this table, which only you can edit. It is never a code in the page.
4. **Keys**: copy the project URL and the `anon` key into the page config. The anon key is meant to be public;
   row-level security is what protects the data. **Never put the `service_role` key in the repo or the browser.**
5. **Content-security policy**: add the project URL to `connect-src` in the `<meta http-equiv="Content-Security-Policy">`
   of the three pages (and `wss://` for live updates), or the browser will block every call.
6. **Retention and the nightly job**: enable `pg_cron`, uncomment the two schedules at the bottom of the schema,
   and add a nightly function that fills `day_results` (see "The one tricky part").

## What has to change in the code

The pages call `load()` and `save()` from `src/core.js` in many places. Those two are synchronous; a database is not.
So the change is a proper step, not a one-line swap:

| Page action today | Becomes | Table |
|---|---|---|
| first open of the day | insert shift | `shifts` |
| set start/end time | update shift | `shifts` |
| start / stop / resume a break | update `active_*`, insert a sitting | `shifts`, `break_segments` |
| manager +/- 5 min | upsert / delete | `adjustments` (audited by trigger) |
| manager edits, adds or removes a recorded break | update / insert / delete | `break_segments` |
| manager adds a custom break | upsert | `custom_break_rules` |
| Breakathon / Punctuality | call `leaderboard(14)` | `day_results` |

Plan: add `src/data/api.js` with these as named async functions, give `src/core.js` the pure maths only,
and make the pages call the named functions instead of `load()`/`save()`. Use Supabase realtime on `shifts`
and `break_segments` instead of the 10 second refresh. The break maths in `plan()` stays exactly as it is.

## The one tricky part

Agents must see the Breakathon ranking without being able to read each other's raw break times. So the ranking comes from
`day_results` (one summary row per person per day) through the `leaderboard()` function, which hides minutes-over from agents.
Something trusted has to write `day_results` using the **same rules as `plan()`** (overrun comes off the next break,
tolerance, custom breaks). Easiest: a nightly Supabase Edge Function that re-implements `plan()` in TypeScript, with the test cases in
`tests/engine.test.js` copied across so the two cannot drift.
Today's live row is computed from the person's own `shifts` for themselves, and by managers for the team.

## Honest limits

- The pilot codes in `src/pilot.js` are readable by anyone who views the page source. They are fine for a demo and must not be used with real data.
- Times use the laptop clock. For a real roll-out use server time (`now()`) and the Europe/London zone, including the clock change on Sunday 25 October 2026.
- Check with HR/legal that taking overrun off the next break (including lunch) is allowed where you operate, and that the data is covered by your privacy notice.
