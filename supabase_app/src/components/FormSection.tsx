import type { ReactNode } from "react";
import { useId, useState } from "react";

export function FormSection({
  step,
  title,
  description,
  children,
  className = "",
}: {
  step?: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#14141c]/90 to-[#101014]/90 p-6 shadow-lg shadow-black/20 backdrop-blur-sm ${className}`}
    >
      <header className="mb-5 flex gap-4">
        {step != null ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-sm font-bold text-teal-300 ring-1 ring-teal-500/30">
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p> : null}
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-200">
          {label}
        </label>
        {optional ? (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Optional
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121a]/80 shadow-md shadow-black/15">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-200">{title}</span>
            {badge ? (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/25">
                {badge}
              </span>
            ) : null}
          </span>
          {description ? <span className="mt-1 block text-sm text-slate-500">{description}</span> : null}
        </span>
      </button>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-white/[0.06] px-5 pb-5 pt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
