"use client";

import { useEffect, useState } from "react";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import {
  CheckCircle2,
  Clock,
  XCircle,
  EyeOff,
  RefreshCw,
  Eye,
  ExternalLink,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type {
  SearchIndexRecordWithEntity,
  SearchIndexStats,
  SearchIndexEntityType,
  SearchIndexStatus,
} from "@/types/search-index";
import type { SearchIndexRecord } from "@prisma/client";
import { TableContainer } from "@/components/ui/table";

interface IndexData {
  records: SearchIndexRecordWithEntity[];
  stats: SearchIndexStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function SearchIndexPage() {
  const [data, setData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<SearchIndexEntityType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<SearchIndexStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadIndexData();
  }, [filterType, filterStatus, page]);

  async function loadIndexData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.set("entityType", filterType);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      params.set("page", page.toString());

      const response = await fetch(`/api/admin/search/index?${params}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to load index data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(recordId: string, action: string) {
    try {
      const response = await fetch(`/api/admin/search/index/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (result.success) {
        await loadIndexData();
      } else {
        alert(result.error || "Действие не выполнено");
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert("Действие не выполнено");
    }
  }

  function getStatusBadge(status: SearchIndexStatus) {
    switch (status) {
      case "INDEXED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Проиндексировано
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3.5 h-3.5" />
            В ожидании
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3.5 h-3.5" />
            Ошибка
          </span>
        );
      case "EXCLUDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <EyeOff className="w-3.5 h-3.5" />
            Исключено
          </span>
        );
    }
  }

  function getTypeLabel(type: SearchIndexEntityType) {
    const labels = {
      EVENT: "Событие",
      PLACE: "Место",
      OFFER: "Предложение",
      ROUTE: "Маршрут",
      ARTICLE: "Статья",
    };
    return labels[type] || type;
  }

  if (loading && !data) {
    return (
      <SearchLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      </SearchLayout>
    );
  }

  if (!data) {
    return (
      <SearchLayout>
        <div className="text-center py-12">
          <p className="text-red-600">Не удалось загрузить данные</p>
        </div>
      </SearchLayout>
    );
  }

  const healthScore = data.stats.total > 0
    ? Math.round((data.stats.indexed / data.stats.total) * 100)
    : 100;

  return (
    <SearchLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Индекс поиска</h2>
          <p className="text-gray-600 mt-1">
            Мониторинг и контроль качества индексации
          </p>
        </div>

        {/* Honest disclosure: this table is NOT the real search index */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-amber-900">
            Эта таблица не отражает реальный индекс поиска
          </h3>
          <p className="text-sm text-amber-800 mt-1">
            Публичный поиск читает <code className="mx-1 px-1 py-0.5 rounded bg-amber-100">SearchDocument</code>,
            который обновляется автоматически при публикации/изменении
            контента — управлять им вручную не нужно. Таблица ниже
            (<code className="mx-1 px-1 py-0.5 rounded bg-amber-100">SearchIndexRecord</code>) сейчас ничем не
            заполняется, поэтому 0 записей и «100% здоровья» ниже означают
            «нет данных», а не «всё проиндексировано».
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Всего</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.stats.total.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Проиндексировано</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.stats.indexed.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">В ожидании</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.stats.pending.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Ошибка</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.stats.failed.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <EyeOff className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Исключено</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.stats.excluded.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Health Score */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Состояние индекса</h3>
              <p className="text-sm text-gray-700 mt-1">
                {data.stats.total > 0
                  ? `${healthScore}% контента успешно проиндексировано`
                  : "Нет данных в этой таблице (см. пояснение выше)"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-green-600">
                {data.stats.total > 0 ? `${healthScore}%` : "—"}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {data.stats.indexed} / {data.stats.total}
              </p>
            </div>
          </div>
          <div className="mt-4 bg-white rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
              style={{ width: `${data.stats.total > 0 ? healthScore : 0}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Фильтры:</span>
            </div>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as SearchIndexEntityType | "ALL");
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Все типы</option>
              <option value="EVENT">События</option>
              <option value="PLACE">Места</option>
              <option value="OFFER">Предложения</option>
              <option value="ROUTE">Маршруты</option>
              <option value="ARTICLE">Статьи</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as SearchIndexStatus | "ALL");
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Все статусы</option>
              <option value="INDEXED">Проиндексировано</option>
              <option value="PENDING">В ожидании</option>
              <option value="FAILED">Ошибка</option>
              <option value="EXCLUDED">Исключено</option>
            </select>

            <div className="ml-auto text-sm text-gray-600">
              Показано {data.records.length} из {data.pagination.total}
            </div>
          </div>
        </div>

        {/* Records Table */}
        {data.records.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Записей по текущим фильтрам не найдено</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <TableContainer
              minWidthClassName="min-w-[720px]"
              scrollLabel="Записи поискового индекса, прокручивается по горизонтали"
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Объект
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Тип
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      В поиске
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Дата индексации
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={record.entityUrl || "#"}
                            target="_blank"
                            className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
                          >
                            {record.entityTitle}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        {record.error && (
                          <p className="text-xs text-red-600 mt-1">{record.error}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {getTypeLabel(record.entityType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                      <td className="px-6 py-4">
                        {record.searchable ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <Eye className="w-4 h-4" />
                            Да
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                            <EyeOff className="w-4 h-4" />
                            Нет
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.indexedAt
                          ? new Date(record.indexedAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {record.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(record.id, "reindex")}
                              className="text-xs"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Переиндексировать
                            </Button>
                          )}
                          {record.searchable ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(record.id, "exclude")}
                              className="text-xs"
                            >
                              <EyeOff className="w-3 h-3 mr-1" />
                              Исключить
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(record.id, "include")}
                              className="text-xs"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Включить
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          </div>
        )}

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Назад
            </Button>
            <span className="text-sm text-gray-600">
              Страница {page} из {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page === data.pagination.totalPages}
            >
              Вперёд
            </Button>
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Как задумана эта панель
          </h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>
              • <strong>Автоматическая индексация:</strong> контент
              индексируется автоматически при публикации, изменении или
              архивации
            </p>
            <p>
              • <strong>Контроль качества:</strong> панель должна помогать
              следить за состоянием индексации и находить проблемы
            </p>
            <p>
              • <strong>Исключить/включить:</strong> управление тем, какой
              контент показывается в поиске
            </p>
            <p>
              • <strong>Переиндексировать:</strong> повторить неудачную
              попытку индексации
            </p>
            <p className="pt-2 border-t border-blue-100">
              Как отмечено выше, эта таблица сейчас не заполняется — эти
              действия не влияют на реальный поиск, пока подключение не
              появится.
            </p>
          </div>
        </div>
      </div>
    </SearchLayout>
  );
}
