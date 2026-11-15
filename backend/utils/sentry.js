/**
 * Error tracking. A no-op unless SENTRY_DSN is set, so local runs and tests
 * never send anything. Request bodies, cookies and auth headers are stripped:
 * they contain names, rooms and tokens.
 */
let Sentry = null;

function initSentry() {
  if (Sentry || !process.env.SENTRY_DSN) return Sentry;
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
  return Sentry;
}

/** Report a server error with its request id; resolves once flushed (serverless-safe). */
async function captureServerError(err, req) {
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTag("requestId", req.id);
    scope.setTag("route", `${req.method} ${req.route?.path || req.path}`);
    if (req.user?.id) scope.setUser({ id: req.user.id });
    Sentry.captureException(err);
  });
  await Sentry.flush(2000).catch(() => {});
}

module.exports = { initSentry, captureServerError };
