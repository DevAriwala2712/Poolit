import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Kbd } from "./ui";

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      { id: "dash", label: "Go to Dashboard", hint: "Overview", icon: "dashboard", run: () => navigate("/") },
      { id: "orders", label: "Go to Orders", hint: "Manage live orders", icon: "orders", run: () => navigate("/orders") },
      { id: "inv", label: "Go to Inventory", hint: "Stock and pricing", icon: "inventory", run: () => navigate("/inventory") },
      { id: "an", label: "Go to Analytics", hint: "Revenue and peaks", icon: "analytics", run: () => navigate("/analytics") },
      { id: "set", label: "Go to Settings", hint: "Store preferences", icon: "settings", run: () => navigate("/settings") },
      { id: "low", label: "View low stock", hint: "Items needing restock", icon: "alert", run: () => navigate("/inventory?status=low") },
      { id: "out", label: "View out of stock", hint: "Unavailable to students", icon: "box", run: () => navigate("/inventory?status=out") },
    ],
    [navigate],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && results[cursor]) {
        e.preventDefault();
        results[cursor].run();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-black/60" />
      <div className="animate-palette relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Icon name="search" className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="w-full bg-transparent text-[14px] text-text outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[12.5px] text-faint">No commands match.</li>
          )}
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  c.run();
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  i === cursor ? "bg-raised" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    i === cursor ? "bg-accent text-bg" : "bg-raised text-muted"
                  }`}
                >
                  <Icon name={c.icon} className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-text">{c.label}</span>
                  <span className="block truncate text-[11.5px] text-faint">{c.hint}</span>
                </span>
                {i === cursor && <Kbd>↵</Kbd>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
