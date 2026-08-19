import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../components/Icon";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "info";
}

const ToastContext = createContext<((message: string, tone?: Toast["tone"]) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-rise flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[13px] font-semibold text-cream shadow-[var(--shadow-lift)]"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                t.tone === "success" ? "bg-lime text-ink" : "bg-cream/20 text-cream"
              }`}
            >
              <Icon name={t.tone === "success" ? "check" : "sparkle"} className="h-3 w-3" strokeWidth={3} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
