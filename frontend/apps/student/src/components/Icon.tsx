export type IconName =
  | "home" | "grid" | "cart" | "receipt" | "user" | "search" | "mic"
  | "pin" | "chevronRight" | "chevronLeft" | "chevronDown" | "star" | "clock"
  | "plus" | "minus" | "filter" | "check" | "heart" | "wallet" | "phone"
  | "chat" | "close" | "sparkle" | "tag" | "arrowRight" | "bolt" | "shield"
  | "users" | "package";

const P: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  cart: "M3 4h2l2.5 12h11L21 8H6M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  receipt: "M6 2v20l3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2ZM9 9h6M9 13h4",
  user: "M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3ZM19 11a7 7 0 0 1-14 0M12 18v4M8 22h8",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  chevronRight: "M9 18l6-6-6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronDown: "M6 9l6 6 6-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6.5V12l3.5 2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  check: "M20 6L9 17l-5-5",
  heart: "M12 20s-7.5-4.6-9.3-9A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.3 4.4C19.5 15.4 12 20 12 20Z",
  wallet: "M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M17 14h.01",
  phone: "M21 16.9v2.6a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-16.6-16.6A2 2 0 0 1 4.2 2.7h2.6a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 10.4a16 16 0 0 0 5.6 5.6l1.1-1.1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  chat: "M21 11.5a8 8 0 0 1-11.9 7L3 20.5l2-6.1A8 8 0 1 1 21 11.5Z",
  close: "M18 6 6 18M6 6l12 12",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  tag: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z",
  arrowRight: "M5 12h14M13 5l7 7-7 7",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  users: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  package: "M21 8l-9-5-9 5 9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8",
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.9,
  filled = false,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={P[name]} />
    </svg>
  );
}
