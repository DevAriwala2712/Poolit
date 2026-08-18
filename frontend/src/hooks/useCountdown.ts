import { useEffect, useState } from "react";

export function useCountdown(targetMs: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    remainingMs,
    label: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    expired: remainingMs <= 0,
  };
}
