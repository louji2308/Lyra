"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, Stat, PageHeader, EmptyState, SectionLabel, KeyValue } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { updateShop, updateShopCredit, recordPayment, addBlacklist, removeBlacklist, confirmMemory, deleteMemory, resolveComplaint, closeComplaint, createReturn, updateReturnStatus } from "@/lib/actions";
import type { Shop, ShopCredit, BlacklistWithProduct, ShopMemory, Complaint, CallLog, ReturnRecord, OrderDetail, OrderItem, ShopPaymentLedger } from "@/lib/types";
import { formatINR, languageLabel, formatDate, formatDateTime, formatTime, daysSince, languageNative, memoryTypeLabel, complaintTypeLabel, sentimentLabel } from "@/lib/format";
import { memoryTypeTone, sentimentTone, severityTone, returnStatusTone, severityLabel, returnStatusLabel } from "@/lib/tones";

import type { ReturnWithShop } from "@/lib/types";

interface ShopDetailClientProps {
  shop: Shop;
  credit: ShopCredit | null;
  blacklist: BlacklistWithProduct[];
  orders: OrderDetail[];
  memories: ShopMemory[];
  complaints: Complaint[];
  callLogs: CallLog[];
  returns: ReturnWithShop[];
  routeName: string | null;
}

export function ShopDetailClient({
  shop: initialShop,
  credit,
  blacklist: initialBlacklist,
  orders: initialOrders,
  memories: initialMemories,
  complaints: initialComplaints,
  callLogs,
  returns: initialReturns,
  routeName,
}: ShopDetailClientProps) {
  const [shop, setShop] = useState<Shop>(initialShop);
  const [blacklist, setBlacklist] = useState<BlacklistWithProduct[]>(initialBlacklist);
  const [orders] = useState<OrderDetail[]>(initialOrders);
  const [memories, setMemories] = useState<ShopMemory[]>(initialMemories);
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [returns, setReturns] = useState<ReturnWithShop[]>(initialReturns);
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Shop>>({});
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; form: Record<string, string> }>({ isOpen: false, form: {} });
  const [addBlacklistModal, setAddBlacklistModal] = useState<{ isOpen: boolean; productId: string }>({ isOpen: false, productId: "" });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [routeOptions, setRouteOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "Select route" },
  ]);

  const available = credit?.available_credit ?? shop.credit_limit - shop.outstanding_balance;
  const creditExceeded = credit?.credit_exceeded ?? available < 0;
  const creditPct = Math.max(0, Math.min(1, shop.credit_limit > 0 ? available / shop.credit_limit : 0));
  const lastOrderDays = daysSince(shop.last_order_date);

  const handleEditProfileStart = () => {
    setEditingProfile(true);
    setEditForm({
      shop_name: shop.shop_name,
      owner_name: shop.owner_name,
      phone_number: shop.phone_number,
      whatsapp_number: shop.whatsapp_number,
      preferred_language: shop.preferred_language,
      beat_route_id: shop.beat_route_id,
      visit_gap_days: shop.visit_gap_days,
      credit_limit: shop.credit_limit,
      address: (shop as any).address,
      gst_number: (shop as any).gst_number,
      preferred_call_start: shop.preferred_call_start,
      preferred_call_end: shop.preferred_call_end,
      voice_consent: shop.voice_consent,
      whatsapp_consent: shop.whatsapp_consent,
      opt_out: shop.opt_out,
    });
  };

  const handleEditProfileSave = async () => {
    setLoadingAction("save-profile");
    const result = await updateShop(shop.shop_id, editForm);
    setLoadingAction(null);
    if (result.success) {
      setShop({ ...shop, ...result.data });
      setEditingProfile(false);
    } else {
      alert(result.error);
    }
  };

  const handleEditProfileCancel = () => {
    setEditingProfile(false);
    setEditForm({});
  };

  const openPaymentModal = () => {
    setPaymentModal({ isOpen: true, form: { amount: "", method: "cash", reference: "", collected_by: "", notes: "" } });
  };

  const handlePaymentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("payment");
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
      setShop({ ...shop, outstanding_balance: Math.max(0, shop.outstanding_balance - Number(formData.get("amount"))) });
      setPaymentModal({ isOpen: false, form: {} });
    } else {
      alert(result.error);
    }
  };

  const openAddBlacklistModal = (productId: string) => {
    setAddBlacklistModal({ isOpen: true, productId });
  };

  const handleAddBlacklistConfirm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reason = formData.get("reason") as string;
    const result = await addBlacklist(shop.shop_id, addBlacklistModal.productId, reason || undefined);
    if (result.success) {
      // Fetch updated blacklist - for now just add optimistically
      const { data: product } = await fetch(`/api/products/${addBlacklistModal.productId}`).then(r => r.json());
      setBlacklist([...blacklist, { ...result.data, product_name: product?.product_name ?? addBlacklistModal.productId } as any]);
    } else {
      alert(result.error);
    }
    setAddBlacklistModal({ isOpen: false, productId: "" });
  };

  const handleRemoveBlacklist = async (productId: string) => {
    const result = await removeBlacklist(shop.shop_id, productId);
    if (result.success) {
      setBlacklist(blacklist.filter(b => b.product_id !== productId));
    } else {
      alert(result.error);
    }
  };

  const handleConfirmMemory = async (memoryId: number) => {
    const result = await confirmMemory(memoryId);
    if (result.success) {
      setMemories(memories.map(m => m.memory_id === memoryId ? { ...m, confirmed_by_user: true } : m));
    } else {
      alert(result.error);
    }
  };

  const handleDeleteMemory = async (memoryId: number) => {
    const result = await deleteMemory(memoryId);
    if (result.success) {
      setMemories(memories.filter(m => m.memory_id !== memoryId));
    } else {
      alert(result.error);
    }
  };

  const handleResolveComplaint = async (complaintId: number) => {
    const resolution = prompt("Enter resolution notes:");
    if (!resolution) return;
    const result = await resolveComplaint(complaintId, resolution, "Current User");
    if (result.success) {
      setComplaints(complaints.map(c => c.complaint_id === complaintId ? { ...c, status: "resolved", description: resolution } : c));
    } else {
      alert(result.error);
    }
  };

  const handleCloseComplaint = async (complaintId: number) => {
    const result = await closeComplaint(complaintId);
    if (result.success) {
      setComplaints(complaints.map(c => c.complaint_id === complaintId ? { ...c, status: "closed" } : c));
    } else {
      alert(result.error);
    }
  };

  const openCreateReturnModal = async (orderItem: OrderItem) => {
    // For now just create with defaults
    const result = await createReturn({
      shop_id: shop.shop_id,
      order_id: orderItem.order_id,
      product_id: orderItem.product_id,
      quantity: orderItem.quantity,
      reason: "damaged_goods",
    });
    if (result.success) {
      // Convert ReturnRecord to ReturnWithShop by adding product_name and shop_name
      const newReturn = {
        ...result.data,
        shop_name: shop.shop_name,
        product_name: orderItem.product_id,
      };
      setReturns([newReturn, ...returns]);
    } else {
      alert(result.error);
    }
  };

  const handleUpdateReturnStatus = async (returnId: number, status: any) => {
    const result = await updateReturnStatus(returnId, status);
    if (result.success) {
      setReturns(returns.map(r => r.return_id === returnId ? { ...r, status } : r));
    } else {
      alert(result.error);
    }
  };

  const languageOptions = [
    { value: "tamil", label: "Tamil" },
    { value: "tanglish", label: "Tanglish" },
    { value: "hindi", label: "Hindi" },
    { value: "english", label: "English" },
  ];

  const methodOptions = [
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "upi", label: "UPI" },
    { value: "bank", label: "Bank Transfer" },
    { value: "credit_note", label: "Credit Note" },
    { value: "adjustment", label: "Adjustment" },
  ];

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "credit", label: "Credit" },
    { id: "blacklist", label: "Blacklist" },
    { id: "memory", label: "Memory" },
    { id: "orders", label: "Orders" },
    { id: "complaints", label: "Complaints" },
    { id: "returns", label: "Returns" },
    { id: "calls", label: "Call Logs" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={shop.shop_name}
        subtitle={`${shop.owner_name ?? "\u2014"} \u00b7 {shop.shop_id} \u00b7 {shop.phone_number}`}
        right={
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="violet">
              {languageLabel[shop.preferred_language]} {" "}
              <span className="opacity-70">\u00b7 {languageNative[shop.preferred_language]}</span>
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

      <div className="border-b border-zinc-200">
        <nav className="flex gap-1 overflow-x-auto px-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Credit health"
                right={editingProfile ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleEditProfileCancel} disabled={loadingAction === "save-profile"}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleEditProfileSave} loading={loadingAction === "save-profile"}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={handleEditProfileStart}>
                    Edit Profile
                  </Button>
                )}
              />
              {editingProfile ? (
                <div className="p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Shop Name" id="shop_name" value={(editForm.shop_name ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, shop_name: e.target.value })} required />
                    <FormField label="Owner Name" id="owner_name" value={(editForm.owner_name ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, owner_name: e.target.value })} required />
                    <FormField label="Phone" id="phone_number" value={(editForm.phone_number ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, phone_number: e.target.value })} type="tel" required />
                    <FormField label="WhatsApp" id="whatsapp_number" value={(editForm.whatsapp_number ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, whatsapp_number: e.target.value })} type="tel" />
                    <SelectField label="Language" id="preferred_language" value={editForm.preferred_language ?? ""} onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, preferred_language: e.target.value as any })} options={languageOptions} />
                    <SelectField label="Route" id="beat_route_id" value={editForm.beat_route_id ?? ""} onChange={(e: ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, beat_route_id: e.target.value || undefined })} options={routeOptions} placeholder="Select route" />
                    <NumberInput label="Visit Gap" id="visit_gap_days" value={editForm.visit_gap_days ?? 7} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, visit_gap_days: Number(e.target.value) })} min={1} />
                    <NumberInput label="Credit Limit" id="credit_limit" value={editForm.credit_limit ?? 0} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, credit_limit: Number(e.target.value) })} min={0} step={1000} />
                    <FormField label="Call Start" id="preferred_call_start" value={(editForm.preferred_call_start ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, preferred_call_start: e.target.value })} type="time" />
                    <FormField label="Call End" id="preferred_call_end" value={(editForm.preferred_call_end ?? "") as string} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, preferred_call_end: e.target.value })} type="time" />
                  </div>
                  <FormField label="Address" id="address" value={editForm.address} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, address: e.target.value })} />
                  <FormField label="GST Number" id="gst_number" value={editForm.gst_number} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, gst_number: e.target.value })} />
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editForm.voice_consent ?? false} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, voice_consent: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-zinc-700">Voice Consent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editForm.whatsapp_consent ?? false} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, whatsapp_consent: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-zinc-700">WhatsApp Consent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editForm.opt_out ?? false} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, opt_out: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-zinc-700">Opt Out</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold tracking-tight text-zinc-900">{formatINR(available)}</p>
                      <p className="mt-1 text-sm text-zinc-500">available of {formatINR(shop.credit_limit)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-zinc-900">{formatINR(shop.outstanding_balance)}</p>
                      <p className="text-zinc-500">outstanding</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div className={cn("h-full rounded-full", creditExceeded ? "bg-rose-500" : creditPct < 0.25 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${creditPct * 100}%` }} />
                  </div>
                  {creditExceeded && (
                    <p className="mt-3 text-sm text-rose-600">This shop has crossed its credit limit. Cap new orders at confirmation until balance clears.</p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Shop profile" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 sm:grid-cols-3">
                <KeyValue label="Phone" value={shop.phone_number} />
                <KeyValue label="WhatsApp" value={shop.whatsapp_number ?? "\u2014"} />
                <KeyValue label="Language" value={languageLabel[shop.preferred_language]} />
                <KeyValue label="Call window" value={`${formatTime(shop.preferred_call_start)} \u2013 ${formatTime(shop.preferred_call_end)}`} />
                <KeyValue label="Visit gap" value={`${shop.visit_gap_days} days`} />
                <KeyValue label="Beat route" value={routeName ?? shop.beat_route_id ?? "\u2014"} />
                <KeyValue label="Voice consent" value={shop.voice_consent ? "Yes" : "No"} />
                <KeyValue label="WhatsApp consent" value={shop.whatsapp_consent ? "Yes" : "No"} />
                <KeyValue label="Opted out" value={shop.opt_out ? "Yes" : "No"} />
              </dl>
            </Card>
          </div>
        )}

        {/* Credit Tab */}
{activeTab === "credit" && (
          <Card>
            <CardHeader title="Credit Ledger" right={<Button size="sm" onClick={openPaymentModal} disabled={loadingAction === "payment"}>Record Payment</Button>} />
            <div className="px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-zinc-900">{formatINR(available)}</p>
                  <p className="text-sm text-zinc-500">Available of {formatINR(shop.credit_limit)} | Limit: {formatINR(shop.credit_limit)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-zinc-900">{formatINR(shop.outstanding_balance)}</p>
                  <p className="text-zinc-500">Outstanding</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className={cn("h-full rounded-full", creditExceeded ? "bg-rose-500" : creditPct < 0.25 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${creditPct * 100}%` }} />
              </div>
            </div>
            <div className="border-t border-zinc-100">
              <DataTable<ShopPaymentLedger>
                columns={[
                  { key: "collected_at", header: "Date", render: (row) => formatDate(row.collected_at) },
                  { key: "entry_type", header: "Type", render: (row) => <StatusBadge status={row.entry_type} /> },
                  { key: "method", header: "Method", render: (row) => row.method },
                  { key: "reference", header: "Reference", render: (row) => row.reference ?? "\u2014" },
                  { key: "collected_by", header: "Collected By", render: (row) => row.collected_by ?? "\u2014" },
                  { key: "amount", header: "Amount", className: "text-right", render: (row) => formatINR(row.amount) },
                  { key: "notes", header: "Notes", render: (row) => row.notes ?? "\u2014" },
                ]}
                data={[] as ShopPaymentLedger[]}
                keyExtractor={(row) => row.entry_id}
                emptyMessage="No payment history yet"
              />
            </div>

            {paymentModal.isOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPaymentModal({ isOpen: false, form: {} })}>
                <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-gray-900">Record Payment for {shop.shop_name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">Outstanding: {formatINR(shop.outstanding_balance)} | Available Credit: {formatINR(available)}</p>
                  <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
                    <NumberInput label="Amount" id="payment_amount" value={paymentModal.form.amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, amount: e.target.value } })} required min={1} step={1} />
                    <SelectField label="Method" id="payment_method" value={paymentModal.form.method} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, method: e.target.value as any } })} options={methodOptions} />
                    <FormField label="Reference (Cheque No, UPI Ref)" id="payment_reference" value={paymentModal.form.reference} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, reference: e.target.value } })} />
                    <FormField label="Collected By" id="payment_collected_by" value={paymentModal.form.collected_by} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, collected_by: e.target.value } })} />
                    <TextareaField label="Notes" id="payment_notes" value={paymentModal.form.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, notes: e.target.value } })} rows={2} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setPaymentModal({ isOpen: false, form: {} })} disabled={loadingAction === "payment"}>Cancel</Button>
                      <Button type="submit" loading={loadingAction === "payment"}>Record Payment</Button>
                    </div>
                  </form>
                </div>
              </div>
) : null}
          </Card>
        )}

        {/* Blacklist Tab */}
        {activeTab === "blacklist" && (
          <Card>
            <CardHeader
              title="Blacklist"
              subtitle="Products the AI must never pitch"
              right={<Button size="sm" onClick={() => {}}>Add to Blacklist</Button>}
            />
            {blacklist.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No blacklisted products" body="No products are off-limits for this shop." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {blacklist.map((b) => (
                  <li key={b.blacklist_id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{b.product_name}</p>
                      {b.reason && <p className="mt-0.5 text-sm text-zinc-500">\u201c{b.reason}\u201d</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveBlacklist(b.product_id)}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Memory Tab */}
        {activeTab === "memory" && (
          <Card>
            <CardHeader
              title="AI memory"
              subtitle={`${memories.length} learned preferences`}
              right={
                memories.length > 0 ? (
                  <Badge tone="emerald">{memories.filter((m) => m.confirmed_by_user).length} confirmed</Badge>
                ) : undefined
              }
            />
            {memories.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No memories yet" body="The AI records shop preferences after every call." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {memories.map((m) => (
                  <li key={m.memory_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-zinc-800">{m.memory_text}</p>
                      <div className="flex items-center gap-2">
                        {m.confirmed_by_user ? (
                          <Badge tone="emerald">Confirmed</Badge>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleConfirmMemory(m.memory_id)}>Confirm</Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteMemory(m.memory_id)}>Delete</Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={memoryTypeTone[m.memory_type]}>{memoryTypeLabel[m.memory_type]}</Badge>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(m.confidence_score * 100)}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400">{Math.round(m.confidence_score * 100)}%</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <Card>
            <CardHeader title="Orders" subtitle={`${orders.length} orders recorded`} right={<Button size="sm">Create Manual Order</Button>} />
            {orders.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No orders yet" body="Orders from AI calls will appear here." />
              </div>
            ) : (
              <DataTable
                columns={[
                  { key: "order_id", header: "Order ID", render: (o) => <a href={"/orders/" + o.order_id} className="text-emerald-700 hover:underline">{o.order_id}</a> },
                  { key: "order_date", header: "Date", render: (o) => formatDate(o.order_date) },
                  { key: "order_status", header: "Status", render: (o) => <StatusBadge status={o.order_status} /> },
                  { key: "payment_status", header: "Payment", render: (o) => <StatusBadge status={o.payment_status} /> },
                  { key: "total_amount", header: "Total", className: "text-right", render: (o) => formatINR(o.total_amount) },
                  { key: "delivery_date", header: "Delivery", render: (o) => formatDate(o.delivery_date) },
                ]}
                data={orders}
                keyExtractor={(o) => o.order_id}
              />
            )}
          </Card>
        )}

        {/* Complaints Tab */}
        {activeTab === "complaints" && (
          <Card>
            <CardHeader title="Complaints" subtitle={`${complaints.length} recorded`} />
            {complaints.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No complaints" body="This shop has no open complaints." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {complaints.map((c) => (
                  <li key={c.complaint_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">{complaintTypeLabel[c.complaint_type]}</span>
                        <StatusBadge status={c.severity} />
                        <StatusBadge status={c.status} />
                        {c.callback_requested && <Badge tone="rose">Callback</Badge>}
                      </div>
                      <div className="flex gap-2">
                        {c.status === "open" && <Button variant="ghost" size="sm" onClick={() => handleResolveComplaint(c.complaint_id)}>Resolve</Button>}
                        {c.status === "resolved" && <Button variant="ghost" size="sm" onClick={() => handleCloseComplaint(c.complaint_id)}>Close</Button>}
                      </div>
                    </div>
                    {c.description && <p className="mt-1.5 text-sm text-zinc-500">{c.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Returns Tab */}
        {activeTab === "returns" && (
          <Card>
            <CardHeader title="Returns" subtitle={`${returns.length} return requests`} right={<Button size="sm">Create Return</Button>} />
            {returns.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No returns" body="Return requests from this shop will appear here." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {returns.map((r) => (
                  <li key={r.return_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{r.product_name ?? r.product_id ?? "Item"} \u00d7 {r.quantity}</p>
                        <p className="text-xs text-zinc-500">Order: {r.order_id ?? "\u2014"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <select
                          value={r.status}
                          onChange={(e) => handleUpdateReturnStatus(r.return_id, e.target.value)}
                          className="text-xs border border-zinc-300 rounded px-2 py-1"
                          disabled={loadingAction?.startsWith("return-")}
                        >
                          <option value="requested">Requested</option>
                          <option value="photo_received">Photo Received</option>
                          <option value="approved">Approved</option>
                          <option value="collected">Collected</option>
                          <option value="credit_issued">Credit Issued</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                    {r.reason && <p className="mt-1 text-sm text-zinc-500">{complaintTypeLabel[r.reason] ?? r.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Call Logs Tab */}
        {activeTab === "calls" && (
          <Card>
            <CardHeader title="Call logs" subtitle={`${callLogs.length} AI calls`} />
            {callLogs.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No calls yet" body="Voice AI call history will appear here." />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {callLogs.map((call) => (
                  <li key={call.call_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-zinc-900">{formatDateTime(call.start_time)}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone="violet">{languageLabel[call.language_detected ?? "english"]}</Badge>
                        <Badge tone={sentimentTone[call.sentiment]}>{sentimentLabel[call.sentiment]}</Badge>
                        {call.order_placed && <Badge tone="emerald">Order placed</Badge>}
                        {call.escalated_to_human && <Badge tone="rose">Escalated</Badge>}
                      </div>
                    </div>
                    {call.transcript_summary && <p className="mt-1.5 text-sm text-zinc-500">{call.transcript_summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* Add Blacklist Modal */}
      {addBlacklistModal.isOpen && (
        <ConfirmDialog
          isOpen={addBlacklistModal.isOpen}
          onClose={() => setAddBlacklistModal({ isOpen: false, productId: "" })}
          onConfirm={() => {}}
          title="Add to Blacklist"
          confirmText="Add"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleAddBlacklistConfirm} className="space-y-4">
            <TextareaField label="Reason (optional)" id="bl_reason" name="reason" rows={3} placeholder="Why should this product be blacklisted for this shop?" />
          </form>
        </ConfirmDialog>
      )}

      {/* Payment Modal */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPaymentModal({ isOpen: false, form: {} })}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Record Payment for {shop.shop_name}</h3>
            <p className="mt-1 text-sm text-zinc-500">Outstanding: {formatINR(shop.outstanding_balance)} | Available Credit: {formatINR(available)}</p>
            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
              <NumberInput label="Amount" id="payment_amount" value={paymentModal.form.amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, amount: e.target.value } })} required min={1} step={1} />
              <SelectField label="Method" id="payment_method" value={paymentModal.form.method} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, method: e.target.value as any } })} options={methodOptions} />
              <FormField label="Reference (Cheque No, UPI Ref)" id="payment_reference" value={paymentModal.form.reference} onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentModal({ ...paymentModal, form: { ...paymentModal.form, reference: e.target.value } })} />
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
    </div>
  );
}