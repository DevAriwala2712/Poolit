import { API_URL, useStore } from "@poolit/domain";
import type { ReactNode } from "react";
import { LogoMark } from "./LogoMark";
import { Button } from "./ui";

/**
 * Holds the app behind a branded loading state until the first fetch lands,
 * and surfaces a real error if the backend can't be reached — otherwise an
 * unreachable API just looks like an empty store.
 */
export function ConnectionGate({ children }: { children: ReactNode }) {
  const { loading, error, refresh, vendors } = useStore();

  if (loading && vendors.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-8">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-black p-3">
          <LogoMark className="h-full w-full" />
        </div>
        <p className="text-[14px] font-semibold text-ink-soft">Loading your hostel store…</p>
      </div>
    );
  }

  if (error && vendors.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-coral-soft text-4xl">
          📡
        </div>
        <p className="mt-1 text-[18px] font-bold text-ink">Can't reach Poolit</p>
        <p className="max-w-[20rem] text-[13.5px] leading-relaxed text-ink-soft">{error}</p>
        <p className="text-[11.5px] text-ink-faint">
          API: <span className="font-mono">{API_URL}</span>
        </p>
        <Button className="mt-3" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  // Reachable but empty — the database hasn't been seeded.
  if (vendors.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-deep text-4xl">
          🏪
        </div>
        <p className="mt-1 text-[18px] font-bold text-ink">No stores yet</p>
        <p className="max-w-[20rem] text-[13.5px] leading-relaxed text-ink-soft">
          The server is up but has no data. Seed it with{" "}
          <span className="font-mono text-[12.5px]">npm run seed</span> in the backend.
        </p>
        <Button className="mt-3" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
