"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SectionLabel, KeyValue } from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { updateReturnStatus, createReturn } from "@/lib/actions";
import type { ReturnWithShop, OrderDetail, OrderItem, ReturnStatus } from "@/lib/types";
import { formatINR, formatDate, complaintTypeLabel } from "@/lib/format";
import { returnStatusLabel, returnStatusTone } from "@/lib/tones";

interface ReturnsClientProps {
  returns: ReturnWithShop[];
  orders: OrderDetail[];
}

export function ReturnsClient({ returns: initialReturns, orders }: ReturnsClientProps) {
  const [returns, setReturns] = useState<ReturnWithShop[]>(initialReturns);
  const [createReturnModal, setCreateReturnModal] = useState<{ isOpen: boolean; orderId: string; orderItem: OrderItem | null }>({ isOpen: false, orderId: "", orderItem: null });
  const [returnForm, setReturnForm] = useState({ quantity: 1, reason: "damaged_goods", photo_url: "" });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const statusOrder: ReturnStatus[] = ["requested", "photo_received", "approved", "collected", "credit_issued", "rejected"];

  const getNextStatuses = (currentStatus: ReturnStatus): ReturnStatus[] => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statusOrder.length - 1) return [];
    return statusOrder.slice(currentIndex + 1);
  };

  const handleUpdateStatus = async (returnId: number, newStatus: ReturnStatus) => {
    setLoadingAction(`status-${returnId}`);
    const result = await updateReturnStatus(returnId, newStatus);
    setLoadingAction(null);
    if (result.success) {
      setReturns(returns.map(r => r.return_id === returnId ? { ...r, status: newStatus } : r));
    } else {
      alert(result.error);
    }
  };

  const nextStatusMap: Record<ReturnStatus, ReturnStatus[]> = {
    requested: ["photo_received", "approved", "rejected"],
    photo_received: ["approved", "rejected"],
    approved: ["collected", "rejected"],
    collected: ["credit_issued", "rejected"],
    credit_issued: ["rejected"],
    rejected: [],
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Open Returns"
          subtitle="Returns not yet issued as credit"
          right={<Button size="sm" onClick={() => {}}>Create Return</Button>}
        />
        {initialReturns.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No open returns" body="All returns resolved." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {initialReturns.map((r) => (
              <li key={r.return_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-700">{r.shop_name}</span>
                    <span className="text-sm text-zinc-600">{r.product_name ?? r.product_id ?? "Item"} × {r.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {nextStatusMap[r.status] && nextStatusMap[r.status].length > 0 && (
                      <select
                        value={r.status}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => handleUpdateStatus(r.return_id, e.target.value as ReturnStatus)}
                        className="text-xs border border-zinc-300 rounded px-2 py-1"
                        disabled={loadingAction === `status-${r.return_id}`}
                      >
                        <option value={r.status}>Current: {returnStatusLabel[r.status]}</option>
                        {nextStatusMap[r.status].map(s => (
                          <option key={s} value={s}>{returnStatusLabel[s]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                {r.reason && <p className="mt-1 text-sm text-zinc-500">{complaintTypeLabel[r.reason] ?? r.reason}</p>}
                <p className="mt-1 text-xs text-zinc-400">Created: {formatDate(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}