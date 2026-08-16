import type { Metadata } from "next";
import { Badge, PageHeader } from "@/components/ui";
import { VoiceSimulator } from "@/components/voice-simulator";
import { getOrders, getShops } from "@/lib/data";
import type { AppLanguage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Voice AI",
};

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const [shops, orders] = await Promise.all([getShops(), getOrders()]);

  const shopOptions = shops.map((s) => ({
    shop_id: s.shop_id,
    shop_name: s.shop_name,
    preferred_language: s.preferred_language as AppLanguage,
  }));

  const repeatByShop: Record<
    string,
    { product_name: string; quantity: number; unit: string }[]
  > = {};
  for (const order of orders) {
    if (!repeatByShop[order.shop_id]) {
      repeatByShop[order.shop_id] = order.items.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
      }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice AI"
        subtitle="Lyra voice agent foundation — run the call flow in your browser, no phone needed."
        right={<Badge tone="emerald">Phase 3 · Foundation</Badge>}
      />
      <VoiceSimulator shops={shopOptions} repeatByShop={repeatByShop} />
    </div>
  );
}
