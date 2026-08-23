"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SectionLabel, KeyValue } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { confirmOrder, scheduleDelivery, cancelOrder, updateOrderItems, recordPayment, createReturn, updateReturnStatus, createDelivery } from "@/lib/actions";
import type { OrderDetail, OrderItem, ShopWithExtras } from "@/lib/types";
import { formatINR, formatDate, daysSince, formatDateTime } from "@/lib/format";

interface OrderDetailClientProps {
  order: OrderDetail;
  shops: ShopWithExtras[];
  products: Product[];
}

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "awaiting_confirmation", label: "Awaiting Confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "exception", label: "Exception" },
];

const activeStatuses = ["draft", "awaiting_confirmation", "confirmed", "payment_pending", "out_for_delivery", "exception"];

interface OrderItemWithName extends OrderItem {
  product_name: string;
}

export function OrderDetailClient({ order: initialOrder, shops, products }: OrderDetailClientProps) {
  const [order, setOrder] = useState<OrderDetail>(initialOrder);
  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<{ product_id: string; quantity: number; unit: string; price: number; discount?: number }[]>([]);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; form: any }>({ isOpen: false, form: {} });
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean; orderItem: OrderItemWithName | null; form: any }>({ isOpen: false, orderItem: null, form: {} });
  const [deliveryModal, setDeliveryModal] = useState<{ isOpen: boolean; form: any }>({ isOpen: false, form: {} });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleConfirmOrder = async () => {
    if (!activeStatuses.includes(order.order_status)) return;
    setLoadingAction("confirm");
    const result = await confirmOrder(order.order_id, "MANUAL");
    setLoadingAction(null);
    if (result.success) {
      setOrder({ ...order, ...result.data });
    } else {
      alert(result.error);
    }
  };

  const openScheduleDelivery = () => {
    const date = prompt("Enter delivery date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    const slot = prompt("Enter delivery slot (e.g., Morning/Afternoon):");
    if (date) {
      setLoadingAction("schedule");
      scheduleDelivery(order.order_id, date, slot || "", "MANUAL").then(result => {
        setLoadingAction(null);
        if (result.success) {
          setOrder({ ...order, ...result.data });
        } else {
          alert(result.error);
        }
      });
    }
  };

  const handleCancelOrder = async () => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    setLoadingAction("cancel");
    const result = await cancelOrder(order.order_id, reason, "MANUAL");
    setLoadingAction(null);
    if (result.success) {
      setOrder({ ...order, ...result.data });
    } else {
      alert(result.error);
    }
  };

  const openEditItems = () => {
    setEditItems(order.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      discount: item.discount ?? 0,
      product_name: item.product_name,
    })));
    setEditingItems(true);
  };

  const handleSaveItems = async () => {
    setLoadingAction("save-items");
    const items = editItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      discount: item.discount ?? 0,
    }));
    const result = await updateOrderItems(order.order_id, items);
    setLoadingAction(null);
    if (result.success) {
      setEditingItems(false);
      // Refresh - in real app would re-fetch
      setOrder({ ...order, items: order.items.map((item, i) => ({
        ...item,
        quantity: items[i].quantity,
        unit: items[i].unit,
        price: items[i].price,
        discount: items[i].discount ?? 0,
        line_total: items[i].price * items[i].quantity - (items[i].discount ?? 0),
      })) });
    } else {
      alert(result.error);
    }
  };

  const handleAddItem = () => {
    setEditItems([...editItems, { product_id: "", quantity: 1, unit: "piece", price: 0, discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setEditItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleProductSelect = (index: number) => {
    const product = products.find(p => p.product_id === editItems[index].product_id);
    if (product) {
      handleItemChange(index, "unit", product.unit_type);
      handleItemChange(index, "price", product.price);
    }
  };

  const openPaymentModal = () => {
    setPaymentModal({ isOpen: true, form: { amount: "", method: "cash", reference: "", collected_by: "", notes: "" } });
  };

  const handlePaymentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("payment");
    const formData = new FormData(e.currentTarget);
    const result = await recordPayment({
      shop_id: order.shop_id,
      order_id: order.order_id,
      amount: Number(formData.get("amount")),
      method: formData.get("method") as any,
      reference: formData.get("reference") as string || undefined,
      collected_by: formData.get("collected_by") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setPaymentModal({ isOpen: false, form: {} });
      alert("Payment recorded!");
    } else {
      alert(result.error);
    }
  };

  const openReturnModal = (orderItem: OrderItem) => {
    const product = products.find(p => p.product_id === orderItem.product_id);
    setReturnModal({
      isOpen: true,
      orderItem: {
        ...orderItem,
        product_name: product?.product_name ?? orderItem.product_id,
      },
      form: {
        quantity: 1,
        reason: "damaged_goods",
        photo_url: "",
      }
    });
  };

  const handleReturnSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!returnModal.orderItem) return;
    setLoadingAction("return");
    const formData = new FormData(e.currentTarget);
    const result = await createReturn({
      shop_id: order.shop_id,
      order_id: order.order_id,
      product_id: returnModal.orderItem.product_id,
      quantity: Number(formData.get("quantity")),
      reason: formData.get("reason") as string,
      photo_url: formData.get("photo_url") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setReturnModal({ isOpen: false, orderItem: null, form: {} });
      alert("Return created!");
    } else {
      alert(result.error);
    }
  };

  const openDeliveryModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setDeliveryModal({ isOpen: true, form: { delivery_date: today, delivery_slot: "", vehicle_no: "", delivery_person: "", notes: "" } });
  };

  const handleDeliverySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("delivery");
    const formData = new FormData(e.currentTarget);
    const deliveryItems = order.items.map(item => ({
      order_item_id: item.order_item_id,
      delivered_qty: item.quantity,
    }));
    const result = await createDelivery({
      order_id: order.order_id,
      delivery_date: formData.get("delivery_date") as string,
      delivery_slot: formData.get("delivery_slot") as string || undefined,
      vehicle_no: formData.get("vehicle_no") as string || undefined,
      delivery_person: formData.get("delivery_person") as string || undefined,
      items: deliveryItems,
      notes: formData.get("notes") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setDeliveryModal({ isOpen: false, form: {} });
      setOrder({ ...order, order_status: "delivered" });
      alert("Delivery recorded!");
    } else {
      alert(result.error);
    }
  };

  const methodOptions = [
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "upi", label: "UPI" },
    { value: "bank", label: "Bank Transfer" },
    { value: "credit_note", label: "Credit Note" },
    { value: "adjustment", label: "Adjustment" },
  ];

  const reasonOptions = [
    { value: "damaged_goods", label: "Damaged Goods" },
    { value: "wrong_order", label: "Wrong Order" },
    { value: "late_delivery", label: "Late Delivery" },
    { value: "price_issue", label: "Price Issue" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.order_id}`}
        subtitle={`Status: ${order.order_status} | ${formatDate(order.order_date)}`}
        right={
          <div className="flex gap-2">
            <Button onClick={() => window.location.href = "/orders"} variant="ghost">Back to List</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-zinc-500">Total Amount</p>
          <p className="text-2xl font-bold">{formatINR(order.total_amount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500">Credit Used</p>
          <p className="text-2xl font-bold">{formatINR(order.credit_used)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500">Payment Status</p>
          <StatusBadge status={order.payment_status} />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500">Items</p>
          <p className="text-2xl font-bold">{order.items.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Order Items" right={editingItems ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingItems(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveItems} loading={loadingAction === "save-items"}>Save</Button>
            </div>
          ) : order.order_status === "draft" || order.order_status === "awaiting_confirmation" ? (
            <Button size="sm" onClick={openEditItems}>Edit Items</Button>
          ) : null} />
          {editingItems ? (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                {editItems.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-5 border-b border-zinc-100 pb-2">
                    <SelectField
                      id={`edit_item_product_${index}`}
                      value={item.product_id}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => { handleItemChange(index, "product_id", e.target.value); handleProductSelect(index); }}
                      options={products.map(p => ({ value: p.product_id, label: p.product_name + " (" + p.product_id + ")" }))}
                      placeholder="Product"
                    />
                    <NumberInput
                      id={`edit_item_qty_${index}`}
                      value={item.quantity}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, "quantity", Number(e.target.value))}
                      min={1}
                      step={1}
                    />
                    <FormField
                      id={`edit_item_unit_${index}`}
                      value={item.unit}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, "unit", e.target.value)}
                    />
                    <NumberInput
                      id={`edit_item_price_${index}`}
                      value={item.price}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, "price", Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                    <NumberInput
                      id={`edit_item_discount_${index}`}
                      value={item.discount ?? 0}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleItemChange(index, "discount", Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>Remove</Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" onClick={handleAddItem}>Add Item</Button>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "product_name", header: "Product", render: (item) => item.product_name },
                { key: "quantity", header: "Qty", className: "text-right w-16", render: (item) => item.quantity },
                { key: "unit", header: "Unit", className: "w-20", render: (item) => item.unit },
                { key: "price", header: "Price", className: "text-right w-24", render: (item) => formatINR(item.price) },
                { key: "discount", header: "Discount", className: "text-right w-24", render: (item) => formatINR(item.discount ?? 0) },
                { key: "line_total", header: "Total", className: "text-right w-24 font-medium", render: (item) => formatINR(item.line_total) },
              ]}
              data={order.items}
              keyExtractor={(item) => item.order_item_id.toString()}
              emptyMessage="No items in this order"
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Order Details" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4">
            <KeyValue label="Order ID" value={order.order_id} />
            <KeyValue label="Shop" value={order.shop_name ?? "—"} />
            <KeyValue label="Order Date" value={formatDate(order.order_date)} />
            <KeyValue label="Delivery Date" value={formatDate(order.delivery_date)} />
            <KeyValue label="Delivery Slot" value={order.delivery_slot ?? "—"} />
            <KeyValue label="Order Status" value={<StatusBadge status={order.order_status} />} />
            <KeyValue label="Payment Status" value={<StatusBadge status={order.payment_status} />} />
            <KeyValue label="Created By" value={order.created_by} />
            <KeyValue label="Created At" value={formatDateTime(order.created_at)} />
          </dl>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Actions */}
        <Card>
          <CardHeader title="Actions" />
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {order.order_status === "draft" || order.order_status === "awaiting_confirmation" ? (
                <Button onClick={handleConfirmOrder} loading={loadingAction === "confirm"} disabled={loadingAction === "confirm"}>
                  Confirm Order
                </Button>
              ) : null}
              {order.order_status === "confirmed" ? (
                <Button onClick={openScheduleDelivery} loading={loadingAction === "schedule"} disabled={loadingAction === "schedule"}>
                  Schedule Delivery
                </Button>
              ) : null}
              {order.order_status === "out_for_delivery" ? (
                <Button onClick={openDeliveryModal} loading={loadingAction === "delivery"} disabled={loadingAction === "delivery"}>
                  Record Delivery
                </Button>
              ) : null}
              {activeStatuses.includes(order.order_status) ? (
                <Button variant="destructive" onClick={handleCancelOrder} loading={loadingAction === "cancel"} disabled={loadingAction === "cancel"}>
                  Cancel Order
                </Button>
              ) : null}
              <Button variant="outline" onClick={openPaymentModal} disabled={loadingAction === "payment"}>
                Record Payment
              </Button>
              <Button variant="outline" onClick={() => { if (order.items.length > 0) openReturnModal(order.items[0]); }} disabled={loadingAction === "return"}>
                Create Return
              </Button>
            </div>
          </div>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader title="Payment History" right={<Button size="sm" onClick={openPaymentModal} disabled={loadingAction === "payment"}>Record Payment</Button>} />
          <div className="px-4 py-4">
            <p className="text-sm text-zinc-500">Payment history would be loaded from the payment ledger.</p>
          </div>
        </Card>

        {/* Returns */}
        <Card>
          <CardHeader title="Returns" right={<Button size="sm" onClick={() => { if (order.items.length > 0) openReturnModal(order.items[0]); }} disabled={loadingAction === "return"}>Create Return</Button>} />
          {order.items.length === 0 ? (
            <div className="p-4"><EmptyState title="No items" body="No items to return." /></div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <li key={item.order_item_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{item.product_name} × {item.quantity}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openReturnModal(item)}>Return</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Deliveries */}
        <Card>
          <CardHeader title="Deliveries" right={order.order_status === "out_for_delivery" ? <Button size="sm" onClick={openDeliveryModal} disabled={loadingAction === "delivery"}>Record Delivery</Button> : null} />
          <div className="px-4 py-4">
            <p className="text-sm text-zinc-500">Delivery history would be shown here.</p>
          </div>
        </Card>
      </div>

      {/* Modals */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPaymentModal({ isOpen: false, form: {} })}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Record Payment for Order {order.order_id}</h3>
            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
              <NumberInput label="Amount" id="payment_amount" value={paymentModal.form.amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, amount: e.target.value } })} required min={1} step={1} />
              <SelectField label="Method" id="payment_method" value={paymentModal.form.method} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, method: e.target.value as any } })} options={methodOptions} />
              <FormField label="Reference" id="payment_reference" value={paymentModal.form.reference} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, reference: e.target.value } })} />
              <FormField label="Collected By" id="payment_collected_by" value={paymentModal.form.collected_by} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, collected_by: e.target.value } })} />
              <TextareaField label="Notes" id="payment_notes" value={paymentModal.form.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, notes: e.target.value } })} rows={2} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setPaymentModal({ isOpen: false, form: {} })} disabled={loadingAction === "payment"}>Cancel</Button>
                <Button type="submit" loading={loadingAction === "payment"}>Record Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returnModal.isOpen && returnModal.orderItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReturnModal({ isOpen: false, orderItem: null, form: {} })}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Create Return for {returnModal.orderItem.product_name}</h3>
            <form onSubmit={handleReturnSubmit} className="mt-4 space-y-4">
              <NumberInput label="Quantity" id="return_qty" value={returnModal.form.quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setReturnModal({ ...returnModal, form: { ...returnModal.form, quantity: Number(e.target.value) } })} required min={1} max={returnModal.orderItem.quantity} step={1} />
              <SelectField label="Reason" id="return_reason" value={returnModal.form.reason} onChange={(e: ChangeEvent<HTMLSelectElement>) => setReturnModal({ ...returnModal, form: { ...returnModal.form, reason: e.target.value } })} options={reasonOptions} />
              <FormField label="Photo URL (optional)" id="return_photo" value={returnModal.form.photo_url} onChange={(e: ChangeEvent<HTMLInputElement>) => setReturnModal({ ...returnModal, form: { ...returnModal.form, photo_url: e.target.value } })} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setReturnModal({ isOpen: false, orderItem: null, form: {} })} disabled={loadingAction === "return"}>Cancel</Button>
                <Button type="submit" loading={loadingAction === "return"}>Create Return</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deliveryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDeliveryModal({ isOpen: false, form: {} })}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Record Delivery for Order {order.order_id}</h3>
            <form onSubmit={handleDeliverySubmit} className="mt-4 space-y-4">
              <FormField label="Delivery Date" id="delivery_date" value={deliveryModal.form.delivery_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryModal({ ...deliveryModal, form: { ...deliveryModal.form, delivery_date: e.target.value } })} type="date" required />
              <FormField label="Delivery Slot" id="delivery_slot" value={deliveryModal.form.delivery_slot} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryModal({ ...deliveryModal, form: { ...deliveryModal.form, delivery_slot: e.target.value } })} placeholder="Morning / Afternoon" />
              <FormField label="Vehicle No" id="vehicle_no" value={deliveryModal.form.vehicle_no} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryModal({ ...deliveryModal, form: { ...deliveryModal.form, vehicle_no: e.target.value } })} />
              <FormField label="Delivery Person" id="delivery_person" value={deliveryModal.form.delivery_person} onChange={(e: ChangeEvent<HTMLInputElement>) => setDeliveryModal({ ...deliveryModal, form: { ...deliveryModal.form, delivery_person: e.target.value } })} />
              <TextareaField label="Notes" id="delivery_notes" value={deliveryModal.form.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDeliveryModal({ ...deliveryModal, form: { ...deliveryModal.form, notes: e.target.value } })} rows={2} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDeliveryModal({ isOpen: false, form: {} })} disabled={loadingAction === "delivery"}>Cancel</Button>
                <Button type="submit" loading={loadingAction === "delivery"}>Record Delivery</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface Product {
  product_id: string;
  product_name: string;
  unit_type: string;
  price: number;
}