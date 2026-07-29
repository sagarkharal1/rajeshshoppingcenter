/**
 * Shown when a panel's data could not be fetched.
 *
 * Without this, a failed request leaves the list empty and the panel renders
 * its "nothing here yet" state — so on a weak connection the shop looks like
 * it has no dealers, no stock, or no customers, which is far more alarming
 * than an honest error.
 */
export function LoadError({
  lang,
  onRetry,
  busy,
}: {
  lang: "en" | "ne";
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
      <p className="text-sm font-bold text-amber-900">
        {lang === "ne" ? "जानकारी ल्याउन सकिएन" : "Could not load this information"}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        {lang === "ne"
          ? "इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्। तपाईंको रेकर्ड सुरक्षित छ।"
          : "Check your internet and try again. Your records are safe."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="mt-3 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-60"
        >
          {busy
            ? (lang === "ne" ? "प्रयास गर्दै..." : "Retrying...")
            : (lang === "ne" ? "फेरि प्रयास गर्नुहोस्" : "Try again")}
        </button>
      ) : null}
    </div>
  );
}
