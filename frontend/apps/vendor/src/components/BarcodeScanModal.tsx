import { rupees, useStore } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { Badge, Button } from "./ui";

interface ScopedItem {
  item: MenuItem;
  vendorName: string;
  vendorId: string;
}

/**
 * Minimal typing for the window.BarcodeDetector API — not in TS's default
 * lib yet, and only implemented by Chromium-based browsers. Feature-detected
 * at runtime; the manual-entry path works everywhere regardless.
 */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
const QUICK = [10, 25];

export function BarcodeScanModal({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: ScopedItem[];
}) {
  const { restockItem, setItemBarcode } = useStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const detectTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const [restockAmount, setRestockAmount] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const cameraSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const match = useMemo(
    () => (scannedCode ? items.find(({ item }) => item.barcode === scannedCode) : undefined),
    [scannedCode, items],
  );

  const assignCandidates = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    return items
      .filter(({ item }) => !q || item.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, assignQuery]);

  function stopCamera() {
    if (detectTimer.current) clearInterval(detectTimer.current);
    detectTimer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new window.BarcodeDetector!({ formats: SCAN_FORMATS });
      setCameraOn(true);

      detectTimer.current = setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes.length > 0) {
            stopCamera();
            setScannedCode(codes[0].rawValue);
          }
        } catch {
          // transient decode failure on a blurry frame — keep trying
        }
      }, 350);
    } catch {
      setCameraError("Couldn't access the camera. Check permissions, or type the barcode below.");
    }
  }

  useEffect(() => {
    if (!open) stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    stopCamera();
    setScannedCode(null);
    setManualCode("");
    setAssignTarget("");
    setAssignQuery("");
    setRestockAmount("");
    setToast(null);
    onClose();
  }

  function submitManual() {
    if (!manualCode.trim()) return;
    stopCamera();
    setScannedCode(manualCode.trim());
  }

  function scanAnother() {
    setScannedCode(null);
    setManualCode("");
    setAssignTarget("");
    setAssignQuery("");
    setRestockAmount("");
    setToast(null);
  }

  async function commitRestock(amount: number) {
    if (!match) return;
    await restockItem(match.vendorId, match.item.id, amount);
    setToast(`Restocked ${match.item.name} +${amount}`);
  }

  async function commitCustomRestock() {
    const amount = Number(restockAmount);
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) return;
    await commitRestock(amount);
    setRestockAmount("");
  }

  async function commitAssign() {
    if (!scannedCode || !assignTarget) return;
    const target = items.find(({ item }) => item.id === assignTarget);
    if (!target) return;
    try {
      await setItemBarcode(target.vendorId, target.item.id, scannedCode);
      setToast(`Barcode assigned to ${target.item.name}`);
      setScannedCode(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to assign barcode");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md">
      <button
        aria-label="Close"
        onClick={handleClose}
        className="animate-fade absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]"
      />
      <div className="animate-fade relative flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)]">
        <header className="flex items-center justify-between border-b border-surface-container-low px-space-md py-space-sm">
          <div className="flex items-center gap-space-xs">
            <MaterialIcon name="qr_code_scanner" className="text-[18px] text-primary" />
            <h2 className="text-headline-sm text-on-surface">Scan barcode</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded text-secondary transition hover:bg-surface-container hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-space-md">
          {!scannedCode && (
            <div className="space-y-space-sm">
              {cameraSupported ? (
                <div className="overflow-hidden rounded-lg bg-surface-container-high">
                  {cameraOn ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-space-sm text-secondary">
                      <MaterialIcon name="photo_camera" className="text-[28px]" />
                      <Button size="sm" variant="primary" onClick={() => void startCamera()}>
                        Start camera
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-surface-container-low p-space-sm text-body-sm text-secondary">
                  This browser doesn't support camera barcode scanning — type the code below instead.
                </p>
              )}
              {cameraError && <p className="text-body-sm text-error">{cameraError}</p>}

              <div className="flex items-center gap-space-xs">
                <div className="h-px flex-1 bg-surface-container-high" />
                <span className="text-label-sm uppercase text-secondary">or type it</span>
                <div className="h-px flex-1 bg-surface-container-high" />
              </div>

              <div className="flex items-center gap-space-xs">
                <input
                  autoFocus={!cameraSupported}
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="e.g. 8901030821012"
                  className="flex-1 rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="sm" onClick={submitManual} disabled={!manualCode.trim()}>
                  Look up
                </Button>
              </div>
            </div>
          )}

          {scannedCode && (
            <div className="space-y-space-sm">
              <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-sm py-space-xs">
                <MaterialIcon name="barcode_reader" className="text-[16px] text-secondary" />
                <span className="min-w-0 flex-1 truncate font-label-sm text-body-sm text-on-surface">{scannedCode}</span>
                <Button size="sm" variant="ghost" onClick={scanAnother}>Scan another</Button>
              </div>

              {match ? (
                <div className="space-y-space-sm rounded-lg bg-surface-container-low p-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-container text-base">
                      {match.item.art}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md text-on-surface">{match.item.name}</p>
                      <p className="text-label-sm text-secondary">{match.vendorName} · {rupees(match.item.price)}</p>
                    </div>
                    <Badge tone={match.item.stockQty === 0 ? "error" : "ready"}>
                      {match.item.stockQty} in stock
                    </Badge>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    {QUICK.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => void commitRestock(amount)}
                        className="rounded bg-surface-container px-2 py-1 text-label-sm text-secondary transition hover:bg-surface-container-high hover:text-on-surface"
                      >
                        +{amount}
                      </button>
                    ))}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={restockAmount}
                      onChange={(e) => setRestockAmount(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && void commitCustomRestock()}
                      placeholder="Qty"
                      className="w-16 rounded bg-surface-container-lowest px-1.5 py-1 text-label-sm text-on-surface outline-none ring-1 ring-surface-container-high focus:ring-2 focus:ring-primary"
                    />
                    <Button size="sm" onClick={() => void commitCustomRestock()} disabled={!restockAmount}>
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-space-sm rounded-lg bg-surface-container-low p-space-sm">
                  <p className="text-body-sm text-secondary">
                    No item has this barcode yet. Assign it to an item to enable scan-to-restock next time.
                  </p>
                  <input
                    value={assignQuery}
                    onChange={(e) => setAssignQuery(e.target.value)}
                    placeholder="Search items…"
                    className="w-full rounded-lg bg-surface-container-lowest px-space-sm py-1.5 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {assignCandidates.map(({ item, vendorName, vendorId }) => (
                      <button
                        key={`${vendorId}-${item.id}`}
                        onClick={() => setAssignTarget(item.id)}
                        className={`flex w-full items-center gap-space-sm rounded px-space-xs py-space-2xs text-left transition ${
                          assignTarget === item.id ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container"
                        }`}
                      >
                        <span className="text-base">{item.art}</span>
                        <span className="min-w-0 flex-1 truncate text-body-sm">{item.name}</span>
                        <span className="text-label-sm text-secondary">{vendorName}</span>
                      </button>
                    ))}
                    {assignCandidates.length === 0 && (
                      <p className="px-space-xs py-space-xs text-body-sm text-secondary">No items match.</p>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    disabled={!assignTarget}
                    onClick={() => void commitAssign()}
                  >
                    Assign to selected item
                  </Button>
                </div>
              )}
            </div>
          )}

          {toast && (
            <p className="mt-space-sm flex items-center gap-space-xs rounded-lg bg-tertiary-container/10 px-space-sm py-space-xs text-body-sm text-tertiary">
              <MaterialIcon name="check_circle" className="text-[16px]" />
              {toast}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
