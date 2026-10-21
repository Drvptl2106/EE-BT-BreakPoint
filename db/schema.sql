-- break.track database for Supabase (Postgres). Paste the whole file into the Supabase SQL editor and press Run.
-- SAFE TO RE-RUN: on an empty project it creates everything; on a project that already has an older version it
-- upgrades it in place (keeps the data, drops the old Breakathon parts, adds break names and the full audit trail).
--
-- It mirrors the data the pages keep in memory (see src/core.js):
--   days[date][person] -> shifts + break_segments     adj[date][person][slot] -> adjustments
--   custom[person][]   -> custom_break_rules          names[person][slot]     -> break_names
--   plus audit_log (every manager change).
-- Rules from the README are enforced HERE, not in the page: an agent touches only their own rows,
-- a manager only their team's, adjustments stay in range, and there is NO reason column anywhere.

-- ---------- tables ----------
create table if not exists profiles (
  id    uuid primary key references auth.users on delete cascade,
  code  text unique not null,                               -- e.g. EE-1001
  name  text not null,                                      -- first name only
  team  text not null default 'pilot',
  role  text not null default 'agent' check (role in ('agent','manager','admin'))
);

create or replace function is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles m join profiles t on t.team = m.team
                 where m.id = auth.uid() and m.role in ('manager','admin') and t.id = target)
$$;
create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('manager','admin'))
$$;

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  shift_start timestamptz not null,
  shift_end timestamptz,
  active_slot text,                                         -- the break running right now, if any
  active_started timestamptz,
  unique (user_id, day)
);
create table if not exists break_segments (                 -- one row per sitting; a break can have several
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  slot_key text not null check (slot_key in ('break1','break2','lunch','c1','c2','c3','c4','c5')),
  started_at timestamptz not null,
  ended_at   timestamptz not null check (ended_at > started_at),
  flag text check (flag in ('forgot'))
);
create table if not exists adjustments (                    -- +/- minutes for ONE person, ONE day, ONE slot
  user_id uuid references profiles(id) on delete cascade,
  day date,
  slot_key text check (slot_key in ('break1','break2','lunch','c1','c2','c3','c4','c5')),
  minutes int not null check (minutes between -30 and 120),   -- = CONFIG.adjustmentLimits
  primary key (user_id, day, slot_key)
);
create table if not exists custom_break_rules (
  user_id uuid not null references profiles(id) on delete cascade,
  slot_key text not null check (slot_key in ('c1','c2','c3','c4','c5')),
  minutes int not null check (minutes between 1 and 120),
  scope text not null check (scope in ('today','days','daily')),
  day date,                                                 -- for scope = 'today'
  weekdays int[],                                           -- for scope = 'days'; 0 = Sunday
  primary key (user_id, slot_key)                           -- one rule per custom break, like the page
);
create table if not exists break_names (                    -- a manager's own name for one break, for ONE person
  user_id uuid not null references profiles(id) on delete cascade,
  slot_key text not null check (slot_key in ('break1','break2','lunch','c1','c2','c3','c4','c5')),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 24),   -- = CONFIG.breakNameMaxLength
  primary key (user_id, slot_key)
);
create table if not exists audit_log (                      -- every manager change; deliberately no reason
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid, action text not null, target_id uuid, slot_key text, day date,
  before_value text, after_value text,                      -- minutes, a time, "start/end" of a break, or a name
  record_id uuid                                            -- the break_segments row, for break edits
);
-- upgrade an older audit_log (values were whole minutes only)
alter table audit_log alter column before_value type text using before_value::text;
alter table audit_log alter column after_value  type text using after_value::text;
alter table audit_log add column if not exists record_id uuid;
create index if not exists audit_log_target_day on audit_log (target_id, day);

-- Breakathon and the Punctuality report were removed: drop their parts if an older version created them.
drop function if exists leaderboard(int);
drop table if exists day_results;

-- ---------- row level security ----------
alter table profiles enable row level security;       alter table shifts enable row level security;
alter table break_segments enable row level security; alter table adjustments enable row level security;
alter table custom_break_rules enable row level security; alter table break_names enable row level security;
alter table audit_log enable row level security;

drop policy if exists "see people in your team" on profiles;
create policy "see people in your team" on profiles for select to authenticated
  using (id = auth.uid() or is_manager_of(id));
-- (no insert/update/delete policy on profiles: nobody can make themselves a manager from the page)
-- Agents: read their own shifts and breaks, start/stop breaks and set their shift times for TODAY only
-- (today = yesterday, today or tomorrow in UTC, so a UK late shift around midnight still works),
-- ADD breaks but never change or delete a recorded one. Managers: everything, for their own team.
create or replace function is_today(d date) returns boolean language sql stable as $$
  select d between current_date - 1 and current_date + 1
