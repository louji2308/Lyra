import type { Metadata } from "next";
import { getShops } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";

export const metadata: Metadata = { title: "Blacklist" };

export const dynamic = "force-dynamic";

export default async function ShopBlacklistPage() {
  const shops = await getShops();

  const allBlacklist = shops.flatMap(s =>
    s.blacklist?.map((b: any) => ({ ...b, shop_name: s.shop_name, shop_id: s.shop_id })) ?? []
  );

  if (allBlacklist.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Blacklist"
          subtitle="Products that shops have opted out of"
          right={<a href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</a>}
        />
        <Card className="p-8 text-center">
          <EmptyState title="No blacklisted items" body="Shops haven't opted out of any products yet." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blacklist"
        subtitle={`${allBlacklist.length} blacklisted items across ${shops.filter(s => s.blacklist?.length).length} shops`}
        right={<a href="/shops" className="text-sm text-emerald-600 hover:underline">← Back to Shops</a>}
      />

      <Card>
        <CardHeader title="All Blacklisted Items" />
        <DataTable
          columns={[
            { key: "shop_name", header: "Shop", className: "w-48",
              render: (b) => (
                <div>
                  <a href={"/shops/" + b.shop_id} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                    {b.shop_name}
                  </a>
                  <p className="mt-0.5 text-xs text-zinc-500">{b.shop_id}</p>
                </div>
              )
            },
            { key: "product_id", header: "Product", className: "w-48",
              render: (b) => <span className="font-medium text-zinc-900">{b.product_id}</span>
            },
            { key: "reason", header: "Reason", className: "w-80",
              render: (b) => <span className="text-zinc-600 max-w-xs truncate block" title={b.reason}>{b.reason ?? "—"}</span>
            },
            { key: "created_at", header: "Date", className: "w-36",
              render: (b) => <span className="text-zinc-500">{new Date(b.created_at).toLocaleDateString()}</span>
            },
          ]}
          data={allBlacklist}
          keyExtractor={(b) => `${b.shop_id}-${b.product_id}-${b.blacklist_id}`}
        />
      </Card>
    </div>
  );
}