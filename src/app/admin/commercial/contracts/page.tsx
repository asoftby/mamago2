import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getContracts } from "@/server/services/commercial/contracts.service";
import { ContractStatusBadge } from "@/components/admin/commercial/ContractStatusBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { FileText, CheckCircle } from "lucide-react";

export default async function AdminContractsPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let contracts = [];
  let error = null;

  try {
    contracts = await getContracts();
  } catch (e: any) {
    error = e.message;
    console.error("Contracts fetch error:", e);
  }

  if (error) {
    return (
      <div className="p-6 md:p-4 space-y-6">
        {/* AdminPageHeader */}
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Договоры</h1>
          <p className="text-sm text-gray-600 mt-1">Управление коммерческими договорами</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">Ошибка загрузки данных. Выполните: <code className="bg-red-100 px-2 py-1 rounded text-xs">npx prisma generate && npm run dev</code></p>
          <p className="text-xs text-red-700 mt-2">Error: {error}</p>
        </div>
      </div>
    );
  }

  const contractTypeLabels = {
    MASTER: "Основной",
    ADDENDUM: "Дополнение",
    OFFER: "Оферта",
    APPENDIX: "Приложение",
  };

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Договоры</h1>
          <p className="text-sm text-gray-600 mt-1">Управление коммерческими договорами</p>
        </div>
        <button className="h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Создать договор
        </button>
      </div>

      {/* AdminPageToolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <select className="h-10 w-full md:w-auto px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="EXPIRING">Истекающие</option>
          <option value="EXPIRED">Истекшие</option>
          <option value="DRAFT">Черновики</option>
          <option value="TERMINATED">Расторгнутые</option>
        </select>
        <select className="h-10 w-full md:w-auto px-3 border border-gray-300 rounded-lg text-sm">
          <option value="">Все типы</option>
          <option value="MASTER">Основной</option>
          <option value="ADDENDUM">Дополнение</option>
          <option value="OFFER">Оферта</option>
          <option value="APPENDIX">Приложение</option>
        </select>
        <button className="h-10 w-full md:w-auto px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Истекают в течение 30 дней
        </button>
        <button className="h-10 w-full md:w-auto px-4 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Истекают в течение 7 дней
        </button>
      </div>

      {/* AdminPageContent */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Номер договора</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Подписан</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Начало</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Окончание</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Автопродление</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contracts.map((contract) => {
                const daysUntilEnd = Math.ceil(
                  (contract.endsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpiringSoon = daysUntilEnd <= 30 && daysUntilEnd > 0;

                return (
                  <tr
                    key={contract.id}
                    className={`hover:bg-gray-50 ${
                      isExpiringSoon ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/businesses/${contract.businessId}/commercial`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {contract.business.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 font-mono">
                          {contract.contractNumber}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {contractTypeLabels[contract.type]}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <ContractStatusBadge status={contract.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {contract.signedAt
                        ? format(contract.signedAt, "dd MMM yyyy", { locale: ru })
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {format(contract.startsAt, "dd MMM yyyy", { locale: ru })}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-900">
                          {format(contract.endsAt, "dd MMM yyyy", { locale: ru })}
                        </p>
                        {isExpiringSoon && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            Через {daysUntilEnd} дн.
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {contract.autoRenew ? (
                        <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-blue-600 hover:text-blue-700">
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {contracts.length === 0 && (
        <div className="border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600">Договоры не найдены</p>
        </div>
      )}
    </div>
  );
}
