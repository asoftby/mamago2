"use client";

import { useEffect, useState } from "react";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import { Search, TrendingUp, AlertCircle, MousePointerClick } from "lucide-react";
import { TableContainer } from "@/components/ui/table";

interface OverviewData {
  windowDays: number;
  stats: {
    totalQueries: number;
    uniqueQueries: number;
    zeroResultQueries: number;
  };
  popularQueries: Array<{
    query: string;
    count: number;
    lastSearched: string;
  }>;
}

export default function SearchOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    try {
      const response = await fetch("/api/admin/search/overview");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to load search overview:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
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

  const stats = [
    {
      id: "total-queries",
      label: `Запросов за ${data.windowDays} дней`,
      value: data.stats.totalQueries.toLocaleString("ru-RU"),
      icon: Search,
    },
    {
      id: "unique-queries",
      label: "Уникальных запросов",
      value: data.stats.uniqueQueries.toLocaleString("ru-RU"),
      icon: TrendingUp,
    },
    {
      id: "zero-results",
      label: "Запросов без результата",
      value: data.stats.zeroResultQueries.toLocaleString("ru-RU"),
      icon: AlertCircle,
    },
  ];

  return (
    <SearchLayout>
      <div className="space-y-8">
        {/* Stats Grid — real SearchQueryLog aggregates, no invented numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Honest state: click-through is not tracked in production today. */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">CTR по результатам</p>
                <p className="text-lg font-semibold text-gray-500 mt-2">
                  Не отслеживается
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Клики по результатам поиска пока не логируются
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MousePointerClick className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Popular Queries Table — real SearchQueryLog GROUP BY, no fabricated CTR/status */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Популярные запросы
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Самые частые запросы за последние {data.windowDays} дней
            </p>
          </div>

          {data.popularQueries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">
                За последние {data.windowDays} дней запросов ещё не было
              </p>
            </div>
          ) : (
            <TableContainer
              minWidthClassName="min-w-[480px]"
              scrollLabel="Популярные поисковые запросы, прокручивается по горизонтали"
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Запрос
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Количество
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Последний раз
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.popularQueries.map((item) => (
                    <tr
                      key={item.query}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Search className="w-4 h-4 text-gray-400 mr-3" />
                          <span className="text-sm font-medium text-gray-900">
                            {item.query}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {item.count.toLocaleString("ru-RU")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {new Date(item.lastSearched).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          )}
        </div>

        {/* Info Card — what actually drives production ranking */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">
                Что реально влияет на поиск
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Данные на этой странице — реальные записи из журнала поисковых
                запросов. Ранжирование результатов использует фиксированные
                коэффициенты по типу контента (вкладка «Ранжирование» — только
                для чтения, объясняет почему). Клики по результатам сейчас не
                отслеживаются, поэтому CTR не показывается.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SearchLayout>
  );
}
