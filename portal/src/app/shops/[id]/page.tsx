import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteName, getShopDetail } from "@/lib/data";
import { ShopDetailClient } from "./ShopDetailClient";

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Shop ${id}` };
}

export const dynamic = "force-dynamic";

export default async function ShopDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getShopDetail(id);
  if (!detail) notFound();

  const {
    shop,
    credit,
    blacklist,
    orders,
    memories,
    complaints,
    callLogs,
    returns,
    phones,
    todayNotes,
  } = detail;

  const routeName = shop.beat_route_id
    ? await getRouteName(shop.beat_route_id)
    : null;

  return (
    <ShopDetailClient
      shop={shop}
      credit={credit}
      blacklist={blacklist}
      orders={orders}
      memories={memories}
      complaints={complaints}
      callLogs={callLogs}
      returns={returns}
      phones={phones}
      todayNotes={todayNotes}
      routeName={routeName}
    />
  );
}