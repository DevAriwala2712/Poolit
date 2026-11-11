# 7. Coverage matrix

Every row of the inventory ([01-inventory.md](01-inventory.md)) with what was done and the
verdict. "Pass" means checked and nothing found. "Unverified" names the owner checklist item.

## Doors

| Door | How it was checked | Verdict |
| --- | --- | --- |
| D1 REST `rpc` | Access matrix, targeted probes, races, line-by-line read of all 45 functions | Findings SEC-01 to SEC-12; access control passes |
| D2 GraphQL | Catalog only; endpoint not reachable from here | Unverified: P2. SEC-13 |
| D3 Auth | Code read; live user and factor counts; settings not reachable | Unverified: A1–A8. SEC-17, SEC-18 |
| D4 Storage | Policy probe on the stand-in table; bucket settings from the live catalog | Policy passes; SEC-05, SEC-11. Real size and type enforcement not exercised |
| D5 Realtime | Live publication has no tables | Pass |
| D6 Express | All route chains read; controllers read; not exercised against a deployment | SEC-14, SEC-15, SEC-16, SEC-21. Deployed flags unverified: V1–V6 |
| D7 Sweep route | Code read | Pass; retire it (V4) |
| D8 Cron | Live job list and 24-hour run history | Pass; SEC-24 |
| D9 Dashboard and keys | Not reachable | Unverified: P3 |
| D10 GitHub Actions | Workflow files read; run history; history secret scan | SEC-20, ARCH-02. Settings unverified: G1–G5 |
| D11 Android | Manifest, Gradle and Capacitor config read; never built | SEC-22 |
| D12 Service worker | Code read | Pass |

## Exposed functions (all 45)

"Matrix" is the intended caller class tested in `evidence/probes/01_access_matrix.sql`.

| Function | Intended callers | Matrix matches? | Verdict |
| --- | --- | --- | --- |
| `api_adjust_stock` | storeX | Yes | Pass |
| `api_audit_log` | admin | Yes | Pass |
| `api_cancel_order` | studentA | Yes | SEC-03, SEC-10 |
| `api_cash_summary` | storeX | Yes | SEC-01 |
| `api_client_errors` | admin | Yes | Pass |
| `api_close_slot` | storeX | Yes | Pass |
| `api_create_menu_item` | storeX | Yes | SEC-02 (to decide) |
| `api_create_staff` | ownerX | Yes | Pass |
| `api_current_slot` | all | Yes | Pass |
| `api_delete_my_account` | students | Yes | SEC-08 |
| `api_delete_staff` | ownerX | Yes | Pass |
| `api_dispatch_slot` | storeX | Yes | Pass |
| `api_export_my_data` | signed-in | Yes | Pass |
| `api_fee_statement` | ownerX+admin | Yes | Pass |
| `api_generate_barcode` | storeX | Yes | Pass |
| `api_generate_missing_barcodes` | storeX | Yes | Pass |
| `api_hostels` | all | Yes | Pass |
| `api_inventory` | storeX | Yes | Pass |
| `api_is_admin` | signed-in | Yes | Pass |
| `api_live_fee` | all | Yes | Pass |
| `api_mark_delivered` | storeX | Yes | SEC-01 |
| `api_me` | signed-in | Yes | Pass |
| `api_my_orders` | signed-in | Yes | Pass |
| `api_pick_list` | storeX | Yes | Pass |
| `api_place_order` | signed-in | Yes | SEC-01, SEC-03, SEC-06, SEC-07 |
| `api_record_consent` | signed-in | Yes | ARCH-06 |
| `api_report_error` | all | Yes | SEC-04 |
| `api_restock_item` | storeX | Yes | Pass |
| `api_restock_log` | storeX | Yes | Pass |
| `api_set_fee_terms` | admin | Yes | Pass |
| `api_set_item_image` | storeX | Yes | SEC-05, SEC-11 |
| `api_slot` | all | Yes | Pass |
| `api_slot_orders` | storeX | Yes | ARCH-10 |
| `api_staff` | storeX | Yes | Pass |
| `api_stock_history` | storeX | Yes | Pass |
| `api_student_view` | all | Yes | SEC-12 |
| `api_update_me` | signed-in | Yes | ARCH-06 |
| `api_update_menu_item` | ownerX | Yes | SEC-02, SEC-05 |
| `api_update_staff` | ownerX | Yes | Pass |
| `api_update_vendor` | ownerX | Yes | Pass |
| `api_vendor` | all | Yes | SEC-12 |
| `api_vendor_menu` | all | Yes | SEC-12; unused by the apps |
| `api_vendor_orders` | storeX | Yes | ARCH-10 |
| `api_vendor_overview` | vendors | Yes | ARCH-10 |
| `api_vendors` | all | Yes | SEC-12 |

