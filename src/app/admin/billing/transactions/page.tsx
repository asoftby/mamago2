import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingTransactions } from "@/server/services/billing/billingTransaction.service";
import { TransactionStatusBadge } from "@/components/admin/billing/TransactionStatusBadge";
import { TransactionTypeBadge } from "@/components/admin/billing/TransactionTypeBadge";
import { TransactionAmount } from "@/components/admin/billing/TransactionAmount";
import { BillingTransactionType, BillingTransactionStatus } from "@prisma/client";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    business?: string;
  }>;
}

export default async function AdminBillingTransactionsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  
  const filters = {
    type: params.type as BillingTransactionType | undefined,
    status: params.status as BillingTransactionStatus | undefined,
    businessId: params.business,
    limit: 100,
  };

  const { transactions, total } = await getBillingTransactions(filters);

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-sm text-gray-600 mt-1">Все списания, пополнения, продления и корректировки</p>
        </div>
      </div>

      {/* AdminPageToolbar - Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select 
              className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm"
              defaultValue={params.type || ""}
            >
              <option value="">Все типы</option>
              <option value="SUBSCRIPTION_CHARGE">Подписка</option>
              <option value="SUBSCRIPTION_RENEWAL">Продление</option>
              <option value="DEPOSIT_TOPUP">Пополнение</option>
              <option value="LEAD_CHARGE">Лид</option>
              <option value="PROMOTION_CHARGE">Продвижение</option>
              <option value="REFUND">Возврат</option>
              <option value="MANUAL_ADJUSTMENT">Корректировка</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select 
              className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm"
              defaultValue={params.status || ""}
            >
              <option value="">Все статусы</option>
              <option value="SUCCEEDED">Успешно</option>
              <option value="FAILED">Ошибка</option>
              <option value="PENDING">В обработке</option>
              <option value="CANCELED">Отменено</option>
            </select>
          </div>

          <div className="flex items-end">
            <p className="text-sm text-gray-600">
              Найдено: <span className="font-medium">{total}</span> транзакций
            </p>
          </div>
        </div>
      </div>

      {/* AdminPageContent - Transactions Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Описание</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Сумма</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">
                    {new Date(tx.occurredAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    <br />
                    <span className="text-xs text-gray-500">
                      {new Date(tx.occurredAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/businesses/${tx.billingAccount.businessId}/billing`}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {tx.billingAccount.business.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <TransactionTypeBadge type={tx.type} />
                  </td>
                  <td className="py-3 px-4 text-gray-700 max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <TransactionAmount amount={tx.amount.toNumber()} currency={tx.currency} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-blue-600 hover:text-blue-700">
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            Транзакции не найдены
          </div>
        )}
      </div>
    </div>
  );
}
