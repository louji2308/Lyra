"use server";

import { revalidatePath } from "next/cache";
import { todayIST } from "@/lib/format";
import { supabaseAdmin } from "./supabaseAdmin";
import type {
  Shop,
  Product,
  Order,
  OrderItem,
  Payment,
  Delivery,
  DeliveryItem,
  StockMovement,
  Complaint,
  ReturnRecord,
  ShopMemory,
  BlacklistEntry,
  MemoryType,
  Scheme,
  Route,
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
  ShopCredit,
  LowStockProduct,
  ShopPaymentLedger,
  DeliverySummary,
} from "./types";

import { revalidateShops, revalidateShop, revalidateOrders, revalidateOrder, revalidateCatalog, revalidateExceptions, revalidatePayments, revalidateDeliveries } from "./revalidate";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function handleError(err: unknown, context: string): ActionResult<never> {
  console.error(`[actions] ${context}:`, err);
  if (err instanceof Error) return { success: false, error: err.message };
  if (err && typeof err === "object" && "message" in err) {
    return { success: false, error: String(err.message) };
  }
  if (err && typeof err === "object" && "error" in err) {
    return { success: false, error: String(err.error) };
  }
  return { success: false, error: JSON.stringify(err) };
}

export async function createShop(input: {
  shop_name: string;
  owner_name: string;
  phone_number: string;
  whatsapp_number?: string;
  preferred_language?: "tamil" | "tanglish" | "hindi" | "english";
  beat_route_id?: string;
  visit_gap_days?: number;
  credit_limit?: number;
  address?: string;
  gst_number?: string;
  preferred_call_start?: string;
  preferred_call_end?: string;
}): Promise<ActionResult<Shop>> {
  try {
    const shopId = `S${Date.now().toString().slice(-3)}`;
    const digits = input.phone_number.replace(/\D/g, "").slice(-10);
    const { data, error } = await supabaseAdmin
      .from("shops")
      .insert({
        shop_id: shopId,
        shop_name: input.shop_name,
        owner_name: input.owner_name,
        phone_number: digits,
        whatsapp_number: input.whatsapp_number ?? digits,
        preferred_language: input.preferred_language ?? "tanglish",
        beat_route_id: input.beat_route_id ?? null,
        visit_gap_days: input.visit_gap_days ?? 7,
        credit_limit: input.credit_limit ?? 0,
        address: input.address ?? null,
        gst_number: input.gst_number ?? null,
        preferred_call_start: input.preferred_call_start ?? "09:00",
        preferred_call_end: input.preferred_call_end ?? "18:00",
      })
      .select()
      .single();

    if (error) throw error;
    revalidateShops();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "createShop");
  }
}

export async function updateShop(
  shopId: string,
  input: Partial<Shop>
): Promise<ActionResult<Shop>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shops")
      .update(input)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) throw error;
    revalidateShop(shopId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateShop");
  }
}

export async function updateShopCredit(
  shopId: string,
  input: { credit_limit?: number; outstanding_balance?: number }
): Promise<ActionResult<Shop>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shops")
      .update(input)
      .eq("shop_id", shopId)
      .select()
      .single();

    if (error) throw error;
    revalidateShop(shopId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateShopCredit");
  }
}

export async function softDeleteShop(shopId: string): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("shops")
      .update({ opt_out: true })
      .eq("shop_id", shopId);

    if (error) throw error;
    revalidateShop(shopId);
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "softDeleteShop");
  }
}

// ============================================================================
// SHOP BLACKLIST
// ============================================================================

export async function addBlacklist(
  shopId: string,
  productId: string,
  reason?: string
): Promise<ActionResult<BlacklistEntry>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("blacklist")
      .insert({ shop_id: shopId, product_id: productId, reason: reason ?? null })
      .select()
      .single();

    if (error) throw error;
    revalidateShop(shopId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "addBlacklist");
  }
}

export async function removeBlacklist(
  shopId: string,
  productId: string
): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("blacklist")
      .delete()
      .eq("shop_id", shopId)
      .eq("product_id", productId);

    if (error) throw error;
    revalidateShop(shopId);
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "removeBlacklist");
  }
}

