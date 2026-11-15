-- Retry-safe writes (Phase 1, week 2).
--
-- A reply that never arrives (bad Wi-Fi), a double tap, or an automatic retry must
-- not place an order twice, add stock twice, or remove it twice. The app sends one
-- random key per intended action; the database remembers the answer to the first
-- request that used it and returns that same answer to any repeat.
--
--   * Keys are per signed-in user and per function, 8 to 128 characters of
--     letters, digits and . _ : -
--   * The same key with a DIFFERENT request is refused (422), so a bug cannot
--     silently reuse one.
--   * The key and the change are saved together or not at all: a request that
--     fails (no stock, pool closed, ...) leaves no key behind, so retrying the same
--     key after fixing the cause works.
--   * Two copies arriving at the same moment cannot both run: the second waits for
--     the first and then gets its answer.
--   * Keys older than 24 hours are removed by the existing daily job.
--   * Calls without a key behave exactly as before.

create or replace function private.idempotent_begin(p_function text, p_key text, p_request jsonb)
 returns jsonb
 language plpgsql
 set search_path = public, pg_temp
as $function$
declare
  v_scope text;
  v_hash text;
  v_inserted integer;
  v_row idempotency_keys;
begin
  if p_key is null then
    return null;
  end if;
  if char_length(p_key) < 8 or char_length(p_key) > 128 or p_key !~ '^[A-Za-z0-9._:-]+$' then
    perform private.fail(400, 'Invalid idempotency key');
  end if;

  v_scope := auth.uid()::text || ':' || p_function;
  v_hash := md5(p_request::text);

  insert into idempotency_keys (scope, key, request_hash, status)
  values (v_scope, p_key, v_hash, 'in_progress')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return null;   -- first time: go ahead and do the work
  end if;

  select * into v_row from idempotency_keys where scope = v_scope and key = p_key;
  if v_row.request_hash <> v_hash then
    perform private.fail(422, 'This idempotency key was already used for a different request');
  end if;
  if v_row.status = 'completed' then
    return v_row.response_body;
  end if;
  perform private.fail(409, 'This request is already being processed');
  return null;
end;
$function$;

create or replace function private.idempotent_finish(p_function text, p_key text, p_response jsonb)
 returns void
 language plpgsql
 set search_path = public, pg_temp
as $function$
begin
  if p_key is null then
    return;
  end if;
  update idempotency_keys
     set status = 'completed', response_status = 200, response_body = p_response
   where scope = auth.uid()::text || ':' || p_function and key = p_key;
end;
$function$;

