-- Load-test data: 17 hostels each with a store, a menu and an open pool, and 20,000 students.
-- Lives in its own schema (load) in a throwaway database; never part of the migrations.
create schema load;

insert into hostels (id, name, blocks)
select gen_random_uuid(), 'Load Hostel ' || lpad(n::text, 2, '0'), array['A', 'B'] from generate_series(1, 17) n;

insert into vendors (name, hostel_id, pool_window_minutes)
select 'Load Store ' || substr(h.name, 13), h.id, 60 from hostels h;

insert into menu_items (vendor_id, name, category, price, unit, stock_qty)
select v.id, 'Load Item ' || i, 'Snacks', 10 + i, 'pack', 2000000000
from vendors v, generate_series(1, 25) i;

insert into auth.users (id, email, phone)
select gen_random_uuid(), null, '+9170' || lpad(n::text, 8, '0') from generate_series(1, 20000) n;

create table load.students as select row_number() over () as n, id from auth.users;
create unique index on load.students (n);

-- open every pool far into the future so none closes during a run
select ensure_open_slot(hostel_id) from vendors;
update slots set closes_at = now() + interval '1 day' where status = 'open';

create table load.pools as
select row_number() over (order by s.id) as h, s.id as slot_id,
       (select id from menu_items m where m.vendor_id = s.vendor_id order by name limit 1) as item_id,
       s.hostel_id
from slots s where s.status = 'open';
create unique index on load.pools (h);

grant usage on schema load to authenticated, anon;
grant select on load.students, load.pools to authenticated, anon;
