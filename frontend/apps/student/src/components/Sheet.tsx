import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Bottom sheet with a soft scrim — used for filters, address, payment. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
      />
      <div className="animate-sheet relative w-full max-w-md rounded-t-[28px] bg-cream pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <p className="text-[17px] font-bold text-ink">{title}</p>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-soft shadow-[var(--shadow-soft)]"
          >
            <Icon name="close" className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
