# Personal data register (facts from the system, for the lawyer)

Checked against the migrations in `supabase/migrations/` on 2026-11-06. Update whenever a table or field is added.

| Data | Where | Whose | Purpose | Seen by | Kept | Deleted by |
| --- | --- | --- | --- | --- | --- | --- |
| Phone number, sign-in records | Supabase auth | Student, store staff | Sign in | The person; Poolit (dashboard) | While the account exists | `api_delete_my_account` removes the auth user |
| Name, hostel, block, room | `students` | Student | Delivery | The student; the store delivering to them | While the account exists | Account deletion |
| Orders: items, unit prices, subtotal, delivery fee, tip, payment method, note, status, times | `orders` | Student, store | Run the pool; bills; accounts | The student; that store; Poolit | **[N years, accountant]** | On account deletion: name, block, room, note and the link to the account are cleared ("Deleted student"); amounts, items and dates stay |
| Cash taken for a cash order | `orders.cash_collected_*` | Student, store | Reconcile cash | That store; Poolit | With the order | With the order |
| Fee per delivered order | `order_fee_ledger` | Store | Commission records | Poolit; that store (statement) | **[N years]** | Not deleted |
| Store fee terms, admin list | `vendor_fee_terms`, `platform_admins` | Store, Poolit staff | Billing, access | Poolit admins | While active | Manual |
| Idempotency records | `idempotency_keys` | Student, store | Stop double orders | Nobody directly | Short-lived (clean-up job) | Clean-up job |
| Product photos and names | Storage `product-images`, `menu_items` | Store | Show products | Everyone signed in | While listed | Store removes |
| Consent: policy version, 18+ confirmation, time | `student_consents` | Student | Proof of consent | The student (export); Poolit | While the account exists | Account deletion |
| Audit log: who changed what, when (personal fields masked as `***`) | `audit_log` | Students, stores, Poolit staff | Accountability, security | Poolit admins only | 180 days | Purged daily; the user id is cleared when an account is deleted |
| Backups | Encrypted off-site bucket | All of the above | Recovery | Holders of the offline key | **[30 days]** | Expire by schedule |

## Processors and places
Supabase (Singapore region): database, sign-in, photo storage. Vercel or Cloudflare: app hosting. [SMS provider] for codes. [Backup storage: Cloudflare R2] for encrypted backups. Planned: Firebase (Android notifications), a payment gateway, an error tracker. Each needs a processing agreement. **[LAWYER]**

## Not collected
Location, contacts, photos of people, device identifiers beyond what sign-in needs, anyone under 18 (declaration to be added at sign-up).

## Rights built into the product
Export: `api_export_my_data()`. Deletion: `api_delete_my_account('DELETE')` (blocked while an order is in progress, and for store or admin accounts). Both are tested in `supabase/tests/70_privacy.sql` and have buttons in the student app's Profile screen.
