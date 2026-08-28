import type { Metadata } from "next";
import { Suspense } from "react";
import { getShops } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { PageHeader, Card, CardHeader, EmptyState, Stat, Badge } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Shop Credit & Payments" };

export const dynamic = "force-dynamic";

export default async function ShopCreditPage() {
  const shops = await getShops();

  const enriched = shops.map(s => {
    const available = s.credit_limit - s.outstanding_balance;
    const pct = s.credit_limit > 0 ? available / s.credit_limit : 1;
    return { ...s, available_credit: available, creditPct: pct, credit_exceeded: available <= 0 };
  });

  const totalOutstanding = enriched.reduce((sum, s) => sum + s.outstanding_balance, 0);
  const totalLimit = enriched.reduce((sum, s) => sum + s.credit_limit, 0);
  const overLimit = enriched.filter(s => s.credit_exceeded).length;
  const lowCredit = enriched.filter(s => s.available_credit > 0 && s.available_credit <= 5000).length;

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
            { key: "credit_limit", header: "Limit", className: "w-32",
              render: (s) => <span className="font-medium">{formatINR(s.credit_limit)}</span>
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
            { key: "flags", header: "Status", className: "w-40",
              render: (s) => (
                <div className="flex flex-wrap gap-1">
                  {s.credit_exceeded && <Badge tone="rose">Over Limit</Badge>}
                  {s.available_credit > 0 && s.available_credit <= 5000 && <Badge tone="amber">Low Credit</Badge>}
                  {!s.credit_exceeded && s.available_credit > 5000 && <Badge tone="emerald">Healthy</Badge>}
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