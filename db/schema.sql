-- breakpoint database for Supabase (Postgres). Paste the whole file into the Supabase SQL editor and press Run.
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
-- ---------- mascots and prizes ----------
-- Everyone's mascot wears headphones and has their own colour from day one (picked for them, changeable any time).
-- Last week's Breakathon champion picks ONE prize: an extra break (the team lead then gives it) or a new accessory, kept for good.
-- Nobody writes these tables directly: the functions below check you really won, claim once a week, and only wear what you unlocked.
create table if not exists avatars (
  user_id uuid primary key references profiles(id) on delete cascade,
  colour text not null default 'auto', accessory text not null default 'none');   -- 'auto' = a colour picked from the code
alter table avatars alter column colour set default 'auto';
create table if not exists rewards (
  user_id uuid not null references profiles(id) on delete cascade,
  week date not null,                                        -- the Monday of the week that was won
  choice text not null check (choice in ('break', 'look')),
  item text,                                                 -- for a look: 'acc:scarf', 'acc:boots' ...
  at timestamptz not null default now(),
  primary key (user_id, week));
alter table avatars enable row level security; alter table rewards enable row level security;
drop policy if exists "read own or team" on avatars; drop policy if exists "read own or team" on rewards;
create policy "read own or team" on avatars for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "read own or team" on rewards for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
revoke all on avatars, rewards from anon, authenticated;
grant select on avatars, rewards to authenticated;

-- = LOOKS in src/race.js. Colours are free for everyone; accessories (except 'none') are prizes.
create or replace function look_colours() returns text[] language sql immutable as $$
  select array['auto','teal','blue','pink','yellow','purple','green','orange','coral','sky','lilac']
$$;
create or replace function look_items() returns text[] language sql immutable as $$
  select array['acc:none','acc:cap','acc:scarf','acc:boots','acc:bow','acc:glasses','acc:sprout']
$$;
create or replace function week_start(d date) returns date language sql immutable as $$ select d - (extract(isodow from d)::int - 1) $$;
drop function if exists breakathon(date, date);
create or replace function breakathon(p_from date, p_to date)
returns table (code text, name text, breaks int, on_time int, clean_days int, over_minutes int, points int, colour text, accessory text)
language sql stable security definer set search_path = public as $$
  with me as (select team, role from profiles where id = auth.uid()),
  team as (select p.id, p.code, p.name from profiles p join me on p.team = me.team where p.role = 'agent'),
  used as (select s.user_id, s.day, b.slot_key, sum(extract(epoch from b.ended_at - b.started_at)) as secs
           from shifts s join team t on t.id = s.user_id join break_segments b on b.shift_id = s.id
           where s.day between p_from and p_to group by 1, 2, 3),
  -- the breaks that apply to each person on each day they worked, with their minutes (= slotsFor in src/core.js)
  slots as (select s.user_id, s.day, d.slot_key, d.minutes
            from shifts s join team t on t.id = s.user_id
            cross join (values ('break1', 15), ('break2', 15), ('lunch', 30)) as d(slot_key, minutes)   -- = CONFIG.defaultSlots
            where s.day between p_from and p_to
            union all
            select s.user_id, s.day, c.slot_key, c.minutes
            from shifts s join team t on t.id = s.user_id join custom_break_rules c on c.user_id = s.user_id
            where s.day between p_from and p_to
              and (c.scope = 'daily' or (c.scope = 'today' and c.day = s.day)
                   or (c.scope = 'days' and extract(dow from s.day)::int = any(c.weekdays)))),
  slot as (select sl.user_id, sl.day, greatest(0, sl.minutes + coalesce(a.minutes, 0)) * 60 as cap, u.secs
           from slots sl
           left join adjustments a on a.user_id = sl.user_id and a.day = sl.day and a.slot_key = sl.slot_key
           left join used u on u.user_id = sl.user_id and u.day = sl.day and u.slot_key = sl.slot_key),
  -- the day's breaks are one pot (= plan() in src/core.js): the day only goes over once its total is used up (24 s grace)
  per_day as (select user_id, day, count(secs) as n, count(secs) filter (where secs - cap < 24) as ok_own,
                     greatest(0, coalesce(sum(secs), 0) - sum(cap)) as over_raw
              from slot group by 1, 2),
  scored as (select user_id, n, case when over_raw < 24 then n else ok_own end as ok,
                    case when over_raw < 24 then 0 else over_raw end as over_s
             from per_day where n > 0),
  tot as (select user_id, sum(n) as breaks, sum(ok) as on_time, count(*) filter (where over_s = 0) as clean, round(sum(over_s) / 60) as over_m
          from scored group by 1)
  select t.code, t.name, coalesce(x.breaks, 0)::int, coalesce(x.on_time, 0)::int, coalesce(x.clean, 0)::int,
         case when (select role from me) in ('manager', 'admin') then coalesce(x.over_m, 0)::int end,
         greatest(0, coalesce(x.on_time, 0) * 10 + coalesce(x.clean, 0) * 5 - coalesce(x.over_m, 0) * 2)::int,
         coalesce(a.colour, 'auto'), coalesce(a.accessory, 'none')
  from team t left join tot x on x.user_id = t.id left join avatars a on a.user_id = t.id
  order by 7 desc, 4 desc, 2
