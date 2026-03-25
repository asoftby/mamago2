import Link from "next/link";
import { DEFAULT_CITY_HUB_PATH } from "@/lib/intent";

/**
 * Публичная страница про тарифы (доступна до одобрения бизнес-заявки;
 * защищённый /business/billing/plan редиректит на /business/verification).
 */
export default function BusinessPricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Тарифы для бизнеса</h1>
            <p className="text-gray-600 mt-2">
              После прохождения модерации вы сможете управлять подпиской и оплатой в
              личном кабинете mamaGo Business.
            </p>
          </div>
          <p className="text-sm text-gray-700">
            Условия подключения и продления тарифа уточняйте у поддержки — мы
            подберём формат под ваши площадки и публикации.
          </p>
          <Link
            href={DEFAULT_CITY_HUB_PATH}
            className="inline-flex text-primary font-semibold hover:underline"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
