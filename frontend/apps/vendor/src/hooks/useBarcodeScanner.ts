import { useCallback, useEffect, useRef, useState } from "react";
import { getDetector, isPlausibleBarcode } from "../lib/scanner";
import type { Detector } from "../lib/scanner";

export type CameraStatus = "idle" | "starting" | "live" | "error";

export interface ScanHit {
  code: string;
  format: string;
}

/** Fraction of the frame (centred) that we decode — matches the on-screen reticle. */
const ROI_W = 0.84;
const ROI_H = 0.5;
/** Decode at most this often. ~8 fps is plenty and keeps phones cool. */
const FRAME_INTERVAL_MS = 120;
/** Ignore the same code for this long after it was handled. */
const REPEAT_COOLDOWN_MS = 2500;

function describeError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The camera only works over HTTPS. Open the console from its https:// address.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser can't open the camera. Type the barcode or use a USB/Bluetooth scanner.";
  }
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access for this site in your browser settings, then tap Retry.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is in use by another app. Close it and tap Retry.";
    default:
      return "Couldn't start the camera. Tap Retry, or type the barcode below.";
  }
}

/**
 * Owns the camera stream + decode loop for the scanner screen.
 *
 * - Requests the rear camera at 720p with continuous focus where supported.
 * - Decodes only the centred reticle region, scaled down, every ~120 ms.
 * - Requires a valid check digit for EAN/UPC (or two identical reads in a row
 *   for other formats) so blurry misreads never reach the vendor.
 * - Releases the camera when the tab is hidden and re-acquires it on return.
 */
export function useBarcodeScanner({
  onDetect,
  paused,
}: {
  onDetect: (hit: ScanHit) => void;
  paused: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number; streak: number }>({ code: "", at: 0, streak: 0 });
  const pausedRef = useRef(paused);
  const onDetectRef = useRef(onDetect);
  const wantedRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Detector["engine"] | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  const stopLoop = () => {
    if (loopRef.current !== null) {
      clearTimeout(loopRef.current);
      loopRef.current = null;
    }
  };

  const releaseStream = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
  }, []);

  const tick = useCallback(async () => {
    loopRef.current = window.setTimeout(() => void tick(), FRAME_INTERVAL_MS);
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || busyRef.current || pausedRef.current) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    busyRef.current = true;
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const sw = Math.round(vw * ROI_W);
      const sh = Math.round(vh * ROI_H);
      const sx = Math.round((vw - sw) / 2);
      const sy = Math.round((vh - sh) / 2);
      const scale = Math.min(1, 960 / sw);

      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const codes = await detector.detect(canvas);
      const hit = codes.find((c) => isPlausibleBarcode(c.rawValue, c.format));
      if (!hit) return;

      const now = Date.now();
      const last = lastRef.current;
      if (hit.rawValue === last.code && now - last.at < REPEAT_COOLDOWN_MS && last.streak >= 2) {
        last.at = now; // still pointing at the one we just handled
        return;
      }
      const streak = hit.rawValue === last.code && now - last.at < 1000 ? last.streak + 1 : 1;
      lastRef.current = { code: hit.rawValue, at: now, streak };

      const isGtin = ["ean_13", "ean_8", "upc_a", "upc_e"].includes(hit.format);
      if (isGtin || streak >= 2) {
        lastRef.current.streak = 2;
        onDetectRef.current({ code: hit.rawValue, format: hit.format });
      }
    } catch {
      // a single bad frame — keep going
    } finally {
      busyRef.current = false;
    }
  }, []);

  const start = useCallback(
    async (preferredDeviceId?: string | null) => {
      wantedRef.current = true;
      setError(null);
      setStatus("starting");
      releaseStream();
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const [detector, stream] = await Promise.all([
          getDetector(),
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: preferredDeviceId
              ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          }),
        ]);
        if (!wantedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        detectorRef.current = detector;
        setEngine(detector.engine);
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
          focusMode?: string[];
        };
        setTorchSupported(Boolean(caps.torch));
        if (caps.focusMode?.includes("continuous")) {
          void track
            .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
            .catch(() => undefined);
        }
        setDeviceId(track.getSettings().deviceId ?? null);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.muted = true;
          await video.play().catch(() => undefined);
        }

        // Labels are only populated after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCameras(devices.filter((d) => d.kind === "videoinput"));

        setStatus("live");
        stopLoop();
        void tick();
      } catch (err) {
        releaseStream();
        setStatus("error");
        setError(describeError(err));
      }
    },
    [releaseStream, tick],
  );

  const stop = useCallback(() => {
    wantedRef.current = false;
    releaseStream();
    setStatus("idle");
  }, [releaseStream]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const switchCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.deviceId === deviceId);
    const next = cameras[(idx + 1) % cameras.length];
    void start(next.deviceId);
  }, [cameras, deviceId, start]);

  /** Forget the last code so the same item can be scanned again right away. */
  const resetRepeat = useCallback(() => {
    lastRef.current = { code: "", at: 0, streak: 0 };
  }, []);

  // Release the camera while the app is backgrounded (battery + privacy),
  // and bring it back when the vendor returns.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (streamRef.current) releaseStream();
      } else if (wantedRef.current && !streamRef.current) {
        void start(deviceId);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [deviceId, releaseStream, start]);

  useEffect(
    () => () => {
      wantedRef.current = false;
      releaseStream();
    },
    [releaseStream],
  );

  return {
    videoRef,
    status,
    error,
    engine,
    start,
    stop,
    torchSupported,
    torchOn,
    toggleTorch,
    canSwitchCamera: cameras.length > 1,
    switchCamera,
    resetRepeat,
  };
}

/**
 * USB / Bluetooth handheld scanners act as a keyboard: they "type" the code
 * very fast and press Enter. Capture that anywhere on the page (except while
 * the vendor is typing in a field) so a Zebra/Honeywell gun works too.
 */
export function useKeyboardWedge(onCode: (code: string) => void, enabled = true) {
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let lastAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const now = performance.now();
      if (now - lastAt > 60) buf = "";
      lastAt = now;
      if (e.key === "Enter") {
        if (buf.length >= 6) {
          e.preventDefault();
          cb.current(buf);
        }
        buf = "";
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
