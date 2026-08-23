"use client";

import { ShopsList } from "./components/ShopsList";

export function ShopsClient({ shops, routes }: { shops: any; routes: any }) {
  return <ShopsList shops={shops} routes={routes} />;
}