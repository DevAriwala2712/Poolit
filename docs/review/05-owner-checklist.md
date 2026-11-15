# 5. Owner checklist

Settings this review could not see. Each stays "unverified" until someone with access
confirms it. Please reply with the actual value for each; several findings change severity
depending on the answer.

## Vercel (backend project → Settings → Environment Variables)

| # | Setting | Should be | Relates to |
| --- | --- | --- | --- |
| V1 | `ENFORCE_VENDOR_SCOPING` | `true` | SEC-16 |
| V2 | `STUDENT_LOGIN_REQUIRED` | `true` once the student build with sign-in is deployed | SEC-16, SEC-14 |
| V3 | `ALLOWED_ORIGINS` | The two app URLs, comma-separated | SEC-16 |
| V4 | `CRON_SECRET` | Unset (the sweep now runs in the database) | Inventory D7 |
| V5 | `VITE_BACKEND` on each frontend project | Which value is deployed today? | ARCH-05 |
| V6 | Which commit each of the three projects is serving | Should be a commit on `main` | ARCH-01 |
| V7 | Plan | Hobby forbids commercial use; move before taking orders | Plan week 3 |
| V8 | Log retention on the current plan | Record the number | SEC-23 |

## Supabase dashboard

| # | Screen | Setting | Should be | Relates to |
| --- | --- | --- | --- | --- |
| A1 | Authentication → Sign In / Providers → Email | "Allow new users to sign up" | Off (store logins are invited) | SEC-17 |
| A2 | Authentication → Sign In / Providers | Anonymous sign-ins | Off | SEC-17 |
| A3 | Authentication → Sign In / Providers → Phone | Enabled; provider; test numbers | No test numbers in production | SEC-17 |
| A4 | Authentication → Rate Limits | OTP and sign-up limits | Set deliberately; record values | SEC-17 |
| A5 | Authentication → Attack Protection | CAPTCHA; leaked-password protection | Both on | SEC-17, SEC-18 |
| A6 | Authentication → Multi-Factor | TOTP | On; enrolled for both store logins | SEC-18 |
| A7 | Authentication → URL Configuration | Site URL and redirect allowlist | Only the two app URLs | Invite flow |
| A8 | Authentication → JWT Keys / Sessions | Asymmetric signing keys; access token lifetime | Record | SEC-18 note |
| P1 | Project Settings → Data API | Exposed schemas | `public` only (not `private`, not `app_policy`) | Inventory |
| P2 | Project Settings → Data API | GraphQL | Off if unused | SEC-13 |
| P3 | Project Settings → Database | Who holds the database password and service-role key | Named people; rotated if ever pasted in chat or a ticket | SEC-15, SEC-20 |
| P4 | Billing | Behaviour at the 500 MB database limit; log retention | Record | SEC-04, SEC-23 |
| P5 | Storage → `product-images` | Public; 200 KB; WebP/JPEG | As migrated (confirmed in the catalog) | SEC-11 |

## GitHub (repository → Settings)

| # | Setting | Should be | Relates to |
| --- | --- | --- | --- |
| G1 | Branches → protection on `main` | Require pull request and passing checks | SEC-20, ARCH-02 |
| G2 | Actions → General → Workflow permissions | Read-only by default | SEC-20 |
| G3 | Secrets | Which exist today; who can read them | SEC-20 |
| G4 | Code security | Secret scanning and push protection on; Dependabot alerts on | SEC-25 |
| G5 | Collaborators | Who has write access | SEC-20 |

## Elsewhere

| # | Item | Question |
| --- | --- | --- |
| O1 | SMS provider | Chosen? DLT sender and template registered? Spend cap set? |
| O2 | Backups | Where is the age private key, and who else could decrypt a backup? |
| O3 | Vendor console | Do store staff use "Advanced mode" and Batch KOT today? (SEC-14 exposure) |
