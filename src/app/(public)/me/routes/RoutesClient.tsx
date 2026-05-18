"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { RoutesHeader } from "./components/RoutesHeader";
import { RoutesTabs, type RoutesFilter } from "./components/RoutesTabs";
import { RoutesGrid } from "./components/RoutesGrid";
import { RoutesEmptyState } from "./components/RoutesEmptyState";

export type UserRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: string;
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
    if (!confirm(`Удалить маршрут «${route.title}»?`)) return;

    const previousRoutes = routes;
    setDeletingRouteId(route.id);
    setRoutes((prev) => prev.filter((r) => r.id !== route.id));

    try {
      const res = await fetch(`/api/routes/${route.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "delete_failed");
      }
      toast.success("Маршрут удалён");
      router.refresh();
    } catch {
      setRoutes(previousRoutes);
      toast.error("Не удалось удалить маршрут", { description: "Попробуйте ещё раз" });
    } finally {
      setDeletingRouteId(null);
    }
  }

  const emptyVariant =
    routes.length === 0 ? "INITIAL" : filter === "DRAFT" ? "DRAFT" : "PUBLISHED";

  return (
    <div className="space-y-6 sm:space-y-8">
      <RoutesHeader totalCount={routes.length} />

      {routes.length > 0 ? (
        <RoutesTabs value={filter} items={tabItems} onChange={setFilter} />
      ) : null}

      {filtered.length > 0 ? (
        <RoutesGrid
          routes={filtered}
          deletingRouteId={deletingRouteId}
          onDelete={handleDelete}
        />
      ) : (
        <RoutesEmptyState variant={emptyVariant} />
      )}
    </div>
  );
}
