# Tables, constraints, indexes (generated)

Source: local build at `396345d`. Every table has RLS on, no policies, and no grants to `anon` or `authenticated`; confirmed on live.

## Columns

- `audit_log`: id, at, actor, actor_role, table_name, op, row_id, old_values, new_values
- `client_errors`: fingerprint, app, message, stack, page, user_agent, user_id, first_at, last_at, occurrences
- `hostels`: id, name, blocks, created_at, updated_at
- `idempotency_keys`: scope, key, request_hash, status, response_status, response_body, created_at
- `menu_items`: id, vendor_id, name, category, price, mrp, unit, rating, rating_count, is_veg, art, tint, stock_qty, low_stock_threshold, created_at, updated_at, barcode, image_path
- `order_fee_ledger`: order_id, vendor_id, goods_paise, fee_paise, fee_type, fee_value, created_at
- `orders`: id, slot_id, student_name, block, room, tip, payment_method, note, items, status, delivery_fee_charged, created_at, updated_at, student_id, subtotal_paise, cash_collected_paise, cash_collected_at, cash_collected_by
- `platform_admins`: user_id, created_at
- `restock_logs`: id, vendor_id, menu_item_id, amount, at
- `slots`: id, hostel_id, vendor_id, status, opens_at, closes_at, created_at, updated_at
- `staff`: id, vendor_id, name, role, email, status, created_at, updated_at
- `stock_adjustments`: id, vendor_id, menu_item_id, user_id, reason, previous_qty, new_qty, delta, note, at
- `student_consents`: user_id, version, age_confirmed, accepted_at
- `students`: user_id, name, phone, hostel_id, block, room, created_at, updated_at
- `vendor_fee_terms`: vendor_id, fee_type, fee_value, updated_at, updated_by
- `vendor_users`: user_id, vendor_id, role, created_at
- `vendors`: id, name, hostel_id, prep_minutes, created_at, updated_at, accepting_orders, pool_window_minutes

## Foreign keys and delete behaviour

- `menu_items.vendor_id` → `vendors`: no action (blocks delete)
- `order_fee_ledger.order_id` → `orders`: no action (blocks delete)
- `order_fee_ledger.vendor_id` → `vendors`: no action (blocks delete)
- `orders.cash_collected_by` → `auth.users`: set null
- `orders.slot_id` → `slots`: no action (blocks delete)
- `orders.student_id` → `auth.users`: set null
- `platform_admins.user_id` → `auth.users`: cascade
- `restock_logs.menu_item_id` → `menu_items`: no action (blocks delete)
- `restock_logs.vendor_id` → `vendors`: no action (blocks delete)
- `slots.hostel_id` → `hostels`: no action (blocks delete)
- `slots.vendor_id` → `vendors`: no action (blocks delete)
- `staff.vendor_id` → `vendors`: cascade
- `stock_adjustments.menu_item_id` → `menu_items`: no action (blocks delete)
- `stock_adjustments.user_id` → `auth.users`: set null
- `stock_adjustments.vendor_id` → `vendors`: no action (blocks delete)
- `student_consents.user_id` → `auth.users`: cascade
- `students.hostel_id` → `hostels`: no action (blocks delete)
- `students.user_id` → `auth.users`: cascade
- `vendor_fee_terms.updated_by` → `auth.users`: set null
- `vendor_fee_terms.vendor_id` → `vendors`: cascade
- `vendor_users.user_id` → `auth.users`: cascade
- `vendor_users.vendor_id` → `vendors`: cascade
- `vendors.hostel_id` → `hostels`: no action (blocks delete)

## Check and unique constraints

- `audit_log`: `CHECK ((op = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))`
- `client_errors`: `CHECK ((app = ANY (ARRAY['student'::text, 'vendor'::text])))`
- `idempotency_keys`: `CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))`
- `menu_items`: `CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))`
- `menu_items`: `CHECK ((category = ANY (ARRAY['Snacks'::text, 'Instant Food'::text, 'Drinks'::text, 'Essentials'::text, 'Fresh'::text, 'Midnight Cravings'::text])))`
- `menu_items`: `CHECK ((image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$'::text))`
- `menu_items`: `CHECK ((low_stock_threshold >= 0))`
- `menu_items`: `CHECK ((mrp >= (0)::numeric))`
- `menu_items`: `CHECK ((price >= (0)::numeric))`
- `menu_items`: `CHECK ((rating_count >= 0))`
- `menu_items`: `CHECK ((stock_qty >= 0))`
- `order_fee_ledger`: `CHECK ((fee_paise >= 0))`
- `order_fee_ledger`: `CHECK ((goods_paise >= 0))`
- `orders`: `CHECK (((cash_collected_paise IS NULL) OR (cash_collected_paise >= 0)))`
- `orders`: `CHECK ((char_length(note) <= 140))`
- `orders`: `CHECK ((delivery_fee_charged >= (0)::numeric))`
- `orders`: `CHECK ((jsonb_array_length(items) > 0))`
- `orders`: `CHECK ((status = ANY (ARRAY['placed'::text, 'pooled'::text, 'dispatched'::text, 'delivered'::text, 'cancelled'::text])))`
- `orders`: `CHECK ((subtotal_paise >= 0))`
- `orders`: `CHECK ((tip >= (0)::numeric))`
- `restock_logs`: `CHECK ((amount >= 1))`
- `slots`: `CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'dispatched'::text])))`
- `staff`: `CHECK ((status = ANY (ARRAY['active'::text, 'break'::text, 'inactive'::text])))`
- `stock_adjustments`: `CHECK ((char_length(note) <= 140))`
- `stock_adjustments`: `CHECK ((new_qty >= 0))`
- `stock_adjustments`: `CHECK ((previous_qty >= 0))`
- `stock_adjustments`: `CHECK ((reason = ANY (ARRAY['count'::text, 'damaged'::text, 'expired'::text, 'correction'::text, 'other'::text])))`
- `student_consents`: `CHECK (((char_length(version) >= 1) AND (char_length(version) <= 40)))`
- `student_consents`: `CHECK (age_confirmed)`
- `students`: `CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)))`
- `students`: `CHECK ((char_length(block) <= 40))`
- `students`: `CHECK ((char_length(room) <= 20))`
- `vendor_fee_terms`: `CHECK ((fee_type = ANY (ARRAY['percent'::text, 'fixed_per_order'::text])))`
- `vendor_fee_terms`: `CHECK ((fee_value >= (0)::numeric))`
- `vendor_users`: `CHECK ((role = ANY (ARRAY['owner'::text, 'staff'::text])))`
- `vendors`: `CHECK (((pool_window_minutes >= 3) AND (pool_window_minutes <= 60)))`
- `vendors`: `CHECK ((prep_minutes >= 1))`
- `vendors`: `UNIQUE (hostel_id)`

