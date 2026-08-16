import type {
  CallSentiment,
  MemoryType,
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
  Severity,
} from "./types";

export type Tone =
  | "emerald"
  | "sky"
  | "amber"
  | "orange"
  | "rose"
  | "zinc"
  | "violet"
  | "indigo";

export const orderStatusTone: Record<OrderStatus, Tone> = {
  draft: "zinc",
  awaiting_confirmation: "amber",
  confirmed: "sky",
  payment_pending: "amber",
  out_for_delivery: "sky",
  delivered: "emerald",
  cancelled: "zinc",
  exception: "rose",
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  payment_pending: "Payment pending",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  exception: "Exception",
};

export const paymentStatusTone: Record<PaymentStatus, Tone> = {
  paid: "emerald",
  partial: "amber",
  pending: "amber",
  overdue: "rose",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
};

export const sentimentTone: Record<CallSentiment, Tone> = {
  positive: "emerald",
  neutral: "zinc",
  negative: "amber",
  angry: "rose",
};

export const severityTone: Record<Severity, Tone> = {
  low: "zinc",
  medium: "amber",
  high: "orange",
  critical: "rose",
};

export const returnStatusTone: Record<ReturnStatus, Tone> = {
  requested: "amber",
  photo_received: "amber",
  approved: "sky",
  collected: "sky",
  credit_issued: "emerald",
  rejected: "zinc",
};

export const memoryTypeTone: Record<MemoryType, Tone> = {
  timing: "sky",
  language: "violet",
  product_preference: "emerald",
  negative_memory: "rose",
  payment_behavior: "amber",
  complaint_history: "orange",
};

export const severityLabel: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const returnStatusLabel: Record<ReturnStatus, string> = {
  requested: "Requested",
  photo_received: "Photo received",
  approved: "Approved",
  collected: "Collected",
  credit_issued: "Credit issued",
  rejected: "Rejected",
};

export const sentimentLabel: Record<CallSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  angry: "Angry",
};
