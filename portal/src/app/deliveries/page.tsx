import type { Metadata } from "next";
import { getOrders, getDeliveries } from "@/lib/data";
import { DeliveriesClient } from "./components/DeliveriesClient";

export const metadata: Metadata = { title: "Deliveries" };

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const [orders, deliveries] = await Promise.all([getOrders(), getDeliveries()]);
  return <DeliveriesClient deliveries={deliveries} orders={orders} />;
}