-- Proves the security rules in db/schema.sql on a local Postgres (run by tests/db/run.sh, after supabase_stub.sql and the schema).
-- People:  A, B = agents in team "pilot"   M = manager of "pilot"   X = agent in team "other"   N = manager of "other"
\set ON_ERROR_STOP on
create schema t;
grant usage on schema t to authenticated, anon;
create function t.denied(q text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'SHOULD HAVE BEEN REFUSED: %', q;
exception when insufficient_privilege or check_violation or raise_exception then null;
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
  ('00000000-0000-0000-0000-00000000000a', 'EE-1001', 'User 1', 'pilot', 'agent'),
  ('00000000-0000-0000-0000-00000000000b', 'EE-1002', 'User 2', 'pilot', 'agent'),
  ('00000000-0000-0000-0000-00000000000c', 'MGR-7777', 'Lead', 'pilot', 'manager'),
  ('00000000-0000-0000-0000-00000000000d', 'EE-2001', 'User 3', 'other', 'agent'),
  ('00000000-0000-0000-0000-00000000000e', 'MGR-8888', 'Other lead', 'other', 'manager');

-- ---------- B and X already have a day on record ----------
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', current_date, now() - interval '3 hours');
insert into break_segments(id, shift_id, slot_key, started_at, ended_at) values
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'break1', now() - interval '2 hours', now() - interval '105 minutes');
-- B had a good day last week (so B is last week's Breakathon champion)
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-00000000000b', current_date - 7, now() - interval '7 days');
insert into break_segments(shift_id, slot_key, started_at, ended_at) values
  ('10000000-0000-0000-0000-0000000000b7', 'break1', now() - interval '7 days', now() - interval '7 days' + interval '10 minutes');
-- and A has a day from last week
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-00000000000a', current_date - 7, now() - interval '7 days');
insert into break_segments(id, shift_id, slot_key, started_at, ended_at) values
  ('20000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-0000000000a7', 'break1', now() - interval '7 days', now() - interval '7 days' + interval '65 minutes');
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-00000000000a', current_date - 8, now() - interval '8 days');
insert into break_segments(shift_id, slot_key, started_at, ended_at) values      -- 25 min on Break 2, but only 25 of the day's 60: fine
  ('10000000-0000-0000-0000-0000000000a8', 'break2', now() - interval '8 days', now() - interval '8 days' + interval '25 minutes');
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true); set local role authenticated;
insert into shifts(id, user_id, day, shift_start) values ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', current_date, now() - interval '3 hours');
commit;

-- ---------- agent A cannot see or change anyone else's data ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select t.ok(t.n('select * from profiles') = 1, 'agent sees only their own profile');
select t.ok((select code from profiles) = 'EE-1001', 'and it is their own');
-- A starts a break with a device clock an hour slow: the database uses its own clock
insert into shifts(id, user_id, day, shift_start, active_slot, active_started) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', current_date, now() - interval '2 hours', 'break1', now() - interval '1 hour');
select t.ok((select active_started from shifts where id = '10000000-0000-0000-0000-00000000000a') = now(), 'a break start is stamped with the database clock');
update shifts set active_started = now() - interval '1 hour' where id = '10000000-0000-0000-0000-00000000000a';
select t.ok((select active_started from shifts where id = '10000000-0000-0000-0000-00000000000a') = now(), 'an agent cannot move the start of a running break');
-- A stops it, sending made-up times: the database records its own start and stop
insert into break_segments(id, shift_id, slot_key, started_at, ended_at) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'break1', now() - interval '1 hour', now() - interval '55 minutes');
update shifts set active_slot = null where id = '10000000-0000-0000-0000-00000000000a';
select t.ok((select started_at = now() and ended_at > now() from break_segments where id = '20000000-0000-0000-0000-00000000000a'), 'a break stop is stamped with the database clock');
select t.denied($$insert into break_segments(shift_id, slot_key, started_at, ended_at) values ('10000000-0000-0000-0000-00000000000a', 'lunch', now() - interval '3 hours', now() - interval '170 minutes')$$);
select t.ok(true, 'an agent cannot add a made-up break that was never started');
select t.ok(t.changed($$update break_segments set ended_at = started_at + interval '2 minutes' where id = '20000000-0000-0000-0000-0000000000a7'$$) = 0, 'an agent cannot shorten their own recorded break');
select t.ok(t.changed($$update break_segments set ended_at = ended_at + interval '1 minute' where id = '20000000-0000-0000-0000-00000000000a'$$) = 0, 'not even today''s');
select t.ok(t.changed($$delete from break_segments where shift_id = '10000000-0000-0000-0000-0000000000a7'$$) = 0, 'an agent cannot delete their own recorded break');
select t.ok(t.changed($$update shifts set shift_start = now() where id = '10000000-0000-0000-0000-0000000000a7'$$) = 0, 'an agent cannot change last week''s shift');
select t.ok(t.changed($$delete from shifts where user_id = auth.uid()$$) = 0, 'an agent cannot delete their own shifts');
select t.denied($$insert into shifts(user_id, day, shift_start) values (auth.uid(), current_date - 5, now())$$);
select t.ok(true, 'an agent cannot invent a shift on another day');
select t.ok(t.n('select * from shifts') = 3, 'agent sees only their own shifts');
select t.ok(t.n('select * from break_segments') = 3, 'agent sees only their own breaks');
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
select t.denied($$select audit_write('forged', '00000000-0000-0000-0000-00000000000b', null, null, null, null, null, true)$$);
select t.ok(true, 'agent cannot call the audit function directly');
commit;

