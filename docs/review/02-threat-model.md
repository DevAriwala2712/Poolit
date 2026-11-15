# 2. Threat model

Written after the evidence, so each abuse case points at what was found. "Held" means the
attempt was made and refused; see [03-findings-security.md](03-findings-security.md).

## What is worth protecting

| Asset | Where |
| --- | --- |
| Student name, phone, hostel, block, room; what they ordered | `students`, `orders`, `auth.users` |
| Stock and prices | `menu_items` |
| Money owed and collected; commission | `orders.cash_collected_*`, `order_fee_ledger`, `vendor_fee_terms` |
| Store logins and the admin login | Supabase Auth; sessions in browser storage |
| The record of who changed what | `audit_log` |
| Keys that bypass every check | Service-role key (Vercel), database password (dashboard, later GitHub), backup private key |
| Availability on a free plan | 500 MB database, 5 GB transfer, 1 GB storage |

## Trust boundaries

1. Internet → Supabase REST, Auth, Storage (public key in both apps).
2. Internet → Express on Vercel (holds the service-role key).
3. Signed-out → signed-in (an OTP or a password).
4. Signed-in → linked to a store → owner of it → platform admin (rows in two tables).
5. Student-typed text → store staff's browser.
6. Repository and CI → live database (migrations by hand today; a database URL in CI later).

## Actors and what they can do today

| Actor | Tried | Result |
| --- | --- | --- |
| Signed-out visitor | Read any table or another person's data through the database functions | Held |
| | Read order lists with names and rooms through Express | Open while the flag is off: SEC-16 |
| | Fill the database or blind error tracking | SEC-04 |
| | Plant script for a store's browser via an Express order | SEC-14 with SEC-16 |
| | Track every store's stock and sales | SEC-12 (by design, to decide) |
| Student | See or cancel another student's order; export another's data | Held |
| | Get goods without paying | SEC-01 |
| | Take over a store login | SEC-14 |
| | Empty a store's stock, repeatedly, free | SEC-03 |
| | Order while a store is paused, or without consent on record | SEC-07, SEC-06 |
| | Exceed 3 orders, oversell stock, double-place with one key | Held under races |
| Self-registered account with no phone | Everything a student can | Depends on sign-up settings: SEC-17 |
| Store staff | Act on another store | Held |
| | Owner-only actions (settings, roster, fee statement) | Held |
| | Change prices | SEC-02 |
| | Record less cash than collected | Visible as a difference in the day's summary; accepted |
| Owner of a rival store | Read or change another store's data | Held on the database path; open on Express while scoping is off: SEC-16 |
| | Put a picture on the other store's product | SEC-05 |
| | Upload without limit | SEC-11 |
| Platform admin | Everything admin functions allow | One password, no second factor, same account as a store owner: SEC-18 |
| Developer with the `.env` | Wipe live by running the documented seed command | SEC-15 |
| Anyone who can change a workflow | Read the database URL once the backup secret exists | SEC-20 |
| Compromised dependency | Build-time only today (2 high in dev dependencies) | SEC-25 |
| Lost device (Android, later) | Session in a device backup | SEC-22 |

## Chains that matter

- **Order text → store session → all stores.** SEC-14, then SEC-18 (no second factor) and,
  on Express, SEC-16 (no store scoping). Shortest path from the internet to every student's
  name and room once real students exist.
- **Free account → free goods.** SEC-17 (cheap accounts) → SEC-01 (paid label) or SEC-03
  (stock lock-out).
- **Mistake → no recovery.** SEC-15 (seed) or any bad migration applied by hand (ARCH-01) →
  ARCH-04 (no backup, no staging).

## Out of scope

Supabase's and Vercel's own platforms, physical delivery, the legal adequacy of the policy
drafts, and social engineering of staff.