export async function updateBlacklist(
  blacklistId: number,
  patch: { reason?: string | null; product_id?: string }
): Promise<ActionResult<BlacklistEntry>> {
  try {
    const updateData: Partial<BlacklistEntry> = { ...patch };
    if (patch.reason !== undefined) {
      updateData.reason = patch.reason && patch.reason.trim() ? patch.reason.trim() : null;
    }
    if (patch.product_id !== undefined && !patch.product_id.trim()) {
      return { success: false, error: "Product is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("blacklist")
      .update(updateData)
      .eq("blacklist_id", blacklistId)
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateBlacklist");
  }
}

export async function deleteBlacklistEntry(blacklistId: number): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("blacklist")
      .delete()
      .eq("blacklist_id", blacklistId);

    if (error) throw error;
    revalidateExceptions();
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "deleteBlacklistEntry");
  }
}

// ============================================================================
// SHOP MEMORY
// ============================================================================

const MEMORY_TYPES: MemoryType[] = [
  "timing",
  "language",
  "product_preference",
  "negative_memory",
  "payment_behavior",
  "complaint_history",
];

export async function addMemory(input: {
  shop_id: string;
  memory_text: string;
  memory_type: MemoryType;
  confidence_score?: number;
  confirmed_by_user?: boolean;
}): Promise<ActionResult<ShopMemory>> {
  try {
    if (!input.shop_id?.trim()) return { success: false, error: "Shop is required" };
    if (!input.memory_text?.trim()) return { success: false, error: "Memory text is required" };
    if (!MEMORY_TYPES.includes(input.memory_type)) return { success: false, error: "Invalid memory type" };

    const { data, error } = await supabaseAdmin
      .from("shop_memory")
      .insert({
        shop_id: input.shop_id.trim(),
        memory_text: input.memory_text.trim(),
        memory_type: input.memory_type,
        confidence_score: input.confidence_score ?? 0.5,
        confirmed_by_user: input.confirmed_by_user ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/memory");
    return { success: true, data };
  } catch (err) {
    return handleError(err, "addMemory");
  }
}

export async function updateMemory(
  memoryId: number,
  patch: {
    memory_text?: string;
    memory_type?: MemoryType;
    confidence_score?: number;
    confirmed_by_user?: boolean;
  }
): Promise<ActionResult<ShopMemory>> {
  try {
    const updateData: Partial<ShopMemory> = { ...patch };
    if (patch.memory_text !== undefined) {
      if (!patch.memory_text.trim()) return { success: false, error: "Memory text cannot be empty" };
      updateData.memory_text = patch.memory_text.trim();
    }
    if (patch.memory_type !== undefined && !MEMORY_TYPES.includes(patch.memory_type)) {
      return { success: false, error: "Invalid memory type" };
    }
    if (
      patch.confidence_score !== undefined &&
      (patch.confidence_score < 0 || patch.confidence_score > 1)
    ) {
      return { success: false, error: "Confidence score must be between 0 and 1" };
    }

    const { data, error } = await supabaseAdmin
      .from("shop_memory")
      .update(updateData)
      .eq("memory_id", memoryId)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/memory");
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateMemory");
  }
}

export async function confirmMemory(
  memoryId: number
): Promise<ActionResult<ShopMemory>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shop_memory")
      .update({ confirmed_by_user: true })
      .eq("memory_id", memoryId)
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "confirmMemory");
  }
}

export async function deleteMemory(memoryId: number): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("shop_memory")
      .delete()
      .eq("memory_id", memoryId);

    if (error) throw error;
    revalidateExceptions();
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "deleteMemory");
  }
}

// ============================================================================
// ORDERS
// ============================================================================

