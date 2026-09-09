import { API_URL, useStore } from "@poolit/domain";
import type { ReactNode } from "react";
import { LogoMark } from "./LogoMark";
import { MaterialIcon } from "./MaterialIcon";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-[#141A2C] p-2">
          <LogoMark className="h-full w-full" />
        </span>
        <p className="text-body-md text-secondary">Connecting to the Poolit API…</p>
      </div>
    );
  }

  if (error && vendors.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="w-full max-w-md rounded-lg bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-error-container text-error">
            <MaterialIcon name="warning" className="text-[20px]" />
          </span>
          <p className="mt-3 text-headline-md text-on-surface">Can't reach the API</p>
          <p className="mt-1.5 text-body-md text-secondary">{error}</p>
          <p className="mt-3 rounded-lg bg-surface-container px-3 py-2 text-label-sm text-on-surface-variant">
            {API_URL}
          </p>
          <p className="mt-3 text-body-sm text-secondary">
            Start it with <code className="text-on-surface">npm run dev</code> in{" "}
            <code className="text-on-surface">backend/</code>, and make sure{" "}
            <code className="text-on-surface">SUPABASE_URL</code> is set in{" "}
            <code className="text-on-surface">backend/.env</code>.
          </p>
          <Button variant="primary" icon="refresh" className="mt-4" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Reachable but empty — the database hasn't been seeded.
  if (vendors.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="w-full max-w-md rounded-lg bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/10 text-primary">
            <MaterialIcon name="inventory_2" className="text-[20px]" />
          </span>
          <p className="mt-3 text-headline-md text-on-surface">No stores yet</p>
          <p className="mt-1.5 text-body-md text-secondary">
            The API is reachable but the database is empty. Seed it with{" "}
            <code className="text-on-surface">npm run seed</code> in{" "}
            <code className="text-on-surface">backend/</code>.
          </p>
          <Button variant="primary" icon="refresh" className="mt-4" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
