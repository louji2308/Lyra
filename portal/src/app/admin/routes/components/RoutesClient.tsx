"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FormField, SelectField, NumberInput, TextareaField } from "@/components/ui/FormFields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createRoute, updateRoute, deactivateRoute } from "@/lib/actions";
import type { Route, ShopWithExtras } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";

interface RoutesClientProps {
  routes: Route[];
  shops: ShopWithExtras[];
}

export function RoutesClient({ routes: initialRoutes, shops }: RoutesClientProps) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeForm, setRouteForm] = useState({
    route_id: "",
    route_name: "",
    salesperson: "",
    coverage_area: "",
    is_active: true,
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAddRoute = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoadingAction("create-route");
    const formData = new FormData(e.currentTarget);
    const result = await createRoute({
      route_id: formData.get("route_id") as string,
      route_name: formData.get("route_name") as string,
      salesperson: formData.get("salesperson") as string || undefined,
      coverage_area: formData.get("coverage_area") as string || undefined,
    });
    setLoadingAction(null);
    if (result.success) {
      setRoutes([result.data, ...routes]);
      setIsAddOpen(false);
      setRouteForm({ route_id: "", route_name: "", salesperson: "", coverage_area: "", is_active: true });
      (e.target as HTMLFormElement).reset();
    } else {
      alert(result.error);
    }
  };

  const handleEditRoute = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRoute) return;
    setLoadingAction(`edit-${editingRoute.route_id}`);
    const formData = new FormData(e.currentTarget);
    const result = await updateRoute(editingRoute.route_id, {
      route_name: formData.get("route_name") as string,
      salesperson: formData.get("salesperson") as string || undefined,
      coverage_area: formData.get("coverage_area") as string || undefined,
      is_active: formData.get("is_active") === "on",
    });
    setLoadingAction(null);
    if (result.success) {
      setRoutes(routes.map(r => r.route_id === editingRoute.route_id ? result.data : r));
      setEditingRoute(null);
    } else {
      alert(result.error);
    }
  };

  const handleDeactivateRoute = async (routeId: string) => {
    if (!confirm("Are you sure you want to deactivate this route?")) return;
    setLoadingAction(`deactivate-${routeId}`);
    const result = await deactivateRoute(routeId);
    setLoadingAction(null);
    if (result.success) {
      setRoutes(routes.filter(r => r.route_id !== routeId));
    } else {
      alert(result.error);
    }
  };

  const startEdit = (route: Route) => {
    setEditingRoute(route);
    setRouteForm({
      route_id: route.route_id,
      route_name: route.route_name,
      salesperson: route.salesperson ?? "",
      coverage_area: route.coverage_area ?? "",
      is_active: route.is_active,
    });
  };

  const shopsForRoute = (routeId: string) => shops.filter(s => s.beat_route_id === routeId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes & Sales Beats"
        subtitle={`${routes.length} routes`}
        right={
          <Button onClick={() => setIsAddOpen(true)}>Create Route</Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Routes" value={routes.length} />
        <Stat label="Active" value={routes.filter(r => r.is_active).length} valueTone="text-emerald-600" />
        <Stat label="Inactive" value={routes.filter(r => !r.is_active).length} valueTone="text-zinc-500" />
        <Stat label="Total Shops" value={shops.length} />
      </div>

      <Card>
        <CardHeader title="All Routes" right={isAddOpen ? null : <Button onClick={() => setIsAddOpen(true)}>Create Route</Button>} />
        <DataTable
          columns={[
            { key: "route_id", header: "Route ID", className: "w-24 font-mono text-xs", render: (r) => r.route_id },
            { key: "route_name", header: "Route Name", className: "w-48", render: (r) => r.route_name },
            { key: "salesperson", header: "Salesperson", className: "w-32", render: (r) => r.salesperson ?? "—" },
            { key: "coverage_area", header: "Coverage Area", className: "w-40", render: (r) => r.coverage_area ?? "—" },
            { key: "shops", header: "Shops", className: "w-20 text-right", render: (r) => shopsForRoute(r.route_id).toString() },
            { key: "is_active", header: "Status", className: "w-20", render: (r) => <Badge tone={r.is_active ? "emerald" : "zinc"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
          ]}
          data={routes}
          keyExtractor={(r) => r.route_id}
          rowActions={(r) => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDeactivateRoute(r.route_id)} disabled={loadingAction === `deactivate-${r.route_id}`}>
                {r.is_active ? "Deactivate" : "Delete"}
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Add Route Modal */}
      <ConfirmDialog
        isOpen={isAddOpen}
        onClose={() => { setIsAddOpen(false); setRouteForm({ route_id: "", route_name: "", salesperson: "", coverage_area: "", is_active: true }); }}
        onConfirm={() => {}}
        title="Create New Route"
        confirmText="Create Route"
        cancelText="Cancel"
        variant="primary"
      >
        <form onSubmit={handleAddRoute} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Route ID" id="route_id" name="route_id" value={routeForm.route_id} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, route_id: e.target.value })} required placeholder="e.g., RT001" />
            <FormField label="Route Name" id="route_name" name="route_name" value={routeForm.route_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, route_name: e.target.value })} required />
            <FormField label="Salesperson" id="salesperson" name="salesperson" value={routeForm.salesperson} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, salesperson: e.target.value })} placeholder="Salesperson name" />
            <FormField label="Coverage Area" id="coverage_area" name="coverage_area" value={routeForm.coverage_area} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, coverage_area: e.target.value })} placeholder="Area covered" />
          </div>
        </form>
      </ConfirmDialog>

      {/* Edit Route Modal */}
      {editingRoute && (
        <ConfirmDialog
          isOpen={!!editingRoute}
          onClose={() => setEditingRoute(null)}
          onConfirm={() => {}}
          title={`Edit Route: ${editingRoute.route_name}`}
          confirmText="Save Changes"
          cancelText="Cancel"
          variant="primary"
        >
          <form onSubmit={handleEditRoute} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Route Name" id="edit_route_name" value={routeForm.route_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, route_name: e.target.value })} required />
              <FormField label="Salesperson" id="edit_salesperson" value={routeForm.salesperson} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, salesperson: e.target.value })} />
              <FormField label="Coverage Area" id="edit_coverage_area" value={routeForm.coverage_area} onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, coverage_area: e.target.value })} />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingRoute.is_active}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRouteForm({ ...routeForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-700">Active</span>
              </label>
            </div>
          </form>
        </ConfirmDialog>
      )}
    </div>
  );
}