-- ---------- an agent's own clicks are not audited ----------
select t.ok(t.n('select * from audit_log') = 0, 'agent and own-data changes create no audit entries');

-- ---------- manager M: sees and edits their team, every edit is audited ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.ok(t.n('select * from profiles') = 3, 'manager sees the 3 people in their team');
select t.ok(t.n($$select * from profiles where team = 'other'$$) = 0, 'manager does not see another team');
select t.ok(t.n('select * from shifts') = 5, 'manager sees their team''s shifts only');
update shifts set shift_start = shift_start - interval '30 minutes' where id = '10000000-0000-0000-0000-00000000000b';
update shifts set shift_end = now() + interval '5 hours' where id = '10000000-0000-0000-0000-00000000000b';
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

-- ---------- an agent changing their own shift times is on the record too ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
update shifts set shift_end = now() + interval '6 hours' where id = '10000000-0000-0000-0000-00000000000a';
commit;
select t.ok(t.n($$select * from audit_log where actor_id = '00000000-0000-0000-0000-00000000000a'$$) = 0, 'an agent setting their end time for the first time is not logged');
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
update shifts set shift_start = shift_start - interval '1 hour', shift_end = shift_end + interval '1 hour' where id = '10000000-0000-0000-0000-00000000000a';
commit;
select t.ok(t.n($$select * from audit_log where actor_id = '00000000-0000-0000-0000-00000000000a' and target_id = actor_id and action in ('edit_shift_start', 'edit_shift_end')$$) = 2, 'an agent moving their own start or end time is logged');

