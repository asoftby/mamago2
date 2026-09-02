import { getCurrentUser } from "@/lib/auth/server";
import { getOperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationsSyntheticSignal, OperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationalSignal } from "@prisma/client";
import {
  deriveProductPulse,
  deriveNorthStar,
  deriveHabit,
  deriveEngagementFunnel,
  deriveGrowth,
  deriveDiscoveryQuality,
  deriveSupplyHealth,
  deriveB2BHealth,
  deriveWorkload,
  deriveDataQuality,
} from "@/lib/admin/dashboardViewModels";
import { deriveGscSeo } from "@/lib/admin/gscSeoViewModel";
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
    // layout.tsx already redirects unauthenticated/unauthorized users before
    // this Server Component can render — defensive only, never reachable.
    return <OperationsLoadErrorState />;
  }

  let view: OperationsView;
  try {
    // Exactly ONE authoritative getOperationsView() call per page load — it
    // updates lastViewedAt as a side effect, so calling it twice here (or
    // again via a client-side fetch on mount) would destroy correct NEW
    // signal semantics for this render. Product Pulse/Engagement/Search/
    // Operational Load below are derived purely from this SAME call's
    // kpis/queues — no second Operations read.
    view = await getOperationsView(user.id);
  } catch (err) {
    console.error("[admin] Failed to load Operations Center view:", err);
    return <OperationsLoadErrorState />;
  }

  const now = new Date();

  const signals = view.signals.map((signal) => toDashboardSignal(signal, view));
  const product = deriveProductPulse(view.kpis);
  const northStar = deriveNorthStar(view.kpis);
  const habit = deriveHabit(view.kpis);
  const funnel = deriveEngagementFunnel(view.kpis);
  const growth = deriveGrowth(view.kpis);
  const seo = deriveGscSeo(view.kpis);
  const search = deriveDiscoveryQuality(view.kpis);
  const supply = deriveSupplyHealth(view.kpis);
  const b2b = deriveB2BHealth(view.kpis);
  const workload = deriveWorkload(view.queues, view.kpis);
  const dataQuality = deriveDataQuality(view.stale);

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
      product={product}
      northStar={northStar}
      habit={habit}
      funnel={funnel}
      growth={growth}
      seo={seo}
      search={search}
      supply={supply}
      b2b={b2b}
      workload={workload}
      dataQuality={dataQuality}
    />
  );
}
