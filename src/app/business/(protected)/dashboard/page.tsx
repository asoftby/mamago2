import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import Link from "next/link";
import { VerificationBanner } from "@/components/business/VerificationBanner";
import { RequireVerifiedBusiness } from "@/components/business/RequireVerifiedBusiness";
import { ImprovementRequestsWidget } from "@/components/business/dashboard/ImprovementRequestsWidget";
import { BillingPlanWidget } from "@/components/business/billing/BillingPlanWidget";
import { BillingDepositWidget } from "@/components/business/billing/BillingDepositWidget";
import prisma from "@/lib/prisma";

export default async function BusinessDashboardPage() {
  // Auth guard
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/register?from=business");
  }

  // Check business exists
  const business = await getMyBusiness(user.id);
  
  if (!business) {
    redirect("/business/onboarding");
  }

  // Fetch counts for dashboard cards
  const userPlaces = await prisma.place.findMany({
    where: { ownerUserId: user.id, archivedAt: null },
    select: { id: true },
  });

  const activities = await prisma.activity.findMany({
    where: { ownerUserId: user.id },
    select: { id: true },
  });

  const offers = userPlaces.length > 0
    ? await prisma.offer.findMany({
        where: { placeId: { in: userPlaces.map(p => p.id) } },
        select: { id: true },
      })
    : [];

  const placesCount = userPlaces.length;
  const eventsCount = activities.length;
  const offersCount = offers.length;

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Verification Badge */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Панель управления бизнесом
            </h1>
            <p className="text-gray-600">
              Управляйте вашим бизнесом отсюда.
            </p>
          </div>
          
          {/* Compact Verification Badge */}
          <VerificationBanner
            status={business.verificationStatus as any}
            reviewNote={business.reviewNote}
            compact
          />
        </div>
      </div>

      {/* Billing Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BillingPlanWidget />
        <BillingDepositWidget />
      </div>

      {/* Improvement Requests Widget */}
      <RequireVerifiedBusiness status={business.verificationStatus as any}>
        <ImprovementRequestsWidget />
      </RequireVerifiedBusiness>

      {/* Business Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Ваш бизнес
        </h2>
        <div className="space-y-2">
          <div>
            <span className="text-sm font-medium text-gray-700">Название: </span>
            <span className="text-gray-900">{business.name}</span>
          </div>
          {business.legalName && (
            <div>
              <span className="text-sm font-medium text-gray-700">Юридическое название: </span>
              <span className="text-gray-900">{business.legalName}</span>
            </div>
          )}
          {business.unp && (
            <div>
              <span className="text-sm font-medium text-gray-700">УНП: </span>
              <span className="text-gray-900">{business.unp}</span>
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-gray-700">Создано: </span>
            <span className="text-gray-900">
              {new Date(business.createdAt).toLocaleDateString("ru-RU")}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions - Gated by verification status */}
      <RequireVerifiedBusiness status={business.verificationStatus as any}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/business/places"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Места{placesCount > 0 && ` (${placesCount})`}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Управление локациями бизнеса
            </p>
            <span className="text-primary hover:text-primary/80 text-sm font-medium">
              Перейти к местам →
            </span>
          </Link>

          <Link
            href="/business/events"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              События{eventsCount > 0 && ` (${eventsCount})`}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Создание и управление событиями
            </p>
            <span className="text-primary hover:text-primary/80 text-sm font-medium">
              Перейти к событиям →
            </span>
          </Link>

          <Link
            href="/business/offers"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Предложения{offersCount > 0 && ` (${offersCount})`}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Создание и управление предложениями
            </p>
            <span className="text-primary hover:text-primary/80 text-sm font-medium">
              Перейти к предложениям →
            </span>
          </Link>
        </div>
      </RequireVerifiedBusiness>
    </div>
  );
}
