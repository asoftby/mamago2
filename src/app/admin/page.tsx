import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { getOperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationsSyntheticSignal, OperationsView } from "@/server/ops/read/getOperationsView";
import type { OperationalSignal } from "@prisma/client";
import { deriveDataQuality, deriveWorkload } from "@/lib/admin/dashboardViewModels";
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

  // A real provider refusal must be visible to the founder on the main admin
  // dashboard, not only in Docker logs. Read only the current admin's alert.
  let smsFailureAt: Date | null = null;
  if (user.role === "ADMIN") {
    try {
      const smsFailure = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: "SYSTEM",
          audience: "ADMIN",
          title: "Сбой отправки SMS",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      smsFailureAt = smsFailure?.createdAt ?? null;
    } catch {
      console.error("[admin] Unable to read SMS delivery incident");
    }
  }

  const now = new Date();
  const signals = view.signals.map((signal) => toDashboardSignal(signal, view));
  const organic = deriveOrganicRecovery(view.kpis);
  const growth = deriveGrowthOverview(view.kpis);
  const workload = deriveWorkload(view.queues, view.kpis);
  const dataQuality = deriveDataQuality(view.stale, view.kpis);

  return (
    <>
      {smsFailureAt && (
        <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 sm:mx-6">
          <strong>За последние 24 часа зафиксирован сбой отправки SMS.</strong>
          {" "}Последний случай: {smsFailureAt.toLocaleString("ru-RU")}.
          {" "}<Link className="font-medium underline" href="/admin/system/notifications">
            Открыть диагностику
          </Link>
        </div>
      )}
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
      dataQuality={dataQuality}
      />
    </>
  );
}
