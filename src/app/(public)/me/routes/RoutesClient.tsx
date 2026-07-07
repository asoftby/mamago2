"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { RoutesHeader } from "./components/RoutesHeader";
import { RoutesTabs, type RoutesFilter } from "./components/RoutesTabs";
import { RoutesGrid } from "./components/RoutesGrid";
import { RoutesEmptyState } from "./components/RoutesEmptyState";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type UserRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: string;
  budgetLabel: string;
  status: string;
  stopsCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type RoutesClientProps = {
  initialRoutes: UserRoute[];
};

const TABS: { value: RoutesFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "DRAFT", label: "Черновики" },
  { value: "PUBLISHED", label: "Опубликованные" },
];

export function RoutesClient({ initialRoutes }: RoutesClientProps) {
  const router = useRouter();
  const [routes, setRoutes] = useState<UserRoute[]>(initialRoutes);
  const [filter, setFilter] = useState<RoutesFilter>("ALL");
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRoute | null>(null);

  const counts = useMemo(
    () => ({
      ALL: routes.length,
      DRAFT: routes.filter((r) => r.status === "DRAFT").length,
      PUBLISHED: routes.filter((r) => r.status === "PUBLISHED").length,
    }),
    [routes],
  );

  const filtered = useMemo(
    () =>
      routes.filter((r) => {
        if (filter === "DRAFT") return r.status === "DRAFT";
        if (filter === "PUBLISHED") return r.status === "PUBLISHED";
        return true;
      }),
    [filter, routes],
  );

  const tabItems = useMemo(
    () => TABS.map((tab) => ({ ...tab, count: counts[tab.value] })),
    [counts],
  );

  async function handleDelete(route: UserRoute) {
    const previousRoutes = routes;
    setDeletingRouteId(route.id);
    setRoutes((prev) => prev.filter((r) => r.id !== route.id));

    try {
      const res = await fetch(`/api/routes/${route.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? body.code ?? "delete_failed");
      }
      toast.success("Маршрут удалён");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setRoutes(previousRoutes);
      toast.error("Не удалось удалить маршрут", {
        description: error instanceof Error ? error.message : "Попробуйте ещё раз",
      });
    } finally {
      setDeletingRouteId(null);
    }
  }

  const emptyVariant =
    routes.length === 0 ? "INITIAL" : filter === "DRAFT" ? "DRAFT" : "PUBLISHED";

  return (
    <div className="space-y-6 sm:space-y-8">
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRouteId !== null}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingRouteId !== null}
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              {deletingRouteId ? "Удаление..." : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RoutesHeader totalCount={routes.length} />

      {routes.length > 0 ? (
        <RoutesTabs value={filter} items={tabItems} onChange={setFilter} />
      ) : null}

      {filtered.length > 0 ? (
        <RoutesGrid
          routes={filtered}
          deletingRouteId={deletingRouteId}
          onDelete={setDeleteTarget}
        />
      ) : (
        <RoutesEmptyState variant={emptyVariant} />
      )}
    </div>
  );
}
