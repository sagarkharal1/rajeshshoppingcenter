export function GaneshBlessing({ compact = false, centered = false }: { compact?: boolean; centered?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff8ef_0%,#f4e0ba_100%)] shadow-sm ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      <div className={`grid items-center gap-3 ${centered ? "justify-center" : ""} ${compact ? "md:grid-cols-[0.72fr_1.2fr]" : "md:grid-cols-[0.8fr_1.1fr]"}`}>
        <div className="flex h-12 min-w-[120px] items-center justify-center rounded-[1rem] bg-[rgba(88,28,0,0.9)] px-3 text-center text-[10px] font-bold leading-tight text-amber-50 shadow-sm sm:h-14 sm:min-w-[170px] sm:text-xs">
          ॐ श्री गणेशाय नमः
        </div>
        <div className="flex items-center gap-3 rounded-[1.2rem] bg-white/55 px-3 py-2 shadow-sm ring-1 ring-amber-100/70">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-base font-bold text-amber-950 sm:text-lg">ॐ श्री गणेशाय नमः</p>
          </div>
          <div className="relative shrink-0">
            <img
              src="/ganesh-banner.png"
              alt="Shree Ganesh"
              className={`${compact ? "h-12 w-40 sm:w-64" : "h-20 w-40"} rounded-[1rem] object-cover shadow-sm`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
