import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { getOperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationsSyntheticSignal, OperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationalSignal } from "@prisma/client";
import { getTrafficViewModel, EMPTY_TRAFFIC_VIEW_MODEL } from "@/server/admin/getTrafficViewModel";
import {
  deriveProductPulse,
  deriveEngagement,
  deriveSearchDiscovery,
  deriveWorkload,
} from "@/lib/admin/dashboardViewModels";
import { AdminDashboardShell } from "./_components/AdminDashboardShell";
import type { DashboardSignal } from "./_components/OperationsBlock";
import { OperationsLoadErrorState } from "./_components/OperationsLoadErrorState";

function toDashboardSignal(signal: OperationalSignal, view: OperationsView): DashboardSignal {
  const release = view.signalReleases[signal.id] ?? null;
  return {
    id: signal.id,
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

  // Traffic is a genuinely separate data source (live UserEvent query, not
  // part of the Operations snapshot) — a failure here must not take down
  // Operations or the rest of the page, so it fails independently into an
  // honest "no data" state rather than propagating.
  let traffic = EMPTY_TRAFFIC_VIEW_MODEL;
  try {
    traffic = await getTrafficViewModel(prisma, now);
  } catch (err) {
    console.error("[admin] Failed to load Traffic view model:", err);
  }

  const signals = view.signals.map((signal) => toDashboardSignal(signal, view));
  const product = deriveProductPulse(view.kpis);
  const engagement = deriveEngagement(view.kpis);
  const search = deriveSearchDiscovery(view.kpis);
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
      traffic={traffic}
      product={product}
      engagement={engagement}
      search={search}
      workload={workload}
    />
  );
}
