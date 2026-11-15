# Incident Response Plan (DRAFT, internal)

One page you can follow at 2 a.m. Fill the names in before launch.

## Who
| Role | Person | Phone |
| --- | --- | --- |
| Incident lead (decides, talks to people) | [NAME] | [PHONE] |
| Engineer on call | [NAME] | [PHONE] |
| Back-up for both | [NAME] | [PHONE] |
| Grievance / data protection contact | [NAME] | [PHONE] |

## Severity
| Level | Meaning | First response |
| --- | --- | --- |
| 1 | Personal data exposed, money wrong, or the app down for everyone | Start now, all roles |
| 2 | One feature broken, or one store cannot work | Within 1 hour |
| 3 | Cosmetic, or a workaround exists | Next working day |

## The first 30 minutes
1. **Write down the time and what you saw.** Keep a running note (a shared document).
2. **Stop the damage, then understand it.**
   - Orders wrong or wrongly priced: pause ordering by switching each store to "not accepting orders" (`accepting_orders` = false). Check `idempotency_keys` and `orders` before changing anything.
   - Suspected data exposure: rotate the Supabase keys, sign users out if needed, and turn off the exposed path (revoke the function's permission: `revoke execute on function ... from anon, authenticated`).
   - A bad release: roll back the hosting deployment to the previous one; a bad database change: see the restore steps below.
3. **Tell the lead.** The lead decides who else to tell.

## If data may have been exposed
1. Work out *what* (which fields), *whose* (how many students or stores) and *since when* (use the logs and `orders`/auth tables).
2. Stop it and keep the evidence: do not delete logs.
3. Tell affected people in plain words: what happened, what data, what to do, how to reach us. The Data Protection Board of India and CERT-In have time limits (CERT-In: report within 6 hours of noticing certain incidents). **[LAWYER: confirm the current limits and who files.]**
4. Write the post-mortem within a week.

## Restoring data
Follow [BACKUP_AND_RESTORE.md](../BACKUP_AND_RESTORE.md): decrypt the latest backup with the offline key, restore into a *new* database, run `restore-check.sh`, then switch the app to it. Never restore over the live database without the lead's say-so.

## Communicating
- Students: a banner in the app and a message to the hostel group, short and honest.
- Stores: a call or message to each store owner.
- One person speaks to outsiders (college, press).

## After
Blameless post-mortem: timeline, cause, what worked, what did not, three fixes with owners and dates. Add a test so it cannot happen again unnoticed.
