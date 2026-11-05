-- Demo data for the student app end-to-end run (a throwaway database).
insert into hostels (id, name, blocks) values
  ('a0000000-0000-4000-8000-000000000001', 'Ganga Hostel', array['A','B']),
  ('a0000000-0000-4000-8000-000000000002', 'Yamuna Hostel', array['A']),
  ('a0000000-0000-4000-8000-000000000003', 'Kaveri Hostel', array['A','B','C']);

insert into vendors (id, name, hostel_id) values
  ('b0000000-0000-4000-8000-000000000001', 'Ganga Store', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'Yamuna Store', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'Kaveri Store', 'a0000000-0000-4000-8000-000000000003');

insert into menu_items (vendor_id, name, category, price, unit, stock_qty, art)
select v.id, i.name, i.cat, i.price, i.unit, 40, i.art
from vendors v, (values
  ('Maggi 2-Minute Noodles', 'Instant Food', 56, 'Pack of 4', '🍜'),
  ('Lays Magic Masala', 'Snacks', 20, '52 g pack', '🥔'),
  ('Coca-Cola', 'Drinks', 45, '750 ml', '🥤'),
  ('Colgate Strong Teeth', 'Essentials', 55, '100 g tube', '🪥')) as i(name, cat, price, unit, art);

insert into auth.users (id, email, phone) values ('c0000000-0000-4000-8000-000000000001', null, '+919876543210');
