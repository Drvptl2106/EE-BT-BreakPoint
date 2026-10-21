# The database (Supabase)

The app keeps its data in a Supabase project (Postgres + login + per-row security). The page only holds the **publishable** key;
the rules about who may see and change what live in the database (`db/schema.sql`), not in the page.

Current project: **`mqyeqrxzjzsfvbbjppxj`** (`https://mqyeqrxzjzsfvbbjppxj.supabase.co`). The old project `cintsnddjtehyhwdlddn` is no longer used.

## Setting up a project, in order

Do all of this in the **same** project as `supabaseUrl` in `src/config.js`. Check the project name at the top of the Supabase dashboard first.

1. **Tables and rules.** SQL Editor > New query > paste the whole of `db/schema.sql` > Run.
   **Run it again every time `db/schema.sql` changes** (for example after pulling a new version): the app will say
   "isn't set up" until you do. Re-running keeps all data.
   It is safe to run again, and it upgrades a project that ran an older version (it keeps the data and drops the tables of the removed ranking feature).
   The last result lists every table with "row level security on" = true.
2. **Nightly cleanup.** New query > paste `db/cleanup_job.sql` > Run. If the first line fails, switch on
   Database > Extensions > `pg_cron` and run it again. The last result shows one job, `break-track-purge`.
3. **Sign-ups off.** Authentication > Sign In / Providers > turn **off** "Allow new users to sign up" > Save.
   Nobody can then create their own login; only the script below can.
4. **Logins for everyone.** On your own computer (Node 18+), never in the browser:
   ```
   cp db/people.example.csv people.csv        # one line per person: code,name,role (agent or manager)
   SUPABASE_SECRET_KEY=sb_secret_... node scripts/create_logins.mjs people.csv
   ```
   The secret key is under Project Settings > API Keys > Secret keys. It creates a confirmed login and a profile for each
   person with their own random password, and writes `logins-<date>.csv`. Give each person only their own line, then delete the file.
   Run it again any time you add people (existing passwords stay; `--reset-passwords` issues new ones; `--dry-run` only checks the list).
   This replaces the old `create_pilot_logins.sql` / `fix_pilot_logins.sql`.

   **Quick trial with simple passwords:** `db/people.pilot.csv` has EE-001 to EE-015 and MGR-001. Run
   `SUPABASE_SECRET_KEY=sb_secret_... node scripts/create_logins.mjs db/people.pilot.csv --simple-passwords`
   and people sign in with their code and `user001`, `user002`, ... (manager: `manager001`).
   Anyone who knows the pattern can sign in as someone else, so the privacy rules and the change history mean nothing
   while these are in use. Before real use, run the same command with `--reset-passwords` instead to issue random ones.
5. **Check it.** With one manager and two agent passwords from step 4:
   ```
   AGENT_A=EE-001:user001 AGENT_B=EE-002:user002 MANAGER=MGR-001:manager001 npm run test:security
   ```
   It proves on the live project that sign-ups are off, signed-out visitors see nothing, one agent cannot see or change
   another's data, and the manager can see the team.

## Keys, addresses and the page security line

- `src/config.js` holds `supabaseUrl` and the **publishable** key (`sb_publishable_…`). Both are meant to be public.
  **Never** put a secret key (`sb_secret_…` or `service_role`) there: the app refuses to start if you do.
- `index.html` and `manager.html` each have a `Content-Security-Policy` line. Its `connect-src` must include exactly the same
  address as `supabaseUrl`, or the browser silently blocks every request. `npm test` fails if they differ, and the app says so on screen.
- If you move to a new project: change `supabaseUrl` and `supabaseKey`, change `connect-src` in both pages, then do steps 1 to 5 there.

## What the error messages mean

| On screen | Cause | Fix |
|---|---|---|
| That code or password is not right. | wrong code or password | check the line from `logins-….csv`, or re-issue with `--reset-passwords` |
| This page's security line doesn't allow the database address… | `connect-src` and `supabaseUrl` differ | make them the same |
| Can't reach the database at … | offline, wrong address, or blocked | check the address and connection |
| The database rejected the key in src/config.js… | key from another project, or mistyped | copy the publishable key again |
| The database on … isn't set up… | schema not run on **this** project | step 1 |
| Your login works, but it has no profile… | login made by hand without a profile | run the login script for that code |
| This login hasn't been confirmed yet. | login made by hand without "Auto confirm" | run the login script again |

## Who can do what

| | Agent | Team lead | Signed out |
|---|---|---|---|
| See profiles | own | own team | nothing |
| Start / stop breaks, set shift times | today only | team, any day | – |
| Change or delete a recorded break | never | team | – |
| Adjust allowances, OH breaks, break names | never | team | – |
| Read the audit trail | never | own team | – |
| Breakathon | team names + points | + minutes over | nothing |

Break start and stop times are stamped by the database clock when an agent starts and stops, so the phone's clock doesn't matter.

## Tables

| Table | What | Who can write |
|---|---|---|
| `profiles` | code, first name, team, role | nobody from the page (the login script, or you in the dashboard) |
| `shifts`, `break_segments` | a person's day and each break sitting | the person, and their team's manager |
| `adjustments` | +/- minutes, one person, one day, one break | managers of that team |
| `custom_break_rules` | OH Break 1 to 5 | managers of that team |
| `break_names` | a manager's name for a break, per person | managers of that team |
| `audit_log` | every manager change (and an agent moving their own shift times): who, when, what, before, after | only the database triggers |

Making someone a manager is a `role` in `profiles` (or `manager` in the login list). It is never a code in the page.

## Honest limits

- Times use the device clock. For a real roll-out use server time and the Europe/London zone, including the clock change on Sunday 25 October 2026.
- Check with HR/legal that taking overrun off the next break (including lunch) is allowed where you operate, and that the data,
  including the audit trail, is covered by your privacy notice.
