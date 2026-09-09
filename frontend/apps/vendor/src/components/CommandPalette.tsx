import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MaterialIcon } from "./MaterialIcon";
import { Kbd } from "./ui";

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      { id: "dash", label: "Go to Overview", hint: "Dashboard", icon: "dashboard", run: () => navigate("/") },
      { id: "orders", label: "Go to Orders", hint: "Manage live orders", icon: "receipt_long", run: () => navigate("/orders") },
      { id: "inv", label: "Go to Inventory", hint: "Stock and pricing", icon: "inventory_2", run: () => navigate("/inventory") },
      { id: "an", label: "Go to Analytics", hint: "Revenue and peaks", icon: "monitoring", run: () => navigate("/analytics") },
      { id: "set", label: "Go to Settings", hint: "Store preferences", icon: "settings", run: () => navigate("/settings") },
      { id: "low", label: "View low stock", hint: "Items needing restock", icon: "warning", run: () => navigate("/inventory?status=low") },
      { id: "out", label: "View out of stock", hint: "Unavailable to students", icon: "block", run: () => navigate("/inventory?status=out") },
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
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" />
      <div className="animate-palette relative w-full max-w-lg overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0_20px_25px_-5px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-space-sm border-b border-surface-container-high px-space-md py-space-sm">
          <MaterialIcon name="search" className="text-[16px] shrink-0 text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="w-full bg-transparent text-body-lg text-on-surface outline-none placeholder:text-secondary"
          />
          <Kbd>esc</Kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-space-md py-space-lg text-center text-body-md text-secondary">No commands match.</li>
          )}
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  c.run();
                  onClose();
                }}
                className={`flex w-full items-center gap-space-md rounded-lg px-space-md py-space-sm text-left transition ${
                  i === cursor ? "bg-surface-container-low" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                    i === cursor ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-secondary"
                  }`}
                >
                  <MaterialIcon name={c.icon} className="text-[15px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-lg font-medium text-on-surface">{c.label}</span>
                  <span className="block truncate text-body-sm text-secondary">{c.hint}</span>
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
