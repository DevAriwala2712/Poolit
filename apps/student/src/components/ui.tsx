import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "lime" | "ghost" | "outline";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-coral text-white shadow-[var(--shadow-cta)] active:scale-[0.98]",
  lime: "bg-lime text-ink active:scale-[0.98]",
  ghost: "bg-transparent text-ink-soft active:bg-cream-deep",
  outline: "bg-surface text-ink ring-1 ring-line active:bg-cream-deep",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  full?: boolean;
  icon?: IconName;
}

export function Button({
  variant = "primary",
  full,
  icon,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition disabled:opacity-40 disabled:active:scale-100 ${buttonVariants[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {icon && <Icon name={icon} className="h-[18px] w-[18px]" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)] ${onClick ? "w-full text-left transition active:scale-[0.99]" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ Chip */

export function Chip({
  active,
  children,
  onClick,
  icon,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95 ${
        active
          ? "bg-ink text-cream"
          : "bg-surface text-ink-soft shadow-[var(--shadow-soft)]"
      }`}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */

export function Badge({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: "lime" | "coral" | "sun" | "neutral";
}) {
  const tones = {
    lime: "bg-lime-soft text-[#4c6b04]",
    coral: "bg-coral-soft text-coral",
    sun: "bg-sun-soft text-[#8a6d02]",
    neutral: "bg-cream-deep text-ink-soft",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- VegDot */

export function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "#3f9142" : "#c2410c";
  return (
    <span
      title={isVeg ? "Veg" : "Non-veg"}
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
      style={{ borderColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/* -------------------------------------------------------------- Sections */

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
      <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[13px] font-semibold text-coral">
          {action}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-card)] bg-surface p-2.5 shadow-[var(--shadow-soft)]">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-2.5 h-3.5 w-4/5" />
          <Skeleton className="mt-1.5 h-3 w-2/5" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  art,
  title,
  body,
  action,
  onAction,
}: {
  art: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-deep text-4xl">
        {art}
      </div>
      <p className="mt-4 text-[17px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{body}</p>
      {action && (
        <Button variant="lime" className="mt-5" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Rating */

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
      <Icon name="star" filled className="h-3 w-3 text-sun" strokeWidth={0} />
      {value.toFixed(1)}
      {count !== undefined && <span className="text-ink-faint">({count > 999 ? `${(count / 1000).toFixed(1)}k` : count})</span>}
    </span>
  );
}
