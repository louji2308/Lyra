"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { BeatScheduleEntry, BeatCallRecord } from "@/lib/voice/backend";

interface BeatScheduleClientProps {
  schedule: BeatScheduleEntry[];
  todayCalls: BeatCallRecord[];
}

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BeatScheduleClient({ schedule, todayCalls }: BeatScheduleClientProps) {
  const [generating, setGenerating] = useState(false);
  const [todayList, setTodayList] = useState(todayCalls);
  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date().getDay();

  const todayRoute = schedule.find((s) => s.beat_day === dayOfWeek);
  const totalShops = schedule.reduce((sum, s) => sum + s.shop_count, 0);

  const pending = todayList.filter((c) => c.status === "pending").length;
  const completed = todayList.filter((c) => c.status === "completed").length;
  const failed = todayList.filter((c) => c.status === "failed").length;

  async function generateCalls() {
    setGenerating(true);
    try {
      const res = await fetch("/api/beat-schedule", { method: "POST" });
      const data = await res.json();
      if (data.today_calls) setTodayList(data.today_calls);
    } finally {
      setGenerating(false);
    }
  }

  async function triggerCall(shopId: string) {
    await fetch("/api/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, provider: "twilio" }),
    });
  }

  async function updateStatus(beatCallId: number, status: string) {
    const res = await fetch("/api/beat-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", beat_call_id: beatCallId, status }),
    });
    if (res.ok) {
      setTodayList((prev) =>
        prev.map((c) => (c.id === beatCallId ? { ...c, status: status as BeatCallRecord["status"] } : c))
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beat Schedule"
        subtitle={`Weekly route schedule · Sunday off · ${totalShops} shops across ${schedule.length} routes`}
        right={
          <div className="flex gap-2">
            <Button onClick={generateCalls} disabled={generating}>
              {generating ? "Generating..." : "Generate Today's Calls"}
            </Button>
            <a href="/admin/routes" className="text-sm text-emerald-600 hover:underline self-center">Manage Routes →</a>
          </div>
        }
      />

      {/* Today's Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Today" value={DAY_NAMES[dayOfWeek] || "Sunday"} />
        <Stat label="Active Route" value={todayRoute?.route_name || "None"} />
        <Stat label="Shops to Call" value={String(todayRoute?.shop_count || 0)} />
        <Stat label="Completed" value={String(completed)} />
        <Stat label="Pending" value={String(pending)} />
      </div>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader title="Weekly Beat Calendar" />
        <div className="grid grid-cols-6 gap-2 p-4">
          {[1, 2, 3, 4, 5, 6].map((day) => {
            const route = schedule.find((s) => s.beat_day === day);
            const isToday = day === dayOfWeek;
            return (
              <div
                key={day}
                className={cn(
                  "rounded-lg border p-3 text-center transition-all",
                  isToday ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200" : "border-zinc-200 bg-white",
                  !route && "opacity-40"
                )}
              >
                <div className={cn("text-xs font-semibold mb-1", isToday ? "text-emerald-700" : "text-zinc-500")}>
                  {DAY_SHORT[day]}
                  {isToday && <span className="ml-1 text-emerald-500">●</span>}
                </div>
                {route ? (
                  <>
                    <div className="text-sm font-medium text-zinc-800 truncate">{route.route_name}</div>
                    <div className="text-xs text-zinc-500 mt-1">{route.shop_count} shops</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{route.salesperson}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Delivery: {route.delivery_days}d</div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-400">No route</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Today's Call List */}
      <Card>
        <CardHeader
          title={`Today's Call List — ${DAY_NAMES[dayOfWeek]}`}
          subtitle={`${todayList.length} shops · ${completed} done · ${pending} pending · ${failed} failed`}
        />
        {todayList.length === 0 ? (
          <div className="p-6 text-center text-zinc-500">
            No calls generated for today. Click &quot;Generate Today&apos;s Calls&quot; to start.
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "shop_name", header: "Shop", className: "w-48",
                render: (c) => (
                  <div>
                    <a href={"/shops/" + c.shop_id} className="font-semibold text-emerald-700 hover:underline">
                      {c.shop_name || c.shop_id}
                    </a>
                    <p className="text-xs text-zinc-500">{c.route_name}</p>
                  </div>
                )
              },
              { key: "status", header: "Status", className: "w-28",
                render: (c) => (
                  <Badge tone={c.status === "completed" ? "emerald" : c.status === "failed" ? "rose" : c.status === "calling" ? "blue" : "zinc"}>
                    {c.status}
                  </Badge>
                )
              },
              { key: "attempt_count", header: "Attempts", className: "w-20" },
              { key: "order_id", header: "Order", className: "w-28",
                render: (c) => c.order_id ? (
                  <a href={"/orders/" + c.order_id} className="text-emerald-600 hover:underline text-sm">{c.order_id}</a>
                ) : <span className="text-zinc-400">—</span>
              },
              { key: "actions", header: "Actions", className: "w-48",
                render: (c) => (
                  <div className="flex gap-1">
                    {c.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => triggerCall(c.shop_id)}>Call</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(c.id, "skipped")}>Skip</Button>
                      </>
                    )}
                    {c.status === "calling" && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(c.id, "failed")}>Mark Failed</Button>
                    )}
                  </div>
                )
              },
            ]}
            data={todayList}
            keyExtractor={(c) => String(c.id)}
          />
        )}
      </Card>

      {/* Route Details */}
      <Card>
        <CardHeader title="Route Details" />
        <DataTable
          columns={[
            { key: "route_id", header: "ID", className: "w-20" },
            { key: "route_name", header: "Route", className: "w-48" },
            { key: "beat_day", header: "Day", className: "w-24",
              render: (r) => <Badge>{DAY_SHORT[r.beat_day]}</Badge>
            },
            { key: "shop_count", header: "Shops", className: "w-20" },
            { key: "delivery_days", header: "Delivery In", className: "w-24",
              render: (r) => <span>{r.delivery_days} days</span>
            },
            { key: "salesperson", header: "Salesperson", className: "w-40" },
            { key: "shops", header: "Coverage", className: "w-64",
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.shops.slice(0, 4).map((s) => (
                    <Badge key={s.shop_id} tone="zinc">{s.shop_name}</Badge>
                  ))}
                  {r.shops.length > 4 && <Badge tone="zinc">+{r.shops.length - 4} more</Badge>}
                </div>
              )
            },
          ]}
          data={schedule}
          keyExtractor={(r) => r.route_id}
        />
      </Card>
    </div>
  );
}