export async function createOrder(input: {
  shop_id: string;
  items: { product_id: string; quantity: number; unit: string; price: number; discount?: number }[];
  call_id?: string;
  created_by?: string;
}): Promise<ActionResult<Order>> {
  try {
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.price * item.quantity - (item.discount ?? 0),
      0
    );

    // Check credit
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("credit_limit, outstanding_balance, beat_route_id")
      .eq("shop_id", input.shop_id)
      .single();

    if (shop && shop.outstanding_balance + totalAmount > shop.credit_limit) {
      return { success: false, error: "Credit limit exceeded" };
    }

    // Fetch route delivery_days
    let deliveryDays = 3;
    if (shop?.beat_route_id) {
      const { data: route } = await supabaseAdmin
        .from("routes")
        .select("delivery_days")
        .eq("route_id", shop.beat_route_id)
        .maybeSingle();
      if (route?.delivery_days) deliveryDays = route.delivery_days;
    }

    // Check blacklist
    for (const item of input.items) {
      const { data: bl } = await supabaseAdmin
        .from("blacklist")
        .select("product_id")
        .eq("shop_id", input.shop_id)
        .eq("product_id", item.product_id)
        .maybeSingle();

      if (bl) {
        return { success: false, error: `Product ${item.product_id} is blacklisted for this shop` };
      }
    }

    // Create order
    const orderId = await nextOrderId(supabaseAdmin);
    const today = todayIST();
    const deliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_id: orderId,
        shop_id: input.shop_id,
        call_id: input.call_id ?? null,
        order_date: today,
        delivery_date: deliveryDate,
        delivery_slot: "2 PM - 5 PM",
        total_amount: totalAmount,
        credit_used: totalAmount,
        order_status: "draft",
        payment_status: "pending",
        created_by: input.created_by ?? "MANUAL",
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const itemsToInsert = input.items.map((item) => ({
      order_id: order.order_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      discount: item.discount ?? 0,
      line_total: item.price * item.quantity - (item.discount ?? 0),
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    revalidateOrders();
    revalidateShop(input.shop_id);
    return { success: true, data: order };
  } catch (err) {
    return handleError(err, "createOrder");
  }
}

export async function updateOrderItems(
  orderId: string,
  items: { product_id: string; quantity: number; unit: string; price: number; discount?: number }[]
): Promise<ActionResult<void>> {
  try {
    // Delete existing items
    const { error: delError } = await supabaseAdmin
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (delError) throw delError;

    // Insert new items
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity - (item.discount ?? 0),
      0
    );

    const itemsToInsert = items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      discount: item.discount ?? 0,
      line_total: item.price * item.quantity - (item.discount ?? 0),
    }));

    const { error: insError } = await supabaseAdmin
      .from("order_items")
      .insert(itemsToInsert);

    if (insError) throw insError;

    // Update order total
    const { error: updError } = await supabaseAdmin
      .from("orders")
      .update({ total_amount: totalAmount, credit_used: totalAmount })
      .eq("order_id", orderId);

    if (updError) throw updError;

    revalidateOrder(orderId);
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "updateOrderItems");
  }
}

export async function confirmOrder(
  orderId: string,
  changedBy: string
): Promise<ActionResult<Order>> {
  try {
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_id", orderId)
      .single();

    if (fetchError) throw fetchError;
    if (!order) throw new Error("Order not found");

    // Validate stock
    for (const item of order.order_items) {
      const { data: inv } = await supabaseAdmin
        .from("inventory")
        .select("available_qty")
        .eq("product_id", item.product_id)
        .single();

      if (inv && inv.available_qty < item.quantity) {
        return { success: false, error: `Insufficient stock for ${item.product_id}` };
      }
    }

    // Reserve→confirm: decrement inventory and record stock movements so the
    // order is not sold twice. Only runs on the human-triggered final confirm.
    for (const item of order.order_items) {
      const { data: inv } = await supabaseAdmin
        .from("inventory")
        .select("available_qty, reserved_qty")
        .eq("product_id", item.product_id)
        .single();

      if (inv) {
        const newAvailable = Math.max(Number(inv.available_qty) - Number(item.quantity), 0);
        const newReserved = Math.max(Number(inv.reserved_qty) - Number(item.quantity), 0);
        await supabaseAdmin
          .from("inventory")
          .update({ available_qty: newAvailable, reserved_qty: newReserved })
          .eq("product_id", item.product_id);

        await supabaseAdmin.from("stock_movements").insert({
          product_id: item.product_id,
          change_qty: -Number(item.quantity),
          reason: "order_confirmation",
          reference_id: orderId,
          reference_type: "order",
          performed_by: changedBy,
        });
      }
    }

    // Update status to confirmed + mark as a real (non-pending) order
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        order_status: "confirmed",
        confirmed_order: true,
        credit_checked: true,
        pending_reason: null,
        created_by: changedBy,
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;

    // Send order-confirmation WhatsApp to the shop owner
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: order.shop_id, order_id: orderId }),
      });
    } catch {
      // non-fatal — confirmation already persisted
    }

    revalidateOrder(orderId);
    revalidateShop(order.shop_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "confirmOrder");
  }
}

