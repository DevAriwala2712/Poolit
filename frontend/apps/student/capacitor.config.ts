import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android wrapper for the student app: the same web build, shown in a native shell.
 * See docs/ANDROID_APP.md for how to build and sign it (needs the Android SDK and a
 * Google Play developer account; neither is part of this repository).
 */
const config: CapacitorConfig = {
  appId: "app.poolit.student",
  appName: "Poolit",
  webDir: "dist",
  android: {
    // The app talks only to Supabase over https; nothing needs cleartext traffic.
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
