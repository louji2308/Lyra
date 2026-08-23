import type { Metadata } from "next";
import Link from "next/link";
import {
  getCreditRisk,
  getLowStock,
  getOpenComplaints,
  getOpenReturns,
  getPendingOrders,
} from "@/lib/data";
import {
  complaintTypeLabel,
  formatDate,
  formatINR,
} from "@/lib/format";
import {
  returnStatusLabel,
  returnStatusTone,
  severityLabel,
  severityTone,
} from "@/lib/tones";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui";
import { OrderCard } from "@/components/order-card";
import { ReturnsClient } from "./components/ReturnsClient";

export const metadata: Metadata = { title: "Exceptions" };

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const [lowStock, creditRisk, complaints, returns, pendingOrders] =
    await Promise.all([
      getLowStock(),
      getCreditRisk(),
      getOpenComplaints(),
      getOpenReturns(),
      getPendingOrders(),
    ]);

  const total =
    lowStock.length +
    creditRisk.length +
    complaints.length +
    returns.length +
    pendingOrders.length;

  const orders = await getOrders();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Exceptions"
        subtitle="Everything the AI flagged for a human to look at"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Low stock"
          value={lowStock.length}
          valueTone={lowStock.length > 0 ? "text-rose-600" : "text-zinc-900"}
        />
        <Stat
          label="Credit risk"
          value={creditRisk.length}
          valueTone={creditRisk.length > 0 ? "text-rose-600" : "text-zinc-900"}
        />
        <Stat
          label="Pending orders"
          value={pendingOrders.length}
          valueTone={pendingOrders.length > 0 ? "text-amber-600" : "text-zinc-900"}
        />
        <Stat
          label="Open complaints"
          value={complaints.length}
          valueTone={complaints.length > 0 ? "text-orange-600" : "text-zinc-900"}
        />
        <Stat
          label="Open returns"
          value={returns.length}
          valueTone={returns.length > 0 ? "text-sky-600" : "text-zinc-900"}
        />
      </div>

      {total === 0 && (
        <EmptyState
          title="All clear"
          body="No exceptions right now. Every signal is green."
        />
      )}

      <section>
        <CardHeader title="Low stock" subtitle="Products at or below threshold" />
        <Card className="mt-2">
          {lowStock.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Stock healthy" body="No products below threshold." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Available</th>
                    <th className="px-4 py-3 font-medium">Threshold</th>
                    <th className="px-4 py-3 font-medium">Restock by</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.product_id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {p.product_name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {p.brand ?? "—"} · {p.unit_type}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{p.category}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-rose-600">
                          {p.available_qty}
                        </span>{" "}
                        <span className="text-xs text-zinc-400">
                          / {p.low_stock_threshold}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {p.low_stock_threshold}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDate(p.restock_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader
          title="Credit risk"
          subtitle="Shops that have crossed their credit limit"
        />
        <Card className="mt-2">
          {creditRisk.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Credit healthy" body="No shop is over its limit." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3 font-medium">Shop</th>
                    <th className="px-4 py-3 font-medium">Limit</th>
                    <th className="px-4 py-3 font-medium">Outstanding</th>
                    <th className="px-4 py-3 font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {creditRisk.map((s) => (
                    <tr key={s.shop_id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/shops/${s.shop_id}`}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          {s.shop_name}
                        </Link>
                        <p className="text-xs text-zinc-500">{s.shop_id}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatINR(s.credit_limit)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatINR(s.outstanding_balance)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="rose">
                          {formatINR(s.available_credit)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader
          title="Pending orders"
          subtitle="Orders not yet delivered or cancelled"
        />
        <Card className="mt-2">
          {pendingOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState title="All orders delivered" body="Nothing pending." />
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {pendingOrders.map((o) => (
                <OrderCard key={o.order_id} order={o} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <CardHeader
          title="Open complaints"
          subtitle="Complaints waiting for resolution"
        />
        <Card className="mt-2">
          {complaints.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No open complaints" body="Nothing to act on." />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {complaints.map((c) => (
                <li key={c.complaint_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/shops/${c.shop_id}`}
                      className="text-sm font-medium text-emerald-700 hover:underline"
                    >
                      {c.shop_name}
                    </Link>
                    <Badge tone="zinc">{complaintTypeLabel[c.complaint_type]}</Badge>
                    <Badge tone={severityTone[c.severity]}>
                      {severityLabel[c.severity]}
                    </Badge>
                    {c.callback_requested && <Badge tone="rose">Callback</Badge>}
                    <span className="ml-auto text-xs text-zinc-400">
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  {c.description && (
                    <p className="mt-1.5 text-sm text-zinc-500">{c.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <ReturnsClient returns={returns} orders={orders} />
      </section>
    </div>
  );
}

async function getOrders() {
  const { getOrders: getOrdersFn } = await import("@/lib/data");
  return getOrdersFn();
}