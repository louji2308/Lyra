import type { Metadata } from "next";
import { getMemories } from "@/lib/data";
import { MemoryClient } from "./components/MemoryClient";

export const metadata: Metadata = { title: "AI Memory" };

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const memories = await getMemories();
  return <MemoryClient memories={memories} />;
}