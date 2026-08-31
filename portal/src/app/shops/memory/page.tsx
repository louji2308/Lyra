import type { Metadata } from "next";
import { getShops } from "@/lib/data";
import { ShopMemoryClient } from "./components/ShopMemoryClient";

export const metadata: Metadata = { title: "AI Memory" };

export const dynamic = "force-dynamic";

export default async function ShopMemoryPage() {
  const shops = await getShops();

  const allMemory = shops.flatMap(s =>
    s.memories?.map((m) => ({
      ...m,
      shop_name: s.shop_name,
      shop_id: s.shop_id,
    })) ?? []
  );

  const shopCount = shops.filter(s => s.memories?.length).length;

  return <ShopMemoryClient memories={allMemory} shopCount={shopCount} />;
}
