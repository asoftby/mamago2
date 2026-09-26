import { getCurrentUser } from "@/lib/auth/server";
import { getOperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationsSyntheticSignal, OperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationalSignal } from "@prisma/client";
import { deriveWorkload } from "@/lib/admin/dashboardViewModels";
import { deriveGrowthOverview, deriveOrganicRecovery } from "@/lib/admin/growthDashboardViewModel";
import { AdminDashboardShell } from "./_components/AdminDashboardShell";
import type { DashboardSignal } from "./_components/OperationsBlock";
import { OperationsLoadErrorState } from "./_components/OperationsLoadErrorState";
import { isProductionAppEnv } from "@/lib/config/productionEnvGuard";

function toDashboardSignal(signal: OperationalSignal, view: OperationsView): DashboardSignal {
  const release = view.signalReleases[signal.id] ?? null;
  return {
    id: signal.id,
    type: signal.type,
    severity: signal.severity,
    title: signal.title,
    summary: signal.summary,
    detailsUrl: signal.detailsUrl,
    openedAt: signal.openedAt,
    attentionChangedAt: signal.attentionChangedAt,
    acknowledgedAt: signal.acknowledgedAt,
    release: release ? { buildId: release.buildId, detectedAt: release.detectedAt } : null,
  };
}

function staleSyntheticTitle(synthetic: OperationsSyntheticSignal[]): string | null {
  const stale = synthetic.find((s) => s.type === "OPERATIONS_DATA_STALE");
  return stale ? "Данные Operations Center устарели" : null;
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <OperationsLoadErrorState />;
  }

  let view: OperationsView;
  try {
    // Exactly one authoritative Operations read per page load. All product
    // and SEO blocks below are derived from this same materialized snapshot.
    view = await getOperationsView(user.id);
  } catch (err) {
    console.error("[admin] Failed to load Operations Center view:", err);
    return <OperationsLoadErrorState />;
  }

  const now = new Date();
  const signals = view.signals.map((signal) => toDashboardSignal(signal, view));
  const organic = deriveOrganicRecovery(view.kpis);
  const growth = deriveGrowthOverview(view.kpis);
  const workload = deriveWorkload(view.queues, view.kpis);

  return (
    <AdminDashboardShell
      stale={view.stale}
      generatedAt={view.generatedAt}
      nodes={view.nodes}
      staleSyntheticTitle={staleSyntheticTitle(view.syntheticSignals)}
      signals={signals}
      previousLastViewedAt={view.lastViewedAt}
      canResolve={user.role === "ADMIN"}
      serverNow={now}
      isDev={!isProductionAppEnv()}
      organic={organic}
      growth={growth}
      workload={workload}
    />
  );
}
