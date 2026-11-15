/**
 * The seed script deletes every row of six tables before inserting demo data.
 * It must never run against a real project by accident (there is no backup to
 * restore from). It runs only when:
 *   - SUPABASE_URL points at this machine (local Supabase: localhost / 127.0.0.1), or
 *   - SEED_CONFIRM_PROJECT is set to the exact project ref in SUPABASE_URL, e.g.
 *     SEED_CONFIRM_PROJECT=abcd1234 for https://abcd1234.supabase.co
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

function checkSeedTarget(supabaseUrl, confirmProject) {
  if (!supabaseUrl) return { ok: false, reason: "SUPABASE_URL is not set." };
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return { ok: false, reason: `SUPABASE_URL is not a valid URL: ${supabaseUrl}` };
  }
  if (LOCAL_HOSTS.has(url.hostname)) return { ok: true, target: `local (${url.host})` };

  const ref = url.hostname.endsWith(".supabase.co") ? url.hostname.split(".")[0] : url.hostname;
  if (confirmProject && confirmProject === ref) return { ok: true, target: `project ${ref} (confirmed)` };

  return {
    ok: false,
    reason:
      `Refusing to seed ${url.hostname}: this deletes every hostel, store, menu item, pool and order there.\n` +
      `Seed a local Supabase instead (npx supabase start), or, if you really mean this project,\n` +
      `run again with SEED_CONFIRM_PROJECT=${ref}`,
  };
}

module.exports = { checkSeedTarget };
