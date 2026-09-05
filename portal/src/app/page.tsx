import type { Metadata } from "next";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import {
  getShops,
  getOrders,
  getLowStock,
  getCreditRisk,
  getOpenComplaints,
  getOpenReturns,
  getPendingOrders,
  getDeliveries,
  getPayments,
  getAllTodayNotes,
  getPendingWhatsApps,
} from "@/lib/data";
import {
  formatINR,
  formatDate,
  daysSince,
} from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderCard } from "@/components/order-card";
import { WhatsAppPendingPanel } from "@/components/whatsapp-pending-panel";

export const metadata: Metadata = { title: "Dashboard | Shree Agencies" };

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const [
    shops,
    orders,
    lowStock,
    creditRisk,
    complaints,
    returns,
    pendingOrders,
    deliveries,
    payments,
  ] = await Promise.all([
    getShops(),
    getOrders(),
    getLowStock(),
    getCreditRisk(),
    getOpenComplaints(),
    getOpenReturns(),
    getPendingOrders(),
    getDeliveries(),
    getPayments(),
  ]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const todayOrders = orders.filter(o => o.order_date === today);
  const todayDeliveries = deliveries.filter(d => d.delivery_date === today);
  const todayPayments = payments.filter(p => p.collected_at?.split('T')[0] === today);

  const todayNotes = await getAllTodayNotes();
  const pendingWhatsApps = await getPendingWhatsApps();

  const totalRevenue = orders
    .filter(o => o.order_status === 'delivered')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const todayRevenue = todayOrders
    .filter(o => o.order_status === 'delivered')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const overdueVisits = shops.filter(s => {
    const d = daysSince(s.last_order_date);
    return d !== null && d > s.visit_gap_days;
  });

  return {
    shops,
    orders,
    lowStock,
    creditRisk,
    complaints,
    returns,
    pendingOrders,
    deliveries,
    payments,
    todayOrders,
    todayDeliveries,
    todayPayments,
    todayNotes,
    pendingWhatsApps,
    totalRevenue,
    todayRevenue,
    overdueVisits,
    totalShops: shops.length,
    totalOrders: orders.length,
  };
}

function KPICard({ label, value, hint, trend, trendUp = true, className = "" }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-light/50">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-charcoal">{value}</p>
      {hint && <p className="mt-1 text-xs text-charcoal-light/50">{hint}</p>}
      {trend && (
        <p className={`mt-1.5 text-xs font-medium ${trendUp ? "text-emerald-700" : "text-rose-600"}`}>
          {trend}
        </p>
      )}
    </Card>
  );
}

