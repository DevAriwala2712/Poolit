import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ---------------------------------------------------------------- Button */

type Variant = "accent" | "surface" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  accent: "bg-accent text-bg hover:bg-accent-dim",
  surface: "bg-raised text-text ring-1 ring-line hover:bg-[#26262b]",
  ghost: "text-muted hover:bg-raised hover:text-text",
  danger: "bg-bad/12 text-bad ring-1 ring-bad/25 hover:bg-bad/20",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  size?: "sm" | "md";
}

export function Button({
  variant = "surface",
  icon,
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const sizes = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-40 disabled:hover:bg-inherit ${variants[variant]} ${sizes} ${className}`}
    >
      {icon && <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
  flush,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  flush?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-card)] border border-line bg-card ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-faint">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- Badge */

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

const toneClasses: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  info: "bg-info/12 text-info",
  accent: "bg-accent/12 text-accent",
  neutral: "bg-raised text-muted",
};

const dotClasses: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  accent: "bg-accent",
  neutral: "bg-faint",
};

export function Badge({
  tone = "neutral",
  children,
  dot = true,
  live,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  live?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium ${toneClasses[tone]}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]} ${live ? "animate-live" : ""}`} />
      )}
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Kbd key */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-faint">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-faint">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[13.5px] font-semibold text-text">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-faint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} />;
}

/* ------------------------------------------------------------- Data cell */

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-faint ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-[13px] ${className}`}>{children}</td>;
}
