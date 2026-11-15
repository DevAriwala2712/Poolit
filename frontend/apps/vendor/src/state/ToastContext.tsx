import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MaterialIcon } from "../components/MaterialIcon";

type Tone = "error" | "success";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  action?: ToastAction;
}

/** A button on the toast, e.g. Undo. Clicking it runs `onClick` and closes the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  notify: (message: string, tone?: Tone, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (message: string, tone: Tone = "error", action?: ToastAction) => {
      const id = ++seq.current;
      // Collapse identical messages (e.g. several failed polls) into one.
      setToasts((t) => [...t.filter((x) => x.message !== message), { id, message, tone, action }].slice(-3));
      // A toast with an action stays long enough to be used.
      window.setTimeout(() => dismiss(id), action ? 8000 : tone === "error" ? 6000 : 3000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Rendered by the Shell. Sits above the mobile tab bar. */
export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg px-3 py-2.5 text-body-md shadow-lg ${
            t.tone === "error" ? "bg-error-container text-on-error-container" : "bg-inverse-surface text-inverse-on-surface"
          }`}
        >
          <button onClick={() => dismiss(t.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <MaterialIcon name={t.tone === "error" ? "error" : "check_circle"} className="mt-px text-[16px]" />
            <span className="flex-1">{t.message}</span>
          </button>
          {t.action && (
            <button
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
              className="-my-1 shrink-0 rounded px-2 py-1 text-label-sm font-semibold underline underline-offset-2"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
