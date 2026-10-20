-- Old-data cleanup for break.track. Run once in the Supabase SQL editor, AFTER db/schema.sql. Safe to re-run.
-- Every night at 03:15 UTC it deletes everything older than 14 days (= CONFIG.retentionDays in src/config.js;
-- if you change one, change the other). Deleting a shift also deletes its breaks.
-- Needs the pg_cron extension. The first line switches it on; if that line fails, switch it on in
-- Database > Extensions > pg_cron instead and run the file again.

create extension if not exists pg_cron;

create or replace function purge_old_data() returns void language sql security definer set search_path = public as $$
  delete from shifts             where day < current_date - 14;
  delete from adjustments        where day < current_date - 14;
  delete from custom_break_rules where scope = 'today' and day < current_date - 14;
  delete from audit_log          where at  < now() - interval '14 days';
$$;
revoke execute on function purge_old_data() from public, anon, authenticated;

-- Replace any earlier version of the jobs (including the two from the old schema file).
select cron.unschedule(jobname) from cron.job where jobname in ('purge-old-days', 'purge-old-audit', 'break-track-purge');
select cron.schedule('break-track-purge', '15 3 * * *', 'select purge_old_data()');

-- Check: should list one job. Run "select purge_old_data();" to clean up straight away.
select jobname, schedule, command from cron.job where jobname = 'break-track-purge';
