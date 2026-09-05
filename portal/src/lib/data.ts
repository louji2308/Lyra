import { supabase } from "./supabase";
import { todayIST } from "@/lib/format";
import type {
  BlacklistEntry,
  BlacklistWithProduct,
  CallLog,
  Complaint,
  ComplaintWithShop,
  LowStockProduct,
  MemoryWithShop,
  Order,
  OrderDetail,
  OrderItem,
  Product,
  ReturnWithShop,
  Shop,
  ShopCredit,
  ShopMemory,
  ShopWithExtras,
} from "./types";

type OrderRow = Order & { shops: { shop_name: string } | null };
type BlacklistRow = BlacklistEntry & {
  products: { product_id: string; product_name: string } | null;
};
type ShopOrderRow = Order & { order_items: OrderItem[] };
type MemoryRow = ShopMemory & { shops: { shop_name: string } | null };
type ComplaintRow = Complaint & { shops: { shop_name: string } | null };
type ReturnRow = ReturnWithShop & {
  products: { product_id: string; product_name: string } | null;
};

export async function getRouteName(routeId: string): Promise<string | null> {
  if (!routeId) return null;
  const { data, error } = await supabase
    .from("routes")
    .select("route_name")
    .eq("route_id", routeId)
    .maybeSingle();
  if (error) throw error;
  return data?.route_name ?? null;
}

export async function getRoutes() {
  const { data, error } = await supabase
    .from("routes")
    .select("route_id, route_name, salesperson, coverage_area, is_active")
    .eq("is_active", true)
    .order("route_name");
  if (error) throw error;
  return data ?? [];
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, inventory(available_qty)")
    .order("product_name");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const inv = (row as { inventory?: { available_qty: number } | { available_qty: number }[] | null }).inventory;
    const rec = Array.isArray(inv) ? inv[0] : inv;
    return { ...row, available_qty: rec ? Number(rec.available_qty) : 0 } as Product;
  });
}

export async function getShops(): Promise<ShopWithExtras[]> {
  const { data: shops, error: shopsError } = await supabase
    .from("shops")
    .select("*")
    .order("shop_name");
  if (shopsError) throw shopsError;

  const { data: credit, error: creditError } = await supabase
    .from("shop_credit")
    .select("*");
  if (creditError) throw creditError;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("shop_id, order_id");
  if (ordersError) throw ordersError;

  const { data: blacklist, error: blacklistError } = await supabase
    .from("blacklist")
    .select("shop_id, blacklist_id, product_id, reason, created_at");
  if (blacklistError) throw blacklistError;

  const { data: memories, error: memoriesError } = await supabase
    .from("shop_memory")
    .select("shop_id, memory_id, memory_text, memory_type, confidence_score, confirmed_by_user, created_at");
  if (memoriesError) throw memoriesError;

  const creditById = new Map(credit.map((c: ShopCredit) => [c.shop_id, c]));
  const orderCount = new Map<string, number>();
  for (const o of orders ?? []) {
    orderCount.set(o.shop_id, (orderCount.get(o.shop_id) ?? 0) + 1);
  }
  const blacklistCount = new Map<string, number>();
  const blacklistByShop = new Map<string, { blacklist_id: number; product_id: string; reason: string | null; created_at: string }[]>();
  for (const b of blacklist ?? []) {
    blacklistCount.set(b.shop_id, (blacklistCount.get(b.shop_id) ?? 0) + 1);
    const list = blacklistByShop.get(b.shop_id) ?? [];
    list.push({ blacklist_id: b.blacklist_id, product_id: b.product_id, reason: b.reason, created_at: b.created_at });
    blacklistByShop.set(b.shop_id, list);
  }
  const memoriesByShop = new Map<string, { memory_id: number; memory_text: string; memory_type: "timing" | "language" | "product_preference" | "negative_memory" | "payment_behavior" | "complaint_history"; confidence_score: number; confirmed_by_user: boolean; created_at: string }[]>();
  for (const m of memories ?? []) {
    const list = memoriesByShop.get(m.shop_id) ?? [];
    list.push({ memory_id: m.memory_id, memory_text: m.memory_text, memory_type: m.memory_type, confidence_score: m.confidence_score, confirmed_by_user: m.confirmed_by_user, created_at: m.created_at });
    memoriesByShop.set(m.shop_id, list);
  }

  return (shops ?? []).map((s: Shop) => {
    const c = creditById.get(s.shop_id);
    return {
      ...s,
      available_credit: c?.available_credit ?? 0,
      credit_exceeded: c?.credit_exceeded ?? false,
      order_count: orderCount.get(s.shop_id) ?? 0,
      blacklist_count: blacklistCount.get(s.shop_id) ?? 0,
      blacklist: blacklistByShop.get(s.shop_id) ?? [],
      memories: memoriesByShop.get(s.shop_id) ?? [],
    };
  });
}

