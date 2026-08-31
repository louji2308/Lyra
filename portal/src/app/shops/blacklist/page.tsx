import type { Metadata } from "next";
import { getShops } from "@/lib/data";
import { ShopBlacklistClient } from "./components/ShopBlacklistClient";

export const metadata: Metadata = { title: "Blacklist" };

export const dynamic = "force-dynamic";

export default async function ShopBlacklistPage() {
  const shops = await getShops();

  const allBlacklist = shops.flatMap(s =>
    s.blacklist?.map((b) => ({
      ...b,
      shop_name: s.shop_name,
      shop_id: s.shop_id,
    })) ?? []
  );

  const shopCount = shops.filter(s => s.blacklist?.length).length;

  return <ShopBlacklistClient blacklist={allBlacklist} shopCount={shopCount} />;
}
