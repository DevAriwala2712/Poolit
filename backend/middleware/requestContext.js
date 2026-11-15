const crypto = require("crypto");

const CODES = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "payload_too_large",
  422: "unprocessable",
  429: "rate_limited",
  500: "internal_error",
  503: "service_unavailable",
};

/**
 * Gives every request an id (honouring a sane inbound X-Request-Id), echoes it
 * in the response, writes one structured JSON log line per request, and makes
 * every error response carry a stable machine-readable `code` next to the
 * existing human `message`, so clients can branch on `code` and support can
 * quote `requestId`.
 */
function requestContext({ log = (line) => console.log(JSON.stringify(line)), now = () => Date.now() } = {}) {
  return (req, res, next) => {
    const inbound = req.headers["x-request-id"];
    const id = typeof inbound === "string" && /^[\w.-]{8,64}$/.test(inbound) ? inbound : crypto.randomUUID();
    req.id = id;
    res.setHeader("X-Request-Id", id);

    const started = now();
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 400 && body && typeof body === "object" && !Array.isArray(body)) {
        body = { code: CODES[res.statusCode] || (res.statusCode >= 500 ? "internal_error" : "error"), ...body, requestId: id };
      }
      return json(body);
    };

    res.on("finish", () => {
      log({
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        msg: "request",
        requestId: id,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        ms: now() - started,
        userId: req.user?.id,
        ip: req.ip,
      });
    });
    next();
  };
}

module.exports = { requestContext, CODES };
