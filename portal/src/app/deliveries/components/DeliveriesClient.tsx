"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, SectionLabel } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createDelivery, updateDelivery } from "@/lib/actions";
import type { OrderDetail, DeliverySummary, OrderItem } from "@/lib/types";
import { formatINR, formatDate, daysSince } from "@/lib/format";

interface DeliveriesClientProps {
  deliveries: DeliverySummary[];
  orders: OrderDetail[];
}

export function DeliveriesClient({ deliveries: initialDeliveries, orders }: DeliveriesClientProps) {
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>(initialDeliveries);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    order_id: "",
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_slot: "",
    vehicle_no: "",
    delivery_person: "",
    notes: "",
    items: [] as { order_item_id: number; delivered_qty: number; product_name: string; ordered_qty: number }[],
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const statusFilter = "";
  const filteredDeliveries = deliveries;

  const handleCreateDelivery = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-delivery");
    const formData = new FormData(e.currentTarget);
    const items = deliveryForm.items.map(item => ({
      order_item_id: item.order_item_id,
      delivered_qty: item.delivered_qty,
    }));
    const result = await createDelivery({
      order_id: deliveryForm.order_id,
      delivery_date: deliveryForm.delivery_date,
      delivery_slot: deliveryForm.delivery_slot || undefined,
      vehicle_no: deliveryForm.vehicle_no || undefined,
      delivery_person: deliveryForm.delivery_person || undefined,
      items,
      notes: deliveryForm.notes || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setIsCreateOpen(false);
      setDeliveryForm({
        order_id: "",
        delivery_date: new Date().toISOString().split('T')[0],
        delivery_slot: "",
        vehicle_no: "",
        delivery_person: "",
        notes: "",
        items: [],
      });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    if (order) {
      setDeliveryForm(prev => ({
        ...prev,
        order_id: orderId,
        items: order.items.map(item => ({
          order_item_id: item.order_item_id,
          delivered_qty: item.quantity,
          product_name: item.product_name,
          ordered_qty: item.quantity,
        })),
      }));
    }
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setDeliveryForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, delivered_qty: qty } : item),
    }));
  };

  const pendingOrders = orders.filter(o => o.order_status === "out_for_delivery" || o.order_status === "confirmed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        subtitle="Track and record product deliveries"
        right={
          <Button onClick={() => { handleOrderSelect(""); setIsCreateOpen(true); }}>
            Create Delivery
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total deliveries" value={deliveries.length} />
        <Stat label="Today" value={deliveries.filter(d => d.delivery_date === new Date().toISOString().split('T')[0]).length} />
        <Stat label="Completed" value={deliveries.filter(d => d.status === "completed").length} />
        <Stat label="Partial" value={deliveries.filter(d => d.status === "partial").length} />
      </div>

      {pendingOrders.length > 0 && (
        <Card>
          <CardHeader title="Ready for Delivery" subtitle={`${pendingOrders.length} orders awaiting delivery`} />
          <div className="p-4">
            <DataTable
              columns={[
                { key: "order_id", header: "Order ID", className: "w-32",
                  render: (order) => <a href={"/orders/" + order.order_id} className="text-emerald-700 hover:underline">{order.order_id}</a>
                },
                { key: "shop_name", header: "Shop", className: "w-40",
                  render: (order) => order.shop_name ?? "—"
                },
                { key: "order_status", header: "Status", className: "w-40",
                  render: (order) => <StatusBadge status={order.order_status} />
                },
                { key: "delivery_date", header: "Scheduled Date", className: "w-28",
                  render: (order) => formatDate(order.delivery_date)
                },
                { key: "total_amount", header: "Total", className: "w-24 text-right",
                  render: (order) => formatINR(order.total_amount)
                },
              ]}
              data={pendingOrders}
              keyExtractor={(o) => o.order_id}
              rowActions={(order) => (
                <Button variant="ghost" size="sm" onClick={() => { handleOrderSelect(order.order_id); setIsCreateOpen(true); }}>
                  Start Delivery
                </Button>
              )}
            />
          </div>
        </Card>
      )}

      {deliveries.length === 0 && pendingOrders.length === 0 ? (
        <EmptyState title="No deliveries yet" body="Create deliveries from orders or record completed deliveries." />
      ) : (
        <Card>
          <CardHeader title="All Deliveries" />
          <DataTable
            columns={[
              { key: "delivery_id", header: "ID", className: "w-20",
                render: (d) => d.delivery_id.toString()
              },
              { key: "order_id", header: "Order", className: "w-32",
                render: (d) => <a href={"/orders/" + d.order_id} className="text-emerald-700 hover:underline">{d.order_id}</a>
              },
              { key: "shop_name", header: "Shop", className: "w-40",
                render: (d) => d.shop_name
              },
              { key: "delivery_date", header: "Date", className: "w-28",
                render: (d) => formatDate(d.delivery_date)
              },
              { key: "delivery_slot", header: "Slot", className: "w-28",
                render: (d) => d.delivery_slot ?? "—"
              },
              { key: "vehicle_no", header: "Vehicle", className: "w-24",
                render: (d) => d.vehicle_no ?? "—"
              },
              { key: "delivery_person", header: "Driver", className: "w-24",
                render: (d) => d.delivery_person ?? "—"
              },
              { key: "status", header: "Status", className: "w-28",
                render: (d) => <StatusBadge status={d.status} />
              },
              { key: "total_qty_delivered", header: "Qty", className: "w-16 text-right",
                render: (d) => d.total_qty_delivered.toString()
              },
            ]}
            data={filteredDeliveries}
            keyExtractor={(d) => d.delivery_id.toString()}
            rowActions={(d) => (
              <Button variant="ghost" size="sm" onClick={() => alert("View delivery details - coming soon")}>
                View
              </Button>
            )}
          />
        </Card>
      )}

      <ConfirmDialog
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setDeliveryForm({ order_id: "", delivery_date: new Date().toISOString().split('T')[0], delivery_slot: "", vehicle_no: "", delivery_person: "", notes: "", items: [] }); }}
        onConfirm={() => {}}
        title="Create Delivery"
        confirmText="Record Delivery"
        cancelText="Cancel"
        variant="primary"
      >
        <form onSubmit={handleCreateDelivery} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <SelectField
            label="Order"
            id="delivery_order_id"
            value={deliveryForm.order_id}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => { setDeliveryForm({ ...deliveryForm, order_id: e.target.value }); handleOrderSelect(e.target.value); }}
            options={orders.map(o => ({ value: o.order_id, label: o.order_id + " - " + (o.shop_name ?? "") + " - " + formatINR(o.total_amount) }))}
            placeholder="Select order"
            required
          />
          <FormField label="Delivery Date" id="delivery_date" value={deliveryForm.delivery_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })} type="date" required />
          <FormField label="Delivery Slot" id="delivery_slot" value={deliveryForm.delivery_slot} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryForm({ ...deliveryForm, delivery_slot: e.target.value })} placeholder="Morning / Afternoon" />
          <FormField label="Vehicle No" id="vehicle_no" value={deliveryForm.vehicle_no} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryForm({ ...deliveryForm, vehicle_no: e.target.value })} />
          <FormField label="Delivery Person" id="delivery_person" value={deliveryForm.delivery_person} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryForm({ ...deliveryForm, delivery_person: e.target.value })} />
          
          <SectionLabel>Delivery Items</SectionLabel>
          {deliveryForm.items.length === 0 ? (
            <p className="text-sm text-zinc-500">Select an order to load items</p>
          ) : (
            <div className="space-y-2">
              {deliveryForm.items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-4 border-b border-zinc-100 pb-2">
                  <span className="text-sm text-zinc-700">{item.product_name}</span>
                  <span className="text-sm text-zinc-500">Ordered: {item.ordered_qty} {item.ordered_qty === 1 ? item.product_name : "pcs"}</span>
                  <NumberInput
                    id={`delivery_qty_${index}`}
                    value={item.delivered_qty}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemQtyChange(index, Number(e.target.value))}
                    min={0}
                    max={item.ordered_qty}
                    step={1}
                  />
                  {item.delivered_qty < item.ordered_qty && (
                    <Badge tone="amber">{item.ordered_qty - item.delivered_qty} short</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <TextareaField label="Notes" id="delivery_notes" value={deliveryForm.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })} rows={2} placeholder="Any delivery notes..." />
        </form>
      </ConfirmDialog>
    </div>
  );
}