export type VoiceState =
  | "greeting"
  | "good_time"
  | "repeat_order"
  | "changes"
  | "read_back"
  | "confirm"
  | "complaint"
  | "complaint_desc"
  | "return_product"
  | "return_qty"
  | "return_reason"
  | "end";

export interface RepeatItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price?: number;
}

export interface VoiceContext {
  shopId: string;
  shopName: string;
  repeatItems: RepeatItem[];
  currentSummary: string | null;
  corrections: number;
  optedOut: boolean;
  pendingComplaintType: string | null;
  pendingReturnProductId: string | null;
  pendingReturnProductName: string | null;
  pendingReturnOrderId: string | null;
}

export interface VoiceMessage {
  role: "agent" | "user";
  text: string;
}

export interface VoiceStep {
  state: VoiceState;
  agentText: string;
  done: boolean;
  ctx: VoiceContext;
}