export async function scheduleDelivery(
  orderId: string,
  deliveryDate: string,
  deliverySlot: string,
  changedBy: string
): Promise<ActionResult<Order>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        order_status: "out_for_delivery",
        delivery_date: deliveryDate,
        delivery_slot: deliverySlot,
        created_by: changedBy,
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;
    revalidateOrder(orderId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "scheduleDelivery");
  }
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  changedBy: string
): Promise<ActionResult<Order>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        order_status: "cancelled",
        created_by: changedBy,
      })
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) throw error;
    revalidateOrder(orderId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "cancelOrder");
  }
}

// ============================================================================
// DELIVERIES
// ============================================================================

export async function createDelivery(input: {
  order_id: string;
  delivery_date: string;
  delivery_slot?: string;
  vehicle_no?: string;
  delivery_person?: string;
  items: { order_item_id: number; delivered_qty: number }[];
  notes?: string;
}): Promise<ActionResult<Delivery>> {
  try {
    // Create delivery
    const { data: delivery, error: delError } = await supabaseAdmin
      .from("deliveries")
      .insert({
        order_id: input.order_id,
        delivery_date: input.delivery_date,
        delivery_slot: input.delivery_slot ?? null,
        vehicle_no: input.vehicle_no ?? null,
        delivery_person: input.delivery_person ?? null,
        status: "completed",
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (delError) throw delError;

    // Create delivery items
    const deliveryItems = input.items.map((item) => ({
      delivery_id: delivery.delivery_id,
      order_item_id: item.order_item_id,
      delivered_qty: item.delivered_qty,
      returned_qty: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("delivery_items")
      .insert(deliveryItems);

    if (itemsError) throw itemsError;

    // Update order status to delivered (trigger will handle inventory + stock_movements)
    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .update({ order_status: "delivered" })
      .eq("order_id", input.order_id);

    if (orderError) throw orderError;

    revalidateDeliveries();
    revalidateOrder(input.order_id);
    return { success: true, data: delivery };
  } catch (err) {
    return handleError(err, "createDelivery");
  }
}

export async function updateDelivery(
  deliveryId: number,
  input: Partial<Delivery>
): Promise<ActionResult<Delivery>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("deliveries")
      .update(input)
      .eq("delivery_id", deliveryId)
      .select()
      .single();

    if (error) throw error;
    revalidateDeliveries();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateDelivery");
  }
}

// ============================================================================
// PAYMENTS
// ============================================================================

export async function recordPayment(input: {
  shop_id: string;
  order_id?: string;
  amount: number;
  method: "cash" | "cheque" | "upi" | "bank" | "credit_note" | "adjustment";
  reference?: string;
  collected_by?: string;
  notes?: string;
}): Promise<ActionResult<Payment>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        shop_id: input.shop_id,
        order_id: input.order_id ?? null,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        collected_by: input.collected_by ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePayments();
    revalidateShop(input.shop_id);
    if (input.order_id) revalidateOrder(input.order_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "recordPayment");
  }
}

export async function getShopPaymentLedger(
  shopId: string
): Promise<ActionResult<ShopPaymentLedger[]>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("shop_payment_ledger")
      .select("*")
      .eq("shop_id", shopId)
      .order("collected_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: data ?? [] };
  } catch (err) {
    return handleError(err, "getShopPaymentLedger");
  }
}

// ============================================================================
// RETURNS
// ============================================================================

