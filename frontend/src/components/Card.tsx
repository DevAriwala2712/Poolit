import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Renders a bordered header strip above the content. */
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  /** Drop the default body padding (for edge-to-edge tables). */
  flush?: boolean;
}

export function Card({ children, className = "", title, subtitle, action, flush }: CardProps) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${className}`}>
      {title && (
        <div className="flex flex-wrap items-center gap-3 border-b border-surface px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-body">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </div>
  );
}
