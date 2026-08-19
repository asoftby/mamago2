"use client";

import { useEffect, useState } from "react";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import { AlertCircle, TrendingUp, Plus, Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { ZeroResultQuery } from "@/types/search-query-log";
import { TableContainer } from "@/components/ui/table";

interface ZeroResultsData {
  queries: ZeroResultQuery[];
  stats: {
    totalZeroResults: number;
    uniqueQueries: number;
  };
}

export default function ZeroResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<ZeroResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);

  useEffect(() => {
    loadZeroResults();
  }, []);

  async function loadZeroResults() {
    try {
      const response = await fetch("/api/admin/search/zero-results");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to load zero results:", error);
    } finally {
      setLoading(false);
    }
  }

  function getSuggestedAction(query: string, count: number): {
    label: string;
    icon: React.ReactNode;
    color: string;
  } {
    // High frequency = needs content or synonym
    if (count >= 10) {
      return {
        label: "Добавить контент или синоним",
        icon: <AlertCircle className="w-4 h-4" />,
        color: "text-red-600",
      };
    }

    // Medium frequency = consider quick tag
    if (count >= 5) {
      return {
        label: "Рассмотреть быстрый тег",
        icon: <Tag className="w-4 h-4" />,
        color: "text-orange-600",
      };
    }

    // Low frequency = create synonym
    return {
      label: "Создать синоним",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-blue-600",
    };
  }

  function handleCreateSynonym(query: string) {
    // Navigate to synonyms page with pre-filled query
    router.push(`/admin/search/synonyms?source=${encodeURIComponent(query)}`);
  }

  function handleCreateQuickTag(query: string) {
    // Navigate to quick tags page with pre-filled query
    router.push(`/admin/search/quick-tags?query=${encodeURIComponent(query)}`);
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

  return (
    <SearchLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Запросы без результата</h2>
          <p className="text-gray-600 mt-1">
            Что ищут пользователи, но mamaGo не может найти
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Всего запросов без результата</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {data.stats.totalZeroResults.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Уникальных запросов</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {data.stats.uniqueQueries.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Tag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">В среднем на запрос</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {data.stats.uniqueQueries > 0
                    ? (data.stats.totalZeroResults / data.stats.uniqueQueries).toFixed(1)
                    : "0"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Intelligence Message */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Панель продуктовых сигналов
          </h3>
          <p className="text-sm text-gray-700">
            Это не технический лог. Здесь видно, чего не хватает в контенте и
            возможностях поиска mamaGo. Каждый запрос — это потребность
            пользователя, которая не была удовлетворена. Используйте эти
            данные, чтобы приоритизировать создание контента, синонимов и
            быстрых тегов.
          </p>
        </div>

        {/* Zero Results Table */}
        {data.queries.length === 0 ? (
          <div className="bg-green-50 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Запросов без результата нет!
            </h3>
            <p className="text-gray-600">
              Все поисковые запросы возвращают результаты. Отлично! 🎉
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <TableContainer
              minWidthClassName="min-w-[640px]"
              scrollLabel="Запросы без результатов, прокручивается по горизонтали"
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Запрос
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Количество
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Последний раз
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Предлагаемое действие
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.queries.map((item, index) => {
                    const suggestion = getSuggestedAction(item.query, item.count);
                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {item.query}
                            </span>
                            {item.count >= 10 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Высокий приоритет
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-2xl font-bold text-gray-900">
                            {item.count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(item.lastSearched).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-2 ${suggestion.color}`}>
                            {suggestion.icon}
                            <span className="text-sm font-medium">
                              {suggestion.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateSynonym(item.query)}
                              className="text-xs"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Синоним
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreateQuickTag(item.query)}
                              className="text-xs"
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              Быстрый тег
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableContainer>
          </div>
        )}

        {/* Action Guide */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Как реагировать на запросы без результата
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Высокая частота (10+)</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Пользователям действительно нужен этот контент. Стоит
                  добавить новые места/занятия или создать синоним к
                  существующему контенту.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Tag className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Средняя частота (5–9)</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Достаточно популярно для быстрого тега. Так пользователям
                  будет проще найти похожий контент.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Низкая частота (1–4)</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Похоже на проблему с синонимом. Свяжите этот запрос с
                  существующим контентом через правило синонима.
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
            Обратите внимание: синонимы и быстрые теги пока не подключены к
            живому поиску (см. соответствующие вкладки) — эти рекомендации
            готовят данные на будущее.
          </p>
        </div>
      </div>
    </SearchLayout>
  );
}
