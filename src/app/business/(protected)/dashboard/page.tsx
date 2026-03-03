import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import Link from "next/link";
import { VerificationBanner } from "@/components/business/VerificationBanner";
import { RequireVerifiedBusiness } from "@/components/business/RequireVerifiedBusiness";

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

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      <VerificationBanner
        status={business.verificationStatus}
        reviewNote={business.reviewNote}
      />

      {/* Dashboard Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Панель управления бизнесом
        </h1>
        <p className="text-gray-600">
          Управляйте вашим бизнесом отсюда.
        </p>
      </div>

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
      <RequireVerifiedBusiness status={business.verificationStatus}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/business/places"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Места</h3>
            <p className="text-gray-600 text-sm mb-4">
              Управление локациями бизнеса
            </p>
            <span className="text-primary hover:text-primary/80 text-sm font-medium">
              Перейти к местам →
            </span>
          </Link>

          <Link
            href="/business/offers"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Предложения</h3>
            <p className="text-gray-600 text-sm mb-4">
              Создание и управление предложениями
            </p>
            <span className="text-primary hover:text-primary/80 text-sm font-medium">
              Перейти к предложениям →
            </span>
          </Link>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Аналитика</h3>
            <p className="text-gray-600 text-sm mb-4">
              Отслеживание эффективности
            </p>
            <span className="text-gray-400 text-sm font-medium">Скоро</span>
          </div>
        </div>
      </RequireVerifiedBusiness>
    </div>
  );
}
