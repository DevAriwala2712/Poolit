# Legal and policy drafts

**These are drafts for a lawyer and a chartered accountant to review. They are not legal advice and
nothing here has been reviewed by one.** They are written around what the system really does today
(see each document's "facts this relies on"), so the lawyer starts from accurate facts instead of a
blank page. Square brackets mark things only you or your lawyer can fill in: `[COMPANY NAME]`.

| Document | Who it is for | Status |
| --- | --- | --- |
| [TERMS_OF_USE.md](TERMS_OF_USE.md) | Students | Draft |
| [PRIVACY_POLICY.md](PRIVACY_POLICY.md) | Students (includes the sign-up consent wording) | Draft |
| [REFUND_CANCELLATION_DELIVERY.md](REFUND_CANCELLATION_DELIVERY.md) | Students | Draft; some promises need features that do not exist yet (marked) |
| [GRIEVANCE_REDRESSAL.md](GRIEVANCE_REDRESSAL.md) | Students and stores | Draft; needs a named officer |
| [VENDOR_AGREEMENT.md](VENDOR_AGREEMENT.md) | Stores | Draft; commission or fixed charge not decided |
| [INFORMATION_SECURITY_POLICY.md](INFORMATION_SECURITY_POLICY.md) | Internal | Draft, describes real controls and the gaps |
| [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md) | Internal | Draft |
| [DATA_REGISTER.md](DATA_REGISTER.md) | Internal and the lawyer | Facts from the system |
| [COLLEGE_MOU_TEMPLATE.md](COLLEGE_MOU_TEMPLATE.md) | College or hostel administration | Draft |
| [../RUNBOOKS.md](../RUNBOOKS.md) | Engineers | Written from the real system |

## What exists in the product to support these documents

Built and tested: an 18+ declaration is **not yet in the app** (the sign-up consent screen is still to
build); students can **download their data** (`api_export_my_data`) and **delete their account**
(`api_delete_my_account`, orders are kept with the name, room and note removed); cash on delivery
records the cash taken; store commission is stored per store and written to a ledger per delivered
order; retry-safe orders; encrypted off-site backups with a restore check.

## Questions only a lawyer or accountant can settle

1. Is Poolit an "e-commerce entity" and "marketplace e-commerce entity" under the Consumer Protection
   (E-Commerce) Rules, 2020, and what follows for seller disclosures and the grievance officer?
2. GST: registration as an e-commerce operator, whether tax collected at source applies when payment is
   cash on delivery (Poolit does not collect it), GST on the commission, and invoicing the stores.
3. FSSAI: what the platform itself needs as a food e-commerce operator, and whether the stores' licences
   are enough for the items they sell.
4. DPDP Act and Rules: wording of notice and consent, whether Poolit is a data fiduciary or the stores
   are joint fiduciaries, cross-border processing (the database is in Singapore), retention periods.
5. Whether store staff delivering orders on the platform's behalf creates any worker obligations.
6. Whether the Legal Metrology rules need extra fields on listings (the plan already adds MRP, net
   quantity, manufacturer and country of origin).
7. The college MoU: who signs, liability, and any rules the institution already has for deliveries.
