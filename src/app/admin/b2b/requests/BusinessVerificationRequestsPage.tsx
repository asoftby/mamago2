"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BusinessVerificationSidePanel } from "./BusinessVerificationSidePanel";
import { LoadingBlock, EmptyBlock, ErrorBlock } from "@/components/admin/ui/StateBlock";
import { TableContainer } from "@/components/ui/table";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { Button } from "@/components/ui/button";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardRow,
  DataCardActions,
} from "@/components/ui/data-card-list";

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

const STATUS_TABS = ["PENDING", "APPROVED", "REJECTED", "DRAFT"].map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

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
    <div className="p-4 sm:p-6 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Заявки на верификацию</h1>
        </div>
      </div>

      {/* AdminPageToolbar - shared status filter */}
      <AdminFilterTabs
        items={STATUS_TABS}
        value={activeStatus}
        onValueChange={handleStatusChange}
        ariaLabel="Статус заявки на верификацию"
      />

      {/* AdminPageContent */}
      <div>
        {/* Loading state */}
        {loading && (
          <LoadingBlock title="Загрузка бизнесов..." compact />
        )}

        {/* Error state */}
        {error && (
          <ErrorBlock title="Не удалось загрузить данные" description={error} compact />
        )}

        {/* Empty state */}
        {!loading && !error && businesses.length === 0 && (
          <EmptyBlock
            title={`Нет бизнесов со статусом «${STATUS_LABELS[activeStatus]}»`}
            description="Попробуйте выбрать другой статус"
            compact
          />
        )}

        {/* Business list */}
        {!loading && !error && businesses.length > 0 && (
          <>
            {/* Desktop: same responsive table pattern as /admin/b2b/partners.
                Fixed layout + wrapping keeps all columns inside the viewport. */}
            <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
              <TableContainer
                minWidthClassName="min-w-0"
                scrollLabel="Заявки на верификацию"
                hideScrollShadow
              >
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[20%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[13%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Бизнес
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Владелец
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        УНП
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Дата подачи
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {businesses.map((business) => (
                      <tr
                        key={business.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          openBusinessId === business.id ? "bg-blue-50" : ""
                        }`}
                        onClick={() => handleOpenBusiness(business.id)}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="break-words font-medium text-gray-900">
                            {business.name}
                          </div>
                          {business.legalName && (
                            <div className="mt-0.5 break-words text-gray-500">
                              {business.legalName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="break-all text-gray-900">
                            {business.owner?.email || "—"}
                          </div>
                          {business.owner?.phoneE164 && (
                            <div className="mt-0.5 text-gray-500">
                              {business.owner.phoneE164}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-gray-900">
                          {business.unp || "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${
                              STATUS_COLORS[business.verificationStatus]
                            }`}
                          >
                            {STATUS_LABELS[business.verificationStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-500">
                          {business.submittedAt
                            ? new Date(business.submittedAt).toLocaleDateString("ru-RU")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right align-top font-medium">
                          <button
                            type="button"
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
              </TableContainer>
            </div>

            {/* Mobile: same card strategy as /admin/b2b/partners. */}
            <DataCardList>
              {businesses.map((business) => (
                <DataCard key={business.id}>
                  <DataCardHeader
                    title={business.name}
                    subtitle={business.legalName}
                    badge={
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${
                          STATUS_COLORS[business.verificationStatus]
                        }`}
                      >
                        {STATUS_LABELS[business.verificationStatus]}
                      </span>
                    }
                  />
                  <DataCardBody>
                    <DataCardRow label="Email" value={business.owner?.email} />
                    <DataCardRow label="Телефон" value={business.owner?.phoneE164} />
                    <DataCardRow label="УНП" value={business.unp} />
                    <DataCardRow
                      label="Дата подачи"
                      value={
                        business.submittedAt
                          ? new Date(business.submittedAt).toLocaleDateString("ru-RU")
                          : "—"
                      }
                    />
                  </DataCardBody>
                  <DataCardActions>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenBusiness(business.id)}
                    >
                      Подробнее
                    </Button>
                  </DataCardActions>
                </DataCard>
              ))}
            </DataCardList>
          </>
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