export async function createReturn(input: {
  shop_id: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  reason: string;
  photo_url?: string;
}): Promise<ActionResult<ReturnRecord>> {
  try {
    // Calculate credit note amount from order item price
    let creditNoteAmount = 0;
    if (input.order_id) {
      const { data: orderItem } = await supabaseAdmin
        .from("order_items")
        .select("price")
        .eq("order_id", input.order_id)
        .eq("product_id", input.product_id)
        .single();

      if (orderItem) {
        creditNoteAmount = orderItem.price * input.quantity;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("returns")
      .insert({
        shop_id: input.shop_id,
        order_id: input.order_id ?? null,
        product_id: input.product_id,
        quantity: input.quantity,
        reason: input.reason,
        photo_url: input.photo_url ?? null,
        credit_note_amount: creditNoteAmount,
        status: "requested",
      })
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    revalidateShop(input.shop_id);
    if (input.order_id) revalidateOrder(input.order_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "createReturn");
  }
}

export async function updateReturnStatus(
  returnId: number,
  status: ReturnStatus,
  creditNoteAmount?: number
): Promise<ActionResult<ReturnRecord>> {
  try {
    const updateData: Partial<ReturnRecord> = { status };
    if (creditNoteAmount !== undefined) {
      updateData.credit_note_amount = creditNoteAmount;
    }

    const { data, error } = await supabaseAdmin
      .from("returns")
      .update(updateData)
      .eq("return_id", returnId)
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    revalidateShop(data.shop_id);
    if (data.order_id) revalidateOrder(data.order_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateReturnStatus");
  }
}

// ============================================================================
// COMPLAINTS
// ============================================================================

export async function resolveComplaint(
  complaintId: number,
  resolutionNotes: string,
  resolvedBy: string
): Promise<ActionResult<Complaint>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .update({
        status: "resolved",
        description: resolutionNotes,
      })
      .eq("complaint_id", complaintId)
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    revalidateShop(data.shop_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "resolveComplaint");
  }
}

export async function closeComplaint(
  complaintId: number
): Promise<ActionResult<Complaint>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("complaints")
      .update({ status: "closed" })
      .eq("complaint_id", complaintId)
      .select()
      .single();

    if (error) throw error;
    revalidateExceptions();
    revalidateShop(data.shop_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "closeComplaint");
  }
}

// ============================================================================
// PRODUCTS
// ============================================================================

export async function createProduct(input: {
  product_id: string;
  product_name: string;
  brand?: string;
  category: string;
  unit_type: string;
  price: number;
  tax_rate?: number;
  supplier_id?: string;
}): Promise<ActionResult<Product>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        product_id: input.product_id,
        product_name: input.product_name,
        brand: input.brand ?? null,
        category: input.category,
        unit_type: input.unit_type,
        price: input.price,
        tax_rate: input.tax_rate ?? 18,
        supplier_id: input.supplier_id ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Initialize inventory
    await supabaseAdmin.from("inventory").insert({
      product_id: input.product_id,
      available_qty: 0,
      reserved_qty: 0,
      low_stock_threshold: 5,
    });

    revalidateCatalog();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "createProduct");
  }
}

export async function updateProduct(
  productId: string,
  input: Partial<Product>
): Promise<ActionResult<Product>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update(input)
      .eq("product_id", productId)
      .select()
      .single();

    if (error) throw error;
    revalidateCatalog();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateProduct");
  }
}

export async function deactivateProduct(productId: string): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("products")
      .update({ is_deleted: true, is_active: false })
      .eq("product_id", productId);

    if (error) throw error;
    revalidateCatalog();
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "deactivateProduct");
  }
}

export async function adjustInventory(input: {
  product_id: string;
  change_qty: number;
  reason: "restock" | "order_delivery" | "return_received" | "adjustment" | "damage" | "transfer";
  reference_id?: string;
  reference_type?: "order" | "delivery" | "return" | "manual";
  performed_by?: string;
}): Promise<ActionResult<StockMovement>> {
  try {
    // Update inventory
    const { data: inv, error: invError } = await supabaseAdmin
      .from("inventory")
      .select("available_qty")
      .eq("product_id", input.product_id)
      .single();

    if (invError) throw invError;

    const newQty = Math.max((inv?.available_qty ?? 0) + input.change_qty, 0);

    const { error: updError } = await supabaseAdmin
      .from("inventory")
      .update({ available_qty: newQty })
      .eq("product_id", input.product_id);

    if (updError) throw updError;

    // Create stock movement
    const { data: movement, error: movError } = await supabaseAdmin
      .from("stock_movements")
      .insert({
        product_id: input.product_id,
        change_qty: input.change_qty,
        reason: input.reason,
        reference_id: input.reference_id ?? null,
        reference_type: input.reference_type ?? null,
        performed_by: input.performed_by ?? null,
      })
      .select()
      .single();

    if (movError) throw movError;
    revalidateCatalog();
    return { success: true, data: movement };
  } catch (err) {
    return handleError(err, "adjustInventory");
  }
}

// ============================================================================
// SCHEMES
// ============================================================================

