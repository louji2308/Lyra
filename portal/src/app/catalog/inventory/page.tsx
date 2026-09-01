import { Suspense } from "react";
import { Metadata } from "next";
import { getProducts } from "@/lib/data";
import { InventoryContent } from "./InventoryContent";

export const metadata: Metadata = {
  title: "Inventory | Shree Agencies",
  description: "SKU-level stock levels, low-stock alerts, and adjustments",
};

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const products = await getProducts();
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-zinc-900">Inventory</h1>
          <p className="mt-1 text-sm text-zinc-500">SKU-level stock levels, low-stock alerts, and adjustments</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<InventorySkeleton />}>
          <InventoryContent products={products} />
        </Suspense>
      </main>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-zinc-200 rounded w-1/4 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-zinc-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}