export async function getShopDetail(
  shopId: string
): Promise<{
  shop: Shop;
  credit: ShopCredit | null;
  blacklist: BlacklistWithProduct[];
  orders: OrderDetail[];
  memories: ShopMemory[];
  complaints: Complaint[];
  callLogs: CallLog[];
  returns: ReturnWithShop[];
  phones: { phone_id: number; phone_number: string; label: string | null; is_primary: boolean }[];
  todayNotes: { note_id: number; note_type: string; note_text: string; source: string; agent_role: string | null; created_at: string }[];
} | null> {
  const today = todayIST();

  const [
    shopRes,
    phonesRes,
    todayNotesRes,
    creditRes,
    blacklistRes,
    ordersRes,
    memoriesRes,
    complaintsRes,
    callLogsRes,
    returnsRes,
    productsRes,
  ] = await Promise.all([
    supabase
      .from("shops")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle(),
    supabase
      .from("shop_phones")
      .select("phone_id, phone_number, label, is_primary")
      .eq("shop_id", shopId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("today_notes")
      .select("note_id, note_type, note_text, source, agent_role, created_at")
      .eq("shop_id", shopId)
      .eq("note_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("shop_credit")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle(),
    supabase
      .from("blacklist")
      .select("*, products(product_id, product_name)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("shop_id", shopId)
      .order("order_date", { ascending: false }),
    supabase
      .from("shop_memory")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("complaints")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("call_logs")
      .select("*")
      .eq("shop_id", shopId)
      .order("start_time", { ascending: false }),
    supabase
      .from("returns")
      .select("*, products(product_id, product_name)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    getProducts(),
  ]);

  const { data: shop, error: shopError } = shopRes;
  const { data: phones } = phonesRes;
  const { data: todayNotes } = todayNotesRes;
  const { data: credit, error: creditError } = creditRes;
  const { data: blacklist, error: blacklistError } = blacklistRes;
  const { data: orders, error: ordersError } = ordersRes;
  const { data: memories, error: memoriesError } = memoriesRes;
  const { data: complaints, error: complaintsError } = complaintsRes;
  const { data: callLogs, error: callLogsError } = callLogsRes;
  const { data: returns, error: returnsError } = returnsRes;
  const products = productsRes;

  if (shopError) throw shopError;
  if (!shop) return null;
  if (creditError) throw creditError;
  if (blacklistError) throw blacklistError;
  if (ordersError) throw ordersError;
  if (memoriesError) throw memoriesError;
  if (complaintsError) throw complaintsError;
  if (callLogsError) throw callLogsError;
  if (returnsError) throw returnsError;
  const productName = new Map(
    products.map((p) => [p.product_id, p.product_name])
  );

  const orderDetails: OrderDetail[] = ((orders as ShopOrderRow[] | null) ??
    []).map(
    (o) => ({
      ...o,
      shop_name: shop.shop_name,
      items: (o.order_items ?? []).map((item: OrderItem) => ({
        ...item,
        product_name: productName.get(item.product_id) ?? item.product_id,
      })),
    })
  );

  return {
    shop,
    credit: (credit as ShopCredit | null) ?? null,
    blacklist: ((blacklist as BlacklistRow[] | null) ?? []).map((b) => ({
      ...b,
      product_name: b.products?.product_name ?? b.product_id,
    })) as BlacklistWithProduct[],
    orders: orderDetails,
    memories: (memories ?? []) as ShopMemory[],
    complaints: (complaints ?? []) as Complaint[],
    callLogs: (callLogs ?? []) as CallLog[],
    returns: ((returns as ReturnRow[] | null) ?? []).map((r) => ({
      ...r,
      product_name: r.products?.product_name ?? null,
    })) as ReturnWithShop[],
    phones: (phones ?? []).map((p) => ({
      phone_id: p.phone_id,
      phone_number: p.phone_number,
      label: p.label,
      is_primary: p.is_primary,
    })),
    todayNotes: (todayNotes ?? []).map((n) => ({
      note_id: n.note_id,
      note_type: n.note_type,
      note_text: n.note_text,
      source: n.source,
      agent_role: n.agent_role,
      created_at: n.created_at,
    })),
  };
}

export async function getTodayNotes(
  shopId: string
): Promise<{ note_id: number; note_type: string; note_text: string; source: string; agent_role: string | null; created_at: string }[]> {
  const today = todayIST();
  const { data } = await supabase
    .from("today_notes")
    .select("note_id, note_type, note_text, source, agent_role, created_at")
    .eq("shop_id", shopId)
    .eq("note_date", today)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({
    note_id: n.note_id,
    note_type: n.note_type,
    note_text: n.note_text,
    source: n.source,
    agent_role: n.agent_role,
    created_at: n.created_at,
  }));
}

export async function getAllTodayNotes(): Promise<{
  note_id: number;
  shop_id: string;
  shop_name: string;
  note_type: string;
  note_text: string;
  source: string;
agent_role: string | null;
  created_at: string;
}[]> {
  const today = todayIST();
  const { data, error } = await supabase
    .from("today_notes")
    .select("note_id, shop_id, note_type, note_text, source, agent_role, created_at, shops(shop_name)")
    .eq("note_date", today)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type TodayNoteRow = {
    note_id: number;
    shop_id: string;
    note_type: string;
    note_text: string;
    source: string;
    agent_role: string | null;
    created_at: string;
    shops?: { shop_name: string }[] | null;
  };
  const rows = (data ?? []) as unknown as TodayNoteRow[];
  return rows.map((n) => ({
    note_id: n.note_id,
    shop_id: n.shop_id,
    shop_name: n.shops?.[0]?.shop_name ?? n.shop_id,
    note_type: n.note_type,
    note_text: n.note_text,
    source: n.source,
    agent_role: n.agent_role,
    created_at: n.created_at,
  }));
}

export interface PendingWhatsAppItem {
  id: number;
  shop_id: string;
  shop_name: string;
  kind: string;
  message: string;
  wa_link: string | null;
  whatsapp_number: string | null;
  status: string;
  agent_role: string | null;
  created_at: string;
}

export async function getPendingWhatsApps(): Promise<PendingWhatsAppItem[]> {
  const { data, error } = await supabase
    .from("whatsapp_pending")
    .select("id, shop_id, kind, message, wa_link, whatsapp_number, status, agent_role, created_at, shops(shop_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  type Row = {
    id: number; shop_id: string; kind: string; message: string;
    wa_link: string | null; whatsapp_number: string | null; status: string;
    agent_role: string | null; created_at: string;
    shops?: { shop_name: string }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    shop_id: r.shop_id,
    shop_name: r.shops?.[0]?.shop_name ?? r.shop_id,
    kind: r.kind,
    message: r.message,
    wa_link: r.wa_link,
    whatsapp_number: r.whatsapp_number,
    status: r.status,
    agent_role: r.agent_role,
    created_at: r.created_at,
  }));
}

async function getOrdersWithItems(orders: OrderRow[]): Promise<OrderDetail[]> {
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .order("order_item_id", { ascending: true });
  if (itemsError) throw itemsError;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("product_id, product_name");
  if (productsError) throw productsError;

  const productName = new Map(
    (products ?? []).map((p) => [p.product_id, p.product_name])
  );
  const itemsByOrder = new Map<string, OrderDetail["items"]>();
  for (const item of orderItems ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      ...item,
      product_name: productName.get(item.product_id) ?? item.product_id,
    });
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((o) => ({
    ...o,
    shop_name: o.shops?.shop_name ?? o.shop_id,
    items: itemsByOrder.get(o.order_id) ?? [],
  }));
}

