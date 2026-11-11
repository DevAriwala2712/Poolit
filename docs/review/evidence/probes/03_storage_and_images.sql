-- Storage policy and shared-picture probes. Needs 01_access_matrix.sql first. Rolled back.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;
create or replace function rv.run(p_actor text, p_sql text) returns text language plpgsql as $$
declare v text; v_state text; v_msg text;
begin
  begin
    if p_actor = 'anon' then perform set_config('request.jwt.claims', '', true); execute 'set local role anon';
    else perform set_config('request.jwt.claims', json_build_object('sub', rv.id(p_actor), 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end if;
    execute p_sql into v;
  exception when others then get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text; v := 'ERROR ' || v_state || ': ' || v_msg; end;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create or replace function rv.up(p_actor text, p_name text) returns text language sql as $$
  select rv.run(p_actor, format($q$with i as (insert into storage.objects (bucket_id, name) values ('product-images', %L) returning 1) select 'stored' from i$q$, p_name)) $$;

\echo == upload rule
select 'ownerY into own folder: ' || rv.up('ownerY', rv.id('vY') || '/aaaaaaaaaaaaaaaa.webp');
select 'ownerY thumb: ' || rv.up('ownerY', rv.id('vY') || '/aaaaaaaaaaaaaaaa.thumb.webp');
select 'ownerY into store X folder: ' || left(rv.up('ownerY', rv.id('vX') || '/bbbbbbbbbbbbbbbb.webp'), 60);
select 'student into store X folder: ' || left(rv.up('studentA', rv.id('vX') || '/cccccccccccccccc.webp'), 60);
select 'signed-out: ' || left(rv.up('anon', rv.id('vY') || '/dddddddddddddddd.webp'), 60);
select 'bad name (.svg): ' || left(rv.up('ownerY', rv.id('vY') || '/eeeeeeeeeeeeeeee.svg'), 60);
select 'path traversal: ' || left(rv.up('ownerY', rv.id('vY') || '/../' || rv.id('vX') || '/ffffffffffffffff.webp'), 60);
select 'overwrite (update) by owner: ' || coalesce(rv.run('ownerY', $q$with u as (update storage.objects set metadata = '{}' where bucket_id = 'product-images' returning 1) select count(*)::text from u$q$), 'null') || ' rows';
select 'delete by owner: ' || coalesce(rv.run('ownerY', $q$with d as (delete from storage.objects where bucket_id = 'product-images' returning 1) select count(*)::text from d$q$), 'null') || ' rows';
select 'list by owner: ' || rv.run('ownerY', $q$select count(*)::text from storage.objects$q$) || ' rows visible';
select 'how many files one vendor may add: ' || rv.run('ownerY', format($q$with i as (insert into storage.objects (bucket_id, name) select 'product-images', %L || '/' || lpad(to_hex(g), 16, '0') || '.webp' from generate_series(1, 2000) g returning 1) select count(*)::text from i$q$, rv.id('vY'))) || ' accepted in one go (no count or quota rule)';

\echo == shared picture by barcode crosses stores
update menu_items set barcode = '8901234567890' where id = rv.id('iX');
select 'store X item picture before: ' || coalesce(rv.run('anon', $q$select api_vendor(rv.id('vX'))->'menu'->0->>'imagePath'$q$), '(none)');
select 'ownerY sets the same barcode on an own item: ' || left(rv.run('ownerY', $q$select api_update_menu_item(rv.id('iY'), '{"barcode":"8901234567890"}')->>'barcode'$q$), 40);
select 'ownerY attaches a picture to that item: ' || left(rv.run('ownerY', format($q$select api_set_item_image(rv.id('iY'), %L)->>'imagePath'$q$, rv.id('vY') || '/aaaaaaaaaaaaaaaa.webp')), 80);
select 'store X item picture now (seen signed-out): ' || coalesce(rv.run('anon', $q$select api_vendor(rv.id('vX'))->'menu'->0->>'imagePath'$q$), '(none)');
select 'that path is in store Y''s folder: ' || (rv.run('anon', $q$select api_vendor(rv.id('vX'))->'menu'->0->>'imagePath'$q$) like rv.id('vY') || '/%');
select 'can store X see or remove it: api_set_item_image(null) -> ' || coalesce(rv.run('ownerX', $q$select api_set_item_image(rv.id('iX'), null)->>'imagePath'$q$), '(still shown: null clears only X''s own picture)');
rollback;
