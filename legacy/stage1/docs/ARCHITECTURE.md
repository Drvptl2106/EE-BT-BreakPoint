# Architecture

```
   screens (src/ui)  ->  main.js  ->  DATA CONTRACT   ->  fake demo data   (now)
                                  \->                  ->  hosted database  (Stage 2)
                                  ->  LOGIN CONTRACT  ->  stub codes        (now)
                                                      ->  invite-only login (Stage 3)
                                                      ->  company SSO       (IT, later)
   core rules (src/core) are used by both the screens and any data layer
```

The screens never know which implementation is plugged in. Swapping one means adding a file and one `case` in `src/data/index.js` or `src/auth/index.js`.

## Where each stage plugs in

| Stage | What changes | Files touched | Must still pass |
|---|---|---|---|
| 2 Data and storage | Add a hosted-database client | new `src/data/apiData.js`; one `case 'api'` in `src/data/index.js`; add the database address to `connect-src` in `index.html`; set `backend: 'api'` | `tests/helpers/contract.js` (run it against the new layer) |
| 3 Login and roles | Add an invite-only login; retire the codes | new `src/auth/inviteAuth.js`; one `case` in `src/auth/index.js`; delete `src/auth/stubAuth.js` and `src/data/fakeRoster.js` | the three-method login contract |
| 4 Agent experience | Polish existing screens | `src/ui/agentScreen.js`, `historyScreen.js` | `npm test` |
| 5 Manager tools | Allowance editor, fix-a-record, audit view | new `src/ui/adjustScreen.js`; uses the existing `setAdjustment` and `getAuditLog` | contract suite (already covers range checks and audit) |
| 6 Streaks | Final streak rules | `streakGapPolicy` in config; `src/core/streaks.js` | `tests/core.test.js` |
| 7 Safety nets | Server time, UK clock change, forgot-to-stop | `src/core/time.js`; `forgotToStopMinutes` in config; extend the daily job | add tests for each |
| 9 Handoff | Docs and demo | this folder; the fake layer is the demo mode | n/a |

## Rules every data layer must enforce itself

See the header of `src/data/contract.js`. In short: an agent only touches their own rows, a manager only their team's; one running break per person; adjustments stay in range and are audited; no reason fields.

## Known limits (be upfront with IT)

- The demo layer keeps data in one browser. It is not shared between people.
- The stub login is not real security. It exists only until Stage 3.
- Dates use UTC and the laptop clock until Stage 7.
- Fonts load from Google Fonts. IT may prefer to self-host them.
- The leaderboard shows "over today" for each person. Stage 6 (BT-6.2) decides whether that stays.
