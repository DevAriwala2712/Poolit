# Database migrations

Every schema change to the live Supabase project (`icnkzzjnuoyfupaydian`,
ap-southeast-1) is a file in `migrations/`. The files here are byte-identical
to what the project has applied (checked against
`supabase_migrations.schema_migrations` on 2 Nov 2026), so the Supabase CLI
sees matching history.

| Version | What it does |
| --- | --- |
| `20260902192143_init_poolit_schema` | Tables, indexes, RLS on, fee ladder, `place_order` / `close_slot` / `dispatch_slot` / `restock_item` |
| `20260915164813_add_barcode_to_menu_items` | `menu_items.barcode`, unique per store |
| `20260915175457_add_vendor_settings_and_staff` | `vendors.accepting_orders`, `staff` table |
| `20261102004932_vendor_users` | Login ↔ store links with owner/staff role (per-store access control) |
| `20261102004948_query_indexes` | `slots(vendor_id)`, `restock_logs(menu_item_id, at)` |
| `20261102005026_harden_functions_and_grants` | Pinned `search_path`; quantity/amount guards inside `place_order` and `restock_item`; functions and tables usable by the API's service role only |
| `20261102005310_staff_fk_index_and_vendor_users_grant` | `staff(vendor_id)` index; `vendor_users` server-only |
| `20261102010452_students_and_order_ownership` | `students` profiles; `orders.student_id`; `place_order` takes an optional student id |

## Making a change

```bash
npx supabase migration new <name>      # write SQL in the new file
npx supabase link --project-ref icnkzzjnuoyfupaydian
npx supabase db push                   # apply to the linked project
```

Never change the schema from the dashboard — it won't be in this history.

## Access model

Both apps use Supabase **only for login**. All data goes through the Express
API, which uses the service-role key. The `anon` and `authenticated` roles
have no table or function access (RLS is on and grants are revoked), so the
public anon key in the vendor app can't read or change data directly.

`scripts/export-schema.sh` dumps a schema-only snapshot if you ever need one
(needs the database connection string).
