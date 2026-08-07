"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBackofficeSavedToast } from "@/hooks/useBackofficeSavedToast";
import { RETURN_TO_PARAM } from "@/lib/backoffice/saveFlow";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import {
  DiscoveryTaxonomyPageShell,
  DiscoveryTaxonomyPageHeader,
  DiscoveryCreateCard,
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  DiscoveryTableChevronCell,
  DiscoveryTitleSlugCreateRow,
  discoveryTh,
  discoveryTd,
  discoveryTableRowClass,
} from "@/components/admin/discovery";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventCategoryPublicationType } from "@prisma/client";

const adminFetch: RequestInit = { credentials: "include" };

type CategoryOption = {
  id: string;
  nameRu: string;
  slug: string;
  parentId: string | null;
  type: EventCategoryPublicationType;
  sortOrder: number;
};

type GenreRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  category: { id: string; nameRu: string; slug: string };
};

function parseListCategoryId(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("category");
  if (raw == null || raw === "" || raw === "all") return null;
  return raw;
}

export function GenresAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategoryId = parseListCategoryId(searchParams);

  useBackofficeSavedToast("Жанр сохранён");

  const [rows, setRows] = useState<GenreRow[]>([]);
  const [eventRootCategories, setEventRootCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const auto = useAutoSlug("", "");

  const listHref = "/admin/taxonomy/genres";

  const setTab = (categoryId: string | null) => {
    if (categoryId == null) {
      router.replace(listHref);
    } else {
      router.replace(`${listHref}?category=${encodeURIComponent(categoryId)}`);
    }
  };

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/admin/taxonomy/event-categories", adminFetch);
    if (!res.ok) return;
    const data = (await res.json()) as CategoryOption[];
    const roots = data
      .filter((c) => c.parentId == null && c.type === "EVENT")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.nameRu.localeCompare(b.nameRu, "ru"));
    setEventRootCategories(roots);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/genres", adminFetch);
      if (res.ok) {
        const data = (await res.json()) as GenreRow[];
        setRows(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } catch {
      toast.error("Не удалось загрузить жанры. Проверьте сеть и обновите страницу.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.category.nameRu.localeCompare(b.category.nameRu, "ru") ||
          a.sortOrder - b.sortOrder ||
          a.id.localeCompare(b.id),
      ),
    [rows],
  );

  const filteredRows = useMemo(() => {
    if (activeCategoryId == null) return sorted;
    return sorted.filter((r) => r.category.id === activeCategoryId);
  }, [sorted, activeCategoryId]);

  const activeCategory = useMemo(
    () => (activeCategoryId ? eventRootCategories.find((c) => c.id === activeCategoryId) : null),
    [eventRootCategories, activeCategoryId],
  );

  /** Неверный id в URL — сбрасываем на «Все» */
  useEffect(() => {
    if (activeCategoryId && eventRootCategories.length > 0 && !activeCategory) {
      router.replace(listHref);
    }
  }, [activeCategoryId, activeCategory, eventRootCategories.length, router]);

  const createRow = async () => {
    if (!activeCategoryId) {
      toast.error("Выберите категорию сверху");
      return;
    }
    if (!auto.source.trim()) {
      toast.error("Укажите название");
      return;
    }
    const res = await fetch("/api/admin/genres", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: auto.source,
        slug: auto.slug,
        categoryId: activeCategoryId,
      }),
    });
    if (res.ok) {
      auto.hydrate("", "");
      fetchRows();
      toast.success("Создано");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const goToEdit = (r: GenreRow) => {
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const p = new URLSearchParams();
    p.set("category", r.category.id);
    p.set(RETURN_TO_PARAM, returnTo);
    router.push(`/admin/taxonomy/genres/${r.id}?${p.toString()}`);
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Genres"
        description="Жанры привязаны к корневым event categories. Выберите категорию в табах, чтобы отфильтровать список и создать жанр."
      />

      <div className="space-y-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Категория событий"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={activeCategoryId == null}
            variant={activeCategoryId == null ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setTab(null)}
          >
            Все
          </Button>
          {eventRootCategories.map((c) => {
            const selected = activeCategoryId === c.id;
            return (
              <Button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setTab(c.id)}
              >
                {c.nameRu}
              </Button>
            );
          })}
        </div>

        {activeCategoryId == null ? (
          <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Чтобы создать жанр, выберите категорию событий в табах выше (не режим «Все»).
          </div>
        ) : (
          <DiscoveryCreateCard
            title={
              activeCategory
                ? `Новый жанр в категории «${activeCategory.nameRu}»`
                : "Новый жанр"
            }
          >
            <DiscoveryTitleSlugCreateRow
              auto={auto}
              onCreate={createRow}
              titlePlaceholder="Название жанра"
              slugPlaceholder="slug"
            />
          </DiscoveryCreateCard>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <DiscoveryEmptyState
            title={activeCategoryId ? "Нет жанров в этой категории" : "Пока нет записей"}
            description={
              activeCategoryId
                ? "Создайте жанр формой выше или переключите таб."
                : "Добавьте жанры, выбрав категорию в табах."
            }
          />
        ) : (
          <DiscoveryTaxonomyTable scrollLabel="Таблица жанров, прокручивается по горизонтали">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh()}>Категория</th>
                <th className={discoveryTh("w-20")}>Порядок</th>
                <th className="w-10 px-2 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  className={cn(discoveryTableRowClass(false), !r.isActive && "opacity-60")}
                  onClick={() => goToEdit(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToEdit(r);
                    }
                  }}
                >
                  <td className={discoveryTd("font-medium text-gray-900")}>{r.name}</td>
                  <td className={discoveryTd("font-mono text-xs text-gray-700")}>{r.slug}</td>
                  <td className={discoveryTd("text-gray-800")}>{r.category.nameRu}</td>
                  <td className={discoveryTd("text-gray-600")}>{r.sortOrder}</td>
                  <DiscoveryTableChevronCell />
                </tr>
              ))}
            </tbody>
          </DiscoveryTaxonomyTable>
        )}
      </div>
    </DiscoveryTaxonomyPageShell>
  );
}
