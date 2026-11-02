-- Indexes the existing set doesn't cover (Phase 1).
-- GET /vendors/:id/orders looks up slots by vendor; the restock log reads by item.
create index if not exists slots_vendor_id_idx on public.slots (vendor_id);
create index if not exists restock_logs_item_at_idx on public.restock_logs (menu_item_id, at desc);
