import type { Metadata } from "next";
import { getShops, getRoutes } from "@/lib/data";
import { ShopsClient } from "./ShopsClient";

export const metadata: Metadata = { title: "Shops" };

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const [shops, routes] = await Promise.all([getShops(), getRoutes()]);

  return <ShopsClient shops={shops} routes={routes} />;
}