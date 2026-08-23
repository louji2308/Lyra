"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { recordPayment } from "@/lib/actions";
import type { ShopWithExtras, ShopPaymentLedger } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";

interface PaymentsClientProps {
  payments: ShopPaymentLedger[];
  shops: ShopWithExtras[];
}

export function PaymentsClient({ payments: initialPayments, shops }: PaymentsClientProps) {
  const [payments, setPayments] = useState<ShopPaymentLedger[]>(initialPayments);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    shop_id: "",
    order_id: "",
    amount: "",
    method: "cash",
    reference: "",
    collected_by: "",
    notes: "",
  });
  const [shopFilter, setShopFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filteredPayments = payments.filter((p) => {
    const matchesShop = !shopFilter || p.shop_id === shopFilter;
    const matchesMethod = !methodFilter || p.method === methodFilter;
    return matchesShop && matchesMethod;
  });

  const totalCollected = payments
    .filter(p => p.method !== "credit_note" && p.method !== "order")
    .reduce((sum, p) => sum + (p.entry_type === "payment" ? p.amount : 0), 0);

  const totalCreditNotes = payments
    .filter(p => p.entry_type === "credit_note")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOrders = payments
    .filter(p => p.entry_type === "order")
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  const handleRecordPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-payment");
    const formData = new FormData(e.currentTarget);
    const result = await recordPayment({
      shop_id: formData.get("shop_id") as string,
      order_id: formData.get("order_id") as string || undefined,
      amount: Number(formData.get("amount")),
      method: formData.get("method") as any,
      reference: formData.get("reference") as string || undefined,
      collected_by: formData.get("collected_by") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setIsCreateOpen(false);
      setPaymentForm({ shop_id: "", order_id: "", amount: "", method: "cash", reference: "", collected_by: "", notes: "" });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleShopSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const shopId = e.target.value;
    setPaymentForm(prev => ({ ...prev, shop_id: shopId, order_id: "" }));
  };

  const ordersForShop = (shopId: string) => {
    // This would need to fetch orders for the selected shop
    // For now, we'll leave it empty - the user can manually enter order_id
    return [];
  };

  const methodOptions = [
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "upi", label: "UPI" },
    { value: "bank", label: "Bank Transfer" },
    { value: "credit_note", label: "Credit Note" },
    { value: "adjustment", label: "Adjustment" },
  ];

  const shopFilterOptions = [
    { value: "", label: "All Shops" },
    ...shops.map(s => ({ value: s.shop_id, label: s.shop_name + " (" + s.shop_id + ")" })),
  ];

  const methodFilterOptions = [
    { value: "", label: "All Methods" },
    ...methodOptions,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Record and track all payments and collections"
        right={
          <Button onClick={() => setIsCreateOpen(true)}>
            Record Payment
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Collected" value={formatINR(totalCollected)} />
        <Stat label="Credit Notes" value={formatINR(totalCreditNotes)} valueTone="text-amber-600" />
        <Stat label="Total Orders" value={formatINR(totalOrders)} />
        <Stat label="Net Position" value={formatINR(totalCollected + totalCreditNotes - totalOrders)} />
      </div>

      <Card>
        <CardHeader title="Filters" />
        <div className="px-4 py-4 grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Shop"
            id="payment_shop_filter"
            value={shopFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setShopFilter(e.target.value)}
            options={shopFilterOptions}
          />
          <SelectField
            label="Method"
            id="payment_method_filter"
            value={methodFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setMethodFilter(e.target.value)}
            options={methodFilterOptions}
          />
        </div>
      </Card>

      {payments.length === 0 ? (
        <EmptyState title="No payments recorded yet" body="Record your first payment to get started." />
      ) : (
        <Card>
          <CardHeader title="Payment History" />
          <DataTable
            columns={[
              { key: "collected_at", header: "Date", className: "w-32",
                render: (p) => formatDate(p.collected_at)
              },
              { key: "entry_type", header: "Type", className: "w-32",
                render: (p) => <StatusBadge status={p.entry_type} />
              },
              { key: "method", header: "Method", className: "w-32",
                render: (p) => <StatusBadge status={p.method} />
              },
              { key: "shop_name", header: "Shop", className: "w-40",
                render: (p) => p.shop_name ?? "—"
              },
              { key: "reference", header: "Reference", className: "w-36",
                render: (p) => p.reference ?? "—"
              },
              { key: "collected_by", header: "Collected By", className: "w-32",
                render: (p) => p.collected_by ?? "—"
              },
              { key: "amount", header: "Amount", className: "w-24 text-right font-medium",
                render: (p) => (
                  <span className={p.entry_type === "order" ? "text-red-600" : p.entry_type === "credit_note" ? "text-amber-600" : "text-emerald-600"}>
                    {p.entry_type === "order" ? "-" : ""}{formatINR(p.amount)}
                  </span>
                )
              },
              { key: "notes", header: "Notes", render: (p) => p.notes ?? "—" },
            ]}
            data={filteredPayments}
            keyExtractor={(p) => p.entry_id}
            emptyMessage="No matching payments"
          />
        </Card>
      )}

      <ConfirmDialog
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setPaymentForm({ shop_id: "", order_id: "", amount: "", method: "cash", reference: "", collected_by: "", notes: "" }); }}
        onConfirm={() => {}}
        title="Record Payment"
        confirmText="Record Payment"
        cancelText="Cancel"
        variant="primary"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <SelectField
            label="Shop"
            id="payment_shop_id"
            value={paymentForm.shop_id}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => { setPaymentForm({ ...paymentForm, shop_id: e.target.value, order_id: "" }); handleShopSelect(e); }}
            options={shops.map(s => ({ value: s.shop_id, label: s.shop_name + " (" + s.shop_id + ") - Outstanding: " + formatINR(s.outstanding_balance) }))}
            placeholder="Select shop"
            required
          />
          <FormField label="Order ID (optional)" id="payment_order_id" value={paymentForm.order_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentForm({ ...paymentForm, order_id: e.target.value })} placeholder="ORD123" />
          <NumberInput label="Amount" id="payment_amount" value={paymentForm.amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required min={1} step={1} />
          <SelectField
            label="Method"
            id="payment_method"
            value={paymentForm.method}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaymentForm({ ...paymentForm, method: e.target.value as any })}
            options={methodOptions}
          />
          <FormField label="Reference (Cheque No, UPI Ref)" id="payment_reference" value={paymentForm.reference} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          <FormField label="Collected By" id="payment_collected_by" value={paymentForm.collected_by} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentForm({ ...paymentForm, collected_by: e.target.value })} />
          <TextareaField label="Notes" id="payment_notes" value={paymentForm.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} />
        </form>
      </ConfirmDialog>
    </div>
  );
}