"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, Badge } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { ProductCatalogItem } from "@/lib/voice/client";

const CATEGORIES = ["All", "Personal Care", "Home Care", "Beverages", "Oral Care"];
const BRANDS = ["All", "Clinic Plus", "Lux", "Surf Excel", "Rin", "Wheel", "Pepsodent", "Boost", "Red Label", "Brooke Bond", "Lifebuoy", "Dove"];

export function CatalogContent() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [search, setSearch] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, inventory(available_qty)")
        .eq("is_active", true)
        .order("brand", { ascending: true })
        .order("product_name", { ascending: true });

      if (error) throw error;

      const mapped: ProductCatalogItem[] = ((data ?? []) as Array<{
        product_id: string;
        product_name: string;
        brand: string;
        category: string;
        unit_type: string;
        price: number;
        tax_rate: number;
        is_active: boolean;
        inventory: Array<{ available_qty: number }> | { available_qty: number } | null;
      }>).map((p) => {
        const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
        return {
          product_id: p.product_id,
          product_name: p.product_name,
          brand: p.brand,
          category: p.category,
          unit_type: p.unit_type,
          price: Number(p.price),
          tax_rate: Number(p.tax_rate),
          is_active: p.is_active,
          available_qty: inv ? Number(inv.available_qty) : 0,
        };
      });

      setProducts(mapped);
      setFilteredProducts(mapped);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = products;

    if (category !== "All") filtered = filtered.filter((p) => p.category === category);
    if (brand !== "All") filtered = filtered.filter((p) => p.brand === brand);
    if (inStockOnly) filtered = filtered.filter((p) => (p.available_qty ?? 0) > 0);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    setFilteredProducts(filtered);
  }, [products, category, brand, search, inStockOnly]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand, category..."
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:w-64">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                In stock only
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                  aria-label="Grid view"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg ${viewMode === "list" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
                  aria-label="List view"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          {filteredProducts.length} of {products.length} products
        </p>
      </div>

      {/* Product Grid/List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-zinc-200 rounded animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-zinc-500">No products match your filters</p>
        </Card>
      ) : (
        viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((product) => (
              <ProductRow key={product.product_id} product={product} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductCatalogItem }) {
  const stock = product.available_qty ?? 0;
  const isLowStock = stock > 0 && stock <= 5;
  const isOutOfStock = stock === 0;

  return (
    <Card className="flex flex-col h-full p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 truncate">{product.product_name}</h3>
          <p className="text-sm text-zinc-500">{product.brand} · {product.category}</p>
        </div>
        <Badge tone={isOutOfStock ? "rose" : isLowStock ? "amber" : "emerald"}>
          {isOutOfStock ? "Out of Stock" : isLowStock ? `Low: ${stock}` : `Stock: ${stock}`}
        </Badge>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-500">{product.unit_type} · ₹{product.price.toFixed(0)} + {product.tax_rate}% GST</p>
          <p className="text-lg font-bold text-emerald-700">₹{product.price.toFixed(0)}</p>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
          <span className="text-xs text-zinc-400">SKU: {product.product_id}</span>
        </div>
      </div>
    </Card>
  );
}

function ProductRow({ product }: { product: ProductCatalogItem }) {
  const stock = product.available_qty ?? 0;
  const isLowStock = stock > 0 && stock <= 5;
  const isOutOfStock = stock === 0;

  return (
    <Card className="p-3">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-900 truncate">{product.product_name}</h3>
          <p className="text-sm text-zinc-500">{product.brand} · {product.category} · {product.unit_type}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-700">₹{product.price.toFixed(0)}</p>
          <p className="text-xs text-zinc-400">+ {product.tax_rate}% GST</p>
        </div>
        <Badge tone={isOutOfStock ? "rose" : isLowStock ? "amber" : "emerald"}>
          {isOutOfStock ? "Out of Stock" : isLowStock ? `Low: ${stock}` : `Stock: ${stock}`}
        </Badge>
        <span className="text-xs text-zinc-400 font-mono">SKU: {product.product_id}</span>
      </div>
    </Card>
  );
}