"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { FormField, SelectField } from "@/components/ui/FormFields";
import { addBlacklist, deleteBlacklistEntry, updateBlacklist } from "@/lib/actions";
import type { Product } from "@/lib/types";

interface BlacklistRow {
  shop_name: string;
  shop_id: string;
  product_id: string;
  reason: string | null;
  created_at: string;
  blacklist_id: number;
}

interface ShopOption {
  shop_id: string;
  shop_name: string;
}

interface ShopBlacklistClientProps {
  blacklist: BlacklistRow[];
  shopCount: number;
  shops: ShopOption[];
  products: Product[];
}

export function ShopBlacklistClient({
  blacklist: initialBlacklist,
  shopCount,
  shops,
  products,
}: ShopBlacklistClientProps) {
  const [blacklist, setBlacklist] = useState(initialBlacklist);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ shop_id: "", product_id: "", reason: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ product_id: "", reason: "" });

  const shopOptions = shops.map((s) => ({ value: s.shop_id, label: s.shop_name }));
  const productOptions = products.map((p) => ({ value: p.product_id, label: p.product_name }));
  const productName = new Map(products.map((p) => [p.product_id, p.product_name]));

  const handleAddSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addForm.shop_id) {
      alert("Select a shop");
      return;
    }
    if (!addForm.product_id) {
      alert("Select a product");
      return;
    }
    setLoadingAction("add-blacklist");
    const result = await addBlacklist(addForm.shop_id, addForm.product_id, addForm.reason || undefined);
    setLoadingAction(null);
    if (result.success) {
      const shop = shops.find((s) => s.shop_id === result.data.shop_id);
      setBlacklist([{ ...result.data, shop_name: shop?.shop_name ?? result.data.shop_id }, ...blacklist]);
      setAddForm({ shop_id: addForm.shop_id, product_id: "", reason: "" });
      setIsAdding(false);
    } else {
      alert(result.error);
    }
  };

  const startEdit = (b: BlacklistRow) => {
    setEditingId(b.blacklist_id);
    setEditForm({ product_id: b.product_id, reason: b.reason ?? "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ product_id: "", reason: "" });
  };

  const handleSaveEdit = async (b: BlacklistRow) => {
    setLoadingAction(`edit-${b.blacklist_id}`);
    const result = await updateBlacklist(b.blacklist_id, {
      product_id: editForm.product_id,
      reason: editForm.reason.trim() || null,
    });
    setLoadingAction(null);
    if (result.success) {
      setBlacklist(
        blacklist.map((bb) =>
          bb.blacklist_id === b.blacklist_id ? { ...bb, ...result.data } : bb
        )
      );
      setEditingId(null);
    } else {
      alert(result.error);
    }
  };

  const handleDelete = async (b: BlacklistRow) => {
    if (!confirm("Are you sure you want to remove this blacklist entry?")) return;
    setLoadingAction(`delete-${b.blacklist_id}`);
    const result = await deleteBlacklistEntry(b.blacklist_id);
    setLoadingAction(null);
    if (result.success) {
      setBlacklist(blacklist.filter((bb) => bb.blacklist_id !== b.blacklist_id));
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blacklist"
        subtitle={`${blacklist.length} blacklisted items across ${shopCount} shops`}
        right={<Link href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</Link>}
      />

      <div className="flex justify-end">
        <Button
          variant={isAdding ? "ghost" : "outline"}
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? "Cancel" : "+ Add blacklist item"}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader title="Add Blacklist Item" />
          <form onSubmit={handleAddSubmit} className="space-y-4 p-5">
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <SelectField
                label="Shop"
                id="blacklist_shop_id"
                value={addForm.shop_id}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setAddForm({ ...addForm, shop_id: e.target.value })
                }
                options={shopOptions}
                placeholder="Select shop"
                required
              />
              <SelectField
                label="Product"
                id="blacklist_product_id"
                value={addForm.product_id}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setAddForm({ ...addForm, product_id: e.target.value })
                }
                options={productOptions}
                placeholder="Select product"
                required
              />
              <FormField
                label="Reason"
                id="blacklist_reason"
                value={addForm.reason}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setAddForm({ ...addForm, reason: e.target.value })
                }
                placeholder="Why this shop opted out"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={loadingAction === "add-blacklist"}>
                Add item
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title="All Blacklisted Items" />
        {blacklist.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No blacklisted items"
              body="Shops haven't opted out of any products yet."
            />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "shop_name", header: "Shop", className: "w-48",
                render: (b: BlacklistRow) => (
                  <div>
                    <a href={"/shops/" + b.shop_id} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                      {b.shop_name}
                    </a>
                    <p className="mt-0.5 text-xs text-zinc-500">{b.shop_id}</p>
                  </div>
                )
              },
              { key: "product_id", header: "Product", className: "w-48",
                render: (b: BlacklistRow) => editingId === b.blacklist_id ? (
                  <SelectField
                    value={editForm.product_id}
                    onChange={(e) => setEditForm({ ...editForm, product_id: e.target.value })}
                    options={productOptions}
                    className="w-44"
                  />
                ) : (
                  <span className="font-medium text-zinc-900">{productName.get(b.product_id) ?? b.product_id}</span>
                )
              },
              { key: "reason", header: "Reason", className: "w-80",
                render: (b: BlacklistRow) => editingId === b.blacklist_id ? (
                  <FormField
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    className="w-64"
                  />
                ) : (
                  <span className="text-zinc-600 max-w-xs truncate block" title={b.reason ?? ""}>{b.reason ?? "—"}</span>
                )
              },
              { key: "created_at", header: "Date", className: "w-36",
                render: (b: BlacklistRow) => <span className="text-zinc-500">{new Date(b.created_at).toLocaleDateString()}</span>
              },
            ]}
            data={blacklist}
            keyExtractor={(b: BlacklistRow) => `${b.shop_id}-${b.product_id}-${b.blacklist_id}`}
            rowActions={(b: BlacklistRow) =>
              editingId === b.blacklist_id ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(b)}
                    loading={loadingAction === `edit-${b.blacklist_id}`}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(b)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(b)}
                    disabled={loadingAction === `delete-${b.blacklist_id}`}
                  >
                    Delete
                  </Button>
                </>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}