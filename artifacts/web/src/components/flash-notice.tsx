import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type FlashType = "success" | "error";

export interface FlashNoticeProps {
  message: string | null;
  type?: FlashType;
  onClose: () => void;
  /** Auto-dismiss delay in ms. Default 3500. Pass 0 to disable. */
  duration?: number;
}

/**
 * Fixed, centered floating notice — appears right in front of the user,
 * not at the top or bottom of the page.
 */
export function FlashNotice({ message, type = "error", onClose, duration = 3500 }: FlashNoticeProps) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!message) return;
    if (duration <= 0) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onClose, duration);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [message, duration, onClose]);

  const isSuccess = type === "success";

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key="flash-notice"
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed inset-x-0 bottom-28 z-[9999] flex justify-center px-4 md:bottom-8"
          style={{ pointerEvents: "none" }}
        >
          <div
            className={`flex max-w-sm items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl ring-1 ${
              isSuccess
                ? "bg-emerald-600 text-white ring-emerald-500"
                : "bg-rose-600 text-white ring-rose-500"
            }`}
            style={{ pointerEvents: "auto" }}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess
                ? <CheckCircle2 className="h-5 w-5" />
                : <XCircle className="h-5 w-5" />}
            </div>
            <p className="flex-1 text-sm font-semibold leading-snug">{message}</p>
            <button
              onClick={onClose}
              className="ml-1 shrink-0 rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
