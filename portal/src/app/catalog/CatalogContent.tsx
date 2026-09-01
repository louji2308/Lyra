"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card, CardHeader, Badge, EmptyState, Stat, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { createProduct, updateProduct, deactivateProduct, adjustInventory } from "@/lib/actions";
import type { Product } from "@/lib/types";
import { formatINR } from "@/lib/format";

const CATEGORIES = ["Personal Care", "Home Care", "Beverages", "Oral Care", "Food", "Other"];
const UNITS = ["bottle", "pack", "box", "kg", "litre", "piece", "sachet", "tube", "can", "jar"];

interface CatalogContentProps {
  products: Product[];
}

export function CatalogContent({ products: initialProducts }: CatalogContentProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustInventoryModal, setAdjustInventoryModal] = useState<{ product: Product | null; isOpen: boolean }>({ product: null, isOpen: false });
  const [inventoryForm, setInventoryForm] = useState({ change_qty: 0, reason: "restock", notes: "" });
  const [productForm, setProductForm] = useState({
    product_id: "",
    product_name: "",
    brand: "",
    category: "",
    unit_type: "bottle",
    price: 0,
    tax_rate: 18,
    supplier_id: "",
    is_active: true,
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim().toLowerCase();
  const filteredProducts = q
    ? products.filter((p) =>
        [p.product_id, p.product_name, p.brand, p.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : products;

  const handleAddProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-product");
    const formData = new FormData(e.currentTarget);
    const result = await createProduct({
      product_id: formData.get("product_id") as string,
      product_name: formData.get("product_name") as string,
      brand: formData.get("brand") as string || undefined,
      category: formData.get("category") as string,
      unit_type: formData.get("unit_type") as string,
      price: Number(formData.get("price")),
      tax_rate: Number(formData.get("tax_rate")) || 18,
      supplier_id: formData.get("supplier_id") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setProducts([result.data, ...products]);
      setIsAddProductOpen(false);
setProductForm({ product_id: "", product_name: "", brand: "", category: "", unit_type: "bottle", price: 0, tax_rate: 18, supplier_id: "", is_active: true });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleEditProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoadingAction(`edit-${editingProduct.product_id}`);
    const formData = new FormData(e.currentTarget);
    const result = await updateProduct(editingProduct.product_id, {
      product_name: formData.get("product_name") as string,
      brand: formData.get("brand") as string || undefined,
      category: formData.get("category") as string,
      unit_type: formData.get("unit_type") as string,
      price: Number(formData.get("price")),
      tax_rate: Number(formData.get("tax_rate")) || 18,
      supplier_id: formData.get("supplier_id") as string || undefined,
      is_active: formData.get("is_active") === "on",
    });
    setLoadingAction(null);
    if (result.success) {
      setProducts(products.map(p => p.product_id === editingProduct.product_id ? result.data : p));
      setEditingProduct(null);
    } else {
      alert(result.error);
    }
  };

  const handleDeactivateProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to deactivate this product?")) return;
    setLoadingAction(`deactivate-${productId}`);
    const result = await deactivateProduct(productId);
    setLoadingAction(null);
    if (result.success) {
      setProducts(products.filter(p => p.product_id !== productId));
    } else {
      alert(result.error);
    }
  };

  const openAdjustInventory = (product: Product) => {
    setAdjustInventoryModal({ product, isOpen: true });
    setInventoryForm({ change_qty: 0, reason: "restock", notes: "" });
  };

  const handleAdjustInventory = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!adjustInventoryModal.product) return;
    setLoadingAction(`adjust-${adjustInventoryModal.product.product_id}`);
    const formData = new FormData(e.currentTarget);
    const result = await adjustInventory({
      product_id: adjustInventoryModal.product.product_id,
      change_qty: Number(formData.get("change_qty")),
      reason: formData.get("reason") as any,
      reference_type: "manual",
      performed_by: "MANUAL",
    });
    setLoadingAction(null);
    if (result.success) {
      setProducts(products.map(p => p.product_id === adjustInventoryModal.product?.product_id
        ? { ...p, available_qty: Math.max(0, (p.available_qty ?? 0) + Number(formData.get("change_qty"))) }
        : p
      ));
      setAdjustInventoryModal({ product: null, isOpen: false });
      setInventoryForm({ change_qty: 0, reason: "restock", notes: "" });
    } else {
      alert(result.error);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      product_id: product.product_id,
      product_name: product.product_name,
      brand: product.brand ?? "",
      category: product.category,
      unit_type: product.unit_type,
      price: product.price,
      tax_rate: product.tax_rate,
      supplier_id: product.supplier_id ?? "",
      is_active: product.is_active,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        subtitle={`${products.length} products`}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsAdminMode(!isAdminMode)}>
              {isAdminMode ? "Exit Admin" : "Admin Mode"}
            </Button>
            {isAdminMode && <Button onClick={() => setIsAddProductOpen(true)}>Add Product</Button>}
          </div>
        }
      />

      {isAdminMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-4">
          <span className="text-sm text-amber-800 font-medium">⚠ Admin Mode - Changes affect live data</span>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Search</label>
            <FormField
              placeholder="Search by name, brand, category..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Products" value={products.length} />
        <Stat label="Active" value={products.filter(p => p.is_active).length} />
        <Stat label="Inactive" value={products.filter(p => !p.is_active).length} valueTone="text-amber-600" />
        <Stat label="Low Stock" value={products.filter(p => (p.available_qty ?? 0) > 0 && (p.available_qty ?? 0) <= 5).length} valueTone="text-rose-600" />
      </div>

      <Card>
        <CardHeader title="Products" right={isAdminMode ? <Button size="sm" onClick={() => setIsAddProductOpen(true)}>Add Product</Button> : null} />
        <DataTable
          columns={[
            { key: "product_id", header: "SKU", className: "w-24 font-mono text-xs", render: (p) => p.product_id },
            { key: "product_name", header: "Product", className: "w-48", render: (p) => p.product_name },
            { key: "brand", header: "Brand", className: "w-28", render: (p) => p.brand ?? "—" },
            { key: "category", header: "Category", className: "w-28", render: (p) => p.category },
            { key: "unit_type", header: "Unit", className: "w-20", render: (p) => p.unit_type },
            { key: "price", header: "Price", className: "w-24 text-right", render: (p) => formatINR(p.price) },
            { key: "tax_rate", header: "GST", className: "w-16 text-right", render: (p) => p.tax_rate + "%" },
            { key: "available_qty", header: "Stock", className: "w-20 text-right",
              render: (p) => {
                const stock = p.available_qty ?? 0;
                if (stock === 0) return <span className="text-rose-600 font-medium">0</span>;
                if (stock <= 5) return <span className="text-amber-600 font-medium">{stock}</span>;
                return <span className="text-emerald-600 font-medium">{stock}</span>;
              }
            },
            { key: "is_active", header: "Status", className: "w-20", render: (p) => <Badge tone={p.is_active ? "emerald" : "zinc"}>{p.is_active ? "Active" : "Inactive"}</Badge> },
          ]}
          data={filteredProducts}
          keyExtractor={(p) => p.product_id}
          rowActions={(p) => (
            <div className="flex items-center gap-1">
              {isAdminMode && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => openAdjustInventory(p)}>Stock</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeactivateProduct(p.product_id)} disabled={loadingAction === `deactivate-${p.product_id}`}>
                    {p.is_active ? "Deactivate" : "Delete"}
                  </Button>
                </>
              )}
            </div>
          )}
        />
      </Card>

      {/* Add Product Modal */}
      <ConfirmDialog
        isOpen={isAddProductOpen}
        onClose={() => { setIsAddProductOpen(false); setProductForm({ product_id: "", product_name: "", brand: "", category: "", unit_type: "bottle", price: 0, tax_rate: 18, supplier_id: "", is_active: true }); }}
        onConfirm={() => {}}
        title="Add New Product"
        confirmText="Create Product"
        cancelText="Cancel"
        variant="primary"
      >
        <form onSubmit={handleAddProduct} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Product ID (SKU)" id="add_product_id" name="product_id" value={productForm.product_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, product_id: e.target.value })} required placeholder="e.g., P034" />
            <FormField label="Product Name" id="add_product_name" name="product_name" value={productForm.product_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, product_name: e.target.value })} required />
            <FormField label="Brand" id="add_brand" name="brand" value={productForm.brand} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, brand: e.target.value })} />
            <SelectField
              label="Category"
              id="add_category"
              name="category"
              value={productForm.category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setProductForm({ ...productForm, category: e.target.value })}
              options={CATEGORIES.map(c => ({ value: c, label: c }))}
              required
            />
            <SelectField
              label="Unit Type"
              id="add_unit_type"
              name="unit_type"
              value={productForm.unit_type}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setProductForm({ ...productForm, unit_type: e.target.value })}
              options={UNITS.map(u => ({ value: u, label: u }))}
              required
            />
            <NumberInput label="Price" id="add_price" name="price" value={productForm.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, price: Number(e.target.value) })} min={0} step={0.01} required />
            <NumberInput label="GST Rate %" id="add_tax_rate" name="tax_rate" value={productForm.tax_rate} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, tax_rate: Number(e.target.value) })} min={0} step={0.01} defaultValue={18} />
            <FormField label="Supplier ID" id="add_supplier" name="supplier_id" value={productForm.supplier_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, supplier_id: e.target.value })} placeholder="Optional" />
          </div>
        </form>
      </ConfirmDialog>

      {/* Edit Product Modal */}
      {editingProduct && (
        <ConfirmDialog
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onConfirm={() => {}}
          title={`Edit Product: ${editingProduct.product_name}`}
          confirmText="Save Changes"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleEditProduct} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Product Name" id="edit_product_name" value={productForm.product_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, product_name: e.target.value })} required />
              <FormField label="Brand" id="edit_brand" value={productForm.brand} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, brand: e.target.value })} />
              <SelectField
                label="Category"
                id="edit_category"
                value={productForm.category}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setProductForm({ ...productForm, category: e.target.value })}
                options={CATEGORIES.map(c => ({ value: c, label: c }))}
                required
              />
              <SelectField
                label="Unit Type"
                id="edit_unit_type"
                value={productForm.unit_type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setProductForm({ ...productForm, unit_type: e.target.value })}
                options={UNITS.map(u => ({ value: u, label: u }))}
                required
              />
              <NumberInput label="Price" id="edit_price" value={productForm.price} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, price: Number(e.target.value) })} min={0} step={0.01} required />
              <NumberInput label="GST Rate %" id="edit_tax_rate" value={productForm.tax_rate} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, tax_rate: Number(e.target.value) })} min={0} step={0.01} />
              <FormField label="Supplier ID" id="edit_supplier" value={productForm.supplier_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, supplier_id: e.target.value })} />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingProduct.is_active}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-700">Active</span>
              </label>
            </div>
          </form>
        </ConfirmDialog>
      )}

      {/* Adjust Inventory Modal */}
      {adjustInventoryModal.isOpen && adjustInventoryModal.product && (
        <ConfirmDialog
          isOpen={adjustInventoryModal.isOpen}
          onClose={() => setAdjustInventoryModal({ product: null, isOpen: false })}
          onConfirm={() => {}}
          title={`Adjust Inventory: ${adjustInventoryModal.product.product_name}`}
          confirmText="Adjust Stock"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleAdjustInventory} className="space-y-4">
            <p className="text-sm text-zinc-600">Current Stock: <span className="font-medium text-emerald-700">{adjustInventoryModal.product.available_qty ?? 0}</span> {adjustInventoryModal.product.unit_type}</p>
            <NumberInput label="Quantity Change (+/-)" id="inv_change_qty" name="change_qty" value={inventoryForm.change_qty} onChange={(e: ChangeEvent<HTMLInputElement>) => setInventoryForm({ ...inventoryForm, change_qty: Number(e.target.value) })} required step={1} placeholder="e.g., +50 or -10" />
            <SelectField
              label="Reason"
              id="inv_reason"
              name="reason"
              value={inventoryForm.reason}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setInventoryForm({ ...inventoryForm, reason: e.target.value as any })}
              options={[
                { value: "restock", label: "Restock" },
                { value: "adjustment", label: "Adjustment" },
                { value: "damage", label: "Damage" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
            <TextareaField label="Notes" id="inv_notes" value={inventoryForm.notes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInventoryForm({ ...inventoryForm, notes: e.target.value })} rows={2} placeholder="Optional notes..." />
          </form>
        </ConfirmDialog>
      )}
    </div>
  );
}

