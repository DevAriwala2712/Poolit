-- Extra demo data for the vendor console end-to-end run, on top of
-- scripts/student-e2e/fixture.sql: a store owner, a student who is NOT a vendor,
-- and three orders waiting in Yamuna Store's open pool.
insert into auth.users (id, email, phone) values
  ('d0000000-0000-4000-8000-000000000001', 'owner@yamuna.example', null),
  ('d0000000-0000-4000-8000-000000000002', 'owner2@ganga.example', null);

insert into vendor_users (user_id, vendor_id, role) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'owner'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'owner');

select ensure_open_slot('a0000000-0000-4000-8000-000000000002') is not null;

do $$
declare s uuid; i uuid; u uuid; n text;
begin
  select id into s from slots where hostel_id = 'a0000000-0000-4000-8000-000000000002' and status = 'open';
  select id into i from menu_items where vendor_id = 'b0000000-0000-4000-8000-000000000002' and name like 'Maggi%';
  foreach n in array array['Rohan', 'Meera', 'Kabir'] loop
    insert into auth.users (email, phone) values (null, '+9190001' || (random() * 89999 + 10000)::int) returning id into u;
    -- Kabir (the newest order, so the first row on screen) pays cash on delivery
    perform place_order(s, n, 'A', '1' || (random() * 80 + 10)::int, 0, case when n = 'Kabir' then 'Cash on delivery' else 'UPI' end, null,
                        jsonb_build_array(jsonb_build_object('menuItemId', i, 'qty', 2)), u);
  end loop;
  -- all three were created in one instant; spread them so the screen order is Kabir, Meera, Rohan
  update orders set created_at = now() - interval '3 minutes' where student_name = 'Rohan';
  update orders set created_at = now() - interval '2 minutes' where student_name = 'Meera';
  update orders set created_at = now() - interval '1 minute' where student_name = 'Kabir';
end $$;