export async function createScheme(input: {
  scheme_id: string;
  scheme_name: string;
  start_date: string;
  end_date?: string;
  eligible_product_ids: string[];
  minimum_quantity?: number;
  benefit_type: "discount" | "free_units" | "cashback";
  benefit_value: number;
}): Promise<ActionResult<Scheme>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("schemes")
      .insert({
        scheme_id: input.scheme_id,
        scheme_name: input.scheme_name,
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        eligible_product_ids: input.eligible_product_ids,
        minimum_quantity: input.minimum_quantity ?? 1,
        benefit_type: input.benefit_type,
        benefit_value: input.benefit_value,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/admin/schemes");
    return { success: true, data };
  } catch (err) {
    return handleError(err, "createScheme");
  }
}

export async function updateScheme(
  schemeId: string,
  input: Partial<Scheme>
): Promise<ActionResult<Scheme>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("schemes")
      .update(input)
      .eq("scheme_id", schemeId)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/admin/schemes");
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateScheme");
  }
}

export async function deactivateScheme(schemeId: string): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("schemes")
      .update({ is_active: false })
      .eq("scheme_id", schemeId);

    if (error) throw error;
    revalidatePath("/admin/schemes");
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "deactivateScheme");
  }
}

// ============================================================================
// ROUTES
// ============================================================================

export async function createRoute(input: {
  route_id: string;
  route_name: string;
  salesperson?: string;
  coverage_area?: string;
}): Promise<ActionResult<Route>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .insert({
        route_id: input.route_id,
        route_name: input.route_name,
        salesperson: input.salesperson ?? null,
        coverage_area: input.coverage_area ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/admin/routes");
    revalidateShops();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "createRoute");
  }
}

export async function updateRoute(
  routeId: string,
  input: Partial<Route>
): Promise<ActionResult<Route>> {
  try {
    const { data, error } = await supabaseAdmin
      .from("routes")
      .update(input)
      .eq("route_id", routeId)
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/admin/routes");
    revalidateShops();
    return { success: true, data };
  } catch (err) {
    return handleError(err, "updateRoute");
  }
}

export async function deactivateRoute(routeId: string): Promise<ActionResult<void>> {
  try {
    const { error } = await supabaseAdmin
      .from("routes")
      .update({ is_active: false })
      .eq("route_id", routeId);

    if (error) throw error;
    revalidatePath("/admin/routes");
    revalidateShops();
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "deactivateRoute");
  }
}

// ============================================================================
// SHOP PHONES (multi-number per shop)
// ============================================================================

export interface ShopPhone {
  phone_id: number;
  shop_id: string;
  phone_number: string;
  label: string | null;
  is_primary: boolean;
}

export async function addShopPhone(
  shopId: string,
  phoneNumber: string,
  label?: string
): Promise<ActionResult<ShopPhone>> {
  try {
    const digits = phoneNumber.replace(/\D/g, "").slice(-10);
    if (!digits) return { success: false, error: "Valid phone number required" };

    const { data, error } = await supabaseAdmin
      .from("shop_phones")
      .insert({ shop_id: shopId, phone_number: digits, label: label ?? "alt", is_primary: false })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return { success: false, error: "This phone number is already added for the shop" };
      throw error;
    }
    revalidateShop(shopId);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "addShopPhone");
  }
}

export async function removeShopPhone(phoneId: number): Promise<ActionResult<void>> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("shop_phones")
      .select("shop_id, is_primary")
      .eq("phone_id", phoneId)
      .single();

    if (existing?.is_primary) {
      return { success: false, error: "Cannot remove the primary phone number" };
    }

    const { error } = await supabaseAdmin
      .from("shop_phones")
      .delete()
      .eq("phone_id", phoneId);

    if (error) throw error;
    if (existing) revalidateShop(existing.shop_id);
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "removeShopPhone");
  }
}

// ============================================================================
// TODAY'S DETAILS (notes stream per shop)
// ============================================================================

export async function writeTodayNote(input: {
  shop_id: string;
  note_text: string;
  note_type?: string;
  source?: "AI" | "human";
}): Promise<ActionResult<{ note_id: number; shop_id: string; note_date: string; note_type: string; note_text: string; source: string; created_at: string }>> {
  try {
    if (!input.note_text?.trim()) return { success: false, error: "Note text required" };

    const { data, error } = await supabaseAdmin
      .from("today_notes")
      .insert({
        shop_id: input.shop_id,
        note_date: todayIST(),
        note_type: input.note_type ?? "general",
        note_text: input.note_text.trim(),
        source: input.source ?? "human",
        agent_role: "portal",
      })
      .select()
      .single();

    if (error) throw error;
    revalidateShop(input.shop_id);
    return { success: true, data };
  } catch (err) {
    return handleError(err, "writeTodayNote");
  }
}

