export type VoiceState =
  | "greeting"
  | "good_time"
  | "repeat_order"
  | "changes"
  | "read_back"
  | "confirm"
  | "end";

export interface RepeatItem {
  product_name: string;
  quantity: number;
  unit: string;
}

export interface VoiceContext {
  shopId: string;
  shopName: string;
  repeatItems: RepeatItem[];
  currentSummary: string | null;
  corrections: number;
  optedOut: boolean;
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
