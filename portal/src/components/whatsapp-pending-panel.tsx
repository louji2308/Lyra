"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { markWhatsAppPendingSent } from "@/lib/actions";
import type { PendingWhatsAppItem } from "@/lib/data";

export function WhatsAppPendingPanel({ items }: { items: PendingWhatsAppItem[] }) {
  const router = useRouter();
  const [sendingId, setSendingId] = useState<number | null>(null);

  const handleSend = async (item: PendingWhatsAppItem) => {
    setSendingId(item.id);
    const res = await markWhatsAppPendingSent(item.id);
    if (!res.success) {
      alert(res.error);
    } else if (res.data?.wa_link) {
      window.open(res.data.wa_link, "_blank");
    }
    router.refresh();
    setSendingId(null);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Pending WhatsApp"
          subtitle="Queued by AI agents — click Send to open WhatsApp for that shop"
        />
        <div className="p-5">
          <EmptyState title="No pending messages" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Pending WhatsApp"
        subtitle="Queued by AI agents — click Send to open WhatsApp for that shop"
      />
      <ul className="divide-y divide-border-subtle">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-charcoal">{item.shop_name}</p>
                <Badge tone={item.kind === "order_summary" ? "sky" : "amber"}>{item.kind}</Badge>
                <span className="text-xs text-charcoal-light/40">{formatDateTime(item.created_at)}</span>
              </div>
              <p className="mt-1 truncate text-xs text-charcoal-light/70">
                {item.message.length > 120 ? `${item.message.slice(0, 120)}…` : item.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={sendingId !== null && sendingId !== item.id}
              onClick={() => handleSend(item)}
            >
              {sendingId === item.id ? "Sending…" : "Send WhatsApp"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}