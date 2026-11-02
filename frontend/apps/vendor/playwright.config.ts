import { defineConfig, devices } from "@playwright/test";

// Smoke tests run the real vendor console against a mocked API + Supabase Auth
// (see e2e/mockApi.ts), so they need no backend and no secrets.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5174",
    ...devices["Pixel 7"],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_URL: "http://api.test",
      VITE_SUPABASE_URL: "http://supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    },
  },
});
