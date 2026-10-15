# Stage 1 (archived reference)

The first, modular version of break.track: a data contract (`src/data`), a login contract
(`src/auth`), pure rules (`src/core`), screens (`src/ui`) and a daily job in the fake data layer
(streak number that survives deletion, auto-closing forgotten breaks, audit log).

It is **not** the app that runs today. The live app is the three pages in the repo root
(`index.html`, `manager.html`, `breakathon.html`) plus `src/`. This folder is kept because
the ideas in it (audit trail, stored streak number, contract tests) are still wanted for the
database stage. Its HTML shell was overwritten earlier, so it has no page; its tests still run:

    npm run test:legacy
