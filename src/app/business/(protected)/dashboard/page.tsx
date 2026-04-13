import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { VerificationBanner } from "@/components/business/VerificationBanner";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { getBusinessWorkspaceData } from "@/server/services/business/businessWorkspace.service";
import { DashboardClient } from "@/components/business/dashboard/DashboardClient";
import type { DashboardData } from "@/components/business/dashboard/DashboardClient";

type BusinessVerificationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export default async function BusinessDashboardPage() {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const business = await getMyBusiness(user.id);

  if (!business) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
  }

  const workspace = await getBusinessWorkspaceData({
    userId: user.id,
    businessId: business.id,
    period: "week",
  });

  const verificationStatus = business.verificationStatus as BusinessVerificationStatus;

  // ── hrefs ──────────────────────────────────────────────────────────────────
  const href = (path: string) =>
    buildSurfaceRedirectDestination({ targetSurface: "business", targetPath: path, ...routing });

  // ── Next actions (dynamic) ─────────────────────────────────────────────────
  const nextActions: DashboardData["nextActions"] = [];

  const totalPublications = workspace.events.length + workspace.offers.length;

  if (totalPublications === 0) {
    nextActions.push({
      label: "Создайте первую публикацию — событие или предложение",
      href: href("/events"),
      cta: "Создать",
    });
  }

  if (workspace.periodLeadCount === 0 && totalPublications > 0) {
    nextActions.push({
      label: "Добавьте CTA или запустите продвижение, чтобы получать обращения",
      href: href("/promotion"),
      cta: "Продвижение",
    });
  }

  const balance = workspace.billingSummary?.account.depositBalance?.toNumber() ?? 0;
  const lowBalanceThreshold = workspace.billingSummary?.account.lowBalanceThreshold?.toNumber() ?? 20;

  if (balance < lowBalanceThreshold && balance >= 0) {
    nextActions.push({
      label: "Пополните баланс — при низком балансе продвижение приостанавливается",
      href: href("/billing/deposit"),
      cta: "Пополнить",
    });
  }

  if (workspace.activePromotionCount === 0 && totalPublications > 0) {
    nextActions.push({
      label: "Запустите продвижение, чтобы публикации начали приносить лиды",
      href: href("/promotion"),
      cta: "Запустить",
    });
  }

  if (nextActions.length === 0) {
    nextActions.push({
      label: "Сравните публикации ниже и направьте бюджет в те, что дают больше лидов",
      href: href("/promotion"),
      cta: "Управлять",
    });
  }

  // ── Dashboard data ─────────────────────────────────────────────────────────
  const dashboardData: DashboardData = {
    businessName: business.name,
    legalName: business.legalName ?? null,
    city: null, // TODO: add city to Business model or derive from places
    depositBalance: balance,
    periodSpend: workspace.periodSpend,
    lowBalanceThreshold,
    periodLeadCount: workspace.periodLeadCount,
    totalCtaClicks: workspace.totalCtaClicks,
    activePromotionCount: workspace.activePromotionCount,
    totalPublications,
    pausedPromotionCount: 0,
    inboxPreview: workspace.inboxPreview.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      seenAt: n.seenAt?.toISOString() ?? null,
    })),
    nextActions: nextActions.slice(0, 3),
    topPublications: workspace.topPublications,
    hrefs: {
      deposit: href("/billing/deposit"),
      leads: href("/promotion"),
      publications: href("/events"),
      promotion: href("/promotion"),
      inbox: href("/inbox"),
      newPublication: href("/events"),
      settings: href("/settings"),
    },
  };

  return (
    <div className="space-y-6">
      <VerificationBanner
        status={verificationStatus}
        reviewNote={business.reviewNote}
        compact
      />
      <DashboardClient data={dashboardData} defaultPeriod="week" />
    </div>
  );
}
