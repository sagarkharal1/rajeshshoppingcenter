"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

type BarcodeScannerProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  lang?: "en" | "ne";
  title?: string;
};

/**
 * Camera barcode scanner for packaged goods.
 *
 * The scanning library is a few hundred kilobytes, so it is imported only
 * when the scanner is actually opened — the shop runs on rural mobile data
 * and most sales (loose rice, vegetables) never need it. Manual typing stays
 * available everywhere this is offered, so a missing camera or a denied
 * permission is an inconvenience, never a dead end.
 */
export function BarcodeScanner({ open, onClose, onScanned, lang = "en", title }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");
  const ne = lang === "ne";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");
    setError("");

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("NO_CAMERA_API");
        }
        // Loaded here, not at page load, so the main bundle stays small.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined, // let the browser pick — the rear camera on a phone
          videoRef.current!,
          (result, _err, ctrl) => {
            if (cancelled || !result) return;
            const text = result.getText?.() ?? String(result);
            if (!text) return;
            ctrl.stop();
            onScanned(text.trim());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        stopRef.current = () => controls.stop();
        setStatus("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = (err as any)?.name || "";
        const message = (err as Error)?.message || "";
        setStatus("error");
        if (name === "NotAllowedError") {
          setError(ne
            ? "क्यामेरा प्रयोग गर्ने अनुमति दिइएको छैन। ब्राउजरको सेटिङमा अनुमति दिनुहोस्, वा कोड हातले लेख्नुहोस्।"
            : "Camera permission was refused. Allow it in your browser settings, or type the code by hand.");
        } else if (name === "NotFoundError" || message === "NO_CAMERA_API") {
          setError(ne
            ? "यो यन्त्रमा क्यामेरा भेटिएन। कोड हातले लेख्नुहोस्।"
            : "No camera found on this device. Type the code by hand instead.");
        } else {
          setError(ne
            ? "क्यामेरा खोल्न सकिएन। कोड हातले लेख्नुहोस्।"
            : "Could not open the camera. Type the code by hand instead.");
        }
      }
    })();

    return () => {
      cancelled = true;
      // Always release the camera, or the light stays on after closing.
      try { stopRef.current?.(); } catch { /* already stopped */ }
      stopRef.current = null;
    };
  }, [open, onScanned, ne]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Camera className="h-5 w-5 text-slate-600" />
            {title || (ne ? "बारकोड स्क्यान गर्नुहोस्" : "Scan a barcode")}
          </h3>
          <button type="button" onClick={onClose} aria-label={ne ? "बन्द" : "Close"} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl bg-slate-900">
          <video
            ref={videoRef}
            className="h-56 w-full object-cover"
            muted
            playsInline
          />
        </div>

        {status === "starting" ? (
          <p className="mt-3 text-center text-sm text-slate-600">
            {ne ? "क्यामेरा खुल्दैछ..." : "Opening the camera..."}
          </p>
        ) : null}
        {status === "scanning" ? (
          <p className="mt-3 text-center text-sm text-slate-600">
            {ne
              ? "प्याकेटको बारकोड क्यामेराअगाडि राख्नुहोस्।"
              : "Hold the barcode on the packet in front of the camera."}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
        >
          {ne ? "बन्द गर्नुहोस् (हातले लेख्ने)" : "Close and type it instead"}
        </button>
      </div>
    </div>
  );
}
