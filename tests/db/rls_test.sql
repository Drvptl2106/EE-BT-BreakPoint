-- Proves the security rules in db/schema.sql on a local Postgres (run by tests/db/run.sh, after supabase_stub.sql and the schema).
-- People:  A, B = agents in team "pilot"   M = manager of "pilot"   X = agent in team "other"   N = manager of "other"
\set ON_ERROR_STOP on
create schema t;
grant usage on schema t to authenticated, anon;
create function t.denied(q text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'SHOULD HAVE BEEN REFUSED: %', q;
exception when insufficient_privilege or check_violation then null;
end $$;
create function t.n(q text) returns int language plpgsql as $$
declare c int; begin execute 'select count(*) from (' || q || ') x' into c; return c; end $$;
create function t.changed(q text) returns int language plpgsql as $$
declare c int; begin execute q; get diagnostics c = row_count; return c; end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', what; end if; raise notice 'PASS %', what; end $$;
grant execute on all functions in schema t to authenticated, anon;

insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ee-1001@pilot.local'), ('00000000-0000-0000-0000-00000000000b', 'ee-1002@pilot.local'),
  ('00000000-0000-0000-0000-00000000000c', 'mgr-7777@pilot.local'), ('00000000-0000-0000-0000-00000000000d', 'ee-2001@pilot.local'),
  ('00000000-0000-0000-0000-00000000000e', 'mgr-8888@pilot.local');
insert into profiles(id, code, name, team, role) values
  ('00000000-0000-0000-0000-00000000000a', 'EE-1001', 'Alex',  'pilot', 'agent'),
  ('00000000-0000-0000-0000-00000000000b', 'EE-1002', 'Priya', 'pilot', 'agent'),
  ('00000000-0000-0000-0000-00000000000c', 'MGR-7777', 'Lead', 'pilot', 'manager'),
  ('00000000-0000-0000-0000-00000000000d', 'EE-2001', 'Sam',   'other', 'agent'),
  ('00000000-0000-0000-0000-00000000000e', 'MGR-8888', 'Other lead', 'other', 'manager');

-- ---------- B and X record their own day (as themselves) ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true); set local role authenticated;
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', current_date, now() - interval '3 hours');
insert into break_segments(id, shift_id, slot_key, started_at, ended_at) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'break1', now() - interval '2 hours', now() - interval '105 minutes');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true); set local role authenticated;
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', current_date, now() - interval '3 hours');
commit;

-- ---------- agent A cannot see or change anyone else's data ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select t.ok(t.n('select * from profiles') = 1, 'agent sees only their own profile');
select t.ok((select code from profiles) = 'EE-1001', 'and it is their own');
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', current_date, now() - interval '2 hours');
insert into break_segments(shift_id, slot_key, started_at, ended_at) values ('10000000-0000-0000-0000-00000000000a', 'break1', now() - interval '1 hour', now() - interval '50 minutes');
select t.ok(t.n('select * from shifts') = 1, 'agent sees only their own shift');
select t.ok(t.n('select * from break_segments') = 1, 'agent sees only their own breaks');
select t.ok(t.n($$select * from shifts where user_id = '00000000-0000-0000-0000-00000000000b'$$) = 0, 'agent cannot read another agent''s shift even by id');
select t.denied($$insert into shifts(user_id, day, shift_start) values ('00000000-0000-0000-0000-00000000000b', current_date - 1, now())$$);
select t.ok(true, 'agent cannot create a shift for someone else');
select t.denied($$insert into break_segments(shift_id, slot_key, started_at, ended_at) values ('10000000-0000-0000-0000-00000000000b', 'lunch', now() - interval '9 minutes', now())$$);
select t.ok(true, 'agent cannot add a break to someone else''s shift');
select t.ok(t.changed($$update shifts set shift_start = now() where user_id = '00000000-0000-0000-0000-00000000000b'$$) = 0, 'agent cannot change another agent''s shift');
select t.ok(t.changed($$update break_segments set ended_at = ended_at + interval '1 hour' where id = '20000000-0000-0000-0000-00000000000b'$$) = 0, 'agent cannot change another agent''s break');
select t.ok(t.changed($$delete from break_segments where id = '20000000-0000-0000-0000-00000000000b'$$) = 0, 'agent cannot delete another agent''s break');
select t.ok(t.changed($$delete from shifts where user_id <> auth.uid()$$) = 0, 'agent cannot delete anyone else''s shift');
select t.denied($$insert into adjustments(user_id, day, slot_key, minutes) values (auth.uid(), current_date, 'lunch', 60)$$);
select t.ok(true, 'agent cannot give themselves extra minutes');
select t.denied($$insert into custom_break_rules(user_id, slot_key, minutes, scope) values (auth.uid(), 'c1', 60, 'daily')$$);
select t.ok(true, 'agent cannot add themselves a custom break');
select t.denied($$insert into break_names(user_id, slot_key, label) values (auth.uid(), 'break1', 'Nap')$$);
select t.ok(true, 'agent cannot rename their own breaks');
select t.denied($$update profiles set role = 'manager' where id = auth.uid()$$);
select t.ok(true, 'agent cannot make themselves a manager');
select t.denied($$update profiles set team = 'other'$$);
select t.ok(true, 'agent cannot move themselves to another team');
select t.denied($$insert into profiles(id, code, name, role) values (gen_random_uuid(), 'EE-9999', 'Fake', 'manager')$$);
select t.ok(true, 'agent cannot create a profile');
select t.denied($$insert into audit_log(action) values ('forged')$$);
select t.ok(true, 'agent cannot write to the audit trail');
select t.denied($$select audit_write('forged', '00000000-0000-0000-0000-00000000000b', null, null, null, null, null)$$);
select t.ok(true, 'agent cannot call the audit function directly');
commit;

