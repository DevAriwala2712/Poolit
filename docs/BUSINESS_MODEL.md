# Poolit — Business Model, Pricing and Earnings Estimate

As of 2 Nov 2026. This document separates what the project has **decided** from what is **still open**, and gives an **illustrative** earnings estimate. The estimate is not from the codebase: every number in the "Illustrative estimate" section is an assumption to be replaced with real figures.

## 1. What Poolit is

Pooled quick-commerce for college hostels. Students in one hostel order inside a shared time window (a "pool"). The more students join, the lower each student's delivery fee gets. Stores (vendors) fulfil the orders; Poolit is the platform.

## 2. What is decided (in the code)

What a student pays on each order (`frontend/packages/domain/src/`, `useBill.ts`):

| Charge | Amount |
| --- | --- |
| Item price | Vendor's menu price |
| Delivery fee | Falls with pool size: 1–2 orders ₹20, 3–5 ₹10, 6–10 ₹5, 11+ free |
| Platform fee | Flat ₹4 per order |
| Tip | Optional: ₹0 / 10 / 20 / 30 |
| Promo | Prototype codes only: `HOSTEL50` (₹50 off), `MIDNIGHT` (₹25 off) |

The delivery fee is calculated from the number of distinct orders in the pool, and is locked onto every order when the pool closes.

Note: `docs/OVERVIEW.md` and the project deck say the ₹5 tier is orders 6–9; the code uses 6–10. The code is what runs.

## 3. What is NOT decided

No document in the repo sets any of the following:

- The commission rate Poolit takes from stores.
- Who keeps the delivery fee and the ₹4 platform fee (Poolit, the store, or whoever delivers).
- Who pays for promo discounts.
- Any revenue forecast, investment figure, ROI or break-even point.
- Who delivers (store staff, Poolit riders, or student runners).
- Cash on delivery vs UPI-only.
- Launch campus and size.

`docs/PRODUCTION_PLAN.md` assumes a **marketplace** model (stores sell, Poolit takes a commission, payments go through a licensed aggregator that pays stores directly), but lists it under "Open questions", not as a decision.

## 4. Known costs (from the production plan)

Approximate and from memory of list prices. Confirm before budgeting.

| Item | Approx. cost |
| --- | --- |
| Supabase Pro (backups later) | $25 a month plus usage |
| Vercel Pro | $20 a month per team member |
| Error tracking, uptime monitoring | Free tiers at this scale |
| SMS login codes (India) | About ₹0.15–0.25 per SMS |
| Payment gateway | About 2% per transaction, often lower for UPI |

The plan's budget line is roughly $45 a month plus usage from Phase 1.

**Not costed anywhere:** company incorporation, GST and FSSAI registration, legal documents, trademark, delivery staff, marketing, developer time.

Tax: as an e-commerce operator Poolit must collect tax at source (GST TCS) on stores' sales. The plan notes the rate was reportedly cut from 1% to 0.5% in July 2024; confirm the current rate with a CA.

## 5. Illustrative estimate (assumptions, not project data)

### Assumptions

| Assumption | Value |
| --- | --- |
| Average basket | ₹250 |
| Commission on item value | 10% |
| Delivery fee revenue | ₹5 average (pool of 6–10 orders) |
| Platform fee | ₹4, kept by Poolit |
| Payment gateway | About 2% of the amount charged |
| Delivery | Done by store staff (no rider cost to Poolit) |
| Fixed costs | About ₹15,000 a month (about ₹4,000 hosting plus allowance for CA, SMS, monitoring, misc.) |
| One-time setup | ₹50,000–1,00,000 (company, registrations, legal documents, trademark) |
| Campus | One campus, 5 hostels, 30 days a month |

### Per order

| Line | ₹ |
| --- | --- |
| Commission (10% of ₹250) | 25 |
| Platform fee | 4 |
| Delivery fee (pool of 6–10) | 5 |
| Payment gateway (about 2%) | −5 |
| **Net per order** | **about 29** |

If Poolit pays riders (about ₹6 per order at 8 orders per trip, also an assumption), net per order falls to about ₹23.

### Monthly earnings, one campus

| Scenario | Orders per hostel per day | Orders per month | Net earnings per month (after ₹15,000 fixed) |
| --- | --- | --- | --- |
| Low | 5 | 750 | about ₹6,750 |
| Base | 10 | 1,500 | about ₹28,500 |
| High | 20 | 3,000 | about ₹72,000 |

- **Break-even:** about 520 orders a month, roughly 17 a day across the campus.
- **Setup payback:** in the base case, about 2–4 months after launch. This excludes developer time. A true ROI needs the actual build cost, which is not recorded anywhere.

## 6. Risks to the numbers

- **The fee ladder erodes income.** Delivery fee revenue goes to ₹0 at 11+ orders, exactly when a pool is doing well. The commission has to carry the business.
- **Commission pushback.** 10% may be too high for campus stores that already sell near MRP.
- **Delivery cost.** If Poolit pays riders, margins fall and gig-worker obligations may apply.
- **Promos.** Discounts such as `HOSTEL50` are a per-student cost that would eat early earnings.
- **Thin base.** One campus depends heavily on hostel size and meal-time habits.

## 7. Decisions needed to make this a real model

1. Average basket size per order.
2. Commission rate (and whether it varies by category).
3. Who delivers, and what it costs.
4. Who keeps the delivery and platform fees.
5. UPI-only or also cash on delivery.
6. First campus: number of hostels, students and stores.
7. Real setup and developer budget, so ROI can be computed.

Once these are answered, replace the assumptions in section 5 and recompute.
