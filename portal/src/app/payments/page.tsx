import type { Metadata } from "next";
import { getShops, getPayments } from "@/lib/data";
import { PaymentsClient } from "./components/PaymentsClient";

export const metadata: Metadata = { title: "Payments" };

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [shops, payments] = await Promise.all([getShops(), getPayments()]);
  return <PaymentsClient payments={payments} shops={shops} />;
}