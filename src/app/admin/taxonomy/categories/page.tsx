"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBackofficeSavedToast } from "@/hooks/useBackofficeSavedToast";
import { RETURN_TO_PARAM } from "@/lib/backoffice/saveFlow";
import { Label } from "@/components/ui/typography";
import { toast } from "sonner";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { orderEventCategoriesForDisplay } from "@/lib/taxonomy/eventCategoryHierarchy";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import {
  EVENT_CATEGORY_PUBLICATION_TYPES,
  EVENT_CATEGORY_TYPE_TAB_LABELS,
  parseEventCategoryPublicationType,
} from "@/lib/taxonomy/eventCategoryPublicationType";
import { EVENT_CATEGORY_HARD_DELETED } from "@/lib/taxonomy/eventCategoryHardDeleteSync";
import type { EventCategoryPublicationType } from "@prisma/client";
import {
  DiscoveryTaxonomyPageShell,
  DiscoveryTaxonomyPageHeader,
  DiscoveryCreateCard,
  DiscoveryParentSelector,
  DiscoveryTitleSlugCreateRow,
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  DiscoveryTableChevronCell,
  discoveryTh,
  discoveryTd,
  discoveryTableRowClass,
} from "@/components/admin/discovery";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminFetch: RequestInit = { credentials: "include" };

const TAB_DEFS: {
  id: string;
  label: string;
  type: EventCategoryPublicationType | null;
}[] = [
  { id: "all", label: "Все", type: null },
  ...EVENT_CATEGORY_PUBLICATION_TYPES.map((t) => ({
    id: t.toLowerCase(),
    label: EVENT_CATEGORY_TYPE_TAB_LABELS[t],
    type: t,
  })),
];

/** Примеры названия в форме создания — зависят от выбранного таба (типа публикации). */
const CREATE_CATEGORY_TITLE_PLACEHOLDERS: Record<EventCategoryPublicationType, string> = {
  EVENT: "Например: Мастер-классы",
  PLACE: "Например: Активный отдых",
  OFFER: "Например: Архитектура",
  ROUTE: "Например: Пешие прогулки",
  ARTICLE: "Например: Подборки",
};

/** Подсказки для slug (без префикса «Например», в отличие от title). */
const CREATE_CATEGORY_SLUG_PLACEHOLDERS: Record<EventCategoryPublicationType, string> = {
  EVENT: "master-klassy",
  PLACE: "aktivnyy-otdyh",
  OFFER: "arhitektura",
  ROUTE: "peshie-progulki",
  ARTICLE: "podborki",
};

type EventCategoryRow = {
  id: string;
  slug: string;
  nameRu: string;
  type: EventCategoryPublicationType;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  parentId: string | null;
  parent: { id: string; nameRu: string; slug: string; type?: EventCategoryPublicationType } | null;
  _count: { activities: number; children: number };
};

function editHref(id: string, listQuery: string, returnTo: string) {
  const params = new URLSearchParams();
  if (listQuery) {
    const sp = new URLSearchParams(listQuery);
    sp.forEach((v, k) => params.set(k, v));
  }
  params.set(RETURN_TO_PARAM, returnTo);
  return `/admin/taxonomy/event-categories/${id}?${params.toString()}`;
}

