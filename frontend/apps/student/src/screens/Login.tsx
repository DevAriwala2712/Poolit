import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Button } from "../components/ui";
import { formatIndianPhone, toIndianE164 } from "../lib/phone";
import { useAuth } from "../state/AuthContext";
import { ScreenHeader } from "./Cart";

const RESEND_SECONDS = 30;

/** Only allow in-app return paths (no open redirects). */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/**
 * Two steps: Indian mobile number → 6-digit SMS code. Reached from Checkout,
 * Orders and Profile with ?next= so the student lands back where they were.
 */
export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { session, sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  if (session) return <Navigate to={next} replace />;

  async function requestCode() {
    const phone = toIndianE164(phoneInput);
    if (!phone) {
      setError("Enter a 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await sendOtp(phone);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setE164(phone);
    setCode("");
    setStep("code");
    setResendIn(RESEND_SECONDS);
  }

  async function submitCode(value = code) {
    if (!e164 || value.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: err } = await verifyOtp(e164, value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <div className="min-h-screen pb-10">
      <ScreenHeader
        title="Sign in"
        onBack={() => (step === "code" ? (setStep("phone"), setError(null)) : navigate(-1))}
      />

      <div className="px-5 pt-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-soft text-[#4c6b04]">
          <Icon name="phone" className="h-6 w-6" strokeWidth={2.1} />
        </span>

        {step === "phone" ? (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void requestCode();
            }}
          >
            <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-ink">
              Your mobile number
            </h2>
            <p className="mt-1.5 text-body leading-relaxed text-ink-soft">
              We'll text you a 6-digit code. Your number is only used to sign you in and to reach you about an order.
            </p>

            <label className="mt-6 flex min-h-[56px] items-center gap-2 rounded-2xl bg-surface px-4 shadow-[var(--shadow-soft)] focus-within:ring-2 focus-within:ring-lime">
              <span className="text-input font-semibold text-ink">+91</span>
              <span className="h-5 w-px bg-line" />
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                aria-label="Mobile number"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))}
                placeholder="98765 43210"
                className="min-w-0 flex-1 bg-transparent text-input font-semibold tracking-wide text-ink outline-none placeholder:font-medium placeholder:text-ink-faint"
              />
            </label>

            {error && <p className="mt-3 text-body-sm font-medium text-coral">{error}</p>}

            <Button full type="submit" className="mt-6" disabled={busy || phoneInput.replace(/\D/g, "").length < 10}>
              {busy ? "Sending code…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-ink">Enter the code</h2>
            <p className="mt-1.5 text-body leading-relaxed text-ink-soft">
              Sent to <span className="font-semibold text-ink">{formatIndianPhone(e164)}</span>.{" "}
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
                className="font-semibold text-ink underline underline-offset-2"
              >
                Change
              </button>
            </p>

            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="6-digit code"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) void submitCode(v);
              }}
              placeholder="••••••"
              className="mt-6 min-h-[56px] w-full rounded-2xl bg-surface px-4 text-center text-[24px] font-extrabold tracking-[0.5em] text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-lime"
            />

            {error && <p className="mt-3 text-body-sm font-medium text-coral">{error}</p>}

            <Button full type="submit" className="mt-6" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Verify and continue"}
            </Button>

            <button
              type="button"
              disabled={resendIn > 0 || busy}
              onClick={() => void requestCode()}
              className="mt-4 w-full text-center text-body-sm font-semibold text-ink-soft disabled:opacity-50"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
