import Link from "next/link";
import { formatDate, formatINR } from "@/lib/format";
import {
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/lib/tones";
import type { OrderDetail } from "@/lib/types";
import { Badge } from "./ui";

export function OrderCard({ order }: { order: OrderDetail }) {
  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900">{order.order_id}</p>
          <Link
            href={`/shops/${order.shop_id}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            {order.shop_name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={orderStatusTone[order.order_status]}>
            {orderStatusLabel[order.order_status]}
          </Badge>
          <Badge tone={paymentStatusTone[order.payment_status]}>
            {paymentStatusLabel[order.payment_status]}
          </Badge>
          <span className="text-sm font-semibold text-zinc-900">
            {formatINR(order.total_amount)}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {formatDate(order.order_date)}
        {order.delivery_slot ? ` · ${order.delivery_slot}` : ""}
        {order.delivery_date ? ` · due ${formatDate(order.delivery_date)}` : ""}
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {order.items.map((item) => (
          <li
            key={item.order_item_id}
            className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm"
          >
            <span className="truncate text-zinc-700">{item.product_name}</span>
            <span className="shrink-0 text-xs text-zinc-500">
              {item.quantity} × {formatINR(item.price)} ={" "}
              {formatINR(item.line_total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