export default function TaxonomyCategoriesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeType = parseEventCategoryPublicationType(searchParams.get("type"));

  useBackofficeSavedToast("Категория сохранена");

  const listQuery = activeType ? `type=${activeType}` : "";

  const [categories, setCategories] = useState<EventCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const newCategory = useAutoSlug("", "");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const qs = activeType ? `?type=${activeType}` : "";
      const res = await fetch(`/api/admin/taxonomy/event-categories${qs}`, adminFetch);
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } catch {
      toast.error("Не удалось загрузить категории. Проверьте сеть и обновите страницу.");
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const onHardDeleted = () => {
      void fetchCategories();
    };
    window.addEventListener(EVENT_CATEGORY_HARD_DELETED, onHardDeleted);
    return () => window.removeEventListener(EVENT_CATEGORY_HARD_DELETED, onHardDeleted);
  }, [fetchCategories]);

  const roots = useMemo(
    () => categories.filter((c) => c.parentId == null),
    [categories],
  );

  const ordered = useMemo(
    () => orderEventCategoriesForDisplay(categories),
    [categories],
  );

  const parentRootOptions = useMemo(() => {
    const list =
      activeType == null ? roots : roots.filter((r) => r.type === activeType);
    return list.map((r) => ({ id: r.id, label: r.nameRu }));
  }, [roots, activeType]);

  const selectedRootType = useMemo(() => {
    if (!createParentId) return null;
    return roots.find((r) => r.id === createParentId)?.type ?? null;
  }, [createParentId, roots]);

  const setTab = (type: EventCategoryPublicationType | null) => {
    if (type == null) {
      router.replace("/admin/taxonomy/categories");
    } else {
      router.replace(`/admin/taxonomy/categories?type=${type}`);
    }
  };

  const createCategory = async () => {
    if (!newCategory.source.trim()) {
      toast.error("Укажите Title");
      return;
    }
    if (!createParentId && activeType == null) {
      toast.error("Выберите тип публикации сверху перед созданием корневой категории");
      return;
    }
    const body: Record<string, unknown> = {
      slug: newCategory.slug,
      title: newCategory.source,
      parentId: createParentId,
    };
    if (!createParentId) {
      body.type = activeType;
    }
    const res = await fetch("/api/admin/taxonomy/event-categories", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      newCategory.hydrate("", "");
      fetchCategories();
      toast.success("Категория создана");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const goToEdit = (id: string) => {
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    router.push(editHref(id, listQuery, returnTo));
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Categories"
        description="Категории по типам публикаций (события, места, маршруты и др.). Два уровня: корень и подкатегория. Откройте строку для редактирования."
      />

      <div className="space-y-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Тип публикации"
        >
          {TAB_DEFS.map((tab) => {
            const selected =
              tab.type == null ? activeType == null : activeType === tab.type;
            return (
              <Button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setTab(tab.type)}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>

        {activeType == null ? (
          <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Чтобы создать новую категорию, выберите тип публикации сверху (Events / Places / Offers / Routes / Articles).
          </div>
        ) : (
          <DiscoveryCreateCard
            title={`Create new ${EVENT_CATEGORY_TYPE_TAB_LABELS[activeType]} category`}
          >
            <DiscoveryParentSelector
              label="Родительская категория"
              helperText="Не выбрано — основная категория; выбран корень — создаётся подкатегория (тот же тип, что у корня)."
              value={createParentId}
              onChange={setCreateParentId}
              roots={parentRootOptions}
              emptyLabel="— Корневая категория —"
            />
            {createParentId ? (
              <div className="grid gap-1 max-w-md mb-3">
                <Label className="text-xs text-muted-foreground">Тип публикации</Label>
                <p className="text-sm text-gray-700">
                  {selectedRootType
                    ? EVENT_CATEGORY_TYPE_TAB_LABELS[selectedRootType]
                    : "—"}
                  <span className="text-xs text-gray-500 ml-2">(как у родителя)</span>
                </p>
              </div>
            ) : null}
            <DiscoveryTitleSlugCreateRow
              auto={newCategory}
              onCreate={createCategory}
              titlePlaceholder={CREATE_CATEGORY_TITLE_PLACEHOLDERS[activeType]}
              slugPlaceholder={CREATE_CATEGORY_SLUG_PLACEHOLDERS[activeType]}
            />
          </DiscoveryCreateCard>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : ordered.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет категорий"
            description="Создайте первую корневую или дочернюю категорию с помощью формы выше."
          />
        ) : (
          <DiscoveryTaxonomyTable>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название (RU)</th>
                <th className={discoveryTh()}>Type</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh()}>Родитель</th>
                <th className={discoveryTh("w-20")}>Порядок</th>
                <th className={discoveryTh("w-24")}>Используется</th>
                <th className="w-10 px-2 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordered.map((c) => (
                <tr
                  key={c.id}
                  role="link"
                  tabIndex={0}
                  className={discoveryTableRowClass(!!c.parentId)}
                  onClick={() => goToEdit(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToEdit(c.id);
                    }
                  }}
                >
                  <td className={discoveryTd()}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2",
                        c.parentId && "pl-6 border-l-2 border-blue-300 ml-1",
                      )}
                    >
                      {c.parentId ? (
                        <span className="text-blue-500 text-xs font-mono" aria-hidden>
                          └
                        </span>
                      ) : null}
                      <span className="font-medium text-gray-900">{c.nameRu}</span>
                    </span>
                  </td>
                  <td className={discoveryTd("text-gray-700 text-sm")}>
                    {EVENT_CATEGORY_TYPE_TAB_LABELS[c.type]}
                  </td>
                  <td className={cn(discoveryTd(), "font-mono text-xs text-gray-700")}>{c.slug}</td>
                  <td className={discoveryTd("text-gray-600")}>
                    {c.parent ? (
                      <span>{c.parent.nameRu}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={discoveryTd("text-gray-600")}>{c.sortOrder}</td>
                  <td className={discoveryTd("text-gray-600")}>{c._count.activities}</td>
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
