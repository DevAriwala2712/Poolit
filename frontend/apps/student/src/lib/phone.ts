/** Indian mobile numbers: 10 digits starting 6–9. Returns E.164 or null. */
export function toIndianE164(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" → "+91 98765 43210" */
export function formatIndianPhone(e164: string | null | undefined): string {
  const m = e164?.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : (e164 ?? "");
}

/** Turn Supabase Auth errors into something a student can act on. */
export function otpErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("seconds")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) {
    return "That code is wrong or has expired. Check it, or send a new one.";
  }
  if (m.includes("provider") || m.includes("unsupported") || m.includes("disabled") || m.includes("sms")) {
    return "Phone sign-in isn't available right now. Please try again later.";
  }
  return message || "Something went wrong. Please try again.";
}
