const { captureServerError } = require("./sentry");

/** Log a handled-but-unexpected error as one JSON line and send it to Sentry (if configured). */
function reportError(err, req) {
  console.error(JSON.stringify({ level: "error", msg: err?.message || String(err), requestId: req?.id, path: req?.originalUrl?.split("?")[0], stack: err?.stack }));
  if (req) captureServerError(err, req).catch(() => {});
}

module.exports = { reportError };
