import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const KEY = "poolit-vendor-advanced-mode-v1";

interface UIModeContextValue {
  /** false = Basic mode (only core day-to-day actions). true = every panel/feature visible. */
  advancedMode: boolean;
  setAdvancedMode: (v: boolean) => void;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

export function UIModeProvider({ children }: { children: ReactNode }) {
  const [advancedMode, setAdvancedMode] = useState(() => localStorage.getItem(KEY) === "true");

  useEffect(() => {
    localStorage.setItem(KEY, String(advancedMode));
  }, [advancedMode]);

  return (
    <UIModeContext.Provider value={{ advancedMode, setAdvancedMode }}>
      {children}
    </UIModeContext.Provider>
  );
}

export function useUIMode() {
  const ctx = useContext(UIModeContext);
  if (!ctx) throw new Error("useUIMode must be used within UIModeProvider");
  return ctx;
}
