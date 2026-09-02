import { useState, type FormEvent } from "react";
import { Button } from "../components/ui";
import { useAuth } from "../state/AuthContext";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-card p-6"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-[16px] font-bold text-bg">
          P
        </span>
        <h1 className="mt-3 text-[16px] font-semibold text-text">Vendor console</h1>
        <p className="mt-1 text-[12.5px] text-faint">Sign in to manage your store.</p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-faint">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-faint">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-[13px] text-text outline-none focus:border-accent"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[12px] text-bad">{error}</p>}

        <Button
          type="submit"
          variant="accent"
          disabled={submitting}
          className="mt-5 w-full justify-center"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
