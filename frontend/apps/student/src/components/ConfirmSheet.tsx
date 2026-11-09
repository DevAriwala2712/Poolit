import { useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./ui";

/**
 * Asks before something that is hard to undo. With `requireText` the person must type that
 * word (for example DELETE) before the confirm button turns on.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  requireText,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  requireText?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = !requireText || typed === requireText;

  function close() {
    setTyped("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <p className="text-[14px] leading-relaxed text-ink-soft">{message}</p>
      {requireText && (
        <label className="mt-3 block">
          <span className="text-[12px] font-semibold text-ink-soft">Type {requireText} to confirm</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            className="mt-1.5 min-h-[46px] w-full rounded-2xl bg-surface px-4 text-[16px] font-medium text-ink shadow-[var(--shadow-soft)] outline-none focus:ring-2 focus:ring-coral"
          />
        </label>
      )}
      {error && <p className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-[13px] text-coral">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="outline" full onClick={close} disabled={busy}>
          Keep it
        </Button>
        <Button full onClick={onConfirm} disabled={!ready || busy}>
          {busy ? "Please wait…" : confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
