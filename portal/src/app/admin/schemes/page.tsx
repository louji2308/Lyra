import type { Metadata } from "next";
import { getSchemes, getProducts } from "@/lib/data";
import { SchemesClient } from "./components/SchemesClient";

export const metadata: Metadata = { title: "Schemes & Promotions" };

export const dynamic = "force-dynamic";

export default async function SchemesPage() {
  const [schemes, products] = await Promise.all([getSchemes(), getProducts()]);
  return <SchemesClient schemes={schemes} products={products} />;
}