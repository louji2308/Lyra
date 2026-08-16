import type { Metadata } from "next";
import { Badge, PageHeader } from "@/components/ui";
import { VoiceSimulator } from "@/components/voice-simulator";
import { getShops } from "@/lib/data";
import type { AppLanguage } from "@/lib/types";

export const metadata: Metadata = {
  title: "Voice AI",
};

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const shops = await getShops();

  const shopOptions = shops.map((s) => ({
    shop_id: s.shop_id,
    shop_name: s.shop_name,
    preferred_language: s.preferred_language as AppLanguage,
    phone_number: s.phone_number,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice AI"
        subtitle="Lyra voice agent connected to the live database — identify the shop by Caller ID, suggest the repeat order, save the confirmed order."
        right={<Badge tone="emerald">Phase 4 · Live database</Badge>}
      />
      <VoiceSimulator shops={shopOptions} />
    </div>
  );
}