$$;
revoke execute on function breakathon(date, date) from public, anon;
grant execute on function breakathon(date, date) to authenticated;
revoke execute on function server_time() from public, anon;
grant execute on function server_time() to authenticated;

create or replace function last_week_champion() returns uuid language sql stable security definer set search_path = public as $$
  select p.id from breakathon(week_start(current_date) - 7, week_start(current_date) - 1) b
  join profiles p on p.code = b.code where b.points > 0 order by b.points desc, b.on_time desc, b.name limit 1
$$;
create or replace function my_rewards() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'colour', coalesce((select colour from avatars where user_id = auth.uid()), 'auto'),
    'accessory', coalesce((select accessory from avatars where user_id = auth.uid()), 'none'),
    'unlocked', coalesce((select json_agg(item order by at) from rewards where user_id = auth.uid() and choice = 'look'), '[]'::json),
    'week', week_start(current_date) - 7,
    'champion', coalesce(last_week_champion() = auth.uid(), false),
    'claimed', (select choice from rewards where user_id = auth.uid() and week = week_start(current_date) - 7),
    'claimed_item', (select item from rewards where user_id = auth.uid() and week = week_start(current_date) - 7))
$$;
create or replace function claim_reward(p_choice text, p_item text default null) returns void
language plpgsql security definer set search_path = public as $$
declare w date := week_start(current_date) - 7;
begin
  if auth.uid() is null or last_week_champion() is distinct from auth.uid() then raise exception 'Only last week''s champion can claim the prize.'; end if;
  if exists (select 1 from rewards where user_id = auth.uid() and week = w) then raise exception 'You have already claimed last week''s prize.'; end if;
  if p_choice = 'look' then
    if p_item is null or not p_item = any(look_items()) or p_item = 'acc:none'
       or exists (select 1 from rewards where user_id = auth.uid() and item = p_item) then
      raise exception 'Pick an accessory you don''t have yet.';
    end if;
  elsif p_choice <> 'break' then raise exception 'Pick a break or a new look.';
  end if;
  insert into rewards(user_id, week, choice, item) values (auth.uid(), w, p_choice, case when p_choice = 'look' then p_item end);
  if p_choice = 'look' then                                  -- wear it straight away
    insert into avatars(user_id) values (auth.uid()) on conflict (user_id) do nothing;
    update avatars set accessory = substr(p_item, 5) where user_id = auth.uid();
  end if;
end $$;
create or replace function set_look(p_colour text, p_accessory text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not p_colour = any(look_colours()) then raise exception 'That colour isn''t available.'; end if;
  if not (p_accessory = 'none' or exists (select 1 from rewards where user_id = auth.uid() and item = 'acc:' || p_accessory)) then
    raise exception 'You can only wear accessories you have unlocked.';
  end if;
  insert into avatars(user_id, colour, accessory) values (auth.uid(), p_colour, p_accessory)
  on conflict (user_id) do update set colour = excluded.colour, accessory = excluded.accessory;
end $$;
revoke execute on function last_week_champion(), my_rewards(), claim_reward(text, text), set_look(text, text) from public, anon;
grant execute on function my_rewards(), claim_reward(text, text), set_look(text, text) to authenticated;
revoke execute on function last_week_champion() from authenticated;

-- ---------- interface choice: Playful or Professional ----------
-- Everyone picks how the app looks (src/ui.js); the features are the same either way. Kept so the pilot can show which
-- look people actually prefer: the current choice, the very first pick and how often they switched. Not a break record,
-- so the 14-day cleanup leaves it alone (like avatars). Only set_ui_style() writes it.
create table if not exists ui_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  style text not null check (style in ('fun', 'pro')),
  first_style text not null check (first_style in ('fun', 'pro')),
  first_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  switches int not null default 0);
