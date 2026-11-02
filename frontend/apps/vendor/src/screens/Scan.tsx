import { rupees, useStore } from "@poolit/domain";
import type { MenuItem, StockAdjustmentReason } from "@poolit/domain";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button } from "../components/ui";
import { useBarcodeScanner, useKeyboardWedge } from "../hooks/useBarcodeScanner";
import type { ScanHit } from "../hooks/useBarcodeScanner";
import { scanFeedback } from "../lib/scanner";
import { useVendor } from "../state/VendorContext";

interface ScopedItem {
  item: MenuItem;
  vendorName: string;
  vendorId: string;
}

interface LogEntry {
  id: number;
  code: string;
  label: string;
  amount?: number;
  ok: boolean;
}

const QUICK = [1, 5, 10, 25];
type Mode = "add" | "set" | "remove";
const MODES: { key: Mode; label: string }[] = [
  { key: "add", label: "Add stock" },
  { key: "set", label: "Set count" },
  { key: "remove", label: "Remove" },
];
const REMOVE_REASONS: { key: StockAdjustmentReason; label: string }[] = [
  { key: "damaged", label: "Damaged" },
  { key: "expired", label: "Expired" },
  { key: "other", label: "Other" },
];

/**
 * Dedicated, full-screen barcode scanner — built for a phone held in one hand
 * at the stock shelf.
 *
 *   scan → item card slides up → tap +N → camera resumes for the next item
 *
 * Unknown codes can be linked to an existing item in two taps. Works with the
 * phone camera (native BarcodeDetector or the bundled WASM decoder), a
 * USB/Bluetooth handheld scanner, or typed digits.
 */
