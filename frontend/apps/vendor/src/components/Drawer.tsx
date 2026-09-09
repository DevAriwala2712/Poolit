import type { ReactNode } from "react";
import { useEffect } from "react";
import { MaterialIcon } from "./MaterialIcon";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" />
      <aside className="animate-drawer relative flex h-full w-full max-w-[440px] flex-col bg-surface-container-lowest">
        <header className="flex items-start gap-space-md px-space-lg py-space-md shadow-sm">
          <div className="min-w-0 flex-1">
            <h2 className="text-headline-md text-on-surface">{title}</h2>
            {subtitle && <p className="mt-0.5 text-body-sm text-secondary">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-secondary transition hover:bg-surface-container hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-space-lg py-space-md">{children}</div>
        {footer && <footer className="px-space-lg py-space-sm shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">{footer}</footer>}
      </aside>
    </div>
  );
}