revoke all on function private.idempotent_begin(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.idempotent_finish(text, text, jsonb) from public, anon, authenticated;

-- ============ api_place_order ============

drop function if exists public.api_place_order(uuid, text, jsonb, text, text, numeric, text, text);

create or replace function public.api_place_order(
  p_slot_id uuid,
  p_student_name text,
  p_items jsonb,
  p_block text default null,
  p_room text default null,
  p_tip numeric default 0,
  p_payment_method text default null,
  p_note text default null,
  p_idempotency_key text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  c_max_orders_per_pool constant integer := 3;
  v_uid uuid := private.require_user();
  v_name text := btrim(coalesce(p_student_name, ''));
  v_existing integer;
  v_clean jsonb;
  v_order orders;
  v_replay jsonb;
  v_resp jsonb;
begin
  if v_name = '' or char_length(v_name) > 60 then
    perform private.fail(400, 'studentName is required (max 60 characters)');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail(400, 'items array is required and cannot be empty');
  end if;
  if char_length(coalesce(p_block, '')) > 40 or char_length(coalesce(p_room, '')) > 20 then
    perform private.fail(400, 'block or room is too long');
  end if;

  -- A repeat of an order already placed with this key returns that order.
  v_replay := private.idempotent_begin('api_place_order', p_idempotency_key, jsonb_build_object(
    'slot', p_slot_id, 'name', v_name, 'items', p_items, 'block', p_block, 'room', p_room,
    'tip', p_tip, 'payment', p_payment_method, 'note', p_note));
  if v_replay is not null then
    return v_replay;
  end if;

  -- Keep only menuItemId and qty from each line, and check their shape.
  begin
    select jsonb_agg(jsonb_build_object('menuItemId', (i->>'menuItemId')::uuid, 'qty', private.json_int(i->'qty', 1, 100)))
      into v_clean
      from jsonb_array_elements(p_items) i;
    if exists (select 1 from jsonb_array_elements(v_clean) c where c->'qty' = 'null'::jsonb or c->'menuItemId' = 'null'::jsonb) then
      perform private.fail(400, 'Each item needs a quantity between 1 and 100 (max 50 lines)');
    end if;
  exception when invalid_text_representation or null_value_not_allowed or invalid_parameter_value then
    perform private.fail(400, 'Each item must have menuItemId and positive integer qty');
  end;

  -- Serialise orders for this pool (place_order takes the same lock), then
  -- apply the per-student limit.
  perform 1 from slots where id = p_slot_id for update;
  if not found then
    perform private.fail(404, 'Slot not found');
  end if;
  select count(*) into v_existing from orders
    where slot_id = p_slot_id and student_id = v_uid and status in ('placed', 'pooled');
  if v_existing >= c_max_orders_per_pool then
    perform private.fail(409, format('You can place up to %s orders in one pool', c_max_orders_per_pool));
  end if;

  begin
    v_order := place_order(
      p_slot_id, v_name, nullif(btrim(coalesce(p_block, '')), ''), nullif(btrim(coalesce(p_room, '')), ''),
      least(greatest(coalesce(p_tip, 0), 0), 500),
      nullif(left(btrim(coalesce(p_payment_method, '')), 30), ''),
      nullif(left(btrim(coalesce(p_note, '')), 140), ''),
      v_clean, v_uid);
  exception when others then
    if sqlstate like 'PT%' then raise; end if;
    if sqlerrm like 'SLOT_NOT_FOUND%' then
      perform private.fail(404, 'Slot not found');
    elsif sqlerrm like 'INVALID_QTY%' or sqlerrm like 'INVALID_ITEMS%' then
      perform private.fail(400, 'Each item needs a quantity between 1 and 100 (max 50 lines)');
    elsif sqlerrm like 'SLOT_NOT_OPEN%' then
      perform private.fail(409, 'Cannot place order: slot is "' || split_part(sqlerrm, ':', 2) || '"');
    elsif sqlerrm like 'INSUFFICIENT_STOCK%' then
      perform private.fail(409, 'Insufficient stock for one or more items');
    elsif sqlerrm like 'WRONG_VENDOR%' then
      perform private.fail(400, 'Menu item "' || split_part(sqlerrm, ':', 2) || '" does not belong to this vendor');
    end if;
    raise;
  end;

  v_resp := private.json_order(v_order);
  perform private.idempotent_finish('api_place_order', p_idempotency_key, v_resp);
  return v_resp;
end;
$function$;

revoke all on function public.api_place_order(uuid, text, jsonb, text, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.api_place_order(uuid, text, jsonb, text, text, numeric, text, text, text) to authenticated;

-- ============ api_restock_item ============

drop function if exists public.api_restock_item(uuid, integer);

create or replace function public.api_restock_item(p_item_id uuid, p_amount integer, p_idempotency_key text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_res jsonb;
  v_replay jsonb;
  v_resp jsonb;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  if p_amount is null or p_amount <= 0 then
    perform private.fail(400, 'amount must be a positive integer');
  end if;

  v_replay := private.idempotent_begin('api_restock_item', p_idempotency_key,
    jsonb_build_object('item', p_item_id, 'amount', p_amount));
  if v_replay is not null then
    return v_replay;
  end if;

  begin
    v_res := restock_item(p_item_id, p_amount);
  exception when others then
    if sqlerrm like 'ITEM_NOT_FOUND%' then perform private.fail(404, 'Menu item not found');
    elsif sqlerrm like 'INVALID_AMOUNT%' then perform private.fail(400, 'amount must be between 1 and 10,000');
    end if;
    raise;
  end;
  v_resp := jsonb_build_object('message', 'Restocked successfully',
    'item', private.json_menu_item(jsonb_populate_record(null::menu_items, v_res->'item')),
    'restockLog', private.json_restock_log(jsonb_populate_record(null::restock_logs, v_res->'restockLog')));
  perform private.idempotent_finish('api_restock_item', p_idempotency_key, v_resp);
  return v_resp;
end;
$function$;

revoke all on function public.api_restock_item(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.api_restock_item(uuid, integer, text) to authenticated;

-- ============ api_adjust_stock ============

drop function if exists public.api_adjust_stock(uuid, text, integer, text, text);

create or replace function public.api_adjust_stock(p_item_id uuid, p_mode text, p_qty integer, p_reason text default null, p_note text default null, p_idempotency_key text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_why text;
  v_res jsonb;
  v_replay jsonb;
  v_resp jsonb;
begin
  perform private.require_vendor(private.vendor_of_item(p_item_id));
  if p_mode is null or p_mode not in ('set', 'remove') then
    perform private.fail(400, 'mode must be "set" or "remove"');
  end if;
  if p_qty is null or p_qty < (case when p_mode = 'remove' then 1 else 0 end) or p_qty > 100000 then
    perform private.fail(400, 'qty must be a whole number (0–100,000; at least 1 to remove)');
  end if;
  v_why := coalesce(p_reason, case when p_mode = 'set' then 'count' else 'damaged' end);
  if v_why not in ('count', 'damaged', 'expired', 'correction', 'other') then
    perform private.fail(400, 'reason must be one of: count, damaged, expired, correction, other');
  end if;
  if char_length(coalesce(p_note, '')) > 140 then
    perform private.fail(400, 'note must be text (max 140 characters)');
  end if;

  v_replay := private.idempotent_begin('api_adjust_stock', p_idempotency_key,
    jsonb_build_object('item', p_item_id, 'mode', p_mode, 'qty', p_qty, 'reason', v_why, 'note', p_note));
  if v_replay is not null then
    return v_replay;
  end if;

  begin
    v_res := adjust_stock(p_item_id, p_mode, p_qty, v_why, auth.uid(), p_note);
  exception when others then
    if sqlerrm like 'ITEM_NOT_FOUND%' then perform private.fail(404, 'Menu item not found');
    elsif sqlerrm like 'NOT_ENOUGH_STOCK%' then
      perform private.fail(409, 'Only ' || split_part(sqlerrm, ':', 2) || ' in stock — can''t remove more than that');
    elsif sqlerrm like 'INVALID_QTY%' then perform private.fail(400, 'Invalid quantity');
    end if;
    raise;
  end;
  v_resp := jsonb_build_object(
    'item', private.json_menu_item(jsonb_populate_record(null::menu_items, v_res->'item')),
    'adjustment', private.json_adjustment(jsonb_populate_record(null::stock_adjustments, v_res->'adjustment')));
  perform private.idempotent_finish('api_adjust_stock', p_idempotency_key, v_resp);
  return v_resp;
end;
$function$;

revoke all on function public.api_adjust_stock(uuid, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.api_adjust_stock(uuid, text, integer, text, text, text) to authenticated;
