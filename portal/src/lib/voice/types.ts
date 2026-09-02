export type VoiceState =
  | "greeting"
  | "good_time"
  | "repeat_order"
  | "changes"
  | "catalog_query"
  | "read_back"
  | "confirm"
  | "upsell_repeat"
  | "complaint"
  | "complaint_desc"
  | "return_product"
  | "return_qty"
  | "return_reason"
  | "onboarding_name"
  | "onboarding_area"
  | "onboarding_owner"
  | "onboarding_language"
  | "onboarding_complete"
  | "onboarding_done"
  | "end";

export interface RepeatItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price?: number;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
  line_total: number;
}

export interface VoiceContext {
  shopId: string;
  shopName: string;
  repeatItems: RepeatItem[];
  currentCart: CartItem[];
  currentSummary: string | null;
  corrections: number;
  optedOut: boolean;
  pendingComplaintType: string | null;
  pendingReturnProductId: string | null;
  pendingReturnProductName: string | null;
  pendingReturnOrderId: string | null;
  isNewShop: boolean;
  onboardingStep: "name" | "area" | "owner" | "language" | "complete" | null;
  onboardingData: {
    shopName?: string;
    area?: string;
    ownerName?: string;
    language?: string;
  };
  newShopPhone?: string;
  pendingAdd?: { query: string; quantity: number };
  pendingRemove?: { query: string; quantity?: number };
  catalogResults?: Array<{ product_id: string; product_name: string; brand: string; category: string; price: number; unit_type: string; available_qty?: number }>;
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
