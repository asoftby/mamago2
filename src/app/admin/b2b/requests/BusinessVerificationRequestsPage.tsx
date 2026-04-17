"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BusinessVerificationSidePanel } from "./BusinessVerificationSidePanel";

type Business = {
  id: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  phone: string | null;
  verificationStatus: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  owner: {
    email: string;
    phoneE164: string | null;
  };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function BusinessVerificationRequestsPage({
  initialStatus,
  initialOpenId,
}: {
  initialStatus: string;
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(initialOpenId);

  useEffect(() => {
    fetchBusinesses(activeStatus);
  }, [activeStatus]);

  const fetchBusinesses = async (status: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/business-verification?status=${status}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      setBusinesses(data.businesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    // Update URL with new status, clear open panel
    router.replace(`${pathname}?status=${status}`, { scroll: false });
    setOpenBusinessId(null);
  };

  const handleOpenBusiness = (businessId: string) => {
    setOpenBusinessId(businessId);
    // Update URL with open parameter for deep-linking
    router.replace(`${pathname}?status=${activeStatus}&open=${businessId}`, { scroll: false });
  };

  const handleCloseBusiness = () => {
    setOpenBusinessId(null);
    // Remove open parameter from URL
    router.replace(`${pathname}?status=${activeStatus}`, { scroll: false });
  };

  const handleActionComplete = (newStatus: string) => {
    // Refresh the list
    fetchBusinesses(activeStatus);
    // Close the panel
    handleCloseBusiness();
    // Optionally switch to the new status tab
    if (newStatus !== activeStatus) {
      setActiveStatus(newStatus);
      router.replace(`${pathname}?status=${newStatus}`, { scroll: false });
    }
  };

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Заявки на верификацию</h1>
        </div>
      </div>

      {/* AdminPageToolbar - Status tabs */}
      <div className="border-b border-gray-200 -mx-6 md:mx-0 px-6 md:px-0">
        <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["PENDING", "APPROVED", "REJECTED", "DRAFT"].map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap text-sm ${
                activeStatus === status
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* AdminPageContent */}
      <div>
        {/* Loading state */}
        {loading && (
          <div className="text-center py-8 text-gray-500">Загрузка...</div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && businesses.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Нет бизнесов со статусом &quot;{STATUS_LABELS[activeStatus]}&quot;
          </div>
        )}

        {/* Business list */}
        {!loading && !error && businesses.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Бизнес
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Владелец
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    УНП
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Дата подачи
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {businesses.map((business) => (
                  <tr 
                    key={business.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      openBusinessId === business.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleOpenBusiness(business.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {business.name}
                      </div>
                      {business.legalName && (
                        <div className="text-gray-500">
                          {business.legalName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">
                        {business.owner.email}
                      </div>
                      {business.owner.phoneE164 && (
                        <div className="text-gray-500">
                          {business.owner.phoneE164}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {business.unp || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          STATUS_COLORS[business.verificationStatus]
                        }`}
                      >
                        {STATUS_LABELS[business.verificationStatus]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {business.submittedAt
                        ? new Date(business.submittedAt).toLocaleDateString(
                            "ru-RU"
                          )
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBusiness(business.id);
                        }}
                        className="text-primary hover:text-primary/80"
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side Panel */}
      {openBusinessId && (
        <BusinessVerificationSidePanel
          businessId={openBusinessId}
          onClose={handleCloseBusiness}
          onActionComplete={handleActionComplete}
        />
      )}
    </div>
  );
}
