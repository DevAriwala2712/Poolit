/**
 * The version of the Terms of Use and Privacy Policy a student agrees to. Bump it when either
 * text changes in a way students must accept again; the consent screen then shows once more.
 */
export const POLICY_VERSION = "2026-11";

const key = (userId: string) => `poolit-consent:${userId}`;

/** Whether this device already recorded consent to the current version for this account. */
export function hasConsented(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === POLICY_VERSION;
  } catch {
    return false;
  }
}

export function rememberConsent(userId: string) {
  try {
    localStorage.setItem(key(userId), POLICY_VERSION);
  } catch {
    /* private mode: the server still has the record, we will just ask the server again */
  }
}
