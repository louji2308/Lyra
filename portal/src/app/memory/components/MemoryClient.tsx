"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { confirmMemory, deleteMemory } from "@/lib/actions";
import type { ShopMemory } from "@/lib/types";
import { formatDateTime, memoryTypeLabel } from "@/lib/format";
import { memoryTypeTone } from "@/lib/tones";

const memoryOrder = [
  "product_preference",
  "negative_memory",
  "timing",
  "language",
  "payment_behavior",
  "complaint_history",
] as const;

interface MemoryClientProps {
  memories: {
    memory_id: number;
    shop_id: string;
    memory_text: string;
    memory_type: string;
    confidence_score: number;
    confirmed_by_user: boolean;
    created_at: string;
    shop_name: string;
  }[];
}

export function MemoryClient({ memories: initialMemories }: MemoryClientProps) {
  const [memories, setMemories] = useState(initialMemories);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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

  const handleConfirm = async (memoryId: number) => {
    setLoadingAction(`confirm-${memoryId}`);
    const result = await confirmMemory(memoryId);
    if (result.success) {
      setMemories(memories.map(m => m.memory_id === memoryId ? { ...m, confirmed_by_user: true } : m));
    } else {
      alert(result.error);
    }
    setLoadingAction(null);
  };

  const handleDelete = async (memoryId: number) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    setLoadingAction(`delete-${memoryId}`);
    const result = await deleteMemory(memoryId);
    if (result.success) {
      setMemories(memories.filter(m => m.memory_id !== memoryId));
    } else {
      alert(result.error);
    }
    setLoadingAction(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Memory"
        subtitle="What the Co-Pilot has learned about each shop"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total memories" value={memories.length} />
        <Stat label="Confirmed" value={memories.filter(m => m.confirmed_by_user).length} />
        <Stat label="Needs review" value={memories.length - memories.filter(m => m.confirmed_by_user).length} />
        <Stat label="Avg confidence" value={`${memories.length ? Math.round(memories.reduce((sum, m) => sum + m.confidence_score, 0) / memories.length * 100) : 0}%`} />
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
                          <a
                            href={`/shops/${m.shop_id}`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {m.shop_name}
                          </a>
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
                                width: `${Math.round(m.confidence_score * 100)}%`,
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
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfirm(m.memory_id)}
                              disabled={loadingAction === `confirm-${m.memory_id}`}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(m.memory_id)}
                              disabled={loadingAction === `delete-${m.memory_id}`}
                            >
                              Delete
                            </Button>
                          </>
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