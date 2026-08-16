import type { Metadata } from "next";
import Link from "next/link";
import { getShops } from "@/lib/data";
import {
  daysSince,
  formatDate,
  formatINR,
  languageLabel,
} from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Shops" };

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const shops = await getShops();

  const creditRiskCount = shops.filter(
    (s) => s.credit_exceeded || s.available_credit <= 0
  ).length;
  const orderCount = shops.reduce((sum, s) => sum + s.order_count, 0);
  const overdueVisitCount = shops.filter((s) => {
    const d = daysSince(s.last_order_date);
    return d !== null && d > s.visit_gap_days;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shops"
        subtitle={`${shops.length} stores on the Tambaram Main Beat`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total shops" value={shops.length} />
        <Stat
          label="Credit at risk"
          value={creditRiskCount}
          valueTone={creditRiskCount > 0 ? "text-rose-600" : "text-zinc-900"}
        />
        <Stat
          label="Overdue visits"
          value={overdueVisitCount}
          valueTone={overdueVisitCount > 0 ? "text-amber-600" : "text-zinc-900"}
        />
        <Stat label="Orders placed" value={orderCount} />
      </div>

      {shops.length === 0 ? (
        <EmptyState
          title="No shops yet"
          body="Add shops to the routes table to see them here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">Shop</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Credit</th>
                  <th className="px-4 py-3 font-medium">Last order</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Blacklist</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const overdue = daysSince(shop.last_order_date);
                  const visitOverdue =
                    overdue !== null && overdue > shop.visit_gap_days;
                  const creditPct = Math.max(
                    0,
                    Math.min(
                      1,
                      shop.credit_limit > 0
                        ? shop.available_credit / shop.credit_limit
                        : 0
                    )
                  );
                  return (
                    <tr
                      key={shop.shop_id}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/shops/${shop.shop_id}`}
                          className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          {shop.shop_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {shop.owner_name ?? "—"} · {shop.shop_id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="violet">
                          {languageLabel[shop.preferred_language]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900">
                            {formatINR(shop.available_credit)}
                          </span>
                          {shop.credit_exceeded && (
                            <Badge tone="rose">Over limit</Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${
                                shop.credit_exceeded
                                  ? "bg-rose-500"
                                  : creditPct < 0.25
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{ width: `${creditPct * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">
                            {formatINR(shop.outstanding_balance)} owed
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDate(shop.last_order_date)}
                        {visitOverdue && (
                          <p className="mt-0.5 text-xs font-medium text-amber-600">
                            {overdue} days ago
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {shop.order_count}
                      </td>
                      <td className="px-4 py-3">
                        {shop.blacklist_count > 0 ? (
                          <Badge tone="orange">
                            {shop.blacklist_count} item
                            {shop.blacklist_count > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {visitOverdue && (
                            <Badge tone="amber">Visit due</Badge>
                          )}
                          {shop.opt_out && <Badge tone="zinc">Opted out</Badge>}
                          {!visitOverdue && !shop.opt_out && (
                            <span className="text-zinc-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
