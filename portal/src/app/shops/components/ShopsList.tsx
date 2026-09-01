"use client";

import { useState, useRef, FormEvent, ChangeEvent, ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, Stat, PageHeader, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { createShop, updateShop, recordPayment, softDeleteShop } from "@/lib/actions";
import type { ShopWithExtras } from "@/lib/types";
import { formatINR, languageLabel, formatDate, daysSince } from "@/lib/format";

interface ShopRow extends ShopWithExtras {
  visitOverdue: boolean;
  creditPct: number;
}

function getEnrichedShops(shops: ShopWithExtras[]): ShopRow[] {
  return shops.map((shop) => {
    const overdue = daysSince(shop.last_order_date);
    const visitOverdue = overdue !== null && overdue > shop.visit_gap_days;
    const creditPct = shop.credit_limit > 0 ? Math.max(0, Math.min(1, shop.available_credit / shop.credit_limit)) : 0;
    return { ...shop, visitOverdue, creditPct };
  });
}

function isPaymentLoading(loadingAction: string | null, shopId: string): boolean {
  return loadingAction === "payment-" + shopId;
}

function isEditLoading(loadingAction: string | null, shopId: string | null): boolean {
  return shopId !== null && loadingAction === "edit-" + shopId;
}

function isDeleteLoading(loadingAction: string | null, shopId: string): boolean {
  return loadingAction === "delete-" + shopId;
}

interface ShopsListProps {
  shops: ShopWithExtras[];
  routes: { route_id: string; route_name: string; salesperson: string | null }[];
}

export function ShopsList({ shops: initialShops, routes: initialRoutes }: ShopsListProps) {
  const [shops, setShops] = useState<ShopWithExtras[]>(initialShops);
  const [routes] = useState(initialRoutes);
  const [isAddShopOpen, setIsAddShopOpen] = useState(false);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ShopWithExtras>>({});
  const [paymentModal, setPaymentModal] = useState<{ shop: ShopWithExtras | null; isOpen: boolean }>({ shop: null, isOpen: false });
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", reference: "", collected_by: "", notes: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ shopId: string; isOpen: boolean }>({ shopId: "", isOpen: false });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const enrichedShops = getEnrichedShops(shops);

  const handleAddShop = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("add-shop");
    const formData = new FormData(e.currentTarget);
    const data = {
      shop_name: formData.get("shop_name") as string,
      owner_name: formData.get("owner_name") as string,
      phone_number: formData.get("phone_number") as string,
      whatsapp_number: formData.get("whatsapp_number") as string || undefined,
      preferred_language: formData.get("preferred_language") as "tamil" | "tanglish" | "hindi" | "english",
      beat_route_id: formData.get("beat_route_id") as string || undefined,
      visit_gap_days: Number(formData.get("visit_gap_days")) || 7,
      credit_limit: Number(formData.get("credit_limit")) || 0,
      address: formData.get("address") as string || undefined,
      gst_number: formData.get("gst_number") as string || undefined,
      preferred_call_start: formData.get("preferred_call_start") as string || undefined,
      preferred_call_end: formData.get("preferred_call_end") as string || undefined,
    };
    const result = await createShop(data);
    setLoadingAction(null);
    if (result.success) {
      const newShop: ShopWithExtras = {
        ...result.data,
        available_credit: result.data.credit_limit,
        credit_exceeded: false,
        order_count: 0,
        blacklist_count: 0,
      };
      setShops([...shops, newShop]);
      setIsAddShopOpen(false);
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleEditStart = (shop: ShopWithExtras) => {
    setEditingShopId(shop.shop_id);
    setEditForm({
      credit_limit: shop.credit_limit,
      beat_route_id: shop.beat_route_id,
      preferred_language: shop.preferred_language,
      visit_gap_days: shop.visit_gap_days,
      voice_consent: shop.voice_consent,
      whatsapp_consent: shop.whatsapp_consent,
      opt_out: shop.opt_out,
    });
  };

  const handleEditSave = async (shopId: string) => {
    setLoadingAction("edit-" + shopId);
    const result = await updateShop(shopId, editForm);
    setLoadingAction(null);
    if (result.success) {
      const updated = result.data;
      const newCreditLimit = updated.credit_limit ?? 0;
      const outstanding = updated.outstanding_balance ?? 0;
      const available_credit = newCreditLimit - outstanding;
      const credit_exceeded = available_credit <= 0;
      setShops(shops.map(s => s.shop_id === shopId
        ? { ...s, ...updated, available_credit, credit_exceeded }
        : s
      ));
      setEditingShopId(null);
      setEditForm({});
    } else {
      alert(result.error);
    }
  };

  const handleEditCancel = () => {
    setEditingShopId(null);
    setEditForm({});
  };

  const openPaymentModal = (shop: ShopWithExtras) => {
    setPaymentModal({ shop, isOpen: true });
    setPaymentForm({ amount: "", method: "cash", reference: "", collected_by: "", notes: "" });
  };

  const handlePaymentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const shop = paymentModal.shop;
    if (!shop) return;
    setLoadingAction("payment-" + shop.shop_id);
    const formData = new FormData(e.currentTarget);
    const result = await recordPayment({
      shop_id: shop.shop_id,
      amount: Number(formData.get("amount")),
      method: formData.get("method") as any,
      reference: formData.get("reference") as string || undefined,
      collected_by: formData.get("collected_by") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setShops(shops.map(s => s.shop_id === shop.shop_id
        ? { ...s, outstanding_balance: Math.max(0, s.outstanding_balance - Number(formData.get("amount"))) }
        : s
      ));
      setPaymentModal({ shop: null, isOpen: false });
    } else {
      alert(result.error);
    }
  };

  const handleDeleteConfirm = (shopId: string) => {
    setDeleteConfirm({ shopId, isOpen: true });
  };

  const handleDeleteExecute = async () => {
    const shopId = deleteConfirm.shopId;
    setLoadingAction("delete-" + shopId);
    const result = await softDeleteShop(shopId);
    setLoadingAction(null);
    if (result.success) {
      setShops(shops.filter(s => s.shop_id !== shopId));
    } else {
      alert(result.error);
    }
    setDeleteConfirm({ shopId: "", isOpen: false });
  };

  const languageOptions = [
    { value: "tamil", label: "Tamil" },
    { value: "tanglish", label: "Tanglish" },
    { value: "hindi", label: "Hindi" },
    { value: "english", label: "English" },
  ];

  const routeOptions = routes.map(r => ({ value: r.route_id, label: r.route_name + (r.salesperson ? " (" + r.salesperson + ")" : "") }));

  const methodOptions = [
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "upi", label: "UPI" },
    { value: "bank", label: "Bank Transfer" },
    { value: "credit_note", label: "Credit Note" },
    { value: "adjustment", label: "Adjustment" },
  ];

  const creditRiskCount = shops.filter(s => s.credit_exceeded || s.available_credit <= 0).length;
  const overdueVisitCount = shops.filter(s => {
    const d = daysSince(s.last_order_date);
    return d !== null && d > s.visit_gap_days;
  }).length;
  const orderCount = shops.reduce((sum, s) => sum + s.order_count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shops"
        subtitle={shops.length + " stores"}
        right={<Button onClick={() => setIsAddShopOpen(true)}>Add Shop</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total shops" value={shops.length} />
        <Stat label="Credit at risk" value={creditRiskCount} />
        <Stat label="Overdue visits" value={overdueVisitCount} />
        <Stat label="Orders placed" value={orderCount} />
      </div>

      {shops.length === 0 ? (
        <EmptyState title="No shops yet" body="Add shops first." />
      ) : (
        <>
          <Card>
            <CardHeader title="All Shops" />
            <DataTable
              columns={[
                { key: "shop_name", header: "Shop", className: "w-48",
                  render: (shop) => (
                    <div>
                      <a href={"/shops/" + shop.shop_id} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                        {shop.shop_name}
                      </a>
                      <p className="mt-0.5 text-xs text-charcoal-light/60">
                        {shop.owner_name ?? "—"} · {shop.shop_id}
                      </p>
                    </div>
                  )
                },
                { key: "language", header: "Language", className: "w-32",
                  render: (shop) => <Badge tone="violet">{languageLabel[shop.preferred_language]}</Badge>
                },
                { key: "credit", header: "Credit", className: "w-64",
                  render: (shop) => {
                    const enriched = enrichedShops.find(s => s.shop_id === shop.shop_id)!;
                    const barColor = enriched.credit_exceeded ? "bg-rose-500" : enriched.creditPct < 0.25 ? "bg-amber-500" : "bg-emerald-500";
                    return (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-charcoal">{formatINR(enriched.available_credit)}</span>
                          {enriched.credit_exceeded && <Badge tone="rose">Over limit</Badge>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-charcoal/5">
                            <div
                              className={cn("h-full rounded-full", barColor)}
                              style={{ width: (enriched.creditPct * 100) + "%" }}
                            />
                          </div>
                          <span className="text-xs text-charcoal-light/40">{formatINR(shop.outstanding_balance)} owed</span>
                        </div>
                      </div>
                    );
                  }
                },
                { key: "last_order", header: "Last Order", className: "w-40",
                  render: (shop) => {
                    const enriched = enrichedShops.find(s => s.shop_id === shop.shop_id)!;
                    return (
                      <div>
                        <span className="text-charcoal-light/70">{formatDate(shop.last_order_date)}</span>
                        {enriched.visitOverdue && (
                          <p className="mt-0.5 text-xs font-medium text-amber-600">
                            {daysSince(shop.last_order_date)} days ago
                          </p>
                        )}
                      </div>
                    );
                  }
                },
                { key: "order_count", header: "Orders", className: "w-20",
                  render: (shop) => <span className="text-charcoal-light/70">{shop.order_count}</span>
                },
                { key: "blacklist_count", header: "Blacklist", className: "w-32",
                  render: (shop) => shop.blacklist_count > 0 ? (
                    <Badge tone="orange">{shop.blacklist_count} item{shop.blacklist_count > 1 ? "s" : ""}</Badge>
                  ) : <span className="text-charcoal-light/40">\u2014</span>
                },
                { key: "flags", header: "Flags", className: "w-40",
                  render: (shop) => {
                    const enriched = enrichedShops.find(s => s.shop_id === shop.shop_id)!;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {enriched.visitOverdue && <Badge tone="amber">Visit due</Badge>}
                        {shop.opt_out && <Badge tone="zinc">Opted out</Badge>}
                        {!enriched.visitOverdue && !shop.opt_out && <span className="text-charcoal-light/40">\u2014</span>}
                      </div>
                    );
                  }
                },
              ]}
              data={shops}
              keyExtractor={(shop) => shop.shop_id}
              rowActions={(shop) => (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openPaymentModal(shop)}
                    disabled={isPaymentLoading(loadingAction, shop.shop_id)}
                  >
                    Payment
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditStart(shop)}
                    disabled={editingShopId !== null || isEditLoading(loadingAction, editingShopId)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteConfirm(shop.shop_id)}
                    disabled={isDeleteLoading(loadingAction, shop.shop_id)}
                  >
                    Deactivate
                  </Button>
                </div>
              )}
            />
          </Card>

          <ConfirmDialog
            isOpen={isAddShopOpen}
            onClose={() => setIsAddShopOpen(false)}
            onConfirm={() => formRef.current?.requestSubmit()}
            title="Add New Shop"
            confirmText="Create Shop"
            cancelText="Cancel"
            variant="primary"
          >
            <form ref={formRef} onSubmit={handleAddShop} className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Shop Name" id="shop_name" name="shop_name" required />
                <FormField label="Owner Name" id="owner_name" name="owner_name" required />
                <FormField label="Phone Number" id="phone_number" name="phone_number" type="tel" required />
                <FormField label="WhatsApp Number" id="whatsapp_number" name="whatsapp_number" type="tel" />
                <SelectField
                  label="Preferred Language"
                  id="preferred_language"
                  name="preferred_language"
                  options={languageOptions}
                  defaultValue="tanglish"
                />
                <SelectField
                  label="Route"
                  id="beat_route_id"
                  name="beat_route_id"
                  options={routeOptions}
                  placeholder="Select route"
                />
                <NumberInput label="Visit Gap (days)" id="visit_gap_days" name="visit_gap_days" defaultValue={7} min={1} />
                <NumberInput label="Credit Limit" id="credit_limit" name="credit_limit" defaultValue={0} min={0} step={1000} />
                <FormField label="Call Window Start" id="preferred_call_start" name="preferred_call_start" type="time" />
                <FormField label="Call Window End" id="preferred_call_end" name="preferred_call_end" type="time" />
              </div>
              <TextareaField label="Address" id="address" name="address" rows={2} />
              <FormField label="GST Number" id="gst_number" name="gst_number" />
            </form>
          </ConfirmDialog>

          {editingShopId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/20 backdrop-blur-sm" onClick={handleEditCancel}>
              <div className="w-full max-w-md glass-strong rounded-2xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-charcoal">Edit Shop</h3>
                <div className="mt-4 space-y-4">
                  <NumberInput
                    label="Credit Limit"
                    id="edit_credit_limit"
                    value={editForm.credit_limit ?? 0}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })}
                    min={0}
                    step={1000}
                  />
                  <SelectField
                    label="Route"
                    id="edit_route"
                    value={editForm.beat_route_id ?? ""}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, beat_route_id: e.target.value || undefined })}
                    options={routeOptions}
                    placeholder="Select route"
                  />
                  <SelectField
                    label="Language"
                    id="edit_language"
                    value={editForm.preferred_language ?? "tanglish"}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, preferred_language: e.target.value as any })}
                    options={languageOptions}
                  />
                  <NumberInput
                    label="Visit Gap (days)"
                    id="edit_visit_gap"
                    value={editForm.visit_gap_days ?? 7}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, visit_gap_days: Number(e.target.value) })}
                    min={1}
                  />
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.voice_consent ?? false}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, voice_consent: e.target.checked })}
                        className="h-4 w-4 rounded border-border-subtle text-accent-peach focus:ring-accent-peach/30"
                      />
                      <span className="text-sm text-charcoal">Voice Consent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.whatsapp_consent ?? false}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, whatsapp_consent: e.target.checked })}
                        className="h-4 w-4 rounded border-border-subtle text-accent-peach focus:ring-accent-peach/30"
                      />
                      <span className="text-sm text-charcoal">WhatsApp Consent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.opt_out ?? false}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, opt_out: e.target.checked })}
                        className="h-4 w-4 rounded border-border-subtle text-accent-peach focus:ring-accent-peach/30"
                      />
                      <span className="text-sm text-charcoal">Opt Out</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={handleEditCancel} disabled={isEditLoading(loadingAction, editingShopId)}>
                      Cancel
                    </Button>
                    <Button onClick={() => handleEditSave(editingShopId)} loading={isEditLoading(loadingAction, editingShopId)}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {paymentModal.isOpen && paymentModal.shop && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/20 backdrop-blur-sm" onClick={() => setPaymentModal({ shop: null, isOpen: false })}>
              <div className="w-full max-w-md glass-strong rounded-2xl p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-charcoal">Record Payment for {paymentModal.shop.shop_name}</h3>
                <p className="mt-1 text-sm text-charcoal-light/60">Outstanding: {formatINR(paymentModal.shop.outstanding_balance)} | Available Credit: {formatINR(paymentModal.shop.available_credit)}</p>
                <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
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
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setPaymentModal({ shop: null, isOpen: false })} disabled={isPaymentLoading(loadingAction, paymentModal.shop.shop_id)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={isPaymentLoading(loadingAction, paymentModal.shop.shop_id)}>
                      Record Payment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <ConfirmDialog
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ shopId: "", isOpen: false })}
            onConfirm={handleDeleteExecute}
            title="Deactivate Shop"
            description="This will mark the shop as opted out. They will no longer receive voice calls. This action can be reversed by editing the shop."
            confirmText="Deactivate"
            variant="destructive"
            loading={isDeleteLoading(loadingAction, deleteConfirm.shopId)}
          />
        </>
      )}
    </div>
  );
}