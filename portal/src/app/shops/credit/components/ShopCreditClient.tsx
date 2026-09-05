"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { formatINR } from "@/lib/format";
import type { ShopWithExtras } from "@/lib/types";

interface ShopCreditClientProps {
  shops: ShopWithExtras[];
}

export function ShopCreditClient({ shops }: ShopCreditClientProps) {
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "", type: "credit" as "credit" | "debit" });
  const [limitForm, setLimitForm] = useState<Record<string, string>>({});

  const enriched = shops.map(s => {
    const available = s.credit_limit - s.outstanding_balance;
    const pct = s.credit_limit > 0 ? available / s.credit_limit : 1;
    return { ...s, available_credit: available, creditPct: pct, credit_exceeded: available <= 0 };
  });

  const totalOutstanding = enriched.reduce((sum, s) => sum + s.outstanding_balance, 0);
  const totalLimit = enriched.reduce((sum, s) => sum + s.credit_limit, 0);
  const overLimit = enriched.filter(s => s.credit_exceeded).length;
  const lowCredit = enriched.filter(s => s.available_credit > 0 && s.available_credit <= 5000).length;

  async function handleAdjust(shopId: string) {
    if (!form.amount || !form.reason) return;
    const res = await fetch("/api/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopId,
        amount: Number(form.amount),
        reason: form.reason,
        type: form.type,
      }),
    });
    if (res.ok) {
      setAdjusting(null);
      setForm({ amount: "", reason: "", type: "credit" });
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({ error: "Request failed" }));
      alert(data.error || "Request failed");
    }
  }

  async function handleLimitUpdate(shopId: string) {
    const val = limitForm[shopId];
    if (!val) return;
    const res = await fetch("/api/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_limit",
        shop_id: shopId,
        credit_limit: Number(val),
      }),
    });
    if (res.ok) {
      setLimitForm((prev) => ({ ...prev, [shopId]: "" }));
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({ error: "Request failed" }));
      alert(data.error || "Request failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit & Payments"
        subtitle="Monitor shop credit limits, outstanding balances, and collection health"
        right={<a href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</a>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Credit Limit" value={formatINR(totalLimit)} />
        <Stat label="Total Outstanding" value={formatINR(totalOutstanding)} />
        <Stat label="Over Limit" value={overLimit} />
        <Stat label="Low Credit (≤₹5k)" value={lowCredit} />
      </div>

      <Card>
        <CardHeader title="All Shops Credit Status" />
        <DataTable
          columns={[
            { key: "shop_name", header: "Shop", className: "w-48",
              render: (s) => (
                <div>
                  <a href={"/shops/" + s.shop_id} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                    {s.shop_name}
                  </a>
                  <p className="mt-0.5 text-xs text-zinc-500">{s.owner_name} · {s.shop_id}</p>
                </div>
              )
            },
            { key: "credit_limit", header: "Limit", className: "w-40",
              render: (s) => (
                <div className="flex items-center gap-1">
                  <span className="font-medium">{formatINR(s.credit_limit)}</span>
                  {limitForm[s.shop_id] !== undefined ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="w-20 rounded border px-1 py-0.5 text-xs"
                        value={limitForm[s.shop_id]}
                        onChange={(e) => setLimitForm((p) => ({ ...p, [s.shop_id]: e.target.value }))}
                      />
                      <button onClick={() => handleLimitUpdate(s.shop_id)} className="text-xs text-emerald-600 hover:underline">✓</button>
                      <button onClick={() => setLimitForm((p) => { const n = { ...p }; delete n[s.shop_id]; return n; })} className="text-xs text-zinc-400 hover:underline">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setLimitForm((p) => ({ ...p, [s.shop_id]: String(s.credit_limit) }))} className="text-xs text-zinc-400 hover:text-emerald-600">✎</button>
                  )}
                </div>
              )
            },
            { key: "outstanding_balance", header: "Outstanding", className: "w-36",
              render: (s) => <span className="font-medium text-rose-600">{formatINR(s.outstanding_balance)}</span>
            },
            { key: "available_credit", header: "Available", className: "w-36",
              render: (s) => <span className={cn("font-medium", s.credit_exceeded ? "text-rose-600" : "text-emerald-600")}>{formatINR(s.available_credit)}</span>
            },
            { key: "creditPct", header: "Utilization", className: "w-48",
              render: (s) => (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className={cn("h-full rounded-full", s.credit_exceeded ? "bg-rose-500" : s.creditPct < 0.25 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: (s.creditPct * 100) + "%" }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-16 text-right">{Math.round(s.creditPct * 100)}%</span>
                </div>
              )
            },
            { key: "action", header: "Action", className: "w-48",
              render: (s) => (
                <div>
                  {adjusting === s.shop_id ? (
                    <div className="space-y-2 rounded-lg border bg-white p-2 shadow-sm">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setForm((p) => ({ ...p, type: "credit" }))}
                          className={cn("rounded px-2 py-0.5 text-xs", form.type === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500")}
                        >Payment Received</button>
                        <button
                          onClick={() => setForm((p) => ({ ...p, type: "debit" }))}
                          className={cn("rounded px-2 py-0.5 text-xs", form.type === "debit" ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-500")}
                        >Extra Credit</button>
                      </div>
                      <input
                        type="number"
                        placeholder="Amount"
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={form.amount}
                        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      />
                      <input
                        placeholder="Reason"
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={form.reason}
                        onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleAdjust(s.shop_id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAdjusting(null); setForm({ amount: "", reason: "", type: "credit" }); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setAdjusting(s.shop_id)}>
                      Adjust Credit
                    </Button>
                  )}
                </div>
              )
            },
          ]}
          data={enriched}
          keyExtractor={(s) => s.shop_id}
        />
      </Card>
    </div>
  );
}
