"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * One topic on a settings-style screen: a title you can read at a glance, and
 * the controls only once you ask for them.
 *
 * The owner screens grew by adding another panel each time a feature landed,
 * until a page showed seven open forms at once. Someone running the shop needs
 * to find the one thing they came for, not read past six others, so everything
 * starts shut and opens on a tap.
 */

type Tone = "default" | "violet" | "rose" | "emerald" | "amber";

const TONES: Record<Tone, { wrap: string; icon: string }> = {
  default: { wrap: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-600" },
  violet: { wrap: "border-violet-200 bg-violet-50/40", icon: "bg-violet-100 text-violet-700" },
  rose: { wrap: "border-2 border-rose-200 bg-rose-50/40", icon: "bg-rose-100 text-rose-700" },
  emerald: { wrap: "border-emerald-200 bg-emerald-50/40", icon: "bg-emerald-100 text-emerald-700" },
  amber: { wrap: "border-amber-200 bg-amber-50/40", icon: "bg-amber-100 text-amber-700" },
};

type CollapsibleSectionProps = {
  title: string;
  /** One line telling the owner what lives in here, read before opening. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  /** Short live status on the right — "On", "Off", "3 notices". */
  status?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  description,
  icon: Icon,
  tone = "default",
  status,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toneStyle = TONES[tone];

  return (
    <section className={`rounded-[1.5rem] border shadow-sm ${toneStyle.wrap}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-[1.5rem] p-5 text-left"
      >
        {Icon ? (
          <span className={`shrink-0 rounded-2xl p-2.5 ${toneStyle.icon}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-slate-950">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
          ) : null}
        </span>
        {status ? (
          <span className="shrink-0 text-sm font-semibold text-slate-600">{status}</span>
        ) : null}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* Unmounted when shut rather than hidden: a closed topic should not keep
          a half-filled form alive, and long lists stay off the page entirely. */}
      {open ? <div className="border-t border-slate-200/70 p-5">{children}</div> : null}
    </section>
  );
}
