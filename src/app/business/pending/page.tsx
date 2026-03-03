import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

export default async function PendingPage() {
  // Auth guard
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login?from=business");
  }

  // Check business exists
  const business = await getMyBusiness(user.id);
  
  if (!business) {
    redirect("/business/onboarding");
  }

  // Get effective verification status
  const verificationStatus = getEffectiveVerificationStatus(business);

  // If approved, redirect to dashboard
  if (verificationStatus === "APPROVED") {
    redirect("/business/dashboard");
  }

  const isPending = verificationStatus === "PENDING";
  const isRejected = verificationStatus === "REJECTED";
  const isDraft = verificationStatus === "DRAFT";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-8">
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

        {isDraft && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Завершите профиль
              </h1>
              <p className="text-gray-600">
                Заполните все обязательные поля и отправьте заявку на проверку
              </p>
            </div>

            <Link href="/business/onboarding">
              <PrimaryButton className="w-full">
                Перейти к заполнению профиля
              </PrimaryButton>
            </Link>
          </>
        )}

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

            <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-red-900 mb-3">
                Что делать?
              </h2>
              <p className="text-sm text-red-800 mb-4">
                Пожалуйста, проверьте предоставленные данные и отправьте заявку повторно.
                Убедитесь, что все поля заполнены корректно.
              </p>
            </div>

            <Link href="/business/onboarding">
              <PrimaryButton className="w-full">
                Исправить данные и отправить снова
              </PrimaryButton>
            </Link>
          </>
        )}

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
            {business.phone && (
              <div>
                <span className="text-sm font-medium text-gray-700">Телефон:</span>{" "}
                <span className="text-sm text-gray-900">{business.phone}</span>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-gray-700">Статус:</span>{" "}
              <span className={`text-sm font-medium ${
                isPending ? "text-yellow-600" : isRejected ? "text-red-600" : "text-blue-600"
              }`}>
                {isPending ? "На проверке" : isRejected ? "Отклонено" : "Черновик"}
              </span>
            </div>
          </div>
        </div>

        {isPending && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Нужна помощь?{" "}
              <a href="mailto:support@mamago.by" className="text-primary hover:underline font-medium">
                Свяжитесь с поддержкой
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
