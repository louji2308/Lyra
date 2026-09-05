export interface VoiceTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const RECEPTION_TOOLS: VoiceTool[] = [
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
    name: "create_shop",
    description:
      "Create a new shop record for an unknown caller. Returns the new shop_id and shop_name.",
    parameters: {
      type: "object",
      properties: {
        phone_number: { type: "string", description: "Caller's phone number" },
        shop_name: { type: "string", description: "Shop name" },
        owner_name: { type: "string", description: "Owner name" },
        area: { type: "string", description: "Area/location" },
        preferred_language: { type: "string", description: "Preferred language: tanglish, tamil, hindi, english" },
      },
      required: ["phone_number", "shop_name", "owner_name", "area", "preferred_language"],
    },
  },
];

const MEMORY_TYPE_ENUM = [
  "timing",
  "language",
  "product_preference",
  "negative_memory",
  "payment_behavior",
  "complaint_history",
];

export const MEMORY_TOOLS: VoiceTool[] = [
  {
    name: "save_shop_memory",
    description:
      "Persist a learned preference or fact about a shop from the conversation (preferred call time, do-not-pitch product, reorder pattern, complaint). Updates the row if an identical memory already exists.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        memory_text: { type: "string", description: "What to remember, in plain English" },
        memory_type: { type: "string", enum: MEMORY_TYPE_ENUM, description: "Category of the memory" },
        confidence_score: { type: "number", minimum: 0, maximum: 1, description: "How confident the AI is (0-1)" },
        confirmed_by_user: { type: "boolean", description: "Whether the shop owner explicitly confirmed this" },
      },
      required: ["shop_id", "memory_text", "memory_type"],
    },
  },
  {
    name: "update_shop_memory",
    description:
      "Edit an existing shop memory by memory_id — correct the text, change the type, or adjust the confidence score.",
    parameters: {
      type: "object",
      properties: {
        memory_id: { type: "number" },
        memory_text: { type: "string", description: "Corrected memory text" },
        memory_type: { type: "string", enum: MEMORY_TYPE_ENUM },
        confidence_score: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "delete_shop_memory",
    description:
      "Remove a shop memory by memory_id, e.g. when the shop owner contradicts an earlier learned fact.",
    parameters: {
      type: "object",
      properties: {
        memory_id: { type: "number" },
      },
      required: ["memory_id"],
    },
  },
];

export const BLACKLIST_TOOLS: VoiceTool[] = [
  {
    name: "add_blacklist",
    description:
      "Permanently stop proposing a product to a shop because the owner refused it. Never suggest this product to this shop again.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        product_id: { type: "string" },
        reason: { type: "string", description: "The owner's reason, in their own words" },
      },
      required: ["shop_id", "product_id"],
    },
  },
  {
    name: "update_blacklist",
    description:
      "Change the reason (or product) for an existing blacklist entry by blacklist_id.",
    parameters: {
      type: "object",
      properties: {
        blacklist_id: { type: "number" },
        reason: { type: "string", description: "Updated reason, or empty string to clear" },
      },
      required: ["blacklist_id"],
    },
  },
  {
    name: "remove_blacklist",
    description:
      "Remove a product from a shop's blacklist when the owner now says they want it again.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        product_id: { type: "string" },
      },
      required: ["shop_id", "product_id"],
    },
  },
];

export const ORDER_TAKER_TOOLS: VoiceTool[] = [
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
    name: "list_products",
    description:
      "List available products with optional category/brand filter. Returns product_id, product_name, brand, category, unit_type, price, and stock availability.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category (e.g., 'Personal Care', 'Home Care', 'Beverages', 'Oral Care')" },
        brand: { type: "string", description: "Filter by brand (e.g., 'Clinic Plus', 'Lux', 'Surf Excel', 'Wheel', 'Pepsodent', 'Boost', 'Red Label', 'Brooke Bond', 'Lifebuoy', 'Dove')" },
        in_stock_only: { type: "boolean", description: "Only show products with available stock > 0" },
      },
    },
  },
  {
    name: "search_catalog",
    description:
      "Search product catalog by keyword (e.g., 'lifebuoy', 'soap', 'shampoo', 'tea'). Returns matching products with details.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword" },
      },
      required: ["query"],
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
      "Queue the order summary WhatsApp for the shop. It appears as a PENDING message in the portal dashboard; the office sends it manually. Do NOT claim it was sent.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        order_id: { type: "string" },
      },
      required: ["shop_id", "order_id"],
    },
  },
  ...MEMORY_TOOLS,
];

export const BUSINESS_BRAIN_TOOLS: VoiceTool[] = [
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
    name: "get_schemes",
    description:
      "Fetch currently active promotion schemes (discounts, free units, cashback) that may apply to the order.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  ...BLACKLIST_TOOLS,
];

export const SUPPORT_TOOLS: VoiceTool[] = [
  {
    name: "save_complaint",
    description:
      "Log a product complaint. Requires shop_id, complaint_type, and description.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        complaint_type: { type: "string" },
        description: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        callback_requested: { type: "boolean" },
      },
      required: ["shop_id", "complaint_type"],
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
    name: "send_whatsapp_summary",
    description:
      "Queue the order summary WhatsApp for the shop. It appears as a PENDING message in the portal dashboard; the office sends it manually. Do NOT claim it was sent.",
    parameters: {
      type: "object",
      properties: {
        shop_id: { type: "string" },
        order_id: { type: "string" },
      },
      required: ["shop_id", "order_id"],
    },
  },
  ...MEMORY_TOOLS,
  ...BLACKLIST_TOOLS,
];

export const AGENT_TOOLS: Record<string, VoiceTool[]> = {
  reception: RECEPTION_TOOLS,
  order_taker: ORDER_TAKER_TOOLS,
  business_brain: BUSINESS_BRAIN_TOOLS,
  support: SUPPORT_TOOLS,
};

export const VOICE_TOOLS: VoiceTool[] = [
  ...RECEPTION_TOOLS,
  ...ORDER_TAKER_TOOLS,
  ...BUSINESS_BRAIN_TOOLS,
  ...SUPPORT_TOOLS,
];