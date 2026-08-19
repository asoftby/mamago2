import Link from "next/link";
import prisma from "@/lib/prisma";
import { adminPath } from "@/lib/routing/surface";
import { TableContainer } from "@/components/ui/table";
import type { BusinessAccessRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<BusinessAccessRequestStatus, string> = {
  PENDING: "На проверке",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  NEEDS_INFO: "Нужны данные",
};

const STATUS_COLORS: Record<BusinessAccessRequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  NEEDS_INFO: "bg-gray-100 text-gray-800",
};

const FILTER_TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export default async function BusinessAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = (params.status || "PENDING").toUpperCase();

  const requests = await prisma.businessAccessRequest.findMany({
    where: activeStatus === "ALL" ? {} : { status: activeStatus as BusinessAccessRequestStatus },
    orderBy: { createdAt: "desc" },
    include: {
      business: { select: { name: true, legalName: true } },
    },
  });

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div>
        <h1 className="text-2xl md:text-xl font-bold">Заявки на доступ к бизнесу</h1>
      </div>

      <div className="border-b border-gray-200 -mx-6 md:mx-0 px-6 md:px-0">
        <div className="flex gap-2 overflow-x-auto">
          {FILTER_TABS.map((status) => (
            <Link
              key={status}
              href={`${adminPath("/b2b/access-requests")}?status=${status}`}
              className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap text-sm ${
                activeStatus === status
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {status === "ALL" ? "Все" : STATUS_LABELS[status as BusinessAccessRequestStatus]}
            </Link>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-gray-500">Заявок не найдено.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <TableContainer
            minWidthClassName="min-w-[920px]"
            scrollLabel="Заявки на доступ к бизнесу, прокручивается по горизонтали"
          >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Дата</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">УНП</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Бизнес</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Заявитель</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Контакты</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Роль</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700">Статус</th>
                <th className="px-6 py-3 text-left font-medium text-gray-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {request.createdAt.toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">{request.unp}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {request.business.legalName || request.business.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">{request.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {request.phone || request.email || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {request.requesterRole}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[request.status]}`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    <Link
                      href={adminPath(`/b2b/access-requests/${request.id}`)}
                      className="text-primary hover:text-primary/80"
                    >
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}