alter table ui_prefs enable row level security;
drop policy if exists "read own or team" on ui_prefs;
create policy "read own or team" on ui_prefs for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
revoke all on ui_prefs from anon, authenticated;
grant select on ui_prefs to authenticated;
create or replace function set_ui_style(p_style text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_style is null or p_style not in ('fun', 'pro') then raise exception 'Pick Playful or Professional.'; end if;
  insert into ui_prefs(user_id, style, first_style) values (auth.uid(), p_style, p_style)
  on conflict (user_id) do update set style = excluded.style, changed_at = now(), switches = ui_prefs.switches + 1
    where ui_prefs.style is distinct from excluded.style;
end $$;
revoke execute on function set_ui_style(text) from public, anon;
grant execute on function set_ui_style(text) to authenticated;

-- ---------- suggestions: ideas, changes and bugs from the people using the app ----------
-- Everyone in a team sees every suggestion and can vote for the ones they want; team leads mark them planned / done / not now.
-- "Post anonymously" means the author is NOT stored at all (author_id is null), so not even the database knows who wrote it.
-- About the app only (the page says so): this is not a break record, and break records still have no free-text field.
-- Nobody touches the tables directly; the functions below check who you are and which team you're in.
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  author_id uuid references profiles(id) on delete set null,          -- null = posted anonymously
  kind text not null check (kind in ('idea', 'change', 'bug', 'other')),
  body text not null check (body = btrim(body) and char_length(body) between 3 and 500),
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'not_now')),
  at timestamptz not null default now());
create table if not exists suggestion_votes (
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (suggestion_id, user_id));
alter table suggestions enable row level security; alter table suggestion_votes enable row level security;
revoke all on suggestions, suggestion_votes from anon, authenticated;

create or replace function my_team() returns text language sql stable security definer set search_path = public as $$
  select team from profiles where id = auth.uid()
$$;
drop function if exists suggestions_list();
create or replace function suggestions_list()
returns table (id uuid, kind text, body text, status text, at timestamptz, author text, mine boolean, votes int, voted boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.kind, s.body, s.status, s.at, p.name, s.author_id is not distinct from auth.uid() and s.author_id is not null,
         (select count(*) from suggestion_votes v where v.suggestion_id = s.id)::int,
         exists (select 1 from suggestion_votes v where v.suggestion_id = s.id and v.user_id = auth.uid())
  from suggestions s left join profiles p on p.id = s.author_id
  where auth.uid() is not null and s.team = my_team()
  order by s.at desc
$$;
create or replace function suggest(p_kind text, p_body text, p_anonymous boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare t text := my_team(); b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')); new_id uuid;
begin
  if t is null then raise exception 'Sign in first.'; end if;
  if char_length(b) < 3 then raise exception 'Write a few words first.'; end if;
  if char_length(b) > 500 then raise exception 'Keep it under 500 characters.'; end if;
  if p_kind is null or p_kind not in ('idea', 'change', 'bug', 'other') then raise exception 'Pick idea, change, bug or other.'; end if;
  insert into suggestions(team, author_id, kind, body) values (t, case when p_anonymous then null else auth.uid() end, p_kind, b)
  returning suggestions.id into new_id;
  return new_id;
end $$;
create or replace function vote_suggestion(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from suggestions where id = p_id and team = my_team()) then raise exception 'That suggestion isn''t there any more.'; end if;
  if p_on then insert into suggestion_votes values (p_id, auth.uid()) on conflict do nothing;
  else delete from suggestion_votes where suggestion_id = p_id and user_id = auth.uid(); end if;
end $$;
create or replace function set_suggestion_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'Only team leads can change the status.'; end if;
  if p_status is null or p_status not in ('new', 'planned', 'done', 'not_now') then raise exception 'Pick new, planned, done or not now.'; end if;
  update suggestions set status = p_status where id = p_id and team = my_team();
  if not found then raise exception 'That suggestion isn''t there any more.'; end if;
end $$;
create or replace function remove_suggestion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from suggestions where id = p_id and team = my_team() and (author_id = auth.uid() or is_manager());
  if not found then raise exception 'You can only remove your own suggestions.'; end if;
end $$;
revoke execute on function my_team(), suggestions_list(), suggest(text, text, boolean), vote_suggestion(uuid, boolean),
  set_suggestion_status(uuid, text), remove_suggestion(uuid) from public, anon;
grant execute on function suggestions_list(), suggest(text, text, boolean), vote_suggestion(uuid, boolean),
  set_suggestion_status(uuid, text), remove_suggestion(uuid) to authenticated;

-- Retention (= CONFIG.retentionDays): run db/cleanup_job.sql once, after this file.

-- Check: these should list your tables with "true" for row level security.
select relname as "table", relrowsecurity as "row level security on"
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
