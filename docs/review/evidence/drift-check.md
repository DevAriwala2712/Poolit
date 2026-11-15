# Drift check: live database versus repo (11 Nov 2026)

Question: is what runs on the live project the same code as `supabase/migrations` at `396345d`?

## Method

1. Built a local database from the 24 migration files at `396345d`.
2. On both sides, for every function in `public`, `private` and `app_policy` not owned by an
   extension, computed `md5` of the body with whitespace collapsed, plus a second fingerprint
   of security mode, `proconfig` (the pinned `search_path`) and whether `anon` and
   `authenticated` may execute it.
3. Compared per schema, then per function.
4. For the functions that differed, compared line by line (hash of each trimmed non-blank line).
5. Rebuilt the database at each of the 7 earlier commits on the branch that touched
   `supabase/`, to see whether live matched an older version of a file.

## Result

| Schema | Functions (local / live) | Mode, `search_path` and grants | Bodies |
| --- | --- | --- | --- |
| `app_policy` | 1 / 1 | identical | identical |
| `private` | 27 / 27 | identical | 2 differ |
| `public` | 59 / 59 | identical | 6 differ |

The 8 differing functions and the full difference:

| Function | Lines in repo only | Lines in live only |
| --- | --- | --- |
| `private.audit_row` | 3 comment lines | none |
| `private.json_order` | 2 comment lines | none |
| `public.api_cancel_order` | 1 comment line | none |
| `public.api_delete_my_account` | 1 comment line | none |
| `public.api_fee_statement` | 1 comment line | none |
| `public.api_mark_delivered` | 2 comment lines | none |
| `public.api_report_error` | 1 comment line | none |
| `public.api_vendor_overview` | 1 comment line | none |

Every differing line is a `--` comment that exists in the repo file and is absent on live.
No executable line differs. None of the 7 earlier commits matches live either, so the
comments were dropped when the SQL was applied, not edited afterwards.

## Conclusions

- **Logic on live equals the repo at `396345d`.** Findings made against the local build apply
  to live.
- No stale overloads: each `api_*` name has exactly one signature on live. The older
  signatures of `api_place_order`, `api_restock_item`, `api_adjust_stock` and
  `api_mark_delivered` were dropped when they were replaced.
- The claim in `supabase/README.md` that the files are "byte-identical to what the project
  has applied" does not hold for these 8 functions. Harmless today, but it means a
  byte-level check cannot be used as a drift alarm. See the architecture findings.
- Other live objects checked against the local build and found equal: 17 tables with RLS on
  and no policy, table grants to `anon` and `authenticated` (none), 27 audit triggers, 4 cron
  jobs, the one storage policy, the `product-images` bucket settings.

## Differences that are environment, not drift

- Locally `pgcrypto` lives in `public` (the test stubs install it there); on live it is in
  `extensions`. Its functions are ignored in the comparison.
- Local is Postgres 16, live is 17.
