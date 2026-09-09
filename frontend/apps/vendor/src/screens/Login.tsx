import { useState, type FormEvent } from "react";
import { LogoMark } from "../components/LogoMark";
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
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-surface-container-lowest p-6 shadow-sm"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#141A2C] p-2">
          <LogoMark className="h-full w-full" />
        </span>
        <h1 className="mt-3 text-headline-md text-on-surface">Vendor console</h1>
        <p className="mt-1 text-body-md text-secondary">Sign in to manage your store.</p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-label-sm uppercase tracking-wide text-secondary">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low px-3 py-2 text-body-lg text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-label-sm uppercase tracking-wide text-secondary">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low px-3 py-2 text-body-lg text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-body-sm text-error">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="mt-5 w-full justify-center"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
