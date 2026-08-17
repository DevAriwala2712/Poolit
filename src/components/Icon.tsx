export type IconName =
  | "grid"
  | "box"
  | "activity"
  | "receipt"
  | "wallet"
  | "alert"
  | "chevronRight"
  | "logout"
  | "search"
  | "calendar"
  | "download"
  | "clock"
  | "trendUp"
  | "trendDown"
  | "store"
  | "list";

const PATHS: Record<IconName, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  receipt: "M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2zM9 8h6M9 12h6",
  wallet: "M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M17 14h.01",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  chevronRight: "M9 18l6-6-6-6",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  clock: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  trendUp: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  trendDown: "M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6",
  store: "M3 9l1.5-5h15L21 9M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18M9 21v-6h6v6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

interface IconProps {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