$$;
drop policy if exists "own or team manager" on shifts;
drop policy if exists "read own or team"    on shifts;
drop policy if exists "add own today"       on shifts;
drop policy if exists "change own today"    on shifts;
drop policy if exists "managers remove"     on shifts;
create policy "read own or team" on shifts for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "add own today"    on shifts for insert to authenticated
  with check ((user_id = auth.uid() and is_today(day)) or is_manager_of(user_id));
create policy "change own today" on shifts for update to authenticated
  using ((user_id = auth.uid() and is_today(day)) or is_manager_of(user_id))
  with check ((user_id = auth.uid() and is_today(day)) or is_manager_of(user_id));
create policy "managers remove"  on shifts for delete to authenticated using (is_manager_of(user_id));
drop policy if exists "own or team manager" on break_segments;
drop policy if exists "read own or team"    on break_segments;
drop policy if exists "add own today"       on break_segments;
drop policy if exists "managers change"     on break_segments;
drop policy if exists "managers remove"     on break_segments;
create policy "read own or team" on break_segments for select to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and (s.user_id = auth.uid() or is_manager_of(s.user_id))));
create policy "add own today"    on break_segments for insert to authenticated
  with check (exists (select 1 from shifts s where s.id = shift_id and ((s.user_id = auth.uid() and is_today(s.day)) or is_manager_of(s.user_id))));
create policy "managers change"  on break_segments for update to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and is_manager_of(s.user_id)))
  with check (exists (select 1 from shifts s where s.id = shift_id and is_manager_of(s.user_id)));
create policy "managers remove"  on break_segments for delete to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and is_manager_of(s.user_id)));
drop policy if exists "read own or team" on adjustments;
drop policy if exists "managers write"   on adjustments;
create policy "read own or team" on adjustments for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "managers write"   on adjustments for all    to authenticated using (is_manager_of(user_id)) with check (is_manager_of(user_id));
drop policy if exists "read own or team" on custom_break_rules;
drop policy if exists "managers write"   on custom_break_rules;
create policy "read own or team" on custom_break_rules for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "managers write"   on custom_break_rules for all    to authenticated using (is_manager_of(user_id)) with check (is_manager_of(user_id));
drop policy if exists "read own or team" on break_names;
drop policy if exists "managers write"   on break_names;
create policy "read own or team" on break_names for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "managers write"   on break_names for all    to authenticated using (is_manager_of(user_id)) with check (is_manager_of(user_id));
drop policy if exists "managers read audit" on audit_log;
create policy "managers read audit" on audit_log for select to authenticated using (is_manager_of(target_id) or actor_id = auth.uid() and is_manager());
-- (no insert/update/delete policy on audit_log: only the triggers below write it, and nobody can edit or remove an entry)

-- ---------- table privileges (a second lock behind the policies) ----------
-- Signed-out visitors get nothing at all. Signed-in people may only read profiles and the audit trail, never change them.
-- TRUNCATE is taken away from everyone because it ignores row level security.
revoke all on profiles, shifts, break_segments, adjustments, custom_break_rules, break_names, audit_log from anon;
revoke all on profiles, shifts, break_segments, adjustments, custom_break_rules, break_names, audit_log from authenticated;
grant select on profiles, audit_log to authenticated;
grant select, insert, update, delete on shifts, break_segments, adjustments, custom_break_rules, break_names to authenticated;

-- ---------- the database's clock decides break times ----------
-- When an agent starts a break, the database stamps the start with ITS clock; when they stop, the break is recorded from
-- that start to the database's "now". So a phone with the wrong time (or someone editing the page) can't shorten a break.
-- Managers' edits keep the times the manager typed (they are audited below).
create or replace function server_time() returns timestamptz language sql stable as $$ select now() $$;
create or replace function stamp_shift() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.user_id then return new; end if;
  if tg_op = 'INSERT' then
    new.active_started := case when new.active_slot is null then null else now() end;
  elsif new.active_slot is distinct from old.active_slot then
    new.active_started := case when new.active_slot is null then null else now() end;
  else
    new.active_started := old.active_started;
  end if;
  return new;
