import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type FlashType = "success" | "error" | "warning";

export interface FlashNoticeProps {
  message: string | null;
  type?: FlashType;
  onClose: () => void;
  /** Auto-dismiss delay in ms. Default 4500. Pass 0 to disable. */
  duration?: number;
}

/**
 * Prominent full-width toast banner — slides down from the very top of the
 * screen so it is impossible to miss on both mobile and desktop.
 */
export function FlashNotice({ message, type = "error", onClose, duration = 4500 }: FlashNoticeProps) {
  const timerRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(100);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!message || duration <= 0) {
      setProgress(100);
      return;
    }

    // Reset and start the countdown bar
    setProgress(100);
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onClose, duration);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [message, duration, onClose]);

  const isSuccess = type === "success";
  const isWarning = type === "warning";

  const bg = isSuccess
    ? "bg-emerald-600"
    : isWarning
    ? "bg-amber-500"
    : "bg-rose-600";

  const bar = isSuccess
    ? "bg-emerald-400"
    : isWarning
    ? "bg-amber-300"
    : "bg-rose-400";

  const Icon = isSuccess ? CheckCircle2 : isWarning ? AlertTriangle : XCircle;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key="flash-notice"
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className={`fixed inset-x-0 top-0 z-[99999] ${bg} text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]`}
          style={{ pointerEvents: "auto" }}
        >
          {/* Main content row */}
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4 sm:px-6">
            <Icon className="h-6 w-6 shrink-0 opacity-90" aria-hidden="true" />
            <p className="flex-1 text-base font-semibold leading-snug">{message}</p>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/20 active:bg-white/30"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Countdown progress bar — drains left to right */}
          {duration > 0 && (
            <div className="h-1 w-full bg-white/20">
              <div
                className={`h-full ${bar} transition-none`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
