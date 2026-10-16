import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  buildBusinessOnboardingSnapshot,
  businessPublicPath,
  type BusinessOnboardingPublication,
} from "@/lib/business/onboardingProgress";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { VerificationBanner } from "@/components/business/VerificationBanner";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import {
  getBusinessWorkspaceData,
  type DashboardPeriod,
} from "@/server/services/business/businessWorkspace.service";
import { DashboardClient } from "@/components/business/dashboard/DashboardClient";
import type { DashboardData } from "@/components/business/dashboard/DashboardClient";
import { getDailyFreeBoostDashboardData } from "@/server/services/promotion/dailyFreeBoost.service";

type BusinessVerificationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

const DASHBOARD_PERIODS = new Set(["today", "yesterday", "week", "month", "quarter"]);

function parseDateRange(from?: string, to?: string) {
  if (!from || !to) return undefined;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return undefined;
  return { start, end };
}

export default async function BusinessDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();
  const query = (await searchParams) ?? {};
  const selectedPeriod = DASHBOARD_PERIODS.has(query.period ?? "")
    ? (query.period as DashboardPeriod)
    : "week";
  const customDateRange = query.period === "custom"
    ? parseDateRange(query.from, query.to)
    : undefined;

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
    period: selectedPeriod,
    dateRange: customDateRange,
  });
  const dailyFreeBoost = await getDailyFreeBoostDashboardData({
    userId: user.id,
    businessId: business.id,
  });

  const onboardingStored = await prisma.businessOnboardingState.findUnique({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    select: {
      startedAt: true,
      tourCompletedAt: true,
      tourSkippedAt: true,
      firstPublicViewedAt: true,
    },
  });
  const publications: BusinessOnboardingPublication[] = [
    ...workspace.places.map((item) => ({ ...item, kind: "place" as const })),
    ...workspace.events.map((item) => ({ ...item, kind: "event" as const })),
    ...workspace.offers.map((item) => ({ ...item, kind: "offer" as const })),
  ];
  const onboarding = buildBusinessOnboardingSnapshot(
    publications,
    onboardingStored
      ? {
          startedAt: onboardingStored.startedAt?.toISOString() ?? null,
          tourCompletedAt: onboardingStored.tourCompletedAt?.toISOString() ?? null,
          tourSkippedAt: onboardingStored.tourSkippedAt?.toISOString() ?? null,
          firstPublicViewedAt: onboardingStored.firstPublicViewedAt?.toISOString() ?? null,
        }
      : null,
  );
  const firstPublicPath = onboarding.published
    ? businessPublicPath(onboarding.published)
    : null;
  const onboardingPublicHref = firstPublicPath
    ? buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: firstPublicPath,
        ...routing,
      })
    : null;

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
    onboarding,
    onboardingPublicHref,
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
    dailyFreeBoost: {
      availableToday: dailyFreeBoost.availableToday,
      candidates: dailyFreeBoost.candidates,
      boost: dailyFreeBoost.boost
        ? {
            ...dailyFreeBoost.boost,
            startAt: dailyFreeBoost.boost.startAt.toISOString(),
            endAt: dailyFreeBoost.boost.endAt.toISOString(),
          }
        : null,
    },
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
      publications: href("/publications"),
      promotion: href("/promotion"),
      bookings: href("/notifications"),
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
      <DashboardClient data={dashboardData} defaultPeriod={selectedPeriod} />
    </div>
  );
}
