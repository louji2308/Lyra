import type { Metadata } from "next";
import { getOrders, getShops, getProducts } from "@/lib/data";
import { OrdersClient } from "./components/OrdersClient";

export const metadata: Metadata = { title: "Orders" };

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, shops, products] = await Promise.all([getOrders(), getShops(), getProducts()]);
  return <OrdersClient orders={orders} shops={shops} products={products} />;
}