export async function getOrders(): Promise<OrderDetail[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, shops(shop_name)")
    .order("order_date", { ascending: false });
  if (error) throw error;
  return getOrdersWithItems((data as OrderRow[]) ?? []);
}

export async function getMemories(): Promise<MemoryWithShop[]> {
  const { data, error } = await supabase
    .from("shop_memory")
    .select("*, shops(shop_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as MemoryRow[]) ?? []).map((m) => ({
    ...m,
    shop_name: m.shops?.shop_name ?? m.shop_id,
  }));
}

export async function getLowStock(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase
    .from("low_stock_products")
    .select("*")
    .order("available_qty", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCreditRisk(): Promise<ShopCredit[]> {
  const { data, error } = await supabase
    .from("shop_credit")
    .select("*")
    .eq("credit_exceeded", true)
    .order("available_credit", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getOpenComplaints(): Promise<ComplaintWithShop[]> {
  const { data, error } = await supabase
    .from("complaints")
    .select("*, shops(shop_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as ComplaintRow[]) ?? []).map((c) => ({
    ...c,
    shop_name: c.shops?.shop_name ?? c.shop_id,
  }));
}

export async function getOpenReturns(): Promise<ReturnWithShop[]> {
  const { data, error } = await supabase
    .from("returns")
    .select("*, shops(shop_name), products(product_id, product_name)")
    .neq("status", "credit_issued")
    .neq("status", "rejected")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as ReturnRow[]) ?? []).map((r) => ({
    ...r,
    product_name: r.products?.product_name ?? null,
  }));
}

export async function getPendingOrders(): Promise<OrderDetail[]> {
  const pending: Order["order_status"][] = [
    "draft",
    "awaiting_confirmation",
    "confirmed",
    "payment_pending",
    "out_for_delivery",
    "exception",
  ];
  const { data, error } = await supabase
    .from("orders")
    .select("*, shops(shop_name)")
    .in("order_status", pending)
    .order("order_date", { ascending: false });
  if (error) throw error;
  return getOrdersWithItems((data as OrderRow[]) ?? []);
}

export async function getActiveSchemes() {
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .eq("is_active", true)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDeliveries() {
  const { data, error } = await supabase
    .from("delivery_summary")
    .select("*")
    .order("delivery_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPayments() {
  const { data, error } = await supabase
    .from("shop_payment_ledger")
    .select("*")
    .order("collected_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSchemes() {
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
