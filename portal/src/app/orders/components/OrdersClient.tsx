"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, SectionLabel } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createOrder, confirmOrder, scheduleDelivery, cancelOrder, updateOrderItems, updateShopCredit } from "@/lib/actions";
import type { OrderDetail, OrderItem, ShopWithExtras, Product } from "@/lib/types";
import { formatINR, formatDate, daysSince, languageLabel } from "@/lib/format";

interface OrdersClientProps {
  orders: OrderDetail[];
  shops: ShopWithExtras[];
  products: Product[];
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "awaiting_confirmation", label: "Awaiting Confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "exception", label: "Exception" },
];

export function OrdersClient({ orders: initialOrders, shops, products }: OrdersClientProps) {
  const [orders, setOrders] = useState<OrderDetail[]>(initialOrders);
  const [viewMode, setViewMode] = useState<"all" | "pending" | "today">("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [createOrderForm, setCreateOrderForm] = useState({
    shop_id: "",
    items: [] as { product_id: string; quantity: number; unit: string; price: number; discount?: number }[],
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  const pendingOrders = orders.filter((o) => o.confirmed_order === false);
  const todayOrders = orders.filter((o) => o.order_date === today);

  const visibleOrders =
    viewMode === "pending" ? pendingOrders :
    viewMode === "today" ? todayOrders :
    orders;

  const filteredOrders = visibleOrders.filter((o) => {
    const matchesStatus = !statusFilter || o.order_status === statusFilter;
    const matchesSearch = !searchQuery ||
      o.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.shop_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const activeStatuses = [
    "draft",
    "awaiting_confirmation",
    "confirmed",
    "payment_pending",
    "out_for_delivery",
    "exception",
  ];

  const handleCreateOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-order");
    const formData = new FormData(e.currentTarget);
    const shopId = formData.get("shop_id") as string;
    const shop = shops.find(s => s.shop_id === shopId);
    if (!shop) {
      alert("Shop not found");
      setLoadingAction(null);
      return;
    }

    const items = createOrderForm.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      discount: item.discount ?? 0,
    }));

    const result = await createOrder({ shop_id: shopId, items, created_by: "MANUAL" });
    setLoadingAction(null);
    if (result.success) {
      const newOrder: OrderDetail = {
        ...result.data,
        shop_name: shop.shop_name,
        items: items.map(item => {
          const product = products.find(p => p.product_id === item.product_id);
          return {
            order_item_id: 0,
            order_id: result.data.order_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            discount: item.discount ?? 0,
            line_total: item.price * item.quantity - (item.discount ?? 0),
            product_name: product?.product_name ?? item.product_id,
          };
        }),
      };
      setOrders([newOrder, ...orders]);
      setIsCreateOrderOpen(false);
      setCreateOrderForm({ shop_id: "", items: [] });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleAddOrderItem = () => {
    setCreateOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: "", quantity: 1, unit: "piece", price: 0, discount: 0 }],
    }));
  };

  const handleRemoveOrderItem = (index: number) => {
    setCreateOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleOrderItemChange = (index: number, field: string, value: any) => {
    setCreateOrderForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleProductSelect = (index: number) => {
    const product = products.find(p => p.product_id === createOrderForm.items[index].product_id);
    if (product) {
      handleOrderItemChange(index, "unit", product.unit_type);
      handleOrderItemChange(index, "price", product.price);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    setLoadingAction(`confirm-${orderId}`);
    const result = await confirmOrder(orderId, "MANUAL");
    setLoadingAction(null);
    if (result.success) {
      setOrders(orders.map(o => o.order_id === orderId ? { ...o, ...result.data } : o));
    } else {
      alert(result.error);
    }
  };

  const handleSendWhatsApp = async (order: OrderDetail) => {
    setLoadingAction(`wa-${order.order_id}`);
    try {
      const res = await fetch("/api/whatsapp/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          kind: order.confirmed_order === true ? "order" : "payment",
        }),
      });
      const data = await res.json();
      if (data.wa_link) {
        window.open(data.wa_link, "_blank");
      } else {
        alert(data.error || `No WhatsApp available for ${order.shop_name ?? "this shop"}. Please add a number/consent on the shop.`);
      }
    } catch (err) {
      alert("Could not prepare WhatsApp: " + String(err));
    }
    setLoadingAction(null);
  };

  const openScheduleDelivery = (orderId: string) => {
    const date = prompt("Enter delivery date (YYYY-MM-DD):");
    const slot = prompt("Enter delivery slot (e.g., Morning/Afternoon):");
    if (date) {
      setLoadingAction(`schedule-${orderId}`);
      scheduleDelivery(orderId, date, slot || "", "MANUAL").then(result => {
        setLoadingAction(null);
        if (result.success) {
          setOrders(orders.map(o => o.order_id === orderId ? { ...o, ...result.data } : o));
        } else {
          alert(result.error);
        }
      });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    setLoadingAction(`cancel-${orderId}`);
    const result = await cancelOrder(orderId, reason, "MANUAL");
    setLoadingAction(null);
    if (result.success) {
      setOrders(orders.map(o => o.order_id === orderId ? { ...o, ...result.data } : o));
    } else {
      alert(result.error);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    for (const id of selectedOrderIds) {
      const order = orders.find(o => o.order_id === id);
      if (order && activeStatuses.includes(order.order_status)) {
        await confirmOrder(id, "MANUAL");
      }
    }
    setBulkActionLoading(false);
    setSelectedOrderIds([]);
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds(prev => prev.includes(orderId)
      ? prev.filter(id => id !== orderId)
      : [...prev, orderId]);
  };

  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.order_id));
    }
  };

  const totalValue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const active = orders.filter(o => activeStatuses.includes(o.order_status));
  const history = orders.filter(o => o.order_status === "delivered" || o.order_status === "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle="Orders captured by the AI over the call"
        right={
          <Button onClick={() => setIsCreateOrderOpen(true)}>
            Create Manual Order
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setViewMode("all")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium border",
            viewMode === "all" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
          )}
        >
          All
        </button>
        <button
          onClick={() => setViewMode("pending")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium border",
            viewMode === "pending" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
          )}
        >
          Pending ({pendingOrders.length})
        </button>
        <button
          onClick={() => setViewMode("today")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium border",
            viewMode === "today" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
          )}
        >
          Today's Orders ({todayOrders.length})
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total orders" value={orders.length} />
        <Stat label="Order value" value={formatINR(totalValue)} />
        <Stat
          label="Pending"
          value={pendingOrders.length}
          valueTone={pendingOrders.length > 0 ? "text-amber-600" : "text-zinc-900"}
        />
        <Stat label="Orders today" value={todayOrders.length} valueTone="text-sky-600" />
      </div>

      <Card>
        <CardHeader title="Filters" />
        <div className="px-4 py-4 grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Status"
            id="status_filter"
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            options={statusOptions}
          />
          <FormField
            label="Search"
            id="search_query"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Order ID, Shop name..."
          />
        </div>
      </Card>

      {selectedOrderIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <span className="text-sm text-amber-800">
            {selectedOrderIds.length} order(s) selected
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleBulkConfirm}
            disabled={bulkActionLoading}
            loading={bulkActionLoading}
          >
            Confirm Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedOrderIds([])}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "No orders yet" : "No matching orders"}
          body={orders.length === 0 ? "Orders captured from AI voice calls will appear here." : "Try adjusting your filters."}
        />
      ) : (
        <Card>
          <DataTable
            columns={[
              { key: "select", header: "", className: "w-12",
                render: (order) => (
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.includes(order.order_id)}
                    onChange={() => handleToggleSelect(order.order_id)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                )
              },
              { key: "order_id", header: "Order ID", className: "w-32",
                render: (order) => <a href={"/orders/" + order.order_id} className="text-emerald-700 hover:underline">{order.order_id}</a>
              },
              { key: "shop_name", header: "Shop", className: "w-40",
                render: (order) => <span className="text-zinc-700">{order.shop_name ?? "—"}</span>
              },
              { key: "order_date", header: "Date", className: "w-28",
                render: (order) => formatDate(order.order_date)
              },
              { key: "order_status", header: "Status", className: "w-40",
                render: (order) => <StatusBadge status={order.order_status} />
              },
              { key: "pending_reason", header: "Reason", className: "w-40",
                render: (order) => order.confirmed_order === false && order.pending_reason ? (
                  <Badge tone={order.pending_reason === "over_credit" ? "amber" : "sky"}>
                    {order.pending_reason === "over_credit" ? "Over credit limit" : order.pending_reason}
                  </Badge>
                ) : (
                  <span className="text-zinc-400">—</span>
                )
              },
              { key: "payment_status", header: "Payment", className: "w-32",
                render: (order) => <StatusBadge status={order.payment_status} />
              },
              { key: "total_amount", header: "Total", className: "w-24 text-right",
                render: (order) => formatINR(order.total_amount)
              },
              { key: "delivery_date", header: "Delivery", className: "w-28",
                render: (order) => formatDate(order.delivery_date)
              },
            ]}
            data={filteredOrders}
            keyExtractor={(order) => order.order_id}
            rowActions={(order) => (
              <div className="flex items-center gap-1">
                {order.confirmed_order === false && order.order_status !== "cancelled" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleSendWhatsApp(order)} disabled={loadingAction === `wa-${order.order_id}`}>WhatsApp</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleConfirmOrder(order.order_id)} disabled={loadingAction === `confirm-${order.order_id}`}>Confirm</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCancelOrder(order.order_id)} disabled={loadingAction === `cancel-${order.order_id}`}>Cancel</Button>
                  </>
                )}
                {order.confirmed_order === true && order.order_status === "confirmed" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleSendWhatsApp(order)} disabled={loadingAction === `wa-${order.order_id}`}>WhatsApp</Button>
                    <Button variant="ghost" size="sm" onClick={() => openScheduleDelivery(order.order_id)} disabled={loadingAction === `schedule-${order.order_id}`}>Schedule</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCancelOrder(order.order_id)} disabled={loadingAction === `cancel-${order.order_id}`}>Cancel</Button>
                  </>
                )}
                {order.order_status === "out_for_delivery" && (
                  <Button variant="ghost" size="sm" onClick={() => alert("Mark Delivered - use Order Detail page")} disabled={loadingAction === `deliver-${order.order_id}`}>Deliver</Button>
                )}
{order.order_status === "delivered" && (
                  <Button variant="ghost" size="sm" onClick={() => { window.location.href = "/orders/" + order.order_id; }}>View</Button>
                )}
              </div>
            )}
          />
        </Card>
      )}

      <ConfirmDialog
        isOpen={isCreateOrderOpen}
        onClose={() => { setIsCreateOrderOpen(false); setCreateOrderForm({ shop_id: "", items: [] }); }}
        onConfirm={() => { (document.getElementById("create-order-form") as HTMLFormElement | null)?.requestSubmit(); }}
        title="Create Manual Order"
        confirmText="Create Order"
        cancelText="Cancel"
        variant="primary"
      >
        <form id="create-order-form" onSubmit={handleCreateOrder} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <SelectField
            label="Shop"
            id="create_shop_id"
            value={createOrderForm.shop_id}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCreateOrderForm({ ...createOrderForm, shop_id: e.target.value })}
            options={shops.map(s => ({ value: s.shop_id, label: s.shop_name + " (" + s.shop_id + ")" }))}
            placeholder="Select shop"
            required
          />
          <SectionLabel>Order Items</SectionLabel>
          {createOrderForm.items.length === 0 ? (
            <p className="text-sm text-zinc-500">No items added yet</p>
          ) : (
            <div className="space-y-2">
              {createOrderForm.items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-5 border-b border-zinc-100 pb-2">
                  <SelectField
                    id={`item_product_${index}`}
                    value={item.product_id}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => { handleOrderItemChange(index, "product_id", e.target.value); handleProductSelect(index); }}
                    options={products.map(p => ({ value: p.product_id, label: p.product_name + " (" + p.product_id + ")" }))}
                    placeholder="Product"
                  />
                  <NumberInput
                    id={`item_qty_${index}`}
                    value={item.quantity}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOrderItemChange(index, "quantity", Number(e.target.value))}
                    min={1}
                    step={1}
                  />
                  <FormField
                    id={`item_unit_${index}`}
                    value={item.unit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOrderItemChange(index, "unit", e.target.value)}
                  />
                  <NumberInput
                    id={`item_price_${index}`}
                    value={item.price}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOrderItemChange(index, "price", Number(e.target.value))}
                    min={0}
                    step={0.01}
                  />
                  <NumberInput
                    id={`item_discount_${index}`}
                    value={item.discount ?? 0}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOrderItemChange(index, "discount", Number(e.target.value))}
                    min={0}
                    step={0.01}
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveOrderItem(index)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="secondary" onClick={handleAddOrderItem}>Add Item</Button>
        </form>
      </ConfirmDialog>
    </div>
  );
}