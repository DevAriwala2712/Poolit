/**
 * Escapes text for use inside HTML that is built as a string (print windows).
 * Every value that comes from a student, a store or the database must go through
 * this: a print window opened by the console shares its origin, so script in it
 * can read the store's login session.
 */
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