-- ---------- Breakathon ----------
-- A: today 1 break on time; 8 days ago 25 min on Break 2 (within the day's 60, so on time and clean);
--    7 days ago break 1 took 65 min, 5 past the day's 60: 3 breaks, 2 on time, 2 clean days, 5 min over -> 20 + 10 - 10 = 20
-- B: break 1 of 13 min (the manager's edit): 1 break, on time, clean -> 15.   X and the managers are not in the game.
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select t.ok((select string_agg(code || ':' || breaks || '/' || on_time || '/' || clean_days || '/' || coalesce(over_minutes::text, '-') || '/' || points, ' ')
             from breakathon(current_date - 30, current_date)) = 'EE-1002:2/2/2/-/30 EE-1001:3/2/2/-/20', 'Breakathon ranks the team; agents see points but not minutes over');
select t.ok(t.n('select * from breakathon(current_date - 3, current_date)') = 2 and (select points from breakathon(current_date - 3, current_date) where code = 'EE-1001') = 15,
            'Breakathon only counts the chosen week');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.ok((select over_minutes from breakathon(current_date - 30, current_date) where code = 'EE-1001') = 5, 'managers also see minutes over');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true); set local role authenticated;
select t.ok(t.n($$select * from breakathon(current_date - 30, current_date) where code like 'EE-1%'$$) = 0, 'another team cannot see this team''s Breakathon');
commit;
begin; set local role anon;
select t.denied('select * from breakathon(current_date - 30, current_date)');
select t.ok(true, 'signed-out visitors cannot see Breakathon');
commit;

-- ---------- prizes and mascots: only the champion claims, once, and you only wear what you unlocked ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select t.ok((my_rewards()->>'champion')::boolean = false and my_rewards()->>'colour' = 'auto' and my_rewards()->>'accessory' = 'none', 'everyone starts with their own colour and no accessory');
select t.denied($$select claim_reward('break')$$);
select t.ok(true, 'someone who did not win cannot claim the prize');
select set_look('pink', 'none');
select t.ok(my_rewards()->>'colour' = 'pink', 'anyone can change their colour');
select t.denied($$select set_look('gold', 'none')$$);
select t.denied($$select set_look('pink', 'cap')$$);
select t.ok(true, 'nobody can wear a made-up colour or an accessory they have not unlocked');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true); set local role authenticated;
select t.ok((my_rewards()->>'champion')::boolean and my_rewards()->>'claimed' is null, 'last week''s champion is told they can pick a prize');
select t.denied($$select claim_reward('look', 'acc:none')$$);
select t.denied($$select claim_reward('look', 'acc:jetpack')$$);
select t.ok(true, 'the prize must be a real item you do not already have');
select set_look('pink', 'none');
select claim_reward('look', 'acc:scarf');
select t.ok(my_rewards()->>'accessory' = 'scarf' and my_rewards()->'unlocked'->>0 = 'acc:scarf' and my_rewards()->>'claimed' = 'look', 'claiming a new accessory unlocks it and puts it on');
select t.denied($$select claim_reward('break')$$);
select t.ok(true, 'the prize can only be claimed once a week');
select t.denied($$select set_look('pink', 'boots')$$);
select set_look('pink', 'none'); select set_look('pink', 'scarf');
select t.ok(my_rewards()->>'accessory' = 'scarf', 'you can take it off and put it back on');
select t.denied($$insert into rewards(user_id, week, choice, item) values (auth.uid(), current_date, 'look', 'acc:headset')$$);
select t.denied($$update avatars set accessory = 'boots'$$);
select t.ok(true, 'nobody can give themselves prizes or looks by writing the tables');
select t.denied('select last_week_champion()');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select t.ok((select colour from breakathon(current_date - 30, current_date) where code = 'EE-1002') = 'pink', 'everyone sees the winner''s new look in the race');
select t.ok(t.n('select * from rewards where user_id <> auth.uid()') + t.n('select * from avatars where user_id <> auth.uid()') = 0, 'agents cannot read other people''s prizes');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.ok((select choice from rewards where user_id = '00000000-0000-0000-0000-00000000000b') = 'look', 'the team lead sees what the champion picked');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true); set local role authenticated;
select t.ok(t.n('select * from rewards') = 0, 'another team''s lead does not');
commit;

-- ---------- interface choice (Playful / Professional) ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select set_ui_style('pro');
select t.ok((select style || '/' || first_style || '/' || switches from ui_prefs) = 'pro/pro/0', 'someone picks a look and it is saved with their first pick');
select set_ui_style('pro');
select t.ok((select switches from ui_prefs) = 0, 'picking the same look again is not a switch');
select set_ui_style('fun');
select t.ok((select style || '/' || first_style || '/' || switches from ui_prefs) = 'fun/pro/1', 'switching keeps the first pick and counts the switch');
select t.denied($$select set_ui_style('neon')$$);
select t.denied($$update ui_prefs set switches = 0$$);
select t.denied($$insert into ui_prefs(user_id, style, first_style) values ('00000000-0000-0000-0000-00000000000b', 'pro', 'pro')$$);
select t.ok(true, 'only real looks, and nobody can write the table directly');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true); set local role authenticated;
select set_ui_style('pro');
select t.ok(t.n('select * from ui_prefs') = 1, 'agents see only their own interface choice');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.ok(t.n('select * from ui_prefs') = 2, 'the team lead sees the team''s interface choices');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true); set local role authenticated;
select t.ok(t.n('select * from ui_prefs') = 0, 'another team''s lead does not');
commit;
begin; set local role anon;
select t.denied($$select set_ui_style('pro')$$);
select t.ok(true, 'signed-out visitors cannot record a choice');
commit;

