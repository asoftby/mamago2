"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NodeKey, NodeState } from "@/server/ops/types";
import { formatFreshness } from "../_lib/operationsSignalPresentation";
import { OperationsBlock, type DashboardSignal } from "./OperationsBlock";
import { OperationalLoadBlock } from "./blocks/OperationalLoadBlock";
import { OrganicRecoveryBlock } from "./growth/OrganicRecoveryBlock";
import { GrowthKpiTiles } from "./growth/GrowthKpiTiles";
import { ValuePathBlock } from "./growth/ValuePathBlock";
import { SupplyPartnersBlock } from "./growth/SupplyPartnersBlock";
import type { WorkloadViewModel } from "@/lib/admin/dashboardViewModels";
import type { GrowthOverviewViewModel, OrganicRecoveryViewModel } from "@/lib/admin/growthDashboardViewModel";

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
  organic: OrganicRecoveryViewModel;
  growth: GrowthOverviewViewModel;
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
  organic,
  growth,
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
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Панель управления</h1>
          <p className="text-sm text-gray-600 mt-1">Работает ли система и растёт ли продукт</p>
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

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700">Рост</h2>
        <OrganicRecoveryBlock model={organic} />
        <GrowthKpiTiles model={growth} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ValuePathBlock model={growth} />
          <SupplyPartnersBlock model={growth} />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Операционная работа</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OperationalLoadBlock model={workload} />
        </div>
      </div>
    </div>
  );
}
