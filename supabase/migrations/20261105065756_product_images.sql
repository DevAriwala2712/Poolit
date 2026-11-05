-- Product photos (Phase 1, week 2).
--
-- * Bucket `product-images`: public to read (so the apps and a CDN cache can
--   fetch pictures without signing in), capped at 200 KB per file and limited
--   to WebP/JPEG. The cap is the safety net behind the in-browser resize: a raw
--   phone photo (several MB) is simply refused, so storage and download
--   traffic cannot balloon.
-- * Who may upload: a signed-in vendor, only into the folder named after a
--   store they are linked to. Nobody may overwrite or delete through the API
--   (no update/delete policy): files are named after their content, so a
--   picture never changes under an existing link.
-- * menu_items.image_path points at the 800 px picture; the 400 px thumbnail is
--   the same name with ".thumb" before the extension.
-- * Items with the same barcode in other stores show the same picture, so a
--   product is photographed once, not once per store.
--
--   path:      <vendor_id>/<16 hex chars of the content hash>.<webp|jpg>
--   thumbnail: <vendor_id>/<16 hex chars of the content hash>.thumb.<webp|jpg>

-- ============ Column ============

alter table public.menu_items
  add column if not exists image_path text
  check (image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$');

-- Finding another store's picture for the same barcode.
create index if not exists menu_items_barcode_image_idx
  on public.menu_items (barcode) where image_path is not null;

-- ============ Menu item JSON gains imagePath ============

create or replace function private.json_menu_item(r menu_items)
 returns jsonb language sql stable set search_path = public, pg_temp
as $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', r.id, 'vendorId', r.vendor_id, 'name', r.name, 'category', r.category,
    'price', r.price, 'mrp', r.mrp, 'unit', r.unit, 'rating', r.rating,
    'ratingCount', r.rating_count, 'isVeg', r.is_veg, 'art', r.art, 'tint', r.tint,
    'stockQty', r.stock_qty, 'lowStockThreshold', r.low_stock_threshold,
    'barcode', r.barcode,
    'imagePath', coalesce(r.image_path,
      (select m2.image_path from menu_items m2
        where r.barcode is not null and m2.barcode = r.barcode and m2.image_path is not null
        order by m2.updated_at desc limit 1)),
    'createdAt', r.created_at, 'updatedAt', r.updated_at))
$function$;

-- ============ Bucket ============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 204800, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============ Upload rule ============

-- Lives in its own schema because a storage policy runs as the signed-in user,
-- who has no access to vendor_users; the helper reads it on their behalf and
-- answers only about themselves. The schema is not exposed through the API.
create schema if not exists app_policy;
grant usage on schema app_policy to authenticated;

create or replace function app_policy.can_upload_product_image(p_name text)
 returns boolean
 language sql
 stable
 security definer
 set search_path = public, pg_temp
as $function$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}(\.thumb)?\.(webp|jpg)$'
     and exists (
       select 1 from public.vendor_users vu
        where vu.user_id = auth.uid()
          and vu.vendor_id::text = split_part(p_name, '/', 1))
$function$;

revoke all on function app_policy.can_upload_product_image(text) from public, anon;
grant execute on function app_policy.can_upload_product_image(text) to authenticated;

drop policy if exists "vendors upload product images" on storage.objects;
create policy "vendors upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and app_policy.can_upload_product_image(name));

-- ============ Attaching a picture to an item ============

-- p_path null removes the item's own picture. The files must already be
-- uploaded (both sizes) into this store's folder.
create or replace function public.api_set_item_image(p_item_id uuid, p_path text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public, pg_temp
as $function$
declare
  v_vendor uuid := private.vendor_of_item(p_item_id);
  v_item menu_items;
  v_thumb text;
begin
  perform private.require_vendor(v_vendor);

  if p_path is not null then
    if p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{16}\.(webp|jpg)$'
       or split_part(p_path, '/', 1) <> v_vendor::text then
      perform private.fail(400, 'Invalid picture path');
    end if;
    v_thumb := regexp_replace(p_path, '\.(webp|jpg)$', '.thumb.\1');
    if (select count(*) from storage.objects
         where bucket_id = 'product-images' and name in (p_path, v_thumb)) < 2 then
      perform private.fail(400, 'Upload both picture sizes first');
    end if;
  end if;

  update menu_items set image_path = p_path, updated_at = now()
    where id = p_item_id returning * into v_item;
  return private.json_menu_item(v_item);
end;
$function$;

revoke all on function public.api_set_item_image(uuid, text) from public, anon, authenticated;
grant execute on function public.api_set_item_image(uuid, text) to authenticated;
