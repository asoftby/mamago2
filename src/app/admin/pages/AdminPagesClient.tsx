"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, ExternalLink, Archive, Edit } from "lucide-react";
import { PageType, PageStatus, PageVisibility } from "@prisma/client";
import { toast } from "sonner";

type Page = {
  id: string;
  slug: string;
  title: string;
  type: PageType;
  status: PageStatus;
  visibility: PageVisibility;
  publishedAt: Date | null;
  updatedAt: Date;
  createdBy?: {
    displayName: string | null;
    email: string;
  } | null;
};

type ListResponse = {
  items: Page[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  LEGAL: "Юридические",
  MARKETING: "Маркетинг",
  LANDING: "Лендинги",
  FAQ: "FAQ",
  SYSTEM: "Системные",
  SEO: "SEO",
};

const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "Архив",
};

export function AdminPagesClient() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PageType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PageStatus | "all">("all");

  useEffect(() => {
    fetchPages();
  }, [search, typeFilter, statusFilter]);

  async function fetchPages() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        ...(search && { search }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/pages?${params}`);
      if (!response.ok) throw new Error("Failed to fetch pages");

      const data: ListResponse = await response.json();
      setPages(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error("Не удалось загрузить страницы");
    } finally {
      setLoading(false);
    }
  }

  function getPublicUrl(page: Page): string {
    if (page.type === "LEGAL") {
      return `/legal/${page.slug}`;
    }
    return `/page/${page.slug}`;
  }

  function getStatusBadgeClass(status: PageStatus): string {
    switch (status) {
      case "PUBLISHED":
        return "bg-green-100 text-green-800 border-green-200";
      case "DRAFT":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "ARCHIVED":
        return "bg-stone-100 text-stone-600 border-stone-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  function getTypeBadgeClass(type: PageType): string {
    switch (type) {
      case "LEGAL":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "MARKETING":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "LANDING":
        return "bg-pink-100 text-pink-800 border-pink-200";
      case "FAQ":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "SYSTEM":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "SEO":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <button
          onClick={() => router.push("/admin/pages/new")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать страницу
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          Найдено: <span className="font-medium">{total}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по названию или slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PageType | "all")}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Все типы</option>
            {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PageStatus | "all")}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Все статусы</option>
            {Object.entries(PAGE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pages List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : pages.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "Страницы не найдены"
              : "Пока нет страниц"}
          </h3>
          <p className="text-gray-600 mb-6">
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "Попробуйте изменить фильтры"
              : "Создайте первую юридическую, рекламную или системную страницу"}
          </p>
          <button
            onClick={() => router.push("/admin/pages/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать страницу
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Обновлено
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{page.title}</div>
                      <div className="text-sm text-gray-500">/{page.slug}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getTypeBadgeClass(page.type)}`}
                    >
                      {PAGE_TYPE_LABELS[page.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusBadgeClass(page.status)}`}
                    >
                      {PAGE_STATUS_LABELS[page.status]}
                    </span>
                    {page.visibility === "UNLISTED" && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
                        Unlisted
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(page.updatedAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/pages/${page.id}/edit`)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {page.status === "PUBLISHED" && (
                        <a
                          href={getPublicUrl(page)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Смотреть на сайте"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
