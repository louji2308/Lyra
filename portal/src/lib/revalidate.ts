import { revalidatePath } from "next/cache";

export function revalidateShops() {
  revalidatePath("/shops");
  revalidatePath("/");
  revalidatePath("/exceptions");
}

export function revalidateShop(shopId: string) {
  revalidatePath(`/shops/${shopId}`);
  revalidatePath("/shops");
  revalidatePath("/");
  revalidatePath("/exceptions");
}

export function revalidateOrders() {
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/exceptions");
}

export function revalidateOrder(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/exceptions");
}

export function revalidateCatalog() {
  revalidatePath("/catalog");
  revalidatePath("/exceptions");
}

export function revalidateExceptions() {
  revalidatePath("/exceptions");
  revalidatePath("/");
}

export function revalidatePayments() {
  revalidatePath("/payments");
  revalidatePath("/shops");
  revalidatePath("/");
  revalidatePath("/exceptions");
}

export function revalidateDeliveries() {
  revalidatePath("/deliveries");
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/exceptions");
}