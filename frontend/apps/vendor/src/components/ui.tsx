import type { ButtonHTMLAttributes, ReactNode } from "react";
import { MaterialIcon } from "./MaterialIcon";

/* ---------------------------------------------------------------- Button */

type Variant = "primary" | "surface" | "tertiary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary-container text-on-primary-container hover:opacity-90 shadow-sm",
  surface: "bg-surface-container-highest text-on-surface hover:bg-surface-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container hover:opacity-90 shadow-sm",
  ghost: "text-secondary hover:bg-surface-container hover:text-on-surface",
  danger: "bg-error-container text-on-error-container hover:opacity-90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: string;
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
  const sizes = size === "sm" ? "h-7 px-2.5 text-label-sm" : "h-8 px-3 text-body-md";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-headline-sm transition disabled:opacity-40 disabled:hover:opacity-40 ${variants[variant]} ${sizes} ${className}`}
    >
      {icon && <MaterialIcon name={icon} className="text-[16px] leading-none" />}
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
  icon,
  flush,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-center gap-2 px-4 pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {icon && <MaterialIcon name={icon} className="text-[16px] text-secondary" />}
            <h2 className="text-headline-sm text-on-surface">{title}</h2>
          </div>
          {action}
        </header>
      )}
      {subtitle && <p className="px-4 pt-1 text-body-sm text-secondary">{subtitle}</p>}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- Badge */

export type Tone = "prep" | "ready" | "dispatched" | "delivered" | "error" | "neutral" | "primary";

const toneClasses: Record<Tone, string> = {
  prep: "bg-primary-container/10 text-primary",
  ready: "bg-tertiary-container/10 text-tertiary",
  dispatched: "bg-secondary-container text-on-secondary-container",
  delivered: "bg-surface-container text-secondary",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container text-secondary",
  primary: "bg-primary-container/10 text-primary",
};

const dotClasses: Record<Tone, string> = {
  prep: "bg-primary",
  ready: "bg-tertiary",
  dispatched: "bg-secondary",
  delivered: "bg-secondary",
  error: "bg-error",
  neutral: "bg-secondary",
  primary: "bg-primary",
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
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-label-sm uppercase tracking-wide ${toneClasses[tone]}`}
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
    <kbd className="rounded bg-surface-container px-1.5 py-0.5 text-label-sm text-on-surface-variant">
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
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container text-secondary">
        <MaterialIcon name={icon} className="text-[20px]" />
      </span>
      <p className="mt-3 text-headline-sm text-on-surface">{title}</p>
      <p className="mt-1 max-w-sm text-body-sm text-secondary">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-container ${className}`} />;
}

/* ------------------------------------------------------------- Data cell */

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap bg-surface-container-low px-3 py-2 text-left text-label-sm uppercase tracking-wide text-secondary ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2.5 text-body-md text-on-surface ${className}`}>{children}</td>;
}
