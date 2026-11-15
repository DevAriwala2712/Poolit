/**
 * Error tracking. Does nothing (and ships no Sentry code) unless
 * VITE_SENTRY_DSN is set at build time. Breadcrumb text and URLs can contain
 * names/rooms, so only the error itself, release and route are sent.
 */
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  void import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_RELEASE as string | undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // Expected API failures are already shown to the user (toast / inline).
      beforeSend: (event, hint) =>
        (hint.originalException as { name?: string } | null)?.name === "ApiError" ? null : event,
    });
    Sentry.setTag("app", "student");
  });
}