end $$;
drop trigger if exists shifts_stamp on shifts;
create trigger shifts_stamp before insert or update on shifts for each row execute function stamp_shift();
create or replace function stamp_break() returns trigger language plpgsql security definer set search_path = public as $$
declare s shifts%rowtype;
begin
  select * into s from shifts where id = new.shift_id;
  if not found or auth.uid() is null or auth.uid() <> s.user_id then return new; end if;
  if s.active_slot = new.slot_key and s.active_started is not null then
    new.started_at := s.active_started;
    new.ended_at := case when new.flag = 'forgot' then s.active_started + interval '90 minutes'   -- = CONFIG.forgotToStopMinutes
                         else greatest(now(), s.active_started + interval '1 second') end;
  elsif new.started_at >= now() - interval '5 minutes' and new.ended_at <= now() + interval '1 minute' then
    null;   -- a very short break stopped before its start reached the database: keep the times sent
  else
    raise exception 'no running break to close';
  end if;
  return new;
end $$;
drop trigger if exists break_segments_stamp on break_segments;
create trigger break_segments_stamp before insert on break_segments for each row execute function stamp_break();

-- ---------- audit trail ----------
-- Logged: every change someone makes to ANOTHER person's data (in practice: a manager), plus an agent changing their
-- own shift start, or an end time they had already set (the things a dispute would be about).
-- Not logged: an agent's normal clicks (start, stop, first end time), the SQL editor and the cleanup job (no signed-in user).
-- Times are stored in UTC, ISO format.
drop function if exists audit_write(text, uuid, text, date, text, text, uuid);
create or replace function audit_write(p_action text, p_target uuid, p_slot text, p_day date, p_before text, p_after text, p_record uuid,
                                       p_include_self boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_target is null or (auth.uid() = p_target and not p_include_self) then return; end if;
  insert into audit_log(actor_id, action, target_id, slot_key, day, before_value, after_value, record_id)
  values (auth.uid(), p_action, p_target, p_slot, p_day, p_before, p_after, p_record);
end $$;
revoke execute on function audit_write(text, uuid, text, date, text, text, uuid, boolean) from public, anon, authenticated;
create or replace function audit_ts(t timestamptz) returns text language sql immutable set search_path = public as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"')
$$;

create or replace function audit_adjustment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform audit_write('adjust_allowance', coalesce(new.user_id, old.user_id), coalesce(new.slot_key, old.slot_key),
                      coalesce(new.day, old.day), old.minutes::text, new.minutes::text, null);
  return coalesce(new, old);
end $$;
drop trigger if exists adjustments_audit on adjustments;
create trigger adjustments_audit after insert or update or delete on adjustments for each row execute function audit_adjustment();

create or replace function audit_shift() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform audit_write('add_shift', new.user_id, null, new.day, null, audit_ts(new.shift_start) || '/' || coalesce(audit_ts(new.shift_end), ''), null);
  elsif tg_op = 'DELETE' then
    perform audit_write('remove_shift', old.user_id, null, old.day, audit_ts(old.shift_start) || '/' || coalesce(audit_ts(old.shift_end), ''), null, null);
  else
    if new.shift_start is distinct from old.shift_start then
      perform audit_write('edit_shift_start', new.user_id, null, new.day, audit_ts(old.shift_start), audit_ts(new.shift_start), null, true);
    end if;
    if new.shift_end is distinct from old.shift_end then
      perform audit_write('edit_shift_end', new.user_id, null, new.day, audit_ts(old.shift_end), audit_ts(new.shift_end), null, old.shift_end is not null);
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists shifts_audit on shifts;
create trigger shifts_audit after insert or update or delete on shifts for each row execute function audit_shift();

create or replace function audit_break() returns trigger language plpgsql security definer set search_path = public as $$
declare s shifts%rowtype; o text; n text;
begin
  select * into s from shifts where id = coalesce(new.shift_id, old.shift_id);
  if not found then return coalesce(new, old); end if;       -- the whole shift is being removed (logged above)
  if tg_op <> 'INSERT' then o := audit_ts(old.started_at) || '/' || audit_ts(old.ended_at); end if;
  if tg_op <> 'DELETE' then n := audit_ts(new.started_at) || '/' || audit_ts(new.ended_at); end if;
  if tg_op = 'INSERT' then
    perform audit_write('add_break', s.user_id, new.slot_key, s.day, null, n, new.id);
  elsif tg_op = 'DELETE' then
    perform audit_write('remove_break', s.user_id, old.slot_key, s.day, o, null, old.id);
  elsif o is distinct from n or new.slot_key is distinct from old.slot_key then
    perform audit_write('edit_break', s.user_id, new.slot_key, s.day,
                        case when new.slot_key is distinct from old.slot_key then old.slot_key || ' ' else '' end || o, n, new.id);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists break_segments_audit on break_segments;
create trigger break_segments_audit after insert or update or delete on break_segments for each row execute function audit_break();

create or replace function audit_custom_rule() returns trigger language plpgsql security definer set search_path = public as $$
declare o text; n text;
begin
  if tg_op <> 'INSERT' then o := old.minutes || ' min ' || old.scope || coalesce(' ' || old.day::text, '') || coalesce(' ' || array_to_string(old.weekdays, ','), ''); end if;
  if tg_op <> 'DELETE' then n := new.minutes || ' min ' || new.scope || coalesce(' ' || new.day::text, '') || coalesce(' ' || array_to_string(new.weekdays, ','), ''); end if;
  if o is distinct from n then
    perform audit_write(case tg_op when 'INSERT' then 'add_custom_break' when 'DELETE' then 'remove_custom_break' else 'edit_custom_break' end,
                        coalesce(new.user_id, old.user_id), coalesce(new.slot_key, old.slot_key), null, o, n, null);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists custom_break_rules_audit on custom_break_rules;
create trigger custom_break_rules_audit after insert or update or delete on custom_break_rules for each row execute function audit_custom_rule();

create or replace function audit_break_name() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.label is distinct from new.label then
    perform audit_write('rename_break', coalesce(new.user_id, old.user_id), coalesce(new.slot_key, old.slot_key), null, old.label, new.label, null);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists break_names_audit on break_names;
create trigger break_names_audit after insert or update or delete on break_names for each row execute function audit_break_name();

-- ---------- Breakathon: the weekly punctuality game ----------
-- Everyone in a team sees names and points; only managers also see minutes over. Nobody gets anyone else's break times.
-- Same maths as weekScore() in src/core.js: a break is on time when it stays within its OWN allowance (+ adjustment),
-- 24 seconds of grace (= CONFIG.overToleranceMinutes); points = 10 per on-time break + 5 per clean day - 2 per minute over.
drop function if exists breakathon(date, date);
create or replace function breakathon(p_from date, p_to date)
returns table (code text, name text, breaks int, on_time int, clean_days int, over_minutes int, points int)
language sql stable security definer set search_path = public as $$
  with me as (select team, role from profiles where id = auth.uid()),
  team as (select p.id, p.code, p.name from profiles p join me on p.team = me.team where p.role = 'agent'),
  used as (select s.user_id, s.day, b.slot_key, sum(extract(epoch from b.ended_at - b.started_at)) as secs
           from shifts s join team t on t.id = s.user_id join break_segments b on b.shift_id = s.id
           where s.day between p_from and p_to group by 1, 2, 3),
  slot as (select u.user_id, u.day,
                  greatest(0, u.secs - 60 * (case u.slot_key when 'break1' then 15 when 'break2' then 15 when 'lunch' then 30   -- = CONFIG.defaultSlots
                                             else c.minutes end + coalesce(a.minutes, 0))) as over_raw
           from used u
           left join custom_break_rules c on c.user_id = u.user_id and c.slot_key = u.slot_key
           left join adjustments a on a.user_id = u.user_id and a.day = u.day and a.slot_key = u.slot_key
           where u.slot_key in ('break1', 'break2', 'lunch') or c.minutes is not null),
  per_day as (select user_id, day, count(*) as n, count(*) filter (where over_raw < 24) as ok,
                     sum(case when over_raw < 24 then 0 else over_raw end) as over_s
              from slot group by 1, 2),
  tot as (select user_id, sum(n) as breaks, sum(ok) as on_time, count(*) filter (where ok = n) as clean, round(sum(over_s) / 60) as over_m
          from per_day group by 1)
  select t.code, t.name, coalesce(x.breaks, 0)::int, coalesce(x.on_time, 0)::int, coalesce(x.clean, 0)::int,
         case when (select role from me) in ('manager', 'admin') then coalesce(x.over_m, 0)::int end,
         greatest(0, coalesce(x.on_time, 0) * 10 + coalesce(x.clean, 0) * 5 - coalesce(x.over_m, 0) * 2)::int
  from team t left join tot x on x.user_id = t.id
  order by 7 desc, 4 desc, 2
$$;
revoke execute on function breakathon(date, date) from public, anon;
grant execute on function breakathon(date, date) to authenticated;
revoke execute on function server_time() from public, anon;
grant execute on function server_time() to authenticated;

-- Retention (= CONFIG.retentionDays): run db/cleanup_job.sql once, after this file.

-- Check: these should list your tables with "true" for row level security.
select relname as "table", relrowsecurity as "row level security on"
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
