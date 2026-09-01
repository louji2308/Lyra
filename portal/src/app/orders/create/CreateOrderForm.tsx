"use client";

import { getShops, getProducts, getActiveSchemes } from "@/lib/data";
import { createOrder } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { cn } from "@/lib/utils";
import { useState, FormEvent, ChangeEvent, useEffect } from "react";

export default function CreateOrderFormWrapper() {
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data on mount
  const fetchData = async () => {
    try {
      const [shopsRes, productsRes, schemesRes] = await Promise.all([
        fetch("/api/shops-list"),
        fetch("/api/products-list"),
        fetch("/api/schemes-list"),
      ]);
      const [shopsData, productsData, schemesData] = await Promise.all([
        shopsRes.json(),
        productsRes.json(),
        schemesRes.json(),
      ]);
      setShops(shopsData.filter((s: any) => !s.opt_out));
      setProducts(productsData.filter((p: any) => p.is_active));
      setSchemes(schemesData);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-zinc-200 rounded w-1/4" /><div className="h-64 bg-zinc-200 rounded" /></div>;
  }

  return (
    <CreateOrderForm shops={shops} products={products} schemes={schemes} />
  );
}

function CreateOrderForm({ shops, products, schemes }: { shops: any[]; products: any[]; schemes: any[] }) {
  const [items, setItems] = useState<Array<{product_id: string; quantity: number; unit: string; price: number}>>([{product_id: "", quantity: 1, unit: "piece", price: 0}]);
  const [shopId, setShopId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (!shopId || validItems.length === 0) {
      setError("Please select a shop and add at least one item");
      setSubmitting(false);
      return;
    }

    try {
      const result = await createOrder({ shop_id: shopId, items: validItems });
      if (result.success) {
        window.location.href = `/orders/${result.data.order_id}`;
      } else {
        setError(result.error);
      }
    } catch (e: any) {
      setError(e.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const addItem = () => {
    setItems([...items, {product_id: "", quantity: 1, unit: "piece", price: 0}]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "product_id") {
      const product = products.find((p: any) => p.product_id === value);
      if (product) {
        newItems[index].price = product.price;
        newItems[index].unit = product.unit_type;
      }
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <PageHeader
        title="Create Manual Order"
        subtitle="Create a new order for a shop"
        right={<a href="/orders" className="text-sm text-emerald-600 hover:underline">← Back to Orders</a>}
      />
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="grid gap-3 max-w-2xl">
        <SelectField
          label="Shop"
          value={shopId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setShopId(e.target.value)}
          required
          options={shops.map(s => ({ value: s.shop_id, label: `${s.shop_name} (${s.owner_name}) - ${formatINR(s.available_credit)} available` }))}
          placeholder="Select shop"
        />
      </div>

      {items.map((item, index) => (
        <Card key={index}>
          <CardHeader
            title={`Item ${index + 1}`}
            right={items.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => removeItem(index)}>
                Remove
              </Button>
            ) : undefined}
          />
          <div className="p-4 grid gap-3 sm:grid-cols-4">
            <SelectField
              label="Product"
              value={item.product_id}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => updateItem(index, "product_id", e.target.value)}
              required
              options={products.map(p => ({ value: p.product_id, label: `${p.product_name} (${p.unit_type}) - ${formatINR(p.price)}` }))}
              placeholder="Select product"
            />
            <NumberInput
              label="Quantity"
              value={item.quantity}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
              required
              min={1}
              step={1}
            />
            <FormField label="Unit" value={item.unit} disabled />
            <FormField label="Line Total" value={formatINR(item.price * item.quantity)} />
          </div>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>
          + Add Item
        </Button>
      </div>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-4">
          <TextareaField name="notes" label="Internal Notes" rows={3} placeholder="Any special instructions..." />
        </div>
      </Card>

      {error && <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">{error}</div>}

      <div className="flex justify-end gap-3">
        <a href="/orders" className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</a>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
          {submitting ? "Creating..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}