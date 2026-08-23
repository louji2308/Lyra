"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, SectionLabel } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createScheme, updateScheme, deactivateScheme } from "@/lib/actions";
import type { Scheme, Product } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";

interface SchemesClientProps {
  schemes: Scheme[];
  products: Product[];
}

interface SchemesClientProps {
  schemes: Scheme[];
  products: Product[];
}

export function SchemesClient({ schemes: initialSchemes, products }: SchemesClientProps) {
  const [schemes, setSchemes] = useState<Scheme[]>(initialSchemes);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [schemeForm, setSchemeForm] = useState({
    scheme_id: "",
    scheme_name: "",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    eligible_product_ids: [] as string[],
    minimum_quantity: 1,
    benefit_type: "discount",
    benefit_value: 0,
    is_active: true,
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAddScheme = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-scheme");
    const formData = new FormData(e.currentTarget);
    const result = await createScheme({
      scheme_id: formData.get("scheme_id") as string,
      scheme_name: formData.get("scheme_name") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string || undefined,
      eligible_product_ids: formData.getAll("eligible_product_ids") as string[],
      minimum_quantity: Number(formData.get("minimum_quantity")) || 1,
      benefit_type: formData.get("benefit_type") as any,
      benefit_value: Number(formData.get("benefit_value")) || 0,
    });
    setLoadingAction(null);
    if (result.success) {
      setSchemes([result.data, ...schemes]);
      setIsAddOpen(false);
setSchemeForm({ scheme_id: "", scheme_name: "", start_date: new Date().toISOString().split('T')[0], end_date: "", eligible_product_ids: [], minimum_quantity: 1, benefit_type: "discount", benefit_value: 0, is_active: true });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleEditScheme = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingScheme) return;
    setLoadingAction(`edit-${editingScheme.scheme_id}`);
    const formData = new FormData(e.currentTarget);
    const result = await updateScheme(editingScheme.scheme_id, {
      scheme_name: formData.get("scheme_name") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string || undefined,
      eligible_product_ids: formData.getAll("eligible_product_ids") as string[],
      minimum_quantity: Number(formData.get("minimum_quantity")) || 1,
      benefit_type: formData.get("benefit_type") as any,
      benefit_value: Number(formData.get("benefit_value")) || 0,
      is_active: formData.get("is_active") === "on",
    });
    setLoadingAction(null);
    if (result.success) {
      setSchemes(schemes.map(s => s.scheme_id === editingScheme.scheme_id ? result.data : s));
      setEditingScheme(null);
    } else {
      alert(result.error);
    }
  };

  const handleDeactivateScheme = async (schemeId: string) => {
    if (!confirm("Are you sure you want to deactivate this scheme?")) return;
    setLoadingAction(`deactivate-${schemeId}`);
    const result = await deactivateScheme(schemeId);
    setLoadingAction(null);
    if (result.success) {
      setSchemes(schemes.filter(s => s.scheme_id !== schemeId));
    } else {
      alert(result.error);
    }
  };

  const startEdit = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setSchemeForm({
      scheme_id: scheme.scheme_id,
      scheme_name: scheme.scheme_name,
      start_date: scheme.start_date,
      end_date: scheme.end_date ?? "",
      eligible_product_ids: scheme.eligible_product_ids,
      minimum_quantity: scheme.minimum_quantity,
      benefit_type: scheme.benefit_type,
      benefit_value: scheme.benefit_value,
      is_active: scheme.is_active,
    });
  };

  const benefitTypeOptions = [
    { value: "discount", label: "Discount %" },
    { value: "free_units", label: "Free Units" },
    { value: "cashback", label: "Cashback" },
  ];

  const formatBenefit = (scheme: Scheme) => {
    switch (scheme.benefit_type) {
      case "discount": return `${scheme.benefit_value}% off`;
      case "free_units": return `${scheme.benefit_value} free units`;
      case "cashback": return `₹${scheme.benefit_value} cashback`;
      default: return scheme.benefit_value.toString();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schemes & Promotions"
        subtitle={`${schemes.length} schemes`}
        right={
          <div className="flex gap-2">
            <Button onClick={() => setIsAddOpen(true)}>Create Scheme</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Schemes" value={schemes.length} />
        <Stat label="Active" value={schemes.filter(s => s.is_active).length} valueTone="text-emerald-600" />
        <Stat label="Inactive" value={schemes.filter(s => !s.is_active).length} valueTone="text-zinc-500" />
        <Stat label="Expiring Soon" value={schemes.filter(s => s.end_date && new Date(s.end_date) < new Date(Date.now() + 7*24*60*60*1000)).length} valueTone="text-amber-600" />
      </div>

      <Card>
        <CardHeader title="All Schemes" right={isAddOpen ? null : <Button onClick={() => setIsAddOpen(true)}>Create Scheme</Button>} />
        <DataTable
          columns={[
            { key: "scheme_id", header: "ID", className: "w-24 font-mono text-xs", render: (s) => s.scheme_id },
            { key: "scheme_name", header: "Name", className: "w-48", render: (s) => s.scheme_name },
            { key: "start_date", header: "Start", className: "w-28", render: (s) => formatDate(s.start_date) },
            { key: "end_date", header: "End", className: "w-28", render: (s) => formatDate(s.end_date) },
            { key: "benefit_type", header: "Type", className: "w-28", render: (s) => <StatusBadge status={s.benefit_type} /> },
            { key: "benefit_value", header: "Benefit", className: "w-32", render: (s) => formatBenefit(s) },
            { key: "min_qty", header: "Min Qty", className: "w-20 text-right", render: (s) => s.minimum_quantity.toString() },
            { key: "products", header: "Products", className: "w-28", render: (s) => `${s.eligible_product_ids.length} products` },
            { key: "is_active", header: "Status", className: "w-20", render: (s) => <Badge tone={s.is_active ? "emerald" : "zinc"}>{s.is_active ? "Active" : "Inactive"}</Badge> },
          ]}
          data={schemes}
          keyExtractor={(s) => s.scheme_id}
          rowActions={(s) => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeactivateScheme(s.scheme_id)} disabled={loadingAction === `deactivate-${s.scheme_id}`}>
                {s.is_active ? "Deactivate" : "Delete"}
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Add Scheme Modal */}
      <ConfirmDialog
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setSchemeForm({ scheme_id: "", scheme_name: "", start_date: new Date().toISOString().split('T')[0], end_date: "", eligible_product_ids: [], minimum_quantity: 1, benefit_type: "discount", benefit_value: 0, is_active: true }); }}
        onConfirm={() => {}}
        title="Create New Scheme"
        confirmText="Create Scheme"
        cancelText="Cancel"
        variant="primary"
      >
        <form onSubmit={handleAddScheme} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Scheme ID" id="scheme_id" name="scheme_id" value={schemeForm.scheme_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, scheme_id: e.target.value })} required placeholder="e.g., SCH001" />
            <FormField label="Scheme Name" id="scheme_name" name="scheme_name" value={schemeForm.scheme_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, scheme_name: e.target.value })} required />
            <FormField label="Start Date" id="start_date" name="start_date" value={schemeForm.start_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, start_date: e.target.value })} type="date" required />
            <FormField label="End Date" id="end_date" name="end_date" value={schemeForm.end_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, end_date: e.target.value })} type="date" />
            <SelectField
              label="Benefit Type"
              id="benefit_type"
              name="benefit_type"
              value={schemeForm.benefit_type}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSchemeForm({ ...schemeForm, benefit_type: e.target.value as any })}
              options={benefitTypeOptions}
              required
            />
            <NumberInput label="Benefit Value" id="benefit_value" name="benefit_value" value={schemeForm.benefit_value} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, benefit_value: Number(e.target.value) })} min={0} step={0.01} required />
            <NumberInput label="Min Quantity" id="min_qty" name="minimum_quantity" value={schemeForm.minimum_quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, minimum_quantity: Number(e.target.value) })} min={1} required defaultValue={1} />
          </div>
          <SectionLabel>Eligible Products</SectionLabel>
          <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded p-2 space-y-1">
            {products.map(p => (
              <label key={p.product_id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={schemeForm.eligible_product_ids.includes(p.product_id)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, eligible_product_ids: e.target.checked ? [...schemeForm.eligible_product_ids, p.product_id] : schemeForm.eligible_product_ids.filter(id => id !== p.product_id) })}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{p.product_name} ({p.product_id})</span>
              </label>
            ))}
          </div>
        </form>
      </ConfirmDialog>

      {/* Edit Scheme Modal */}
      {editingScheme && (
        <ConfirmDialog
          isOpen={!!editingScheme}
          onClose={() => setEditingScheme(null)}
          onConfirm={() => {}}
          title={`Edit Scheme: ${editingScheme.scheme_name}`}
          confirmText="Save Changes"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleEditScheme} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Scheme Name" id="edit_scheme_name" value={schemeForm.scheme_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, scheme_name: e.target.value })} required />
              <FormField label="Start Date" id="edit_start_date" value={schemeForm.start_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, start_date: e.target.value })} type="date" required />
              <FormField label="End Date" id="edit_end_date" value={schemeForm.end_date} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, end_date: e.target.value })} type="date" />
              <SelectField
                label="Benefit Type"
                id="edit_benefit_type"
                value={schemeForm.benefit_type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSchemeForm({ ...schemeForm, benefit_type: e.target.value as any })}
                options={benefitTypeOptions}
                required
              />
              <NumberInput label="Benefit Value" id="edit_benefit_value" value={schemeForm.benefit_value} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, benefit_value: Number(e.target.value) })} min={0} step={0.01} required />
              <NumberInput label="Min Quantity" id="edit_min_qty" value={schemeForm.minimum_quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, minimum_quantity: Number(e.target.value) })} min={1} required />
            </div>
            <SectionLabel>Eligible Products</SectionLabel>
            <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded p-2 space-y-1">
              {products.map(p => (
                <label key={p.product_id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeForm.eligible_product_ids.includes(p.product_id)}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, eligible_product_ids: e.target.checked ? [...schemeForm.eligible_product_ids, p.product_id] : schemeForm.eligible_product_ids.filter(id => id !== p.product_id) })}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{p.product_name} ({p.product_id})</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingScheme.is_active}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemeForm({ ...schemeForm, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-zinc-700">Active</span>
            </label>
          </form>
        </ConfirmDialog>
      )}
    </div>
  );
}