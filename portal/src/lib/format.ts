const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return inr.format(Number(value));
}

const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatDate(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  return shortDate.format(new Date(value));
}

const shortDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—";
  return shortDateTime.format(new Date(value));
}

export function formatTime(
  value: string | null | undefined
): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  const d = new Date(0, 0, 0, h, m);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function daysSince(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Math.floor(ms / 86_400_000);
}

export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/(\d{5})(\d{5})/, "$1 $2");
}

export const languageLabel: Record<string, string> = {
  tamil: "Tamil",
  tanglish: "Tanglish",
  hindi: "Hindi",
  english: "English",
};

export const languageNative: Record<string, string> = {
  tamil: "தமிழ்",
  tanglish: "Tanglish",
  hindi: "हिन्दी",
  english: "English",
};

export const sentimentLabel: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  angry: "Angry",
};

export const memoryTypeLabel: Record<string, string> = {
  timing: "Timing",
  language: "Language",
  product_preference: "Product preference",
  negative_memory: "Negative memory",
  payment_behavior: "Payment behavior",
  complaint_history: "Complaint history",
};

export const complaintTypeLabel: Record<string, string> = {
  damaged_goods: "Damaged goods",
  wrong_order: "Wrong order",
  late_delivery: "Late delivery",
  price_issue: "Price issue",
  other: "Other",
};

export const severityLabel: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const returnStatusLabel: Record<string, string> = {
  requested: "Requested",
  photo_received: "Photo received",
  approved: "Approved",
  collected: "Collected",
  credit_issued: "Credit issued",
  rejected: "Rejected",
};

export const returnStatusTone: Record<string, string> = {
  requested: "amber",
  photo_received: "amber",
  approved: "sky",
  collected: "sky",
  credit_issued: "emerald",
  rejected: "zinc",
};

export const severityTone: Record<string, string> = {
  low: "zinc",
  medium: "amber",
  high: "orange",
  critical: "rose",
};

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
