/**
 * Rollout switches, read per request so tests can flip them.
 *
 * ENFORCE_VENDOR_SCOPING — a vendor may only act on stores they're linked to.
 * STUDENT_LOGIN_REQUIRED — placing an order needs a signed-in student, and the
 *   order lists (which include students' names and rooms) become vendor-only.
 *   Turn on together with deploying the student app that has phone login.
 */
const on = (name) => process.env[name] === "true";

module.exports = {
  vendorScoping: () => on("ENFORCE_VENDOR_SCOPING"),
  studentLoginRequired: () => on("STUDENT_LOGIN_REQUIRED"),
};
