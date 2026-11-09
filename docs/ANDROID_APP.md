# Android app (student)

The student web app wrapped in a native shell with Capacitor. Same code, same backend; the shell adds
an installable app, the Play Store listing, and (later) push notifications.

## What exists
- `frontend/apps/student/capacitor.config.ts` (app id `app.poolit.student`, name "Poolit", https only).
- `frontend/apps/student/android/`: the generated Android project (Capacitor 8). Web assets are copied
  into it at sync time and are not committed.

## What has NOT been done or tested
- **It has never been built.** The environment this was prepared in has no Android SDK, so there is no
  APK or AAB, and nothing has been run on a phone or emulator.
- No app icon or splash screen beyond Capacitor's defaults; no signing key; no Play listing.
- Push notifications (Firebase) are not set up.
- The phone-number sign-in has only been tested in a desktop browser. SMS auto-fill and the Android back
  button are untested in the native shell.

## To build it (on a computer with Android Studio)
1. Install Node 22 and Android Studio (it brings the Android SDK and a JDK).
2. From `frontend/`: `npm install`.
3. Set the production values and build the web app into the shell:
   ```bash
   cd frontend/apps/student
   VITE_BACKEND=supabase VITE_SUPABASE_URL=<project url> VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key> npm run android:sync
   ```
4. `npm run android:open`, then in Android Studio: Build, Generate Signed Bundle / APK.
5. Test on a real phone first: sign in with an SMS code, place a cash order, cancel it, open Profile.

## For the Play Store
- A Google Play developer account (one-time fee; a new personal account may need a closed test with
  several testers for a fixed number of days before production: check the current rule).
- A privacy policy URL and the Data safety form: the facts are in `docs/legal/DATA_REGISTER.md`.
- Content rating, target audience 18+ (the app already asks students to confirm they are 18 or older).
- Keep the signing key and its password offline and backed up; losing it means a new app listing.

## Known gaps to fix before release
- App icon and splash screen.
- Hardware back button should go back inside the app before closing it.
- Status bar colour and safe-area spacing on notched phones.