export function Scan() {
  const navigate = useNavigate();
  const { vendor, allVendors } = useVendor();
  const { restockItem, setItemBarcode, adjustStock } = useStore();

  const [code, setCode] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [chosenVendorId, setChosenVendorId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [autoResume, setAutoResume] = useState(true);
  const [mode, setMode] = useState<Mode>("add");
  const [removeReason, setRemoveReason] = useState<StockAdjustmentReason>("damaged");

  const allItems = useMemo<ScopedItem[]>(
    () => allVendors.flatMap((v) => v.menu.map((item) => ({ item, vendorName: v.name, vendorId: v.id }))),
    [allVendors],
  );

  // Barcodes are unique per store, not globally — the same EAN can live in
  // several stores. Prefer the active store; let the vendor pick otherwise.
  const matches = useMemo(
    () => (code ? allItems.filter(({ item }) => item.barcode === code) : []),
    [code, allItems],
  );
  const match = useMemo(() => {
    if (matches.length === 0) return undefined;
    return (
      matches.find((m) => m.vendorId === (chosenVendorId ?? vendor.id)) ??
      (matches.length === 1 ? matches[0] : undefined)
    );
  }, [matches, chosenVendorId, vendor.id]);

  const assignCandidates = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    return vendor.menu
      .filter((item) => !item.barcode && (!q || item.name.toLowerCase().includes(q)))
      .concat(vendor.menu.filter((item) => item.barcode && (!q || item.name.toLowerCase().includes(q))))
      .slice(0, 30);
  }, [vendor.menu, assignQuery]);

  const handleCode = useCallback(
    (hit: ScanHit | string) => {
      const value = (typeof hit === "string" ? hit : hit.code).trim();
      if (!value) return;
      scanFeedback();
      setCode(value);
      setError(null);
      setQty("");
      setAssignQuery("");
      setAssignTarget(null);
      setChosenVendorId(null);
    },
    [],
  );

  const scanner = useBarcodeScanner({ onDetect: handleCode, paused: code !== null });
  useKeyboardWedge(handleCode);

  useEffect(() => {
    void scanner.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushLog = (entry: Omit<LogEntry, "id">) =>
    setLog((prev) => [{ ...entry, id: Date.now() + Math.random() }, ...prev].slice(0, 50));

  function next() {
    setCode(null);
    setError(null);
    setManual("");
    scanner.resetRepeat();
  }

  async function restock(amount: number) {
    if (!match || busy) return;
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) {
      setError("Enter a whole number between 1 and 10,000.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await restockItem(match.vendorId, match.item.id, amount);
      pushLog({ code: code!, label: match.item.name, amount, ok: true });
      if (autoResume) {
        next();
      } else {
        setQty("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restock failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function adjust(kind: "set" | "remove", amount: number) {
    if (!match || busy) return;
    if (!Number.isInteger(amount) || amount < (kind === "remove" ? 1 : 0) || amount > 100000) {
      setError(kind === "set" ? "Enter the number you counted (0 or more)." : "Enter how many to remove (1 or more).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adjustStock(match.item.id, kind === "set" ? { mode: "set", qty: amount, reason: "count" } : { mode: "remove", qty: amount, reason: removeReason });
      pushLog({
        code: code!,
        label: kind === "set" ? `${match.item.name}: counted ${amount}` : `${match.item.name}: removed (${removeReason})`,
        amount: kind === "set" ? amount - match.item.stockQty : -amount,
        ok: true,
      });
      if (autoResume) next();
      else setQty("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the stock — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!code || !assignTarget || busy) return;
    const target = vendor.menu.find((m) => m.id === assignTarget);
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await setItemBarcode(vendor.id, target.id, code);
      pushLog({ code, label: `Linked to ${target.name}`, ok: true });
      setChosenVendorId(vendor.id);
      // Stay on this code: the card now shows the matched item, ready to restock.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't link the barcode.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    scanner.stop();
    if (window.history.length > 1) navigate(-1);
    else navigate("/inventory", { replace: true });
  }

  const totalUnits = log.reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      {/* Camera */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={scanner.videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Reticle — matches the decode region in useBarcodeScanner */}
        {scanner.status === "live" && !code && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[50%] max-h-56 w-[84%] max-w-md rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              <span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-white" />
              <span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-white" />
              <span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-white" />
              <span className="animate-scanline absolute inset-x-4 h-0.5 rounded bg-primary-fixed-dim shadow-[0_0_12px_2px_rgba(255,181,153,0.8)]" />
            </div>
          </div>
        )}

        {scanner.status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            {scanner.status === "error" ? (
              <>
                <MaterialIcon name="no_photography" className="text-[40px] text-white/70" />
                <p className="max-w-xs text-body-lg text-white/90">{scanner.error}</p>
                <Button variant="primary" onClick={() => void scanner.start()}>
                  Retry
                </Button>
              </>
            ) : (
              <>
                <MaterialIcon name="photo_camera" className="animate-pulse text-[40px] text-white/70" />
                <p className="text-body-lg text-white/80">Starting camera…</p>
              </>
            )}
          </div>
        )}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(env(safe-area-inset-top),12px)]">
          <IconButton icon="arrow_back" label="Close scanner" onClick={close} />
          <div className="min-w-0 flex-1">
            <p className="text-headline-sm leading-tight">Scan stock</p>
            <p className="truncate text-label-sm text-white/70">
              {vendor.name}
              {scanner.engine === "wasm" && " · compatibility decoder"}
            </p>
          </div>
          {scanner.torchSupported && (
            <IconButton
              icon={scanner.torchOn ? "flashlight_off" : "flashlight_on"}
              label="Toggle flashlight"
              onClick={() => void scanner.toggleTorch()}
              active={scanner.torchOn}
            />
          )}
          {scanner.canSwitchCamera && (
            <IconButton icon="cameraswitch" label="Switch camera" onClick={scanner.switchCamera} />
          )}
        </div>

        {!code && scanner.status === "live" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-body-md text-white/85">
            Point at a product or Poolit label barcode — it scans automatically
          </p>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="max-h-[62vh] overflow-y-auto rounded-t-2xl bg-surface-container-lowest pb-[max(env(safe-area-inset-bottom),12px)] text-on-surface shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-surface-container-highest" />

        {code ? (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
              <MaterialIcon name="barcode" className="text-[18px] text-secondary" />
              <span className="min-w-0 flex-1 truncate font-mono text-body-lg">{code}</span>
              <Button size="md" variant="ghost" icon="qr_code_scanner" onClick={next}>
                Scan next
              </Button>
            </div>

            {matches.length > 1 && !match && (
              <div className="space-y-2">
                <p className="text-body-md text-secondary">This barcode exists in several stores. Which one?</p>
                {matches.map((m) => (
                  <button
                    key={m.vendorId}
                    onClick={() => setChosenVendorId(m.vendorId)}
                    className="flex w-full items-center gap-3 rounded-lg bg-surface-container-low px-3 py-3 text-left"
                  >
                    <span className="text-xl">{m.item.art}</span>
                    <span className="flex-1 text-body-lg">{m.item.name}</span>
                    <span className="text-label-md text-secondary">{m.vendorName}</span>
                  </button>
                ))}
              </div>
            )}

            {match && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container text-2xl">
                    {match.item.art}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-headline-sm">{match.item.name}</p>
                    <p className="text-label-md text-secondary">
                      {match.vendorName} · {match.item.unit} · {rupees(match.item.price)}
                    </p>
                  </div>
                  <Badge tone={match.item.stockQty === 0 ? "error" : match.item.stockQty <= match.item.lowStockThreshold ? "prep" : "ready"}>
                    {match.item.stockQty === 0 ? "Out" : match.item.stockQty <= match.item.lowStockThreshold ? "Low" : "OK"}
                  </Badge>
                </div>
                {match.vendorId !== vendor.id && (
                  <p className="text-body-sm text-secondary">Note: this item belongs to {match.vendorName}, not your active store.</p>
                )}
                <div className="flex items-end justify-between rounded-lg bg-surface-container-low px-3 py-2">
                  <span className="text-label-md uppercase text-secondary">On hand now</span>
                  <span className="font-mono text-[28px] font-semibold leading-none text-on-surface">{match.item.stockQty}</span>
                </div>

                <div role="tablist" aria-label="What to do" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-container-low p-1">
                  {MODES.map((m) => (
                    <button
                      key={m.key}
                      role="tab"
                      aria-selected={mode === m.key}
                      onClick={() => {
                        setMode(m.key);
                        setQty(m.key === "set" ? String(match.item.stockQty) : "");
                        setError(null);
                      }}
                      className={`h-10 rounded-md text-body-md transition ${
                        mode === m.key ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-secondary"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {mode === "add" && (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {QUICK.map((n) => (
                        <button
                          key={n}
                          disabled={busy}
                          onClick={() => void restock(n)}
                          className="h-12 rounded-lg bg-primary-container text-headline-sm text-on-primary-container transition active:scale-95 disabled:opacity-50"
                        >
                          +{n}
                        </button>
                      ))}
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void restock(Number(qty));
                      }}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={qty}
                        onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        placeholder="Custom quantity"
                        className="h-12 min-w-0 flex-1 rounded-lg bg-surface-container-low px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                      />
                      <Button type="submit" variant="tertiary" className="!h-12 px-5" disabled={!qty || busy}>
                        Add
                      </Button>
                    </form>
                  </>
                )}

                {mode === "set" && (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void adjust("set", Number(qty));
                    }}
                  >
                    <label className="block text-body-md text-secondary" htmlFor="count-input">
                      How many are on the shelf right now?
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="count-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={qty}
                        onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="h-12 min-w-0 flex-1 rounded-lg bg-surface-container-low px-3 font-mono text-[20px] outline-none focus:ring-2 focus:ring-primary"
                      />
                      <Button type="submit" variant="primary" className="!h-12 px-5" disabled={qty === "" || busy}>
                        Save count
                      </Button>
                    </div>
                    {qty !== "" && Number(qty) !== match.item.stockQty && (
                      <p className="text-body-sm text-secondary">
                        Changes stock by{" "}
                        <span className="font-mono text-on-surface">
                          {Number(qty) - match.item.stockQty > 0 ? "+" : ""}
                          {Number(qty) - match.item.stockQty}
                        </span>
                        . Recorded in the stock history.
                      </p>
                    )}
                  </form>
                )}

                {mode === "remove" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {REMOVE_REASONS.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setRemoveReason(r.key)}
                          className={`h-9 flex-1 rounded-lg text-body-md transition ${
                            removeReason === r.key ? "bg-error-container text-on-error-container" : "bg-surface-container-low text-secondary"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 5, 10].map((n) => (
                        <button
                          key={n}
                          disabled={busy || n > match.item.stockQty}
                          onClick={() => void adjust("remove", n)}
                          className="h-12 rounded-lg bg-error-container text-headline-sm text-on-error-container transition active:scale-95 disabled:opacity-40"
                        >
                          −{n}
                        </button>
                      ))}
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void adjust("remove", Number(qty));
                      }}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={qty}
                        onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        placeholder="Custom quantity"
                        className="h-12 min-w-0 flex-1 rounded-lg bg-surface-container-low px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                      />
                      <Button type="submit" variant="danger" className="!h-12 px-5" disabled={!qty || busy}>
                        Remove
                      </Button>
                    </form>
                  </div>
                )}
                <label className="flex items-center gap-2 text-body-md text-secondary">
                  <input
                    type="checkbox"
                    checked={autoResume}
                    onChange={(e) => setAutoResume(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  Return to camera after each update
                </label>
              </div>
            )}

            {matches.length === 0 && (
              <div className="space-y-2">
                <p className="text-body-md text-secondary">
                  New barcode. Link it to an item in <span className="text-on-surface">{vendor.name}</span> and it will restock
                  in one scan next time.
                </p>
                <input
                  value={assignQuery}
                  onChange={(e) => setAssignQuery(e.target.value)}
                  placeholder="Search items…"
                  className="h-11 w-full rounded-lg bg-surface-container-low px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {assignCandidates.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setAssignTarget(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        assignTarget === item.id ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container"
                      }`}
                    >
                      <span className="text-lg">{item.art}</span>
                      <span className="min-w-0 flex-1 truncate text-body-lg">{item.name}</span>
                      {item.barcode && <span className="text-label-sm opacity-70">has code</span>}
                    </button>
                  ))}
                  {assignCandidates.length === 0 && <p className="px-3 py-2 text-body-md text-secondary">No items match.</p>}
                </div>
                <Button
                  variant="primary"
                  className="!h-12 w-full"
                  disabled={!assignTarget || busy}
                  onClick={() => void assign()}
                >
                  Link barcode to item
                </Button>
              </div>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
                <MaterialIcon name="error" className="text-[16px]" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleCode(manual);
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Or type the barcode digits"
                className="h-11 min-w-0 flex-1 rounded-lg bg-surface-container-low px-3 text-[16px] outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" className="!h-11 px-4" disabled={!manual.trim()}>
                Look up
              </Button>
            </form>
            <p className="text-body-sm text-secondary">USB and Bluetooth handheld scanners also work on this screen.</p>
          </div>
        )}

        {log.length > 0 && (
          <div className="border-t border-surface-container px-4 py-3">
            <button onClick={() => setLogOpen((v) => !v)} className="flex w-full items-center justify-between">
              <span className="text-headline-sm">
                This session · {log.length} scan{log.length === 1 ? "" : "s"}
                {totalUnits !== 0 && ` · ${totalUnits > 0 ? "+" : "−"}${Math.abs(totalUnits)} units`}
              </span>
              <MaterialIcon name={logOpen ? "expand_more" : "expand_less"} className="text-[20px] text-secondary" />
            </button>
            {logOpen && (
              <ul className="mt-2 space-y-1">
                {log.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-body-md">
                    <MaterialIcon name="check_circle" className="text-[16px] text-tertiary" />
                    <span className="min-w-0 flex-1 truncate">{e.label}</span>
                    {e.amount !== undefined && (
                      <span className={`font-mono ${e.amount < 0 ? "text-error" : "text-tertiary"}`}>
                        {e.amount > 0 ? `+${e.amount}` : e.amount < 0 ? `−${Math.abs(e.amount)}` : "±0"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur transition active:scale-95 ${
        active ? "bg-white text-black" : "bg-white/15 text-white"
      }`}
    >
      <MaterialIcon name={icon} className="text-[22px]" />
    </button>
  );
}
