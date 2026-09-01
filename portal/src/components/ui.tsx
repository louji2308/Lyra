import type { ReactNode } from "react";
import Link from "next/link";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass rounded-2xl shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-charcoal tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-charcoal-light/60">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  emerald:
    "bg-accent-mint/20 text-emerald-800 ring-accent-mint/30",
  sky: "bg-accent-sky/20 text-sky-800 ring-accent-sky/30",
  amber: "bg-accent-amber/20 text-amber-800 ring-accent-amber/30",
  orange: "bg-orange-100 text-orange-800 ring-orange-200",
  rose: "bg-accent-rose/20 text-rose-800 ring-accent-rose/30",
  zinc: "bg-charcoal/5 text-charcoal-light ring-charcoal/10",
  violet: "bg-accent-lavender/20 text-violet-800 ring-accent-lavender/30",
  indigo: "bg-indigo-100 text-indigo-800 ring-indigo-200",
};

export function Badge({
  tone = "zinc",
  children,
}: {
  tone?: keyof typeof badgeStyles;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badgeStyles[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  valueTone = "text-charcoal",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  valueTone?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-light/50">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueTone}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-charcoal-light/50">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="heading-section">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-subtle">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-medium bg-white/40 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/5 text-charcoal-light/40">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-charcoal">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-subtle">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-charcoal/5 ${className}`} />
  );
}

export function SectionLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-light/40">
      {children}
    </p>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-charcoal-light/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-charcoal">{value}</dd>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-light hover:text-charcoal transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}