function UrgentActionsTable({ shops, orders, complaints, returns }: {
  shops: any[];
  orders: any[];
  complaints: any[];
  returns: any[];
}) {
  const overdueVisits = shops.filter(s => {
    const d = daysSince(s.last_order_date);
    return d !== null && d > s.visit_gap_days;
  }).slice(0, 5);

  const oldOrders = (orders ?? [])
    .filter(o => {
      const d = daysSince(o.order_date);
      return o.order_status === 'awaiting_confirmation' && d !== null && d > 1;
    })
    .slice(0, 5);

  const openComplaints = complaints.filter(c => c.status === 'open').slice(0, 5);

  if (overdueVisits.length === 0 && oldOrders.length === 0 && openComplaints.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState title="No urgent actions" body="All caught up!" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Urgent Actions" subtitle="Items requiring immediate attention" />
      <div className="space-y-4 p-5">
        {overdueVisits.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Overdue Visits ({overdueVisits.length})</h4>
            <ul className="space-y-2">
              {overdueVisits.map(s => (
                <li key={s.shop_id} className="flex items-center justify-between p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{s.shop_name}</p>
                    <p className="text-xs text-charcoal-light/60">{daysSince(s.last_order_date)} days since last order (gap: {s.visit_gap_days} days)</p>
                  </div>
                  <Badge tone="amber">Visit Due</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {oldOrders.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Orders Awaiting Confirmation &gt; 24h ({oldOrders.length})</h4>
            <ul className="space-y-2">
              {oldOrders.map(o => (
                <li key={o.order_id} className="flex items-center justify-between p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{o.order_id} - {o.shop_name}</p>
                    <p className="text-xs text-charcoal-light/60">{formatINR(o.total_amount)} · {daysSince(o.order_date)} days ago</p>
                  </div>
                  <StatusBadge status={o.order_status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {openComplaints.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Open Complaints ({openComplaints.length})</h4>
            <ul className="space-y-2">
              {openComplaints.map(c => (
                <li key={c.complaint_id} className="flex items-center justify-between p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{c.shop_name}</p>
                    <p className="text-xs text-charcoal-light/60">{c.complaint_type} · {c.severity}</p>
                  </div>
                  <StatusBadge status={c.severity} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}

function TodaysScheduleTable({ deliveries }: { deliveries: any[] }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const todayDeliveries = deliveries.filter(d => d.delivery_date === today).slice(0, 10);

  if (todayDeliveries.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState title="No deliveries today" body="No deliveries scheduled for today." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Today's Deliveries" subtitle={`${todayDeliveries.length} scheduled`} />
      <div className="p-5">
        <ul className="space-y-2">
          {todayDeliveries.map(d => (
            <li key={d.delivery_id} className="flex items-center justify-between p-3 rounded-xl bg-charcoal/[0.03] border border-border-subtle">
              <div>
                <p className="text-sm font-medium text-charcoal">{d.shop_name}</p>
                <p className="text-xs text-charcoal-light/60">{d.vehicle_no} · {d.delivery_person} · {d.delivery_slot}</p>
              </div>
              <StatusBadge status={d.status} />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function RecentActivityTable({ payments, returns, complaints }: { payments: any[], returns: any[], complaints: any[] }) {
  const recentPayments = payments.slice(0, 5);
  const recentReturns = returns.slice(0, 5);
  const recentComplaints = complaints.slice(0, 5);

  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Recent Payments ({payments.length})</h4>
          <ul className="space-y-2">
            {recentPayments.map(p => (
              <li key={p.entry_id} className="flex items-center justify-between p-3 rounded-xl bg-charcoal/[0.03] border border-border-subtle">
                <div>
                  <p className="text-sm font-medium text-charcoal">{p.shop_name}</p>
                  <p className="text-xs text-charcoal-light/60">{p.method} · {p.reference ?? "—"}</p>
                </div>
                <span className="text-sm font-medium text-emerald-700">{formatINR(p.amount)}</span>
              </li>
            ))}
            {payments.length === 0 && <p className="text-sm text-charcoal-light/40 text-center py-4">No payments yet</p>}
          </ul>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Recent Returns ({returns.length})</h4>
          <ul className="space-y-2">
            {recentReturns.map(r => (
              <li key={r.return_id} className="flex items-center justify-between p-3 rounded-xl bg-charcoal/[0.03] border border-border-subtle">
                <div>
                  <p className="text-sm font-medium text-charcoal">{r.shop_name}</p>
                  <p className="text-xs text-charcoal-light/60">{r.product_name ?? r.product_id} × {r.quantity}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
            {returns.length === 0 && <p className="text-sm text-charcoal-light/40 text-center py-4">No returns yet</p>}
          </ul>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light/50 mb-3">Recent Complaints ({complaints.length})</h4>
          <ul className="space-y-2">
            {recentComplaints.map(c => (
              <li key={c.complaint_id} className="flex items-center justify-between p-3 rounded-xl bg-charcoal/[0.03] border border-border-subtle">
                <div>
                  <p className="text-sm font-medium text-charcoal">{c.shop_name}</p>
                  <p className="text-xs text-charcoal-light/60">{c.complaint_type}</p>
                </div>
                <StatusBadge status={c.severity} />
              </li>
            ))}
            {complaints.length === 0 && <p className="text-sm text-charcoal-light/40 text-center py-4">No complaints yet</p>}
          </ul>
        </section>
      </div>
    </Card>
  );
}

function TodaysDetailsPanel({ todayNotes, todayOrders, todayDeliveries }: {
  todayNotes: { note_id: number; shop_id: string; shop_name: string; note_type: string; note_text: string; source: string; agent_role: string | null; created_at: string }[];
  todayOrders: any[];
  todayDeliveries: any[];
}) {
  if (todayNotes.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState
          title="No notes today"
          body={`${todayOrders.length} order(s) and ${todayDeliveries.length} delivery(s) on record today.`}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Today's Details"
        subtitle={`${todayNotes.length} notes · ${todayOrders.length} orders · ${todayDeliveries.length} deliveries`}
      />
      <ul className="divide-y divide-border-subtle">
        {todayNotes.slice(0, 12).map(n => (
          <li key={n.note_id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/shops/${n.shop_id}`} className="text-sm font-medium text-charcoal hover:underline">{n.shop_name}</a>
              <Badge tone="violet">{n.note_type}</Badge>
              {n.agent_role && <span className="text-xs text-charcoal-light/40">by {n.agent_role}</span>}
            </div>
            <p className="mt-1 text-sm text-charcoal-light/80">{n.note_text}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const {
    shops,
    orders,
    lowStock,
    creditRisk,
    complaints,
    returns,
    pendingOrders,
    deliveries,
    payments,
    todayOrders,
    todayDeliveries,
    todayPayments,
    todayNotes,
    pendingWhatsApps,
    totalRevenue,
    todayRevenue,
    overdueVisits,
    totalShops,
    totalOrders,
  } = data;

  const creditExceededShops = shops.filter(s => s.credit_exceeded || s.available_credit <= 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Shree Agencies — FMCG Distribution Overview"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KPICard
          label="Total Shops"
          value={totalShops}
          hint={`${creditExceededShops} over credit limit`}
        />
        <KPICard
          label="Today's Orders"
          value={todayOrders.length}
          hint={`${todayOrders.filter(o => o.order_status === 'delivered').length} delivered`}
        />
        <KPICard
          label="Today's Revenue"
          value={formatINR(todayRevenue)}
          trend={`+${formatINR(todayRevenue)} vs avg`}
          trendUp={true}
        />
        <KPICard
          label="Pending Deliveries"
          value={todayDeliveries.length}
          hint={deliveries.filter(d => d.status === 'out_for_delivery').length + " out for delivery"}
        />
        <KPICard
          label="Collections Due"
          value={creditExceededShops + overdueVisits.length}
          hint={`${creditExceededShops} over limit, ${overdueVisits.length} overdue visits`}
          trend={creditExceededShops > 0 ? "Action needed" : "All good"}
          trendUp={creditExceededShops === 0}
        />
        <KPICard
          label="Low Stock"
          value={lowStock.length}
          hint={lowStock.length > 0 ? "Restock needed" : "Stock healthy"}
          trendUp={lowStock.length === 0}
        />
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue Summary" />
          <div className="p-5 space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-charcoal-light/60">Total Revenue (Delivered)</span>
              <span className="text-2xl font-bold text-emerald-700">{formatINR(totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-charcoal-light/60">Total Orders</span>
              <span className="text-lg font-bold text-charcoal">{totalOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-charcoal-light/60">Avg Order Value</span>
              <span className="text-lg font-bold text-charcoal">{formatINR(totalOrders > 0 ? totalRevenue / totalOrders : 0)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Shop Health" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-accent-mint/10 border border-accent-mint/20">
                <p className="text-xs text-charcoal-light/60">Healthy Credit</p>
                <p className="text-2xl font-bold text-emerald-700">{shops.filter(s => s.available_credit > 0 && !s.credit_exceeded).length}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20">
                <p className="text-xs text-charcoal-light/60">Low Credit</p>
                <p className="text-2xl font-bold text-amber-700">{shops.filter(s => s.available_credit > 0 && s.available_credit <= 5000).length}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/20">
                <p className="text-xs text-charcoal-light/60">Over Limit</p>
                <p className="text-2xl font-bold text-rose-700">{shops.filter(s => s.credit_exceeded).length}</p>
              </div>
              <div className="p-3 rounded-xl bg-charcoal/5 border border-border-subtle">
                <p className="text-xs text-charcoal-light/60">No Credit Limit</p>
                <p className="text-2xl font-bold text-charcoal">{shops.filter(s => s.credit_limit === 0).length}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<Card className="h-96 animate-pulse bg-charcoal/5">Loading...</Card>}>
          <UrgentActionsTable shops={shops} orders={orders} complaints={complaints} returns={returns} />
        </Suspense>

        <Suspense fallback={<Card className="h-96 animate-pulse bg-charcoal/5">Loading...</Card>}>
          <TodaysScheduleTable deliveries={deliveries} />
        </Suspense>
      </div>

      {/* Recent Activity */}
      <Suspense fallback={<Card className="h-96 animate-pulse bg-charcoal/5">Loading...</Card>}>
        <RecentActivityTable payments={payments} returns={returns} complaints={complaints} />
      </Suspense>

      {/* Today's Details */}
      <Suspense fallback={<Card className="h-96 animate-pulse bg-charcoal/5">Loading...</Card>}>
        <TodaysDetailsPanel todayNotes={todayNotes} todayOrders={todayOrders} todayDeliveries={todayDeliveries} />
      </Suspense>

      {/* Pending WhatsApp */}
      <Suspense fallback={<Card className="h-96 animate-pulse bg-charcoal/5">Loading...</Card>}>
        <WhatsAppPendingPanel items={pendingWhatsApps} />
      </Suspense>
    </div>
  );
}