-- ---------- suggestions ----------
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select suggest('idea', '  A reminder   one minute before my break ends ');
select suggest('bug', 'The clock froze once', true);
select t.ok((select body from suggestions_list() where kind = 'idea') = 'A reminder one minute before my break ends', 'a suggestion is saved, tidied');
select t.ok((select author || '/' || mine from suggestions_list() where kind = 'idea') = 'User 1/true', 'your own suggestion shows your name and is marked as yours');
select t.ok((select author is null and not mine from suggestions_list() where kind = 'bug'), 'an anonymous one shows no name, not even to its author');
select t.denied($$select suggest('rant', 'not a real kind')$$);
select t.denied($$select suggest('idea', 'x')$$);
select t.denied($$select suggest('idea', repeat('a', 501))$$);
select t.denied($$select * from suggestions$$);
select t.denied($$insert into suggestion_votes values ((select id from suggestions_list() limit 1), auth.uid())$$);
select t.denied($$select set_suggestion_status((select id from suggestions_list() limit 1), 'done')$$);
select t.ok(true, 'only real kinds and sensible lengths; no direct table access; agents cannot set the status');
commit;
select t.ok((select count(*) from suggestions where kind = 'bug' and author_id is null) = 1, 'an anonymous suggestion stores no author at all');
select id as idea_id from suggestions where kind = 'idea' \gset
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true); set local role authenticated;
select t.ok(t.n('select * from suggestions_list()') = 2, 'everyone in the team sees the team''s suggestions');
select vote_suggestion((select id from suggestions_list() where kind = 'idea'), true);
select vote_suggestion((select id from suggestions_list() where kind = 'idea'), true);
select t.ok((select votes || '/' || voted from suggestions_list() where kind = 'idea') = '1/true', 'a vote counts once, however often you tap');
select t.denied($$select remove_suggestion((select id from suggestions_list() where kind = 'idea'))$$);
select t.ok(true, 'you cannot remove someone else''s suggestion');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true); set local role authenticated;
select t.ok(t.n('select * from suggestions_list()') = 0, 'another team does not see them');
select t.denied(format('select vote_suggestion(%L, true)', :'idea_id'));
select t.ok(true, 'and cannot reach them');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select set_suggestion_status((select id from suggestions_list() where kind = 'idea'), 'planned');
select t.ok((select status from suggestions_list() where kind = 'idea') = 'planned', 'the team lead marks a suggestion as planned');
select remove_suggestion((select id from suggestions_list() where kind = 'bug'));
select t.ok(t.n('select * from suggestions_list()') = 1, 'the team lead can remove one (for example something inappropriate)');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true); set local role authenticated;
select t.denied(format('select set_suggestion_status(%L, %L)', :'idea_id', 'done'));
select t.ok(true, 'another team''s lead cannot change it');
commit;
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true); set local role authenticated;
select remove_suggestion((select id from suggestions_list() where kind = 'idea'));
select t.ok(t.n('select * from suggestions_list()') = 0, 'you can remove your own suggestion');
commit;
begin; set local role anon;
select t.denied($$select * from suggestions_list()$$);
select t.ok(true, 'signed-out visitors see no suggestions');
commit;

-- ---------- cleanup job ----------
insert into shifts(user_id, day, shift_start) values ('00000000-0000-0000-0000-00000000000a', current_date - 20, now() - interval '20 days');
insert into adjustments(user_id, day, slot_key, minutes) values ('00000000-0000-0000-0000-00000000000a', current_date - 20, 'lunch', 5);
insert into audit_log(at, action) values (now() - interval '20 days', 'old');
select purge_old_data();
select t.ok(t.n('select * from shifts where day < current_date - 14') = 0, 'cleanup removes shifts older than 14 days');
select t.ok(t.n('select * from adjustments where day < current_date - 14') = 0, 'cleanup removes old adjustments');
select t.ok(t.n($$select * from audit_log where action = 'old'$$) = 0, 'cleanup removes old audit entries');
select t.ok(t.n('select * from shifts') = 6, 'cleanup keeps recent shifts');
select t.ok(t.n($$select * from cron.job where jobname = 'break-track-purge'$$) = 1, 'nightly job is scheduled');
begin; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true); set local role authenticated;
select t.denied('select purge_old_data()');
select t.ok(true, 'nobody signed in can run the cleanup by hand');
commit;

-- ---------- every table has row level security on ----------
select t.ok(not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity), 'row level security is on for every table');
select t.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and column_name ilike '%reason%'), 'no reason column anywhere');
select t.ok(to_regclass('public.day_results') is null and to_regprocedure('public.leaderboard(int)') is null, 'Breakathon tables and functions are gone');
