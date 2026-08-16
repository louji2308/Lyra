import type { Metadata } from "next";
import Link from "next/link";
import { getMemories } from "@/lib/data";
import { formatDateTime, memoryTypeLabel } from "@/lib/format";
import { memoryTypeTone } from "@/lib/tones";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui";

export const metadata: Metadata = { title: "AI Memory" };

export const dynamic = "force-dynamic";

const memoryOrder = [
  "product_preference",
  "negative_memory",
  "timing",
  "language",
  "payment_behavior",
  "complaint_history",
] as const;

export default async function MemoryPage() {
  const memories = await getMemories();

  const confirmed = memories.filter((m) => m.confirmed_by_user).length;
  const avgConfidence = memories.length
    ? Math.round(
        (memories.reduce((sum, m) => sum + m.confidence_score, 0) /
          memories.length) *
          100
      )
    : 0;

  const byType = new Map<string, typeof memories>();
  for (const m of memories) {
    const list = byType.get(m.memory_type) ?? [];
    list.push(m);
    byType.set(m.memory_type, list);
  }
  const groups = memoryOrder
    .map((type) => ({ type, items: byType.get(type) ?? [] }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Memory"
        subtitle="What the Co-Pilot has learned about each shop"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total memories" value={memories.length} />
        <Stat label="Confirmed" value={confirmed} />
        <Stat label="Needs review" value={memories.length - confirmed} />
        <Stat label="Avg confidence" value={`${avgConfidence}%`} />
      </div>

      {memories.length === 0 ? (
        <EmptyState
          title="No memories yet"
          body="The AI records shop preferences after every voice call."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.type}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={memoryTypeTone[group.type]}>
                  {memoryTypeLabel[group.type]}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "memory" : "memories"}
                </span>
              </div>
              <Card>
                <ul className="divide-y divide-zinc-100">
                  {group.items.map((m) => (
                    <li
                      key={m.memory_id}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-800">{m.memory_text}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          <Link
                            href={`/shops/${m.shop_id}`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {m.shop_name}
                          </Link>
                          {" · "}
                          {formatDateTime(m.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.round(
                                  m.confidence_score * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">
                            {Math.round(m.confidence_score * 100)}%
                          </span>
                        </div>
                        {m.confirmed_by_user ? (
                          <Badge tone="emerald">Confirmed</Badge>
                        ) : (
                          <Badge tone="amber">Review</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
