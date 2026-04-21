export function GaneshBlessing({ compact = false, centered = false }: { compact?: boolean; centered?: boolean }) {
  const mantra = "ॐ श्री गणेशाय नमः";

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8ef_0%,#f4e0ba_100%)] shadow-sm ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <div
        className={`grid items-center gap-3 ${centered ? "justify-center" : ""} ${
          compact ? "md:grid-cols-[0.82fr_1.18fr]" : "md:grid-cols-[0.8fr_1.2fr]"
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-4 text-center font-bold leading-tight text-amber-50 shadow-sm ${
            compact ? "min-h-[4.5rem] text-base sm:text-lg" : "min-h-[5rem] text-lg sm:text-xl"
          }`}
        >
          {mantra}
        </div>
        <div className="rounded-[1.2rem] bg-white/55 p-2 shadow-sm ring-1 ring-amber-100/70">
          <img
            src="/ganesh-banner.png"
            alt="Shree Ganesh"
            className={`w-full rounded-[1rem] object-cover shadow-sm ${compact ? "h-16 sm:h-20" : "h-24"}`}
          />
        </div>
      </div>
    </div>
  );
}
