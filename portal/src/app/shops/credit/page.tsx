import type { Metadata } from "next";
import { getShops } from "@/lib/data";
import { ShopCreditClient } from "./components/ShopCreditClient";

export const metadata: Metadata = { title: "Shop Credit & Payments" };

export const dynamic = "force-dynamic";

export default async function ShopCreditPage() {
  const shops = await getShops();
  return <ShopCreditClient shops={shops} />;
}
