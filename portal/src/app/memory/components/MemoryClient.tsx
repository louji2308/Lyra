"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { FormField, NumberInput, SelectField } from "@/components/ui/FormFields";
import { addMemory, confirmMemory, deleteMemory, updateMemory } from "@/lib/actions";
import type { MemoryType } from "@/lib/types";
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

interface MemoryRow {
  memory_id: number;
  shop_id: string;
  memory_text: string;
  memory_type: string;
  confidence_score: number;
  confirmed_by_user: boolean;
  created_at: string;
  shop_name: string;
}

interface ShopOption {
  shop_id: string;
  shop_name: string;
}

interface MemoryClientProps {
  memories: MemoryRow[];
  shops: ShopOption[];
}

const memoryTypeOptions = memoryOrder.map((t) => ({
  value: t,
  label: memoryTypeLabel[t],
}));

export function MemoryClient({ memories: initialMemories, shops }: MemoryClientProps) {
  const [memories, setMemories] = useState(initialMemories);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    shop_id: shops[0]?.shop_id ?? "",
    memory_text: "",
    memory_type: "product_preference" as MemoryType,
    confidence: "",
    confirmed: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ memory_text: "", memory_type: "", confidence: "" });

  const byType = new Map<string, typeof memories>();
  for (const m of memories) {
    const list = byType.get(m.memory_type) ?? [];
    list.push(m);
    byType.set(m.memory_type, list);
  }
  const groups = memoryOrder
    .map((type) => ({ type, items: byType.get(type) ?? [] }))
    .filter((g) => g.items.length > 0);

  const handleAddSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addForm.shop_id) {
      alert("Select a shop");
      return;
    }
    if (!addForm.memory_text.trim()) {
      alert("Memory text is required");
      return;
    }
    setLoadingAction("add-memory");
    const result = await addMemory({
      shop_id: addForm.shop_id,
      memory_text: addForm.memory_text,
      memory_type: addForm.memory_type,
      confidence_score: addForm.confidence === "" ? undefined : Number(addForm.confidence) / 100,
      confirmed_by_user: addForm.confirmed || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      const shop = shops.find((s) => s.shop_id === result.data.shop_id);
      setMemories([{ ...result.data, shop_name: shop?.shop_name ?? result.data.shop_id }, ...memories]);
      setAddForm({
        shop_id: addForm.shop_id,
        memory_text: "",
        memory_type: "product_preference",
        confidence: "",
        confirmed: false,
      });
      setIsAdding(false);
    } else {
      alert(result.error);
    }
  };

  const startEdit = (m: MemoryRow) => {
    setEditingId(m.memory_id);
    setEditForm({
      memory_text: m.memory_text,
      memory_type: m.memory_type,
      confidence: String(Math.round(m.confidence_score * 100)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ memory_text: "", memory_type: "", confidence: "" });
  };

  const handleSaveEdit = async (m: MemoryRow) => {
    if (!editForm.memory_text.trim()) {
      alert("Memory text is required");
      return;
    }
    setLoadingAction(`edit-${m.memory_id}`);
    const result = await updateMemory(m.memory_id, {
      memory_text: editForm.memory_text,
      memory_type: editForm.memory_type as MemoryType,
      confidence_score: editForm.confidence === "" ? undefined : Number(editForm.confidence) / 100,
    });
    setLoadingAction(null);
    if (result.success) {
      setMemories(
        memories.map((mm) =>
          mm.memory_id === m.memory_id ? { ...mm, ...result.data } : mm
        )
      );
      setEditingId(null);
    } else {
      alert(result.error);
    }
  };

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

      <div className="flex justify-end">
        <Button
          variant={isAdding ? "ghost" : "outline"}
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? "Cancel" : "+ Add memory"}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader title="Add Memory" />
          <form onSubmit={handleAddSubmit} className="space-y-4 p-5">
            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Shop"
                id="memory_shop_id"
                value={addForm.shop_id}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setAddForm({ ...addForm, shop_id: e.target.value })
                }
                options={shops.map((s) => ({ value: s.shop_id, label: s.shop_name }))}
                placeholder="Select shop"
                required
              />
              <SelectField
                label="Type"
                id="memory_type"
                value={addForm.memory_type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setAddForm({ ...addForm, memory_type: e.target.value as MemoryType })
                }
                options={memoryTypeOptions}
              />
              <FormField
                label="Memory"
                id="memory_text"
                value={addForm.memory_text}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddForm({ ...addForm, memory_text: e.target.value })
                }
                placeholder="What Lyra should remember"
                required
              />
              <NumberInput
                label="Confidence %"
                id="memory_confidence"
                value={addForm.confidence}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddForm({ ...addForm, confidence: e.target.value })
                }
                min={0}
                max={100}
                step={1}
                placeholder="50"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={addForm.confirmed}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setAddForm({ ...addForm, confirmed: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border-subtle text-accent-peach focus:ring-accent-peach/30"
                />
                Confirmed
              </label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={loadingAction === "add-memory"}>
                  Save memory
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

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
                      {editingId === m.memory_id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveEdit(m);
                          }}
                          className="flex flex-col items-end gap-2"
                        >
                          <div className="grid gap-2 sm:grid-cols-3">
                            <FormField
                              label="Memory"
                              id={`edit_text_${m.memory_id}`}
                              value={editForm.memory_text}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setEditForm({ ...editForm, memory_text: e.target.value })
                              }
                            />
                            <SelectField
                              label="Type"
                              id={`edit_type_${m.memory_id}`}
                              value={editForm.memory_type}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                setEditForm({ ...editForm, memory_type: e.target.value })
                              }
                              options={memoryTypeOptions}
                            />
                            <NumberInput
                              label="Confidence %"
                              id={`edit_conf_${m.memory_id}`}
                              value={editForm.confidence}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setEditForm({ ...editForm, confidence: e.target.value })
                              }
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              type="submit"
                              loading={loadingAction === `edit-${m.memory_id}`}
                            >
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" type="button" onClick={cancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
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
                          {m.confirmed_by_user && <Badge tone="emerald">Confirmed</Badge>}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(m)}
                          >
                            Edit
                          </Button>
                          {!m.confirmed_by_user && (
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
                      )}
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