export async function markWhatsAppPendingSent(pendingId: number): Promise<ActionResult<{ wa_link: string | null }>> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("whatsapp_pending")
      .select("wa_link")
      .eq("id", pendingId)
      .eq("status", "pending")
      .single();
    if (!existing) return { success: false, error: "Pending message not found or already sent" };
    const { error } = await supabaseAdmin
      .from("whatsapp_pending")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", pendingId);
    if (error) throw error;
    revalidatePath("/");
    return { success: true, data: { wa_link: existing.wa_link } };
  } catch (err) {
    return handleError(err, "markWhatsAppPendingSent");
  }
}

export async function clearTodayNote(noteId: number): Promise<ActionResult<void>> {
  try {
    const { data: existing } = await supabaseAdmin
      .from("today_notes")
      .select("shop_id")
      .eq("note_id", noteId)
      .single();

    const { error } = await supabaseAdmin
      .from("today_notes")
      .delete()
      .eq("note_id", noteId);

    if (error) throw error;
    if (existing) revalidateShop(existing.shop_id);
    return { success: true, data: undefined };
  } catch (err) {
    return handleError(err, "clearTodayNote");
  }
}

async function nextOrderId(client: typeof supabaseAdmin): Promise<string> {
  const { data, error } = await client.from("orders").select("order_id");
  if (error) throw error;
  const max = Math.max(
    0,
    ...(data ?? []).map((r) => {
      const match = String((r as { order_id: string }).order_id).match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
  );
  return `ORD${String(max + 1).padStart(4, "0")}`;
}

// ──────────────────────────────────────────────
// Credit Management
// ──────────────────────────────────────────────

export async function adjustShopCredit(input: {
  shop_id: string;
  amount: number;
  reason: string;
  type: "credit" | "debit";
}): Promise<ActionResult<{ shop_id: string; new_balance: number; new_limit: number }>> {
  try {
    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .select("shop_id, credit_limit, outstanding_balance")
      .eq("shop_id", input.shop_id)
      .single();
    if (shopError || !shop) return { success: false, error: "Shop not found" };

    let newBalance = Number(shop.outstanding_balance);
    if (input.type === "credit") {
      // Payment received - reduce outstanding
      newBalance -= Math.abs(input.amount);
    } else {
      // Extra credit given - increase outstanding
      newBalance += Math.abs(input.amount);
    }

    const { error: updateError } = await supabaseAdmin
      .from("shops")
      .update({ outstanding_balance: newBalance })
      .eq("shop_id", input.shop_id);
    if (updateError) throw updateError;

    // Record as payment entry for audit trail
    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      shop_id: input.shop_id,
      amount: input.type === "credit" ? Math.abs(input.amount) : -Math.abs(input.amount),
      payment_method: "manual",
      reference_no: `CREDIT-${input.type.toUpperCase()}-${Date.now()}`,
      notes: input.reason,
      recorded_by: "HUMAN",
    });
    if (paymentError) console.error("Failed to record payment:", paymentError.message);

    revalidateShop(input.shop_id);
    return {
      success: true,
      data: {
        shop_id: input.shop_id,
        new_balance: newBalance,
        new_limit: Number(shop.credit_limit),
      },
    };
  } catch (err) {
    return handleError(err, "adjustShopCredit");
  }
}

export async function updateShopCreditLimit(input: {
  shop_id: string;
  credit_limit: number;
}): Promise<ActionResult<{ shop_id: string; new_limit: number }>> {
  try {
    const { error } = await supabaseAdmin
      .from("shops")
      .update({ credit_limit: input.credit_limit })
      .eq("shop_id", input.shop_id);
    if (error) throw error;

    revalidateShop(input.shop_id);
    return {
      success: true,
      data: { shop_id: input.shop_id, new_limit: input.credit_limit },
    };
  } catch (err) {
    return handleError(err, "updateShopCreditLimit");
  }
}