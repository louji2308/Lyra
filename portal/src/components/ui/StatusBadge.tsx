import { cn } from "@/lib/utils";

type StatusVariant =
  | "draft"
  | "awaiting_confirmation"
  | "confirmed"
  | "payment_pending"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "exception"
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "open"
  | "resolved"
  | "closed"
  | "requested"
  | "photo_received"
  | "approved"
  | "collected"
  | "credit_issued"
  | "rejected"
  | "active"
  | "inactive"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "positive"
  | "neutral"
  | "negative"
  | "angry";

const variantStyles: Record<StatusVariant, string> = {
  draft: "bg-charcoal/5 text-charcoal-light",
  awaiting_confirmation: "bg-accent-amber/20 text-amber-800",
  confirmed: "bg-accent-sky/20 text-sky-800",
  payment_pending: "bg-accent-peach/20 text-orange-800",
  out_for_delivery: "bg-accent-lavender/20 text-violet-800",
  delivered: "bg-accent-mint/20 text-emerald-800",
  cancelled: "bg-accent-rose/20 text-rose-800",
  exception: "bg-accent-rose/20 text-rose-800",
  pending: "bg-accent-amber/20 text-amber-800",
  partial: "bg-accent-peach/20 text-orange-800",
  paid: "bg-accent-mint/20 text-emerald-800",
  overdue: "bg-accent-rose/20 text-rose-800",
  open: "bg-accent-rose/20 text-rose-800",
  resolved: "bg-accent-sky/20 text-sky-800",
  closed: "bg-charcoal/5 text-charcoal-light",
  requested: "bg-accent-amber/20 text-amber-800",
  photo_received: "bg-accent-sky/20 text-sky-800",
  approved: "bg-accent-mint/20 text-emerald-800",
  collected: "bg-accent-lavender/20 text-violet-800",
  credit_issued: "bg-accent-mint/20 text-emerald-800",
  rejected: "bg-accent-rose/20 text-rose-800",
  active: "bg-accent-mint/20 text-emerald-800",
  inactive: "bg-charcoal/5 text-charcoal-light",
  low: "bg-accent-mint/20 text-emerald-800",
  medium: "bg-accent-amber/20 text-amber-800",
  high: "bg-accent-peach/20 text-orange-800",
  critical: "bg-accent-rose/20 text-rose-800",
  positive: "bg-accent-mint/20 text-emerald-800",
  neutral: "bg-charcoal/5 text-charcoal-light",
  negative: "bg-accent-peach/20 text-orange-800",
  angry: "bg-accent-rose/20 text-rose-800",
};

const variantLabels: Record<StatusVariant, string> = {
  draft: "Draft",
  awaiting_confirmation: "Awaiting Confirmation",
  confirmed: "Confirmed",
  payment_pending: "Payment Pending",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  exception: "Exception",
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
  requested: "Requested",
  photo_received: "Photo Received",
  approved: "Approved",
  collected: "Collected",
  credit_issued: "Credit Issued",
  rejected: "Rejected",
  active: "Active",
  inactive: "Inactive",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  angry: "Angry",
};

interface StatusBadgeProps {
  status: StatusVariant | string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  const variant = status as StatusVariant;
  const label = variantLabels[variant] ?? status;
  const style = variantStyles[variant] ?? "bg-charcoal/5 text-charcoal-light";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", style, className)}>
      {showIcon && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inset-0 rounded-full bg-current opacity-75" />
          <span className="relative flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}