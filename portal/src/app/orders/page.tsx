import type { Metadata } from "next";
import { getOrders } from "@/lib/data";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { OrderCard } from "@/components/order-card";
import { formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Orders" };

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders();

  const totalValue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const active = orders.filter(
    (o) => o.order_status !== "delivered" && o.order_status !== "cancelled"
  );
  const history = orders.filter(
    (o) => o.order_status === "delivered" || o.order_status === "cancelled"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle="Orders captured by the AI over the call"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={orders.length} />
        <Stat label="Order value" value={formatINR(totalValue)} />
        <Stat
          label="Active"
          value={active.length}
          valueTone={active.length > 0 ? "text-amber-600" : "text-zinc-900"}
        />
        <Stat label="Delivered" value={history.length} />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="Orders captured from AI voice calls will appear here."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <CardHeader
              title="Active orders"
              subtitle="Not yet delivered or cancelled"
            />
            <Card className="mt-2">
              {active.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="All clear" body="No pending orders." />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {active.map((o) => (
                    <OrderCard key={o.order_id} order={o} />
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section>
            <CardHeader title="Order history" subtitle="Delivered and cancelled" />
            <Card className="mt-2">
              {history.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No history" body="No delivered orders yet." />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {history.map((o) => (
                    <OrderCard key={o.order_id} order={o} />
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
