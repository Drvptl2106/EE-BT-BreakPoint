#!/usr/bin/env bash
# Tests db/schema.sql and db/cleanup_job.sql on a throwaway local Postgres (needs Postgres 15+ installed: initdb, pg_ctl, psql).
# Checks three things:
#   1. the schema installs on an EMPTY project,
#   2. it UPGRADES a project that already ran the old schema (with Breakathon), and is safe to run twice,
#   3. the security rules hold: tests/db/rls_test.sql (agents can't see each other, managers only their team, audit trail).
# Usage: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN="$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -x "$BIN/initdb" ] || { echo "SKIP: Postgres is not installed (no initdb found)."; exit 0; }
TMP="$(mktemp -d)"; RUN=(); [ "$(id -u)" = 0 ] && { chown postgres "$TMP"; RUN=(runuser -u postgres --); }
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"${RUN[@]}" "$BIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
sql() { PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}" "$BIN/psql" -h "$TMP" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
# the cleanup job without its first line (pg_cron is stubbed locally)
grep -v '^create extension' db/cleanup_job.sql > "$TMP/cleanup.sql"

echo "== 1. empty project: schema + cleanup job, twice"
sql -c 'create database fresh' -c 'create database upgrade'
for i in 1 2; do sql -d fresh $( [ $i = 1 ] && echo "-f tests/db/supabase_stub.sql" ) -f db/schema.sql -f "$TMP/cleanup.sql" >/dev/null; done
echo "ok"

echo "== 2. upgrade from the old schema (with Breakathon and old data)"
git show 'ae471fc:db/schema.sql' > "$TMP/old_schema.sql"
sql -d upgrade -f tests/db/supabase_stub.sql -f "$TMP/old_schema.sql" >/dev/null
sql -d upgrade >/dev/null <<'SQL'
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000aa', 'old@pilot.local');
insert into profiles(id, code, name) values ('00000000-0000-0000-0000-0000000000aa', 'EE-0001', 'Old');
insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-0000000000aa', current_date, 'lunch', 10);
SQL
sql -d upgrade -f db/schema.sql -f "$TMP/cleanup.sql" >/dev/null
sql -d upgrade -tA -c "select count(*) from profiles" | grep -qx 1 || { echo "FAIL: upgrade lost profiles"; exit 1; }
sql -d upgrade -tA -c "select count(*) from audit_log where after_value = '10'" | grep -qx 1 || { echo "FAIL: upgrade lost the old audit entries"; exit 1; }
sql -d upgrade -tA -c "select to_regclass('day_results') is null" | grep -qx t || { echo "FAIL: day_results still there"; exit 1; }
echo "ok"

echo "== 3. security rules"
PGOPTIONS='-c client_min_messages=notice' sql -d fresh -f tests/db/rls_test.sql 2>&1 | sed -n 's/.*NOTICE:  //p;s/.*ERROR:  /ERROR: /p'
[ "${PIPESTATUS[0]}" = 0 ] || { echo "FAIL: see the ERROR line above"; exit 1; }
echo "== all database tests passed"
