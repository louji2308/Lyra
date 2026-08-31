"use client";

import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/format";

interface MemoryRow {
  shop_name: string;
  shop_id: string;
  memory_id: number;
  memory_text: string;
  memory_type: string;
  confidence_score: number;
  confirmed_by_user: boolean;
  created_at: string;
}

interface ShopMemoryClientProps {
  memories: MemoryRow[];
  shopCount: number;
}

const typeLabels: Record<string, string> = {
  timing: "Timing",
  language: "Language",
  product_preference: "Product Preference",
  negative_memory: "Negative Memory",
  payment_behavior: "Payment Behavior",
  complaint_history: "Complaint History",
};

export function ShopMemoryClient({ memories, shopCount }: ShopMemoryClientProps) {
  if (memories.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Memory"
          subtitle="What the AI has learned about each shop"
          right={<a href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</a>}
        />
        <Card className="p-8 text-center">
          <EmptyState title="No AI memories yet" body="The AI will learn preferences over time." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Memory"
        subtitle={`${memories.length} memories across ${shopCount} shops`}
        right={<a href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</a>}
      />

      <Card>
        <CardHeader title="All Memories" />
        <DataTable
          columns={[
            { key: "shop_name", header: "Shop", className: "w-40",
              render: (m: MemoryRow) => (
                <a href={"/shops/" + m.shop_id} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                  {m.shop_name}
                </a>
              )
            },
            { key: "memory_type", header: "Type", className: "w-32",
              render: (m: MemoryRow) => <Badge tone="violet">{typeLabels[m.memory_type] ?? m.memory_type}</Badge>
            },
            { key: "memory_text", header: "Memory", className: "w-96",
              render: (m: MemoryRow) => <span className="text-zinc-600 max-w-xs truncate block" title={m.memory_text}>{m.memory_text}</span>
            },
            { key: "confidence_score", header: "Confidence", className: "w-28",
              render: (m: MemoryRow) => (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: (m.confidence_score * 100) + "%" }} />
                  </div>
                  <span className="text-xs text-zinc-500">{Math.round(m.confidence_score * 100)}%</span>
                </div>
              )
            },
            { key: "confirmed_by_user", header: "Confirmed", className: "w-24",
              render: (m: MemoryRow) => m.confirmed_by_user ? (
                <Badge tone="emerald">Yes</Badge>
              ) : (
                <Badge tone="zinc">Pending</Badge>
              )
            },
            { key: "created_at", header: "Created", className: "w-36",
              render: (m: MemoryRow) => <span className="text-zinc-500">{formatDate(m.created_at)}</span>
            },
          ]}
          data={memories}
          keyExtractor={(m: MemoryRow) => m.memory_id.toString()}
        />
      </Card>
    </div>
  );
}
