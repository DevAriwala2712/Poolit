import { useStore } from "@poolit/domain";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const KEY = "poolit-vendor-active-v1";

interface VendorContextValue {
  vendor: ReturnType<typeof useStore>["vendors"][number];
  hostel: ReturnType<typeof useStore>["hostels"][number] | undefined;
  allVendors: ReturnType<typeof useStore>["vendors"];
  setVendorId: (id: string) => void;
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({ children }: { children: ReactNode }) {
  const { vendors, hostels } = useStore();
  const [vendorId, setVendorId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? vendors[0]?.id ?? "";
    } catch {
      return vendors[0]?.id ?? "";
    }
  });

  useEffect(() => {
    try {
      if (vendorId) localStorage.setItem(KEY, vendorId);
    } catch {
      // private mode / storage disabled — the choice just won't persist
    }
  }, [vendorId]);

  const value = useMemo<VendorContextValue | null>(() => {
    const vendor = vendors.find((v) => v.id === vendorId) ?? vendors[0];
    if (!vendor) return null;
    return {
      vendor,
      hostel: hostels.find((h) => h.id === vendor.hostelId),
      allVendors: vendors,
      setVendorId,
    };
  }, [vendors, hostels, vendorId]);

  // An API that returns zero stores is a real (if odd) state — e.g. a fresh
  // database before seeding. Say so instead of crashing on vendors[0].
  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center">
        <div>
          <p className="text-headline-md text-on-surface">No stores yet</p>
          <p className="mt-1 text-body-md text-secondary">
            The API is reachable but has no vendors. Seed the database (<code>npm run seed</code> in backend/) or create a store.
          </p>
        </div>
      </div>
    );
  }

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error("useVendor must be used within VendorProvider");
  return ctx;
}