-- ---------- an agent's own clicks are not audited ----------
select t.ok(t.n('select * from audit_log') = 0, 'agent and own-data changes create no audit entries');

-- ---------- manager M: sees and edits their team, every edit is audited ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.ok(t.n('select * from profiles') = 3, 'manager sees the 3 people in their team');
select t.ok(t.n($$select * from profiles where team = 'other'$$) = 0, 'manager does not see another team');
select t.ok(t.n('select * from shifts') = 2, 'manager sees their team''s shifts only');
update shifts set shift_start = shift_start - interval '30 minutes' where user_id = '00000000-0000-0000-0000-00000000000b';
update shifts set shift_end = now() + interval '5 hours' where user_id = '00000000-0000-0000-0000-00000000000b';
update break_segments set ended_at = ended_at - interval '2 minutes' where id = '20000000-0000-0000-0000-00000000000b';
insert into break_segments(id, shift_id, slot_key, started_at, ended_at) values
  ('30000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'lunch', now() - interval '80 minutes', now() - interval '50 minutes');
delete from break_segments where id = '30000000-0000-0000-0000-00000000000b';
insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-00000000000b', current_date, 'lunch', 15);
insert into custom_break_rules(user_id, slot_key, minutes, scope) values ('00000000-0000-0000-0000-00000000000b', 'c1', 10, 'daily');
insert into break_names(user_id, slot_key, label) values ('00000000-0000-0000-0000-00000000000b', 'c1', 'Prayer');
update break_names set label = 'Quiet time' where user_id = '00000000-0000-0000-0000-00000000000b';
-- an upsert with nothing changed must not add a line
insert into break_segments(id, shift_id, slot_key, started_at, ended_at)
  select id, shift_id, slot_key, started_at, ended_at from break_segments where id = '20000000-0000-0000-0000-00000000000b'
  on conflict (id) do update set started_at = excluded.started_at, ended_at = excluded.ended_at;
select t.denied($$insert into break_names(user_id, slot_key, label) values ('00000000-0000-0000-0000-00000000000b', 'break2', 'A name that is far too long to fit')$$);
select t.ok(true, 'break names longer than 24 characters are refused');
select t.denied($$insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-00000000000b', current_date, 'break1', 500)$$);
select t.ok(true, 'adjustments outside -30..120 minutes are refused');
select t.ok(t.changed($$update shifts set shift_start = now() where user_id = '00000000-0000-0000-0000-00000000000d'$$) = 0, 'manager cannot change another team''s shift');
select t.denied($$insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-00000000000d', current_date, 'lunch', 15)$$);
select t.ok(true, 'manager cannot adjust another team''s allowance');
select t.ok(t.n('select * from audit_log') = 9, 'manager sees the 9 audit entries for their team');
select t.ok(t.n($$select * from audit_log where action = 'edit_shift_start' and before_value is not null and after_value is not null$$) = 1, 'shift start edit logged with before and after');
select t.ok(t.n($$select * from audit_log where action = 'edit_shift_end' and before_value is null and after_value is not null$$) = 1, 'shift end edit logged');
select t.ok(t.n($$select * from audit_log where action = 'edit_break' and record_id = '20000000-0000-0000-0000-00000000000b' and before_value <> after_value$$) = 1, 'break time edit logged (before/after)');
select t.ok(t.n($$select * from audit_log where action = 'add_break' and slot_key = 'lunch'$$) = 1, 'added break logged');
select t.ok(t.n($$select * from audit_log where action = 'remove_break' and slot_key = 'lunch' and before_value is not null$$) = 1, 'removed break logged with its old times');
select t.ok(t.n($$select * from audit_log where action = 'adjust_allowance' and after_value = '15'$$) = 1, 'allowance change logged');
select t.ok(t.n($$select * from audit_log where action = 'add_custom_break'$$) = 1, 'custom break logged');
select t.ok(t.n($$select * from audit_log where action = 'rename_break' and before_value = 'Prayer' and after_value = 'Quiet time'$$) = 1, 'rename logged');
select t.ok(t.n($$select * from audit_log where actor_id = '00000000-0000-0000-0000-00000000000c' and target_id = '00000000-0000-0000-0000-00000000000b'$$) = 9, 'every entry names who did it and to whom');
select t.denied('delete from audit_log');
select t.ok(true, 'manager cannot delete audit entries');
select t.denied($$update audit_log set after_value = 'x'$$);
select t.ok(true, 'manager cannot edit audit entries');
commit;

-- ---------- the other team's manager sees none of it; agents never see the audit trail ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true); set local role authenticated;
select t.ok(t.n('select * from audit_log') = 0, 'another team''s manager cannot read this team''s audit trail');
select t.ok(t.n('select * from break_names') = 0, 'another team''s manager cannot read this team''s break names');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true); set local role authenticated;
select t.ok(t.n('select * from audit_log') = 0, 'agent cannot read the audit trail, even about themselves');
select t.ok((select label from break_names where slot_key = 'c1') = 'Quiet time', 'agent sees the name their manager gave their break');
select t.ok(t.n('select * from adjustments') = 1, 'agent sees their own adjustment');
commit;
begin; set local role anon;
select t.denied('select * from profiles'), t.denied('select * from shifts'), t.denied('select * from break_segments'),
       t.denied('select * from adjustments'), t.denied('select * from break_names'), t.denied('select * from audit_log');
select t.ok(true, 'signed-out visitors cannot read any table');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.denied('truncate break_segments'), t.denied('truncate audit_log');
select t.ok(true, 'nobody signed in can wipe a table with TRUNCATE (it would skip row level security)');
select t.denied($$update profiles set role = 'admin'$$);
select t.ok(true, 'even a manager cannot change profiles from the page');
commit;

-- ---------- cleanup job ----------
insert into shifts(user_id, day, shift_start) values ('00000000-0000-0000-0000-00000000000a', current_date - 20, now() - interval '20 days');
insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-00000000000a', current_date - 20, 'lunch', 5);
insert into audit_log(at, action) values (now() - interval '20 days', 'old');
select purge_old_data();
select t.ok(t.n('select * from shifts where day < current_date - 14') = 0, 'cleanup removes shifts older than 14 days');
select t.ok(t.n('select * from adjustments where day < current_date - 14') = 0, 'cleanup removes old adjustments');
select t.ok(t.n($$select * from audit_log where action = 'old'$$) = 0, 'cleanup removes old audit entries');
select t.ok(t.n('select * from shifts') = 3, 'cleanup keeps recent shifts');
select t.ok(t.n($$select * from cron.job where jobname = 'break-track-purge'$$) = 1, 'nightly job is scheduled');
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.denied('select purge_old_data()');
select t.ok(true, 'nobody signed in can run the cleanup by hand');
commit;

-- ---------- every table has row level security on ----------
select t.ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity), 'row level security is on for every table');
select t.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and column_name ilike '%reason%'), 'no reason column anywhere');
select t.ok(to_regclass('public.day_results') is null and to_regprocedure('public.leaderboard(int)') is null, 'Breakathon tables and functions are gone');
