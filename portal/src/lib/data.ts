import { supabase } from "./supabase";
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
    .select("*")
    .order("product_name");
  if (error) throw error;
  return data ?? [];
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
} | null> {
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop) return null;

  const { data: credit, error: creditError } = await supabase
    .from("shop_credit")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (creditError) throw creditError;

  const { data: blacklist, error: blacklistError } = await supabase
    .from("blacklist")
    .select("*, products(product_id, product_name)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (blacklistError) throw blacklistError;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("shop_id", shopId)
    .order("order_date", { ascending: false });
  if (ordersError) throw ordersError;

  const { data: memories, error: memoriesError } = await supabase
    .from("shop_memory")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (memoriesError) throw memoriesError;

  const { data: complaints, error: complaintsError } = await supabase
    .from("complaints")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (complaintsError) throw complaintsError;

  const { data: callLogs, error: callLogsError } = await supabase
    .from("call_logs")
    .select("*")
    .eq("shop_id", shopId)
    .order("start_time", { ascending: false });
  if (callLogsError) throw callLogsError;

  const { data: returns, error: returnsError } = await supabase
    .from("returns")
    .select("*, products(product_id, product_name)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (returnsError) throw returnsError;

  const products = await getProducts();
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
  };
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
