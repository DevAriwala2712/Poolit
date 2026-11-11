# Function inventory (generated)

Source: local Postgres 16 built from `supabase/migrations` at `396345d`. Counts, security mode, `search_path` and execute grants were compared with the live project on 11 Nov 2026 and match for all 87 functions (see `drift-check.md`).

| Function | Mode | Volatility | Signed-out | Signed-in | Writes |
| --- | --- | --- | --- | --- | --- |
| `app_policy.can_upload_product_image(name text)` | definer | stable | no | yes | - |
| `private.amount_due_paise(o orders)` | invoker | stable | no | no | - |
| `private.audit_clean(j jsonb, mask text[], skip text[])` | invoker | immutable | no | no | - |
| `private.audit_row()` | definer | volatile | no | no | direct |
| `private.close_if_expired(slot_id uuid)` | invoker | volatile | no | no | via helper |
| `private.fail(status integer, message text)` | invoker | volatile | no | no | - |
| `private.idempotent_begin(function text, key text, request jsonb)` | invoker | volatile | no | no | direct |
| `private.idempotent_finish(function text, key text, response jsonb)` | invoker | volatile | no | no | - |
| `private.is_cod(payment_method text)` | invoker | immutable | no | no | - |
| `private.is_platform_admin()` | invoker | stable | no | no | - |
| `private.json_adjustment(r stock_adjustments)` | invoker | stable | no | no | - |
| `private.json_hostel(r hostels)` | invoker | stable | no | no | - |
| `private.json_int(val jsonb, lo bigint, hi bigint)` | invoker | immutable | no | no | - |
| `private.json_menu_item(r menu_items)` | invoker | stable | no | no | - |
| `private.json_order(r orders)` | invoker | stable | no | no | - |
| `private.json_restock_log(r restock_logs)` | invoker | stable | no | no | - |
| `private.json_slot(r slots)` | invoker | stable | no | no | - |
| `private.json_staff(r staff)` | invoker | stable | no | no | - |
| `private.json_vendor(r vendors)` | invoker | stable | no | no | - |
| `private.json_vendor_with_menu(r vendors)` | invoker | stable | no | no | - |
| `private.ms(ts timestamp with time zone)` | invoker | immutable | no | no | - |
| `private.platform_fee_paise()` | invoker | immutable | no | no | - |
| `private.require_user()` | invoker | stable | no | no | - |
| `private.require_vendor(vendor_id uuid, owner_only boolean)` | invoker | stable | no | no | - |
| `private.vendor_of_item(item_id uuid)` | invoker | stable | no | no | - |
| `private.vendor_of_order(order_id uuid)` | invoker | stable | no | no | - |
| `private.vendor_of_slot(slot_id uuid)` | invoker | stable | no | no | - |
| `private.vendor_of_staff(staff_id uuid)` | invoker | stable | no | no | - |
| `public.adjust_stock(item_id uuid, mode text, qty integer, reason text, user_id uuid, note text)` | invoker | volatile | no | no | direct |
| `public.api_adjust_stock(item_id uuid, mode text, qty integer, reason text, note text, idempotency_key text)` | definer | volatile | no | yes | via helper |
| `public.api_audit_log(table text, row_id text, actor uuid, before bigint, limit integer)` | definer | stable | no | yes | - |
| `public.api_cancel_order(order_id uuid)` | definer | volatile | no | yes | direct |
| `public.api_cash_summary(vendor_id uuid, day date)` | definer | stable | no | yes | - |
| `public.api_client_errors(limit integer)` | definer | stable | no | yes | - |
| `public.api_close_slot(slot_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_create_menu_item(vendor_id uuid, input jsonb)` | definer | volatile | no | yes | direct |
| `public.api_create_staff(vendor_id uuid, name text, role text, email text)` | definer | volatile | no | yes | direct |
| `public.api_current_slot(hostel_id uuid)` | definer | volatile | **yes** | yes | via helper |
| `public.api_delete_my_account(confirm text)` | definer | volatile | no | yes | direct |
| `public.api_delete_staff(staff_id uuid)` | definer | volatile | no | yes | direct |
| `public.api_dispatch_slot(slot_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_export_my_data()` | definer | stable | no | yes | - |
| `public.api_fee_statement(vendor_id uuid, from date, to date)` | definer | stable | no | yes | - |
| `public.api_generate_barcode(item_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_generate_missing_barcodes(vendor_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_hostels()` | definer | stable | **yes** | yes | - |
| `public.api_inventory(vendor_id uuid, status text)` | definer | stable | no | yes | - |
| `public.api_is_admin()` | definer | stable | no | yes | - |
| `public.api_live_fee(slot_id uuid)` | definer | volatile | **yes** | yes | via helper |
| `public.api_mark_delivered(order_id uuid, cash_collected_paise integer)` | definer | volatile | no | yes | direct |
| `public.api_me()` | definer | stable | no | yes | - |
| `public.api_my_orders()` | definer | stable | no | yes | - |
| `public.api_pick_list(slot_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_place_order(slot_id uuid, student_name text, items jsonb, block text, room text, tip numeric, payment_method text, note text, idempotency_key text)` | definer | volatile | no | yes | via helper |
| `public.api_record_consent(version text, age_confirmed boolean)` | definer | volatile | no | yes | direct |
| `public.api_report_error(app text, message text, stack text, page text, user_agent text)` | definer | volatile | **yes** | yes | direct |
| `public.api_restock_item(item_id uuid, amount integer, idempotency_key text)` | definer | volatile | no | yes | via helper |
| `public.api_restock_log(item_id uuid)` | definer | stable | no | yes | - |
| `public.api_set_fee_terms(vendor_id uuid, fee_type text, fee_value numeric)` | definer | volatile | no | yes | direct |
| `public.api_set_item_image(item_id uuid, path text)` | definer | volatile | no | yes | direct |
| `public.api_slot(slot_id uuid)` | definer | volatile | **yes** | yes | via helper |
| `public.api_slot_orders(slot_id uuid)` | definer | volatile | no | yes | via helper |
| `public.api_staff(vendor_id uuid)` | definer | stable | no | yes | - |
| `public.api_stock_history(item_id uuid)` | definer | stable | no | yes | - |
| `public.api_student_view(hostel_id uuid)` | definer | volatile | **yes** | yes | via helper |
| `public.api_update_me(name text, hostel_id uuid, block text, room text)` | definer | volatile | no | yes | direct |
| `public.api_update_menu_item(item_id uuid, patch jsonb)` | definer | volatile | no | yes | direct |
| `public.api_update_staff(staff_id uuid, patch jsonb)` | definer | volatile | no | yes | direct |
| `public.api_update_vendor(vendor_id uuid, patch jsonb)` | definer | volatile | no | yes | direct |
| `public.api_vendor(vendor_id uuid)` | definer | stable | **yes** | yes | - |
| `public.api_vendor_menu(vendor_id uuid)` | definer | stable | **yes** | yes | - |
| `public.api_vendor_orders(vendor_id uuid, status text)` | definer | stable | no | yes | - |
| `public.api_vendor_overview(days integer)` | definer | volatile | no | yes | via helper |
| `public.api_vendors()` | definer | stable | **yes** | yes | - |
| `public.close_slot(slot_id uuid)` | invoker | volatile | no | no | direct |
| `public.dispatch_slot(slot_id uuid)` | invoker | volatile | no | no | direct |
| `public.ean13_check_digit(first12 text)` | invoker | immutable | no | no | - |
| `public.ensure_open_slot(hostel_id uuid)` | invoker | volatile | no | no | direct |
| `public.fee_for_order_count(order_count integer)` | invoker | immutable | no | no | - |
| `public.generate_item_barcode(item_id uuid)` | invoker | volatile | no | no | direct |
| `public.place_order(slot_id uuid, student_name text, block text, room text, tip numeric, payment_method text, note text, items jsonb, student_id uuid)` | invoker | volatile | no | no | direct |
| `public.purge_audit_log()` | definer | volatile | no | no | direct |
| `public.purge_client_errors()` | definer | volatile | no | no | direct |
| `public.purge_idempotency_keys()` | invoker | volatile | no | no | direct |
| `public.restock_item(item_id uuid, amount integer)` | invoker | volatile | no | no | direct |
| `public.sweep_expired_slots()` | invoker | volatile | no | no | via helper |
| `public.vendor_daily_revenue(vendor_id uuid, days integer)` | invoker | stable | no | no | - |
