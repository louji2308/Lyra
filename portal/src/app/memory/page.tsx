import type { Metadata } from "next";
import { getMemories, getShops } from "@/lib/data";
import { MemoryClient } from "./components/MemoryClient";

export const metadata: Metadata = { title: "AI Memory" };

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const [memories, shops] = await Promise.all([getMemories(), getShops()]);
  return <MemoryClient memories={memories} shops={shops} />;
}