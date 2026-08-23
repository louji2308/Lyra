import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrders, getShops, getProducts } from "@/lib/data";
import { OrderDetailClient } from "../components/OrderDetailClient";

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orders = await getOrders();
  const order = orders.find(o => o.order_id === id);
  if (!order) notFound();

  const [shops, products] = await Promise.all([getShops(), getProducts()]);

  return <OrderDetailClient order={order} shops={shops} products={products} />;
}