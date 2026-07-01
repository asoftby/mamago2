import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { VerificationPendingNextSteps } from "@/components/business/verification/VerificationPendingNextSteps";
import { UnpVerificationNotice } from "@/components/business/verification/UnpVerificationNotice";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import prisma from "@/lib/prisma";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

/**
 * Business Verification Status Page - CANONICAL
 * Shows verification status for DRAFT, PENDING, and REJECTED businesses
 * APPROVED businesses are redirected to dashboard
 */
export default async function BusinessVerificationPage() {
  const routing = await getCurrentRequestRoutingContext();
  // Auth guard
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Check business exists
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

  // Get effective verification status
  const verificationStatus = getEffectiveVerificationStatus(business);

  // DRAFT → redirect to onboarding
  if (verificationStatus === "DRAFT") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
  }

  // If approved, redirect to dashboard
  if (verificationStatus === "APPROVED") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/dashboard",
        ...routing,
      }),
    );
  }

  // Fetch verification logs for history
  const verificationLogs = await prisma.businessVerificationLog.findMany({
    where: { businessId: business.id },
    include: {
      reviewedBy: {
        select: {
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const isPending = verificationStatus === "PENDING";
  const isNeedsInfo = verificationStatus === "NEEDS_INFO";
  const isRejected = verificationStatus === "REJECTED";

  // Get last moderator comment from logs or business.reviewNote
  const lastLog = verificationLogs[0];
  const moderatorComment = business.reviewNote || lastLog?.note;
  const lastReviewDate = business.reviewedAt || lastLog?.createdAt;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow p-8">
        {/* PENDING Status */}
        {isPending && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                На проверке
              </h1>
              <p className="text-gray-600">
                Ваша заявка отправлена на модерацию
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-yellow-900 mb-3">
                Что дальше?
              </h2>
              <ul className="space-y-2 text-sm text-yellow-800">
                <li className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Модератор проверит предоставленные данные
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Проверка обычно занимает 1-2 рабочих дня
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Вы получите уведомление о результатах на email
                </li>
              </ul>
            </div>
          </>
        )}

        {/* REJECTED Status */}
        {isRejected && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Заявка отклонена
              </h1>
              <p className="text-gray-600">
                К сожалению, ваша заявка не прошла проверку
              </p>
            </div>

            {/* Moderator Comment - REQUIRED for REJECTED */}
            {moderatorComment && (
              <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-red-900 mb-3">
                  Причина отклонения
                </h2>
                <p className="text-sm text-red-800 whitespace-pre-wrap">
                  {moderatorComment}
                </p>
                {lastReviewDate && (
                  <p className="text-xs text-red-600 mt-3">
                    {new Date(lastReviewDate).toLocaleString("ru-RU")}
                  </p>
                )}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-yellow-900 mb-3">
                Что делать?
              </h2>
              <p className="text-sm text-yellow-800 mb-4">
                Пожалуйста, проверьте предоставленные данные и отправьте заявку повторно.
                Убедитесь, что все поля заполнены корректно.
              </p>
            </div>

            <Link
              href={buildSurfaceRedirectDestination({
                targetSurface: "business",
                targetPath: "/onboarding",
                ...routing,
              })}
            >
              <PrimaryButton className="w-full">
                Исправить данные и отправить снова
              </PrimaryButton>
            </Link>
          </>
        )}

        {/* NEEDS_INFO Status */}
        {isNeedsInfo && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Требуется уточнение данных
              </h1>
              <p className="text-gray-600">
                Модератор запросил дополнительную информацию
              </p>
            </div>

            {/* Moderator Comment - REQUIRED for NEEDS_INFO */}
            {moderatorComment && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-yellow-900 mb-3">
                  Комментарий модератора
                </h2>
                <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                  {moderatorComment}
                </p>
                {lastReviewDate && (
                  <p className="text-xs text-yellow-600 mt-3">
                    {new Date(lastReviewDate).toLocaleString("ru-RU")}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">
                Что делать?
              </h2>
              <p className="text-sm text-blue-800 mb-4">
                Пожалуйста, внесите необходимые изменения в данные и отправьте заявку повторно.
                Обратите внимание на комментарий модератора выше.
              </p>
            </div>

            <Link
              href={buildSurfaceRedirectDestination({
                targetSurface: "business",
                targetPath: "/onboarding",
                ...routing,
              })}
            >
              <PrimaryButton className="w-full">
                Исправить данные
              </PrimaryButton>
            </Link>
          </>
        )}

        {/* Business Data Summary */}
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Данные вашей заявки
          </h3>
          <div className="bg-gray-50 rounded-md p-4 space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Название:</span>{" "}
              <span className="text-sm text-gray-900">{business.name}</span>
            </div>
            {business.legalName && (
              <div>
                <span className="text-sm font-medium text-gray-700">Юридическое название:</span>{" "}
                <span className="text-sm text-gray-900">{business.legalName}</span>
              </div>
            )}
            {business.unp && (
              <div>
                <span className="text-sm font-medium text-gray-700">УНП:</span>{" "}
                <span className="text-sm text-gray-900">{business.unp}</span>
              </div>
            )}
            {business.unp && <UnpVerificationNotice business={business} />}
            {business.phone && (
              <div>
                <span className="text-sm font-medium text-gray-700">Телефон:</span>{" "}
                <span className="text-sm text-gray-900">{business.phone}</span>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-gray-700">Статус:</span>{" "}
              <span className={`text-sm font-medium ${
                isPending ? "text-yellow-600" : 
                isNeedsInfo ? "text-yellow-600" : 
                "text-red-600"
              }`}>
                {isPending ? "На проверке" : 
                 isNeedsInfo ? "Требуется уточнение" : 
                 "Отклонено"}
              </span>
            </div>
          </div>
        </div>

        {isPending && <VerificationPendingNextSteps />}

        {/* Verification History (optional) */}
        {verificationLogs.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              История проверки
            </h3>
            <div className="space-y-3">
              {verificationLogs.map((log) => (
                <div key={log.id} className="bg-gray-50 rounded-md p-3 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">
                      {log.statusFrom} → {log.statusTo}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  {log.note && (
                    <p className="text-gray-700 mt-1">{log.note}</p>
                  )}
                  {log.reviewedBy && (
                    <p className="text-xs text-gray-500 mt-1">
                      Модератор: {log.reviewedBy.email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Support Link */}
        {isPending && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Нужна помощь?{" "}
              <a
                href="https://t.me/shapovalovalexey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Свяжитесь с поддержкой
              </a>
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
