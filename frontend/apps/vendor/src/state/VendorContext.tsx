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
  const [vendorId, setVendorId] = useState(() => localStorage.getItem(KEY) ?? vendors[0].id);

  useEffect(() => {
    localStorage.setItem(KEY, vendorId);
  }, [vendorId]);

  const value = useMemo<VendorContextValue>(() => {
    const vendor = vendors.find((v) => v.id === vendorId) ?? vendors[0];
    return {
      vendor,
      hostel: hostels.find((h) => h.id === vendor.hostelId),
      allVendors: vendors,
      setVendorId,
    };
  }, [vendors, hostels, vendorId]);

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error("useVendor must be used within VendorProvider");
  return ctx;
}
