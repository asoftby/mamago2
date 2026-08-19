"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NodeKey, NodeState } from "@/server/ops/types";
import { formatFreshness } from "../_lib/operationsSignalPresentation";
import { OperationsBlock, type DashboardSignal } from "./OperationsBlock";
import { TrafficBlock } from "./blocks/TrafficBlock";
import { ProductPulseBlock } from "./blocks/ProductPulseBlock";
import { EngagementBlock } from "./blocks/EngagementBlock";
import { SearchDiscoveryBlock } from "./blocks/SearchDiscoveryBlock";
import { OperationalLoadBlock } from "./blocks/OperationalLoadBlock";
import type { TrafficViewModel } from "@/server/admin/getTrafficViewModel";
import type {
  ProductPulseViewModel,
  EngagementViewModel,
  SearchDiscoveryViewModel,
  WorkloadViewModel,
} from "@/lib/admin/dashboardViewModels";

const AUTO_REFRESH_MS = 60_000;

export interface AdminDashboardShellProps {
  // Operations (unchanged semantics — see OperationsBlock).
  stale: boolean;
  generatedAt: Date | null;
  nodes: { key: NodeKey; state: NodeState }[];
  staleSyntheticTitle: string | null;
  signals: DashboardSignal[];
  previousLastViewedAt: Date | null;
  canResolve: boolean;
  serverNow: Date;
  /** Server-computed via isProductionAppEnv() — never inferred client-side. */
  isDev: boolean;
  // Product blocks — pre-derived view-models, sourced from the SAME
  // single getOperationsView() call (kpis/queues) plus one small bounded
  // Traffic query. Never re-fetched client-side; a refresh re-runs the
  // whole Server Component tree via router.refresh().
  traffic: TrafficViewModel;
  product: ProductPulseViewModel;
  engagement: EngagementViewModel;
  search: SearchDiscoveryViewModel;
  workload: WorkloadViewModel;
}

export function AdminDashboardShell({
  stale,
  generatedAt,
  nodes,
  staleSyntheticTitle,
  signals,
  previousLastViewedAt,
  canResolve,
  serverNow,
  isDev,
  traffic,
  product,
  engagement,
  search,
  workload,
}: AdminDashboardShellProps) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      router.refresh();
    }, AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  function handleManualRefresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Панель управления</h1>
          <p className="text-sm text-gray-600 mt-1">Состояние продукта сегодня</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {generatedAt ? formatFreshness(generatedAt, now) : "Нет данных о снимке"}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleManualRefresh}
            aria-label="Обновить"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Block 1 — Operations: full width, visually dominant */}
      <OperationsBlock
        stale={stale}
        nodes={nodes}
        staleSyntheticTitle={staleSyntheticTitle}
        signals={signals}
        previousLastViewedAt={previousLastViewedAt}
        canResolve={canResolve}
        now={now}
        isDev={isDev}
      />

      {/* Blocks 2-6 — the quieter modular product grid */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Сводка продукта</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrafficBlock model={traffic} />
          <ProductPulseBlock model={product} />
          <EngagementBlock model={engagement} />
          <SearchDiscoveryBlock model={search} />
          <OperationalLoadBlock model={workload} />
        </div>
      </div>
    </div>
  );
}
