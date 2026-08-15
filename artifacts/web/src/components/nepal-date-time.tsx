import { useEffect, useMemo, useState } from "react";
import { Clock3, CalendarDays } from "lucide-react";
import { formatNepalDate } from "@/lib/nepal-time";

function useNepalNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export function NepalDateTime({
  lang = "en",
  compact = false,
  centered = false,
  inline = false,
}: {
  lang?: "en" | "ne";
  compact?: boolean;
  centered?: boolean;
  /**
   * Single line, no heading, no card of its own — for sitting inside another
   * strip. The default stays the boxed version so existing callers are
   * unaffected.
   */
  inline?: boolean;
}) {
  const now = useNepalNow();

  const dateText = useMemo(() => formatNepalDate(now, lang), [lang, now]);

  const timeText = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ne" ? "ne-NP" : "en-NP", {
        timeZone: "Asia/Kathmandu",
        hour: "numeric",
        minute: "2-digit",
        second: compact || inline ? undefined : "2-digit",
        hour12: true,
      }).format(now),
    [compact, inline, lang, now],
  );

  if (inline) {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 text-[11px] font-semibold text-amber-50 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 text-amber-200" />
          {dateText}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5 text-amber-200" />
          {timeText}
        </span>
      </span>
    );
  }

  return (
    <div
      className={`rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-3 py-2 shadow-sm ${
        centered ? "text-center" : ""
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/90">
        {lang === "ne" ? "\u0928\u0947\u092a\u093e\u0932 BS \u092e\u093f\u0924\u093f / \u0938\u092e\u092f" : "Nepal BS Date / Time"}
      </p>
      <div className={`mt-1.5 flex flex-wrap gap-2 text-xs sm:text-sm ${centered ? "justify-center" : ""}`}>
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-50">
          <CalendarDays className="h-3.5 w-3.5 text-amber-200" />
          {dateText}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-50">
          <Clock3 className="h-3.5 w-3.5 text-amber-200" />
          {timeText}
        </span>
      </div>
    </div>
  );
}
