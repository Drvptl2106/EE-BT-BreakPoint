-- STEP 1 (in the Supabase dashboard, NOT here): Authentication > Users > Add user > Create new user
--   Create these 6 users, tick "Auto Confirm User", and give each a password you choose
--   (not the code itself):
--     ee-1001@pilot.local   ee-1002@pilot.local   ee-1003@pilot.local
--     ee-1004@pilot.local   ee-1005@pilot.local   mgr-7777@pilot.local
-- STEP 2: run this in SQL Editor. It links each login to a profile (code, first name, role).

insert into profiles (id, code, name, role)
select id, 'EE-1001', 'Alex',   'agent' from auth.users where email = 'ee-1001@pilot.local';
insert into profiles (id, code, name, role)
select id, 'EE-1002', 'Priya',  'agent' from auth.users where email = 'ee-1002@pilot.local';
insert into profiles (id, code, name, role)
select id, 'EE-1003', 'Sam',    'agent' from auth.users where email = 'ee-1003@pilot.local';
insert into profiles (id, code, name, role)
select id, 'EE-1004', 'Jordan', 'agent' from auth.users where email = 'ee-1004@pilot.local';
insert into profiles (id, code, name, role)
select id, 'EE-1005', 'Chris',  'agent' from auth.users where email = 'ee-1005@pilot.local';
insert into profiles (id, code, name, role)
select id, 'MGR-7777', 'Team lead', 'manager' from auth.users where email = 'mgr-7777@pilot.local';

-- Check: should list 6 rows.
select code, name, role, team from profiles order by code;
