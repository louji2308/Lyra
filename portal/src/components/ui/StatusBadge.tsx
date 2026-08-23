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
  draft: "bg-gray-100 text-gray-700",
  awaiting_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  payment_pending: "bg-orange-100 text-orange-800",
  out_for_delivery: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  exception: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  open: "bg-red-100 text-red-800",
  resolved: "bg-blue-100 text-blue-800",
  closed: "bg-gray-100 text-gray-700",
  requested: "bg-yellow-100 text-yellow-800",
  photo_received: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  collected: "bg-purple-100 text-purple-800",
  credit_issued: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-700",
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  positive: "bg-green-100 text-green-800",
  neutral: "bg-gray-100 text-gray-700",
  negative: "bg-orange-100 text-orange-800",
  angry: "bg-red-100 text-red-800",
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
  const style = variantStyles[variant] ?? "bg-gray-100 text-gray-700";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", style, className)}>
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