## Indexes

- `INDEX audit_log_actor_idx ON public.audit_log (actor, at DESC) WHERE (actor IS NOT NULL)`
- `INDEX audit_log_at_idx ON public.audit_log (at DESC)`
- `UNIQUE INDEX audit_log_pkey ON public.audit_log (id)`
- `INDEX audit_log_row_idx ON public.audit_log (table_name, row_id, at DESC)`
- `INDEX client_errors_last_at_idx ON public.client_errors (last_at DESC)`
- `UNIQUE INDEX client_errors_pkey ON public.client_errors (fingerprint)`
- `UNIQUE INDEX hostels_pkey ON public.hostels (id)`
- `INDEX idempotency_keys_created_at_idx ON public.idempotency_keys (created_at)`
- `UNIQUE INDEX idempotency_keys_pkey ON public.idempotency_keys (scope, key)`
- `INDEX menu_items_barcode_image_idx ON public.menu_items (barcode) WHERE (image_path IS NOT NULL)`
- `UNIQUE INDEX menu_items_pkey ON public.menu_items (id)`
- `INDEX menu_items_vendor_category_idx ON public.menu_items (vendor_id, category)`
- `UNIQUE INDEX menu_items_vendor_id_barcode_key ON public.menu_items (vendor_id, barcode) WHERE (barcode IS NOT NULL)`
- `INDEX menu_items_vendor_stock_idx ON public.menu_items (vendor_id, stock_qty)`
- `UNIQUE INDEX order_fee_ledger_pkey ON public.order_fee_ledger (order_id)`
- `INDEX order_fee_ledger_vendor_created_idx ON public.order_fee_ledger (vendor_id, created_at)`
- `UNIQUE INDEX orders_pkey ON public.orders (id)`
- `INDEX orders_slot_status_idx ON public.orders (slot_id, status)`
- `INDEX orders_student_created_idx ON public.orders (student_id, created_at DESC)`
- `UNIQUE INDEX platform_admins_pkey ON public.platform_admins (user_id)`
- `INDEX restock_logs_item_at_idx ON public.restock_logs (menu_item_id, at DESC)`
- `UNIQUE INDEX restock_logs_pkey ON public.restock_logs (id)`
- `INDEX restock_logs_vendor_at_idx ON public.restock_logs (vendor_id, at DESC)`
- `INDEX slots_hostel_status_idx ON public.slots (hostel_id, status)`
- `UNIQUE INDEX slots_one_open_per_hostel ON public.slots (hostel_id) WHERE (status = 'open'::text)`
- `UNIQUE INDEX slots_pkey ON public.slots (id)`
- `INDEX slots_status_closes_idx ON public.slots (status, closes_at)`
- `INDEX slots_vendor_id_idx ON public.slots (vendor_id)`
- `UNIQUE INDEX staff_pkey ON public.staff (id)`
- `INDEX staff_vendor_id_idx ON public.staff (vendor_id)`
- `INDEX stock_adjustments_item_at_idx ON public.stock_adjustments (menu_item_id, at DESC)`
- `UNIQUE INDEX stock_adjustments_pkey ON public.stock_adjustments (id)`
- `INDEX stock_adjustments_vendor_at_idx ON public.stock_adjustments (vendor_id, at DESC)`
- `UNIQUE INDEX student_consents_pkey ON public.student_consents (user_id, version)`
- `UNIQUE INDEX students_pkey ON public.students (user_id)`
- `UNIQUE INDEX vendor_fee_terms_pkey ON public.vendor_fee_terms (vendor_id)`
- `UNIQUE INDEX vendor_users_pkey ON public.vendor_users (user_id, vendor_id)`
- `INDEX vendor_users_vendor_id_idx ON public.vendor_users (vendor_id)`
- `UNIQUE INDEX vendors_hostel_id_key ON public.vendors (hostel_id)`
- `UNIQUE INDEX vendors_pkey ON public.vendors (id)`
