import type { Metadata } from "next";
import CreateOrderForm from "./CreateOrderForm";

export const metadata: Metadata = { title: "Create Order" };

export const dynamic = "force-dynamic";

export default async function CreateOrderPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <CreateOrderForm />
    </div>
  );
}