import type { Metadata } from "next";
import { getRoutes, getShops } from "@/lib/data";
import { RoutesClient } from "./components/RoutesClient";

export const metadata: Metadata = { title: "Routes & Sales Beats" };

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const [routes, shops] = await Promise.all([getRoutes(), getShops()]);
  return <RoutesClient routes={routes} shops={shops} />;
}