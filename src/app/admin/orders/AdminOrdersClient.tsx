"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import type { BookingStatus } from "@prisma/client";

type EntityTypeFilter = "all" | "CAMP_SHIFT" | "EVENT" | "OFFER" | "PLACE";

interface AdminOrderListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  business: {
    id: string;
    name: string;
  };
  publicationType: "EVENT" | "OFFER" | "PLACE";
  entityType: "CAMP_SHIFT" | "EVENT" | "OFFER" | "PLACE" | "UNKNOWN";
  entityId: string | null;
  entityTitle: string | null;
  cityId: string | null;
  sourceChannel: string | null;
  campShiftSnapshot: {
    id: string;
    title: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  } | null;
  latestActivity: {
    id: string;
    type: string;
    actorType: string;
    actorId: string | null;
    createdAt: string;
  } | null;
}

interface AdminOrdersResponse {
  orders: AdminOrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<BookingStatus, number>;
}

interface BusinessOption {
  id: string;
  name: string;
}

interface CityOption {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

const STATUS_BADGE_CLASS: Record<BookingStatus, string> = {
  NEW: "border-blue-200 bg-blue-50 text-blue-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-stone-200 bg-stone-100 text-stone-700",
  COMPLETED: "border-violet-200 bg-violet-50 text-violet-700",
};

const ENTITY_TYPE_LABELS: Record<EntityTypeFilter | "UNKNOWN", string> = {
  all: "Все типы",
  CAMP_SHIFT: "Лагерь",
  EVENT: "Событие",
  OFFER: "Предложение",
  PLACE: "Место",
  UNKNOWN: "Не определено",
};

const DEFAULT_COUNTS: Record<BookingStatus, number> = {
  NEW: 0,
  CONFIRMED: 0,
  REJECTED: 0,
  CANCELLED: 0,
  COMPLETED: 0,
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompactDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getPublicationHref(order: AdminOrderListItem) {
  if (!order.entityId) return null;

  if (order.entityType === "PLACE") {
    return `/admin/content/places/${order.entityId}`;
  }

  if (order.entityType === "EVENT") {
    return `/admin/seo/pages/event/${order.entityId}`;
  }

  if (order.entityType === "CAMP_SHIFT" || order.entityType === "OFFER") {
    return `/admin/seo/pages/offer/${order.entityId}`;
  }

  return null;
}

export function AdminOrdersClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | BookingStatus>("all");
  const [businessId, setBusinessId] = useState("all");
  const [entityType, setEntityType] = useState<EntityTypeFilter>("all");
  const [cityId, setCityId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [ordersData, setOrdersData] = useState<AdminOrdersResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (businessId !== "all") params.set("businessId", businessId);
      if (entityType !== "all") params.set("entityType", entityType);
      if (cityId !== "all") params.set("cityId", cityId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/admin/orders?${params.toString()}`);
      if (response.status === 401) {
        throw new Error("Необходима авторизация администратора.");
      }
      if (response.status === 403) {
        throw new Error("Недостаточно прав. Раздел доступен только ADMIN.");
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Не удалось загрузить заказы");
      }

      const data = (await response.json()) as AdminOrdersResponse;
      setOrdersData(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Не удалось загрузить заказы",
      );
    } finally {
      setLoading(false);
    }
  }, [businessId, cityId, dateFrom, dateTo, entityType, page, search, status]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [businessesResponse, citiesResponse] = await Promise.all([
          fetch("/api/admin/businesses/list"),
          fetch("/api/admin/taxonomy/cities"),
        ]);

        if (businessesResponse.ok) {
          const data = (await businessesResponse.json()) as {
            businesses?: { id: string; name: string }[];
          };
          setBusinesses(data.businesses ?? []);
        }

        if (citiesResponse.ok) {
          const data = (await citiesResponse.json()) as CityOption[];
          setCities(data);
        }
      } catch (optionsError) {
        console.error("Failed to load order filters:", optionsError);
      }
    }

    void loadFilterOptions();
  }, []);

  const statusTabs = useMemo(
    () => [
      {
        value: "all" as const,
        label: "Все",
        count: Object.values(ordersData?.statusCounts ?? DEFAULT_COUNTS).reduce(
          (acc, value) => acc + value,
          0,
        ),
      },
      { value: "NEW" as const, label: STATUS_LABELS.NEW, count: ordersData?.statusCounts.NEW ?? 0 },
      {
        value: "CONFIRMED" as const,
        label: STATUS_LABELS.CONFIRMED,
        count: ordersData?.statusCounts.CONFIRMED ?? 0,
      },
      {
        value: "COMPLETED" as const,
        label: STATUS_LABELS.COMPLETED,
        count: ordersData?.statusCounts.COMPLETED ?? 0,
      },
      {
        value: "REJECTED" as const,
        label: STATUS_LABELS.REJECTED,
        count: ordersData?.statusCounts.REJECTED ?? 0,
      },
      {
        value: "CANCELLED" as const,
        label: STATUS_LABELS.CANCELLED,
        count: ordersData?.statusCounts.CANCELLED ?? 0,
      },
    ],
    [ordersData?.statusCounts],
  );

  const resetPageAndSet = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              status === tab.value
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-100",
            ].join(" ")}
          >
            {tab.label}
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                status === tab.value ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600",
              ].join(" ")}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="Поиск по имени, телефону, email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <FilterSelect
            value={businessId}
            placeholder="Все бизнесы"
            onChange={(value) => resetPageAndSet(setBusinessId, value)}
            options={businesses.map((business) => ({
              value: business.id,
              label: business.name,
            }))}
          />

          <FilterSelect
            value={entityType}
            placeholder="Все типы"
            onChange={(value) => resetPageAndSet(setEntityType, value as EntityTypeFilter)}
            options={[
              { value: "CAMP_SHIFT", label: ENTITY_TYPE_LABELS.CAMP_SHIFT },
              { value: "EVENT", label: ENTITY_TYPE_LABELS.EVENT },
              { value: "OFFER", label: ENTITY_TYPE_LABELS.OFFER },
              { value: "PLACE", label: ENTITY_TYPE_LABELS.PLACE },
            ]}
          />

          <FilterSelect
            value={cityId}
            placeholder="Все города"
            onChange={(value) => resetPageAndSet(setCityId, value)}
            options={cities.map((city) => ({
              value: city.id,
              label: city.name,
            }))}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Дата от</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Дата до</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Статус</label>
            <FilterSelect
              value={status}
              placeholder="Все статусы"
              onChange={(value) => resetPageAndSet(setStatus, value as "all" | BookingStatus)}
              options={[
                { value: "NEW", label: STATUS_LABELS.NEW },
                { value: "CONFIRMED", label: STATUS_LABELS.CONFIRMED },
                { value: "COMPLETED", label: STATUS_LABELS.COMPLETED },
                { value: "REJECTED", label: STATUS_LABELS.REJECTED },
                { value: "CANCELLED", label: STATUS_LABELS.CANCELLED },
              ]}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setBusinessId("all");
                setEntityType("all");
                setCityId("all");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>
          Найдено: <span className="font-medium text-gray-900">{ordersData?.total ?? 0}</span>
        </p>
        <p>
          Страница {ordersData?.page ?? 1} из {ordersData?.totalPages ?? 1}
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">Загрузка заказов…</div>
      ) : !ordersData || ordersData.orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          Заявки не найдены
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Создано</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Клиент</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Публикация</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Последняя активность</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordersData.orders.map((order) => {
                const publicationHref = getPublicationHref(order);
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 align-top text-gray-700">
                      <div className="font-medium text-gray-900">{formatDateTime(order.createdAt)}</div>
                      <div className="text-xs text-gray-500">{order.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-gray-600">{order.customerPhone}</div>
                      <div className="text-gray-500">{order.customerEmail || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASS[order.status]}
                      >
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/b2b/partners/${order.business.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {order.business.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-stone-200 bg-stone-50 text-stone-700">
                          {ENTITY_TYPE_LABELS[order.entityType]}
                        </Badge>
                        {publicationHref ? (
                          <Link
                            href={publicationHref}
                            className="block font-medium text-blue-600 hover:text-blue-700"
                          >
                            {order.entityTitle || "Открыть публикацию"}
                          </Link>
                        ) : (
                          <div className="font-medium text-gray-900">{order.entityTitle || "—"}</div>
                        )}
                        {order.campShiftSnapshot && (
                          <div className="text-xs text-gray-500">
                            Смена: {order.campShiftSnapshot.title || "Без названия"} ·{" "}
                            {formatCompactDate(order.campShiftSnapshot.dateFrom)} -{" "}
                            {formatCompactDate(order.campShiftSnapshot.dateTo)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-600">
                      {order.latestActivity ? (
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{order.latestActivity.type}</div>
                          <div className="text-xs text-gray-500">
                            {order.latestActivity.actorType} ·{" "}
                            {formatDateTime(order.latestActivity.createdAt)}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Открыть детали
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading || page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Назад
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || page >= (ordersData?.totalPages ?? 1)}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}
