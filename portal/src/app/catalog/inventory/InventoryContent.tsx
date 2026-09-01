"use client";

import { useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, Badge, Stat, EmptyState } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adjustInventory } from "@/lib/actions";
import type { Product } from "@/lib/types";

interface InventoryContentProps {
  products: Product[];
}

export function InventoryContent({ products: initialProducts }: InventoryContentProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{ product: Product | null; isOpen: boolean }>({ product: null, isOpen: false });
  const [form, setForm] = useState({ change_qty: 0, reason: "restock", notes: "" });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) =>
        [p.product_id, p.product_name, p.brand, p.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : products;
  const sorted = [...filtered].sort((a, b) => (a.available_qty ?? 0) - (b.available_qty ?? 0));

  const inStock = products.filter((p) => (p.available_qty ?? 0) > 0).length;
  const lowStock = products.filter((p) => (p.available_qty ?? 0) > 0 && (p.available_qty ?? 0) <= 5).length;
  const outOfStock = products.filter((p) => (p.available_qty ?? 0) === 0).length;

  const handleAdjustInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adjustModal.product) return;
    setLoadingAction(`adjust-${adjustModal.product.product_id}`);
    const fd = new FormData(e.currentTarget);
    const result = await adjustInventory({
      product_id: adjustModal.product.product_id,
      change_qty: Number(fd.get("change_qty")),
      reason: (fd.get("reason") as "restock" | "adjustment" | "damage" | "transfer") || "restock",
      reference_type: "manual",
      performed_by: "MANUAL",
    });
    setLoadingAction(null);
    if (result.success) {
      setProducts(products.map((p) =>
        p.product_id === adjustModal.product!.product_id
          ? { ...p, available_qty: Math.max(0, (p.available_qty ?? 0) + Number(fd.get("change_qty"))) }
          : p
      ));
      setAdjustModal({ product: null, isOpen: false });
      setForm({ change_qty: 0, reason: "restock", notes: "" });
    } else {
      alert(result.error);
    }
  };

  const openAdjust = (p: Product) => {
    setAdjustModal({ product: p, isOpen: true });
    setForm({ change_qty: 0, reason: "restock", notes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {products.length} SKUs · sorted by stock level (lowest first)
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={isAdminMode ? "primary" : "secondary"} onClick={() => setIsAdminMode(!isAdminMode)}>
            {isAdminMode ? "Admin Mode On" : "Admin Mode"}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Search</label>
            <FormField
              placeholder="Search by SKU, name, brand, category..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total SKUs" value={products.length} />
        <Stat label="In Stock" value={inStock} />
        <Stat label="Low Stock" value={lowStock} valueTone={lowStock > 0 ? "text-rose-600" : undefined} />
        <Stat label="Out of Stock" value={outOfStock} valueTone={outOfStock > 0 ? "text-rose-600" : undefined} />
      </div>

      <Card>
        <CardHeader title="Stock Levels" />
        {sorted.length === 0 ? (
          <EmptyState title="No products match" body="Try clearing the search." />
        ) : (
          <DataTable
            columns={[
              { key: "product_id", header: "SKU", className: "w-24 font-mono text-xs", render: (p) => p.product_id },
              { key: "product_name", header: "Product", className: "w-52", render: (p) => p.product_name },
              { key: "brand", header: "Brand", className: "w-24", render: (p) => p.brand ?? "—" },
              { key: "category", header: "Category", className: "w-24", render: (p) => p.category },
              { key: "unit_type", header: "Unit", className: "w-20", render: (p) => p.unit_type },
              { key: "available_qty", header: "Stock", className: "w-24 text-right",
                render: (p) => {
                  const stock = p.available_qty ?? 0;
                  if (stock === 0) return <span className="text-rose-600 font-medium">0</span>;
                  if (stock <= 5) return <span className="text-amber-600 font-medium">{stock}</span>;
                  return <span className="text-emerald-600 font-medium">{stock}</span>;
                }
              },
              { key: "level", header: "Level", className: "w-24",
                render: (p) => {
                  const stock = p.available_qty ?? 0;
                  return stock === 0
                    ? <Badge tone="rose">Out of Stock</Badge>
                    : stock <= 5
                    ? <Badge tone="amber">Low Stock</Badge>
                    : <Badge tone="emerald">OK</Badge>;
                }
              },
            ]}
            data={sorted}
            keyExtractor={(p) => p.product_id}
            rowActions={(p) => (
              isAdminMode ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openAdjust(p)} disabled={loadingAction === `adjust-${p.product_id}`}>
                    Adjust Stock
                  </Button>
                </div>
              ) : undefined
            )}
          />
        )}
      </Card>

      {adjustModal.isOpen && adjustModal.product && (
        <ConfirmDialog
          isOpen={adjustModal.isOpen}
          onClose={() => setAdjustModal({ product: null, isOpen: false })}
          onConfirm={() => {}}
          title={`Adjust Inventory: ${adjustModal.product.product_name}`}
          confirmText="Adjust Stock"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleAdjustInventory} className="space-y-4">
            <p className="text-sm text-zinc-600">
              Current Stock: <span className="font-medium text-emerald-700">{adjustModal.product.available_qty ?? 0}</span> {adjustModal.product.unit_type}
            </p>
            <NumberInput
              label="Quantity Change (+/-)"
              id="inv_change_qty"
              name="change_qty"
              value={form.change_qty}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, change_qty: Number(e.target.value) })}
              required step={1} placeholder="e.g., +50 or -10"
            />
            <SelectField
              label="Reason"
              id="inv_reason"
              name="reason"
              value={form.reason}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm({ ...form, reason: e.target.value as any })}
              options={[
                { value: "restock", label: "Restock" },
                { value: "adjustment", label: "Adjustment" },
                { value: "damage", label: "Damage" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
            <TextareaField label="Notes" id="inv_notes" value={form.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional notes..." />
          </form>
        </ConfirmDialog>
      )}
    </div>
  );
}