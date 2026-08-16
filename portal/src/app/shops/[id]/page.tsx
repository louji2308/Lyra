import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRouteName, getShopDetail } from "@/lib/data";
import {
  daysSince,
  formatDate,
  formatDateTime,
  formatINR,
  formatPhone,
  formatTime,
  languageLabel,
  languageNative,
  memoryTypeLabel,
  complaintTypeLabel,
} from "@/lib/format";
import {
  memoryTypeTone,
  returnStatusLabel,
  returnStatusTone,
  sentimentLabel,
  sentimentTone,
  severityLabel,
  severityTone,
} from "@/lib/tones";
import {
  BackLink,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  KeyValue,
  PageHeader,
  SectionLabel,
  Stat,
} from "@/components/ui";
import { OrderCard } from "@/components/order-card";

export async function generateMetadata({
  params,
}: PageProps<"/shops/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Shop ${id}` };
}

export const dynamic = "force-dynamic";

export default async function ShopDetailPage({
  params,
}: PageProps<"/shops/[id]">) {
  const { id } = await params;
  const detail = await getShopDetail(id);
  if (!detail) notFound();

  const {
    shop,
    credit,
    blacklist,
    orders,
    memories,
    complaints,
    callLogs,
    returns,
  } = detail;

  const available =
    credit?.available_credit ??
    shop.credit_limit - shop.outstanding_balance;
  const creditExceeded =
    credit?.credit_exceeded ?? available < 0;
  const creditPct = Math.max(
    0,
    Math.min(
      1,
      shop.credit_limit > 0 ? available / shop.credit_limit : 0
    )
  );
  const lastOrderDays = daysSince(shop.last_order_date);
  const routeName = shop.beat_route_id
    ? await getRouteName(shop.beat_route_id)
    : null;

  return (
    <div className="space-y-6">
      <BackLink href="/shops" label="All shops" />

      <PageHeader
        title={shop.shop_name}
        subtitle={`${shop.owner_name ?? "—"} · ${shop.shop_id} · ${shop.phone_number}`}
        right={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="violet">
              {languageLabel[shop.preferred_language]}{" "}
              <span className="opacity-70">· {languageNative[shop.preferred_language]}</span>
            </Badge>
            {creditExceeded ? (
              <Badge tone="rose">Credit over limit</Badge>
            ) : available <= 0.25 * shop.credit_limit && shop.credit_limit > 0 ? (
              <Badge tone="amber">Low available credit</Badge>
            ) : (
              <Badge tone="emerald">Credit healthy</Badge>
            )}
            {shop.opt_out && <Badge tone="zinc">Opted out</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Credit available"
          value={formatINR(available)}
          valueTone={creditExceeded ? "text-rose-600" : "text-zinc-900"}
          hint={`Limit ${formatINR(shop.credit_limit)}`}
        />
        <Stat
          label="Outstanding"
          value={formatINR(shop.outstanding_balance)}
          hint={`${orders.length} orders on record`}
        />
        <Stat
          label="Last order"
          value={formatDate(shop.last_order_date)}
          hint={
            lastOrderDays === null
              ? "No orders yet"
              : `${lastOrderDays} days ago`
          }
        />
        <Stat
          label="Blacklisted items"
          value={blacklist.length}
          valueTone={blacklist.length > 0 ? "text-orange-600" : "text-zinc-900"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Credit health" />
          <div className="px-4 py-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight text-zinc-900">
                  {formatINR(available)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  available of {formatINR(shop.credit_limit)}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-zinc-900">
                  {formatINR(shop.outstanding_balance)}
                </p>
                <p className="text-zinc-500">outstanding</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${
                  creditExceeded
                    ? "bg-rose-500"
                    : creditPct < 0.25
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${creditPct * 100}%` }}
              />
            </div>
            {creditExceeded && (
              <p className="mt-3 text-sm text-rose-600">
                This shop has crossed its credit limit. Cap new orders at
                confirmation until balance clears.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Shop profile" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 sm:grid-cols-3">
            <KeyValue label="Phone" value={formatPhone(shop.phone_number)} />
            <KeyValue
              label="WhatsApp"
              value={formatPhone(shop.whatsapp_number)}
            />
            <KeyValue label="Language" value={languageLabel[shop.preferred_language]} />
            <KeyValue
              label="Call window"
              value={`${formatTime(shop.preferred_call_start)} – ${formatTime(
                shop.preferred_call_end
              )}`}
            />
            <KeyValue label="Visit gap" value={`${shop.visit_gap_days} days`} />
            <KeyValue label="Beat route" value={routeName ?? shop.beat_route_id ?? "—"} />
            <KeyValue label="Voice consent" value={shop.voice_consent ? "Yes" : "No"} />
            <KeyValue label="WhatsApp consent" value={shop.whatsapp_consent ? "Yes" : "No"} />
            <KeyValue label="Opted out" value={shop.opt_out ? "Yes" : "No"} />
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="AI memory"
            subtitle={`${memories.length} learned preferences`}
            right={
              memories.length > 0 ? (
                <Badge tone="emerald">
                  {memories.filter((m) => m.confirmed_by_user).length} confirmed
                </Badge>
              ) : undefined
            }
          />
          {memories.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No memories yet"
                body="The AI records shop preferences after every call."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {memories.map((m) => (
                <li key={m.memory_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-800">{m.memory_text}</p>
                    {m.confirmed_by_user && (
                      <Badge tone="emerald">Confirmed</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={memoryTypeTone[m.memory_type]}>
                      {memoryTypeLabel[m.memory_type]}
                    </Badge>
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Blacklist"
            subtitle="Products the AI must never pitch"
            right={
              blacklist.length > 0 ? (
                <Badge tone="orange">{blacklist.length} items</Badge>
              ) : undefined
            }
          />
          {blacklist.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No blacklisted products"
                body="No products are off-limits for this shop."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {blacklist.map((b) => (
                <li key={b.blacklist_id} className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-900">
                    {b.product_name}
                  </p>
                  {b.reason && (
                    <p className="mt-0.5 text-sm text-zinc-500">“{b.reason}”</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Orders"
          subtitle={`${orders.length} orders recorded`}
        />
        {orders.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No orders yet"
              body="Orders from AI calls will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {orders.map((o) => (
              <OrderCard key={o.order_id} order={o} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Complaints"
            subtitle={`${complaints.length} recorded`}
          />
          {complaints.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No complaints"
                body="This shop has no open complaints."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {complaints.map((c) => (
                <li key={c.complaint_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900">
                      {complaintTypeLabel[c.complaint_type]}
                    </span>
                    <Badge tone={severityTone[c.severity]}>
                      {severityLabel[c.severity]}
                    </Badge>
                    <Badge
                      tone={c.status === "open" ? "amber" : "emerald"}
                    >
                      {c.status}
                    </Badge>
                    {c.callback_requested && <Badge tone="rose">Callback</Badge>}
                  </div>
                  {c.description && (
                    <p className="mt-1.5 text-sm text-zinc-500">
                      {c.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Call logs"
            subtitle={`${callLogs.length} AI calls`}
          />
          {callLogs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No calls yet"
                body="Voice AI call history will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {callLogs.map((call) => (
                <li key={call.call_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-900">
                      {formatDateTime(call.start_time)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="violet">
                        {languageLabel[call.language_detected ?? "english"]}
                      </Badge>
                      <Badge tone={sentimentTone[call.sentiment]}>
                        {sentimentLabel[call.sentiment]}
                      </Badge>
                      {call.order_placed && (
                        <Badge tone="emerald">Order placed</Badge>
                      )}
                      {call.escalated_to_human && (
                        <Badge tone="rose">Escalated</Badge>
                      )}
                    </div>
                  </div>
                  {call.transcript_summary && (
                    <p className="mt-1.5 text-sm text-zinc-500">
                      {call.transcript_summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <SectionLabel>Returns</SectionLabel>
        <Card className="mt-2">
          {returns.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No returns"
                body="Return requests from this shop will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {returns.map((r) => (
                <li key={r.return_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900">
                      {r.product_name ?? r.product_id ?? "Item"} × {r.quantity}
                    </p>
                    <Badge tone={returnStatusTone[r.status]}>
                      {returnStatusLabel[r.status]}
                    </Badge>
                  </div>
                  {r.reason && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {complaintTypeLabel[r.reason] ?? r.reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
