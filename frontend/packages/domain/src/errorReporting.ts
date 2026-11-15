import { api, ApiError, BACKEND } from "./api";

type App = "student" | "vendor";

/** At most this many different errors are sent from one page load, so a loop cannot flood the server. */
const MAX_PER_PAGE_LOAD = 10;

let installed: App | null = null;
const sent = new Set<string>();

/**
 * Send one crash to Poolit (api_report_error). Safe to call from anywhere: it never throws,
 * sends nothing on the old backend, sends each distinct message once per page load, and keeps
 * only what is useful: the message, the stack, the page (the server drops the query string) and
 * the browser. No names, numbers or rooms are ever included.
 */
export function reportError(error: unknown, app: App | null = installed): void {
  try {
    if (BACKEND !== "supabase" || !app) return;
    // Problems the person already saw and can fix (wrong input, not signed in, sold out) are not crashes.
    if (error instanceof ApiError && error.status > 0 && error.status < 500) return;
    const e = error as { message?: unknown; stack?: unknown } | string | null | undefined;
    const message = typeof e === "string" ? e : typeof e?.message === "string" && e.message ? e.message : "Unknown error";
    if (sent.has(message) || sent.size >= MAX_PER_PAGE_LOAD) return;
    sent.add(message);
    const stack = typeof e === "object" && e && typeof e.stack === "string" ? e.stack : undefined;
    void api.reportError(app, message, stack, location.pathname, navigator.userAgent).catch(() => undefined);
  } catch {
    /* reporting must never cause a second problem */
  }
}

/** Report uncaught errors and unhandled promise rejections for the whole app. Call once at startup. */
export function installErrorReporting(app: App): void {
  if (typeof window === "undefined" || installed) return;
  installed = app;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, app));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, app));
}

/** For tests: forget what has been sent. */
export function resetErrorReporting(): void {
  installed = null;
  sent.clear();
}
