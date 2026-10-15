-- break.track database for Supabase (Postgres). Run once in the Supabase SQL editor.
-- It mirrors the data the pages keep in the browser today (see src/core.js):
--   days[date][person] -> shifts + break_segments     adj[date][person][slot] -> adjustments
--   custom[person][]   -> custom_break_rules          (plus audit_log and day_results)
-- Rules from the README are enforced HERE, not in the page: an agent touches only their own rows,
-- a manager only their team's, adjustments stay in range, and there is NO reason column anywhere.

create table profiles (
  id    uuid primary key references auth.users on delete cascade,
  code  text unique not null,                               -- e.g. EE-1001
  name  text not null,                                      -- first name only
  team  text not null default 'pilot',
  role  text not null default 'agent' check (role in ('agent','manager','admin'))
);

create function is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles m join profiles t on t.team = m.team
                 where m.id = auth.uid() and m.role in ('manager','admin') and t.id = target)
$$;
create function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('manager','admin'))
$$;

create table shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  shift_start timestamptz not null,
  shift_end timestamptz,
  active_slot text,                                         -- the break running right now, if any
  active_started timestamptz,
  unique (user_id, day)
);
create table break_segments (                               -- one row per sitting; a break can have several
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  slot_key text not null check (slot_key in ('break1','break2','lunch','c1','c2','c3','c4','c5')),
  started_at timestamptz not null,
  ended_at   timestamptz not null check (ended_at > started_at),
  flag text check (flag in ('forgot'))
);
create table adjustments (                                  -- +/- minutes for ONE person, ONE day, ONE slot
  user_id uuid references profiles(id) on delete cascade,
  day date,
  slot_key text check (slot_key in ('break1','break2','lunch','c1','c2','c3','c4','c5')),
  minutes int not null check (minutes between -30 and 120),   -- = CONFIG.adjustmentLimits
  primary key (user_id, day, slot_key)
);
create table custom_break_rules (
  user_id uuid not null references profiles(id) on delete cascade,
  slot_key text not null check (slot_key in ('c1','c2','c3','c4','c5')),
  minutes int not null check (minutes between 1 and 120),
  scope text not null check (scope in ('today','days','daily')),
  day date,                                                 -- for scope = 'today'
  weekdays int[],                                           -- for scope = 'days'; 0 = Sunday
  primary key (user_id, slot_key)                           -- one rule per custom break, like the page
);
create table audit_log (                                    -- every manager change; deliberately no reason
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid, action text not null, target_id uuid, slot_key text, day date,
  before_value int, after_value int
);
create table day_results (                                  -- filled each night by the daily job, feeds Breakathon
  user_id uuid references profiles(id) on delete cascade,
  day date, tracked int not null, clean int not null, over_seconds int not null,
  primary key (user_id, day)
);

-- ---------- row level security ----------
alter table profiles enable row level security;       alter table shifts enable row level security;
alter table break_segments enable row level security; alter table adjustments enable row level security;
alter table custom_break_rules enable row level security; alter table audit_log enable row level security;
alter table day_results enable row level security;

create policy "see people in your team" on profiles for select to authenticated
  using (id = auth.uid() or is_manager_of(id));
create policy "own or team manager" on shifts for all to authenticated
  using (user_id = auth.uid() or is_manager_of(user_id)) with check (user_id = auth.uid() or is_manager_of(user_id));
create policy "own or team manager" on break_segments for all to authenticated
  using (exists (select 1 from shifts s where s.id = shift_id and (s.user_id = auth.uid() or is_manager_of(s.user_id))))
  with check (exists (select 1 from shifts s where s.id = shift_id and (s.user_id = auth.uid() or is_manager_of(s.user_id))));
create policy "read own or team" on adjustments for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "managers write"   on adjustments for all    to authenticated using (is_manager_of(user_id)) with check (is_manager_of(user_id));
create policy "read own or team" on custom_break_rules for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
create policy "managers write"   on custom_break_rules for all    to authenticated using (is_manager_of(user_id)) with check (is_manager_of(user_id));
create policy "managers read audit" on audit_log for select to authenticated using (is_manager());
create policy "own or team results" on day_results for select to authenticated using (user_id = auth.uid() or is_manager_of(user_id));
-- (no insert/update policy on day_results or audit_log: only the daily job and triggers write them)

-- Audit every allowance change automatically.
create function audit_adjustment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor_id, action, target_id, slot_key, day, before_value, after_value)
  values (auth.uid(), 'adjust_allowance', coalesce(new.user_id, old.user_id), coalesce(new.slot_key, old.slot_key),
          coalesce(new.day, old.day), old.minutes, new.minutes);
  return coalesce(new, old);
end $$;
create trigger adjustments_audit after insert or update or delete on adjustments for each row execute function audit_adjustment();

-- Breakathon: everyone may see the ranking, but only managers see minutes over.
create function leaderboard(days int default 14)
returns table (user_id uuid, name text, tracked bigint, clean bigint, over_seconds bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, coalesce(sum(r.tracked),0), coalesce(sum(r.clean),0),
         case when is_manager() then coalesce(sum(r.over_seconds),0) end
  from profiles p
  left join day_results r on r.user_id = p.id and r.day >= current_date - days
  where p.role = 'agent' and p.team = (select team from profiles where id = auth.uid())
  group by p.id, p.name
$$;

-- Retention (= CONFIG.retentionDays). Needs the pg_cron extension (Database > Extensions).
-- select cron.schedule('purge-old-days', '15 3 * * *', $$ delete from shifts where day < current_date - 14 $$);
-- select cron.schedule('purge-old-audit', '20 3 * * *', $$ delete from audit_log where at < now() - interval '14 days' $$);
