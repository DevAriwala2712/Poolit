const requireAuth = require("./requireAuth");
const { requireVendorAccess } = require("./requireVendorAccess");
const flags = require("../utils/flags");

/**
 * Order lists contain students' names, blocks and rooms. The old student app
 * read them to find "its" orders; the new one uses GET /me/orders instead.
 * Once STUDENT_LOGIN_REQUIRED=true (i.e. the new student app is live), these
 * lists are vendor-only.
 */
function vendorOnlyWhenStudentLogin(resolveVendorId) {
  const vendorCheck = requireVendorAccess(resolveVendorId);
  return (req, res, next) => {
    if (!flags.studentLoginRequired()) return next();
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      vendorCheck(req, res, next);
    });
  };
}

module.exports = vendorOnlyWhenStudentLogin;
