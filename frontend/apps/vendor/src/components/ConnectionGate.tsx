import { API_URL, useStore } from "@poolit/domain";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Button } from "./ui";

/**
 * Holds the console behind a loading state until the first fetch lands, and
 * surfaces a real error if the backend can't be reached — otherwise an
 * unreachable API just looks like a store with no orders.
 */
export function ConnectionGate({ children }: { children: ReactNode }) {
  const { loading, error, refresh, vendors } = useStore();

  if (loading && vendors.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-accent text-[16px] font-bold text-bg">
          P
        </span>
        <p className="text-[13px] text-muted">Connecting to the Poolit API…</p>
      </div>
    );
  }

  if (error && vendors.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-card p-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-bad/12 text-bad">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-text">Can't reach the API</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{error}</p>
          <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 font-mono text-[11.5px] text-faint">
            {API_URL}
          </p>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            Start it with <code className="text-muted">npm run dev</code> in{" "}
            <code className="text-muted">backend/</code>, and make sure{" "}
            <code className="text-muted">SUPABASE_URL</code> is set in{" "}
            <code className="text-muted">backend/.env</code>.
          </p>
          <Button variant="accent" icon="refresh" className="mt-4" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Reachable but empty — the database hasn't been seeded.
  if (vendors.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-card p-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-warn/12 text-warn">
            <Icon name="box" className="h-5 w-5" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-text">No stores yet</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            The API is reachable but the database is empty. Seed it with{" "}
            <code className="text-text">npm run seed</code> in{" "}
            <code className="text-text">backend/</code>.
          </p>
          <Button variant="accent" icon="refresh" className="mt-4" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
