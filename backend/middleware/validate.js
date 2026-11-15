/**
 * validate({ body, params, query }) — checks the request against zod schemas
 * and replaces req.body/params/query with the parsed (trimmed, defaulted,
 * unknown-keys-stripped) values. Failures are a 400 with
 * { code: "validation_failed", message, issues: [{ path, message }] }.
 */
function validate(schemas) {
  return (req, res, next) => {
    const issues = [];
    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        if (part === "query") Object.defineProperty(req, "query", { value: result.data, configurable: true });
        else req[part] = result.data;
      } else {
        for (const i of result.error.issues) {
          issues.push({ path: [part, ...i.path].join("."), message: i.message });
        }
      }
    }
    if (issues.length) {
      const first = issues[0];
      return res.status(400).json({
        code: "validation_failed",
        message: `${first.path.replace(/^(body|params|query)\./, "")}: ${first.message}`,
        issues,
      });
    }
    next();
  };
}

module.exports = { validate };
