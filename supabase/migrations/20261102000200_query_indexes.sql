-- Indexes for the queries the API runs on every poll (Phase 1).
-- All "if not exists", so harmless if some already exist in the live project.
-- On a large table, run each with CREATE INDEX CONCURRENTLY outside a
-- transaction instead; at prototype volume a plain create is fine.

create index if not exists orders_slot_id_idx       on public.orders (slot_id);
create index if not exists orders_status_idx        on public.orders (status);
create index if not exists slots_hostel_status_idx  on public.slots (hostel_id, status);
create index if not exists slots_vendor_id_idx      on public.slots (vendor_id);
create index if not exists menu_items_vendor_id_idx on public.menu_items (vendor_id);
create index if not exists restock_logs_item_idx    on public.restock_logs (menu_item_id, at desc);
