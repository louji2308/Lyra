export interface VoiceTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const VOICE_TOOLS: VoiceTool[] = [
  {
    name: "identify_shop_by_phone",
    description:
      "Find the shop record from the caller's phone number (Caller ID). Returns shop_id and shop_name.",
    parameters: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "The caller's phone number, digits only" },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "get_shop_context",
    description:
      "Get a shop's credit, blacklist, opt-out and language preference before taking an order.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "get_repeat_order",
    description:
      "Get the shop's most recent confirmed order as the repeat-order suggestion.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "check_stock",
    description: "Check whether an item is in stock before promising it to the shop.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The product ID to check" },
        quantity: { type: "number", description: "How many units needed" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "check_credit",
    description:
      "Check whether the shop's credit limit allows another order. Returns available credit and whether order is approved.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string", description: "The shop ID" },
        order_total: { type: "number", description: "Total order amount to check against credit" },
      },
      required: ["shop_id", "order_total"],
    },
  },
  {
    name: "check_blacklist",
    description: "Check whether the shop is blacklisted from ordering a product.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        product_id: { type: "string" },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "create_order",
    description:
      "Persist the confirmed order with its line items, total and credit used.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
      },
      required: ["shop_id", "items"],
    },
  },
  {
    name: "send_whatsapp_summary",
    description:
      "Send the confirmed order summary to the shop's WhatsApp number.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        order_id: { type: "string" },
      },
      required: ["shop_id", "order_id"],
    },
  },
  {
    name: "mark_opt_out",
    description: "Record that the shop owner asked to stop receiving voice calls.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "create_return",
    description:
      "Log a product return request. Requires shop_id, product_id, and quantity. Returns the return record.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        product_id: { type: "string" },
        quantity: { type: "number" },
        reason: { type: "string" },
        order_id: { type: "string" },
      },
      required: ["shop_id", "product_id", "quantity"],
    },
  },
  {
    name: "get_schemes",
    description:
      "Fetch currently active promotion schemes (discounts, free units, cashback) that may apply to the order.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];
