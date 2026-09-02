"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NodeKey, NodeState } from "@/server/ops/types";
import { formatFreshness } from "../_lib/operationsSignalPresentation";
import { OperationsBlock, type DashboardSignal } from "./OperationsBlock";
import { ProductPulseBlock } from "./blocks/ProductPulseBlock";
import { NorthStarBlock } from "./blocks/NorthStarBlock";
import { HabitBlock } from "./blocks/HabitBlock";
import { FunnelBlock } from "./blocks/FunnelBlock";
import { GrowthBlock } from "./blocks/GrowthBlock";
import { GscSeoBlock } from "./blocks/GscSeoBlock";
import { SearchDiscoveryBlock } from "./blocks/SearchDiscoveryBlock";
import { SupplyHealthBlock } from "./blocks/SupplyHealthBlock";
import { B2BHealthBlock } from "./blocks/B2BHealthBlock";
import { OperationalLoadBlock } from "./blocks/OperationalLoadBlock";
import { DataQualityBlock } from "./blocks/DataQualityBlock";
import type { GscSeoViewModel } from "@/lib/admin/gscSeoViewModel";
import type {
  ProductPulseViewModel,
  NorthStarViewModel,
  HabitViewModel,
  EngagementFunnelViewModel,
  GrowthViewModel,
  DiscoveryQualityViewModel,
  SupplyHealthViewModel,
  B2BHealthViewModel,
  WorkloadViewModel,
  DataQualityViewModel,
} from "@/lib/admin/dashboardViewModels";

const AUTO_REFRESH_MS = 60_000;

export interface AdminDashboardShellProps {
  stale: boolean;
  generatedAt: Date | null;
  nodes: { key: NodeKey; state: NodeState }[];
  staleSyntheticTitle: string | null;
  signals: DashboardSignal[];
  previousLastViewedAt: Date | null;
  canResolve: boolean;
  serverNow: Date;
  isDev: boolean;
  product: ProductPulseViewModel;
  northStar: NorthStarViewModel;
  habit: HabitViewModel;
  funnel: EngagementFunnelViewModel;
  growth: GrowthViewModel;
  seo: GscSeoViewModel;
  search: DiscoveryQualityViewModel;
  supply: SupplyHealthViewModel;
  b2b: B2BHealthViewModel;
  workload: WorkloadViewModel;
  dataQuality: DataQualityViewModel;
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
  product,
  northStar,
  habit,
  funnel,
  growth,
  seo,
  search,
  supply,
  b2b,
  workload,
  dataQuality,
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
    intervalRef.current = setInterval(() => router.refresh(), AUTO_REFRESH_MS);
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

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Company Pulse</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProductPulseBlock model={product} />
          <NorthStarBlock model={northStar} />
        </div>
      </div>

      <HabitBlock model={habit} />
      <FunnelBlock model={funnel} />
      <GrowthBlock model={growth} />
      <GscSeoBlock model={seo} />

      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchDiscoveryBlock model={search} />
          <SupplyHealthBlock model={supply} />
        </div>
      </div>

      <B2BHealthBlock model={b2b} />

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Operations & Data Quality</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <OperationalLoadBlock model={workload} />
          <DataQualityBlock model={dataQuality} />
        </div>
      </div>
    </div>
  );
}
