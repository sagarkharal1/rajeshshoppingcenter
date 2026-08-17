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

  // Held in a ref, and deliberately NOT a dependency of the effect below.
  //
  // The caller passes an inline arrow, so its identity changes on every parent
  // render. As a dependency that tore the camera down and started it again each
  // time — fast enough that the light stayed on and it looked like it was
  // scanning, while the decoder never held a stream long enough to read
  // anything. The camera worked; the scan could not.
  const onScannedRef = useRef(onScanned);
  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

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
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        // Without this the decoder tries every format it knows on every frame,
        // most of which no shop ever sees. These are what is actually printed
        // on packaged goods, plus CODE_128 for the labels this app prints
        // itself. Fewer formats means more attempts per second on the ones
        // that matter.
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          // Default is half a second between attempts. A shopkeeper holding a
          // packet steady for two seconds gets four tries at that rate.
          delayBetweenScanAttempts: 100,
        });

        const handle = (result: any, ctrl: { stop: () => void }) => {
          if (cancelled || !result) return;
          const text = result.getText?.() ?? String(result);
          if (!text) return;
          ctrl.stop();
          onScannedRef.current(text.trim());
        };

        let controls;
        try {
          // Ask for the back camera explicitly. Passing no device id picks the
          // browser's default, which on a phone is usually the front-facing
          // one — pointing the wrong way at a barcode held up to the back.
          controls = await reader.decodeFromConstraints(
            {
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            },
            videoRef.current!,
            (result, _err, ctrl) => handle(result, ctrl),
          );
        } catch {
          // A laptop with only a front camera rejects those constraints
          // outright. Better a front camera than no scanner.
          controls = await reader.decodeFromVideoDevice(
            undefined,
            videoRef.current!,
            (result, _err, ctrl) => handle(result, ctrl),
          );
        }

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
    // `onScanned` is read through a ref on purpose — see above.
  }, [open, ne]);

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
            autoPlay
            playsInline
          />
        </div>

        {status === "starting" ? (
          <p className="mt-3 text-center text-sm text-slate-600">
            {ne ? "क्यामेरा खुल्दैछ..." : "Opening the camera..."}
          </p>
        ) : null}
        {status === "scanning" ? (
          <div className="mt-3 space-y-1 text-center">
            <p className="text-sm text-slate-600">
              {ne
                ? "प्याकेटको बारकोड क्यामेराअगाडि राख्नुहोस्।"
                : "Hold the barcode on the packet in front of the camera."}
            </p>
            {/* A laptop webcam has fixed focus and reads a small printed
                barcode poorly. Saying so beats letting someone conclude the
                feature is broken. */}
            <p className="text-xs text-slate-500">
              {ne
                ? "उज्यालोमा, करिब १५ सेन्टिमिटर टाढा, स्थिर राख्नुहोस्। ल्यापटपको क्यामेराले नपढे मोबाइलबाट चलाउनुहोस्।"
                : "Good light, about 15 cm away, held steady. If a laptop webcam will not read it, try the same page on a phone."}
            </p>
          </div>
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
