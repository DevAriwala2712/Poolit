import { createClient } from "@supabase/supabase-js";

/**
 * Used only for vendor login (Supabase Auth) — never for direct data access.
 * The publishable/anon key is safe to ship client-side; override via
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in a .env for a different project.
 */
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://icnkzzjnuoyfupaydian.supabase.co";
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  "sb_publishable_jKBN4t_7QlQUxbT0zxMPdw_tH0HpqYr";

export const supabase = createClient(url, publishableKey);