`api_update_menu_item` matches for store scoping; the price case is the one deviation (SEC-02).

## Internal functions (41) and `app_policy` (1)

| Group | Check | Verdict |
| --- | --- | --- |
| 27 `private` helpers | Not executable by public roles (live); schema has no usage grant; bodies read | Pass |
| `place_order`, `close_slot`, `dispatch_slot`, `restock_item`, `adjust_stock`, `ensure_open_slot`, `generate_item_barcode`, `sweep_expired_slots` | Not executable by public roles; bodies read; races | Pass; SEC-03, SEC-07, SEC-10 arise here |
| `vendor_daily_revenue`, `fee_for_order_count`, `ean13_check_digit`, three `purge_*` | Not executable by public roles | Pass |
| `private.audit_row` (definer trigger) | Body read; masking probed through account deletion | Pass; ARCH-09 (swallows its own failure) |
| `app_policy.can_upload_product_image` | Probe 03 | Pass; schema exposure unverified: P1 |

## Tables (17) and other objects

| Object | Check | Verdict |
| --- | --- | --- |
| All 17 tables | RLS on, no policy, no grant to public roles: local and live | Pass |
| Personal data columns | Responses searched for another person's data; deletion and export probed | Pass; SEC-08, SEC-23 |
| Sequences | Live privileges | SEC-09 |
| 27 audit triggers | Live list equals migration | Pass |
| Default privileges | Live `pg_default_acl` | Tables and functions pass; sequences SEC-09 |
| Constraints and indexes | Listed in `evidence/schema.md`; plans not measured (53 rows on live) | Not measured: ARCH-10 |
| Bucket `product-images` | Live settings equal migration | Pass |
| Extensions, Edge Functions | Live list; none unexpected; no Edge Functions | Pass |
| Live versus repo | Fingerprint of all 87 functions | Pass (comment-only differences); ARCH-01 |

## Code and configuration

| Area | Check | Verdict |
| --- | --- | --- |
| `rpcApi.ts` ↔ SQL signatures | Mechanical comparison, 44 calls | Pass |
| HTML sinks in both apps | Search for `document.write`, `innerHTML`, `eval`; browser reproduction | SEC-14; label printer passes |
| Response headers | `vercel.json` ×3 | SEC-19 |
| Browser storage | Search and read | Session in `localStorage` (standard); consent flag SEC-06 |
| Third-party loads | Search of HTML and CSS | SEC-26 |
| Token verification | `verifyToken.js` read | Pass |
| Idempotency (both paths) | Probes; code read | Database passes; Express SEC-21 |
| Rate limits | Code read | Express SEC-21; database ARCH-06 |
| Dependencies | `npm audit` ×3 | Runtime passes; SEC-25 |
| Secrets in history | Pattern scan, all 6 branches | Pass |
| Seed and scripts | Read | SEC-15; backup script passes with SEC-20, SEC-23 notes |
| Legal drafts | Compared with the system for facts only | SEC-23 |
| Existing tests | Baseline run ×2; 8 mutations | Pass (8 of 8 caught); gaps in ARCH-14 |
| Docs | Compared with inventory | ARCH-13 |

## Not done, and why

- Nothing was exercised against the deployed Express API or the live REST endpoint: the
  deployment URL is not in the repo and the review's ground rule was not to write to live.
- Real Storage API behaviour (size and MIME enforcement, content sniffing) was not tested;
  the local stand-in models only the policy.
- Query plans and load: no meaningful data volume exists; see ARCH-10.
- Android: no SDK here and the project has never been built.
- Postgres 17-specific behaviour: local is 16. Nothing found depends on the version.
