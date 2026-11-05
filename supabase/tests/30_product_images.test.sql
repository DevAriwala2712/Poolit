-- Product photos: bucket settings, who may upload where, and attaching a
-- picture to an item. Uses the t.* helpers defined in 10_api_security.test.sql
-- (test files run in name order on the same database).

do $$
declare
  v1 text := t.id('v1')::text;
  v2 text := t.id('v2')::text;
  n integer;
  r jsonb;
begin
  -- ---- Bucket settings ----
  perform t.ok((select public from storage.buckets where id = 'product-images'), 'bucket must be public to read');
  perform t.ok((select file_size_limit from storage.buckets where id = 'product-images') <= 204800, 'bucket must cap files at 200 KB');
  perform t.ok((select allowed_mime_types from storage.buckets where id = 'product-images') = array['image/webp', 'image/jpeg'], 'bucket must only accept webp and jpeg');

  -- ---- Uploads ----
  -- Store 1's owner and staff may upload into store 1's folder.
  perform t.as_user('owner1');
  insert into storage.objects (bucket_id, name) values ('product-images', v1 || '/0123456789abcdef.webp');
  insert into storage.objects (bucket_id, name) values ('product-images', v1 || '/0123456789abcdef.thumb.webp');
  perform t.as_user('staff1');
  insert into storage.objects (bucket_id, name) values ('product-images', v1 || '/fedcba9876543210.webp');
  insert into storage.objects (bucket_id, name) values ('product-images', v1 || '/fedcba9876543210.thumb.webp');

  -- ...but not into another store's folder, a made-up folder, or with a bad name.
  perform t.as_user('owner1');
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/0123456789abcdef.webp') $q$, v2));
  perform t.throws('42501', $q$ insert into storage.objects (bucket_id, name) values ('product-images', '00000000-0000-4000-8000-000000000000/0123456789abcdef.webp') $q$);
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/raw-photo.png') $q$, v1));
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/../x/0123456789abcdef.webp') $q$, v1));
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('some-other-bucket', '%s/0123456789abcdef.webp') $q$, v1));

  -- Students, strangers and anonymous visitors cannot upload anywhere.
  perform t.as_user('B');
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/aaaaaaaaaaaaaaaa.webp') $q$, v1));
  perform t.as_user('nobody');
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/aaaaaaaaaaaaaaaa.webp') $q$, v1));
  perform t.as_anon();
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/aaaaaaaaaaaaaaaa.webp') $q$, v1));

  -- Another store's owner cannot upload into store 1 either.
  perform t.as_user('owner2');
  perform t.throws('42501', format($q$ insert into storage.objects (bucket_id, name) values ('product-images', '%s/aaaaaaaaaaaaaaaa.webp') $q$, v1));
  insert into storage.objects (bucket_id, name) values ('product-images', v2 || '/1111111111111111.webp');
  insert into storage.objects (bucket_id, name) values ('product-images', v2 || '/1111111111111111.thumb.webp');

  -- ---- Nobody can overwrite or delete through the API ----
  perform t.as_user('owner1');
  update storage.objects set name = v1 || '/0000000000000000.webp' where name = v1 || '/0123456789abcdef.webp';
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'vendors must not be able to rename or replace uploaded files');
  delete from storage.objects where name = v1 || '/0123456789abcdef.webp';
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'vendors must not be able to delete uploaded files');
  perform t.as_admin();
  perform t.ok((select count(*) from storage.objects where name = v1 || '/0123456789abcdef.webp') = 1, 'the file is still there');

  -- The helper is not an API endpoint for visitors.
  perform t.ok(not has_function_privilege('anon', 'app_policy.can_upload_product_image(text)', 'execute'), 'anon must not run the upload check');
  perform t.ok(not has_schema_privilege('anon', 'app_policy', 'usage'), 'anon must not see app_policy');

  -- ---- Attaching a picture ----
  -- Nothing yet: no imagePath key at all.
  perform t.as_anon();
  perform t.ok(not (api_vendor_menu(t.id('v1'))->0 ? 'imagePath'), 'items without a picture have no imagePath');

  perform t.as_user('owner1');
  r := api_set_item_image(t.id('i1'), v1 || '/0123456789abcdef.webp');
  perform t.ok(r->>'imagePath' = v1 || '/0123456789abcdef.webp', 'owner attaches a picture');
  perform t.as_user('staff1');
  perform t.ok(api_set_item_image(t.id('i3'), v1 || '/fedcba9876543210.webp')->>'imagePath' is not null, 'staff may attach a picture');

  -- Bad input
  perform t.as_user('owner1');
  perform t.throws('PT400', format($q$ select api_set_item_image(%L, 'not/a/path') $q$, t.id('i1')));
  perform t.throws('PT400', format($q$ select api_set_item_image(%L, '%s/0123456789abcdef.png') $q$, t.id('i1'), v1));
  -- a valid-looking path whose files were never uploaded
  perform t.throws('PT400', format($q$ select api_set_item_image(%L, '%s/9999999999999999.webp') $q$, t.id('i1'), v1));
  -- a picture from another store's folder
  perform t.throws('PT400', format($q$ select api_set_item_image(%L, '%s/1111111111111111.webp') $q$, t.id('i1'), v2));
  -- only one of the two sizes uploaded
  perform t.as_admin();
  insert into storage.objects (bucket_id, name) values ('product-images', v1 || '/2222222222222222.webp');
  perform t.as_user('owner1');
  perform t.throws('PT400', format($q$ select api_set_item_image(%L, '%s/2222222222222222.webp') $q$, t.id('i1'), v1));

  -- Access: other stores, students and visitors cannot change another store's item
  perform t.as_user('owner2');
  perform t.throws('PT403', format($q$ select api_set_item_image(%L, '%s/0123456789abcdef.webp') $q$, t.id('i1'), v1));
  perform t.as_user('B');
  perform t.throws('PT403', format($q$ select api_set_item_image(%L, null) $q$, t.id('i1')));
  perform t.as_anon();
  perform t.throws('42501', format($q$ select api_set_item_image(%L, null) $q$, t.id('i1')));

  -- ---- The picture shows up in the catalogue, for anyone ----
  perform t.as_anon();
  perform t.ok((select count(*) from jsonb_array_elements(api_vendor_menu(t.id('v1'))) m where m ? 'imagePath') = 2, 'both pictures appear in the public menu');
  perform t.ok(api_current_slot(t.id('h1'))->'vendor'->'menu' @> jsonb_build_array(jsonb_build_object('imagePath', v1 || '/0123456789abcdef.webp')), 'and in the current-pool payload');

  -- ---- One photo per product: same barcode, other store ----
  perform t.as_admin();
  update menu_items set barcode = '8901058000290' where id = t.id('i1');
  update menu_items set barcode = '8901058000290' where id = t.id('i2');   -- store 2's item, same product
  perform t.as_anon();
  perform t.ok((select m->>'imagePath' from jsonb_array_elements(api_vendor_menu(t.id('v2'))) m where m->>'id' = t.id('i2')::text) = v1 || '/0123456789abcdef.webp',
               'store 2 shows store 1''s picture for the same barcode');

  -- Its own picture wins once it has one.
  perform t.as_user('owner2');
  perform t.ok(api_set_item_image(t.id('i2'), v2 || '/1111111111111111.webp')->>'imagePath' = v2 || '/1111111111111111.webp', 'store 2 sets its own');
  perform t.as_anon();
  perform t.ok((select m->>'imagePath' from jsonb_array_elements(api_vendor_menu(t.id('v2'))) m where m->>'id' = t.id('i2')::text) = v2 || '/1111111111111111.webp',
               'own picture takes priority over the shared one');

  -- ---- Removing it ----
  perform t.as_user('owner2');
  perform t.ok(not (api_set_item_image(t.id('i2'), null) ? 'imagePath') or api_set_item_image(t.id('i2'), null)->>'imagePath' = v1 || '/0123456789abcdef.webp',
               'removing the own picture falls back to the shared one (or none)');
  perform t.as_admin();
  perform t.ok((select image_path from menu_items where id = t.id('i2')) is null, 'own picture removed');
end $$;
