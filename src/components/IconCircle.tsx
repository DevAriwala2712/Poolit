import type { ReactNode } from "react";

interface IconCircleProps {
  children: ReactNode;
  tone?: "secondary" | "accent";
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-sm",
  md: "h-11 w-11 text-lg",
  lg: "h-16 w-16 text-2xl",
};

const toneClasses = {
  secondary: "bg-secondary",
  accent: "bg-accent",
};

export function IconCircle({ children, tone = "secondary", size = "md" }: IconCircleProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white ${toneClasses[tone]} ${sizeClasses[size]}`}
    >
      {children}
    </div>
  );
}
