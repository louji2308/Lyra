export type AppLanguage = "tamil" | "tanglish" | "hindi" | "english";
export type MemoryType =
  | "timing"
  | "language"
  | "product_preference"
  | "negative_memory"
  | "payment_behavior"
  | "complaint_history";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type OrderStatus =
  | "draft"
  | "awaiting_confirmation"
  | "confirmed"
  | "payment_pending"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "exception";
export type ComplaintType =
  | "damaged_goods"
  | "wrong_order"
  | "late_delivery"
  | "price_issue"
  | "other";
export type Severity = "low" | "medium" | "high" | "critical";
export type CallSentiment = "positive" | "neutral" | "negative" | "angry";
export type ReturnStatus =
  | "requested"
  | "photo_received"
  | "approved"
  | "collected"
  | "credit_issued"
  | "rejected";
export type SchemeBenefitType = "discount" | "free_units" | "cashback";

export interface Route {
  route_id: string;
  route_name: string;
  salesperson: string | null;
  coverage_area: string | null;
  is_active: boolean;
}

export interface Shop {
  shop_id: string;
  shop_name: string;
  owner_name: string | null;
  phone_number: string;
  whatsapp_number: string | null;
  preferred_language: AppLanguage;
  preferred_call_start: string | null;
  preferred_call_end: string | null;
  beat_route_id: string | null;
  visit_gap_days: number;
  credit_limit: number;
  outstanding_balance: number;
  voice_consent: boolean;
  whatsapp_consent: boolean;
  opt_out: boolean;
  last_order_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopCredit {
  shop_id: string;
  shop_name: string;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  credit_exceeded: boolean;
}

export interface Product {
  product_id: string;
  product_name: string;
  brand: string | null;
  category: string;
  unit_type: string;
  price: number;
  tax_rate: number;
  is_active: boolean;
  launch_date: string | null;
}

export interface LowStockProduct {
  product_id: string;
  product_name: string;
  brand: string | null;
  category: string;
  unit_type: string;
  price: number;
  available_qty: number;
  low_stock_threshold: number;
  restock_date: string | null;
}

export interface Order {
  order_id: string;
  shop_id: string;
  call_id: string | null;
  order_date: string;
  delivery_date: string | null;
  delivery_slot: string | null;
  total_amount: number;
  credit_used: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  created_by: string;
  created_at: string;
}

export interface OrderItem {
  order_item_id: number;
  order_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  line_total: number;
}

export interface ShopMemory {
  memory_id: number;
  shop_id: string;
  memory_text: string;
  memory_type: MemoryType;
  confidence_score: number;
  confirmed_by_user: boolean;
  created_at: string;
}

export interface BlacklistEntry {
  blacklist_id: number;
  shop_id: string;
  product_id: string;
  reason: string | null;
  created_at: string;
}

export interface Complaint {
  complaint_id: number;
  shop_id: string;
  call_id: string | null;
  complaint_type: ComplaintType;
  description: string | null;
  severity: Severity;
  status: string;
  callback_requested: boolean;
  created_at: string;
}

export interface ReturnRecord {
  return_id: number;
  shop_id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  reason: string | null;
  photo_url: string | null;
  credit_note_amount: number;
  status: ReturnStatus;
  created_at: string;
}

export interface CallLog {
  call_id: string;
  shop_id: string;
  start_time: string;
  end_time: string | null;
  language_detected: AppLanguage | null;
  sentiment: CallSentiment;
  order_placed: boolean;
  whatsapp_sent: boolean;
  escalated_to_human: boolean;
  transcript_summary: string | null;
}

export interface Scheme {
  scheme_id: string;
  scheme_name: string;
  start_date: string;
  end_date: string | null;
  eligible_product_ids: string[];
  minimum_quantity: number;
  benefit_type: SchemeBenefitType;
  benefit_value: number;
  is_active: boolean;
}

export interface ShopWithExtras extends Shop {
  shop_name: string;
  available_credit: number;
  credit_exceeded: boolean;
  order_count: number;
  blacklist_count: number;
}

export interface OrderWithShop extends Order {
  shop_name: string;
}

export interface OrderDetail extends Order {
  shop_name: string;
  items: (OrderItem & { product_name: string })[];
}

export interface MemoryWithShop extends ShopMemory {
  shop_name: string;
}

export interface BlacklistWithProduct extends BlacklistEntry {
  product_name: string;
}

export interface ComplaintWithShop extends Complaint {
  shop_name: string;
}

export interface ReturnWithShop extends ReturnRecord {
  shop_name: string;
  product_name: string | null;
}
