import { api, ApiError } from "@poolit/domain";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../components/LogoMark";
import { Button } from "../components/ui";
import { POLICY_VERSION, rememberConsent } from "../lib/policy";

/**
 * Shown once after sign-in (and again when the policy version changes): the student confirms
 * they are 18 or older and accepts the Terms and Privacy Policy. The acceptance is saved on
 * the server with the version and time, as proof of consent.
 */
export function Consent({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await api.recordConsent(POLICY_VERSION, true);
      rememberConsent(userId);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      <span className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight text-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black p-1.5">
          <LogoMark className="h-full w-full" />
        </span>
        Poolit
      </span>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">Before you order</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Poolit saves your mobile number, name, hostel, block and room, and what you order, so your store can deliver to
          you. Your number is used to sign you in and is never sold. You can download your data or delete your account in
          Profile at any time.
        </p>

        <label className="mt-6 flex items-start gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-soft)]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-coral)]"
          />
          <span className="text-[14px] leading-snug text-ink">
            I am 18 or older, and I agree to the{" "}
            <Link to="/legal/terms" className="font-semibold underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link to="/legal/privacy" className="font-semibold underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && <p className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-[13px] text-coral">{error}</p>}
      </div>

      <Button full onClick={() => void accept()} disabled={!agreed || busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
