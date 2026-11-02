import { createClient } from "@supabase/supabase-js";

/**
 * Used only for student sign-in (Supabase Auth phone OTP) — never for direct
 * data access; all data goes through the Poolit API. The publishable key is
 * safe to ship client-side. Same project as the vendor console; override via
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
 */
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://icnkzzjnuoyfupaydian.supabase.co";
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  "sb_publishable_jKBN4t_7QlQUxbT0zxMPdw_tH0HpqYr";

export const supabase = createClient(url, publishableKey, {
  auth: { storageKey: "poolit-student-auth" },
});
