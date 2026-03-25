"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/typography";
import { toast } from "sonner";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { orderEventCategoriesForDisplay } from "@/lib/taxonomy/eventCategoryHierarchy";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
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
import { cn } from "@/lib/utils";

const adminFetch: RequestInit = { credentials: "include" };

const EDIT_CATEGORY_HREF = (id: string) => `/admin/taxonomy/event-categories/${id}`;

type EventCategory = {
  id: string;
  slug: string;
  nameRu: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  parentId: string | null;
  parent: { id: string; nameRu: string; slug: string } | null;
  _count: { activities: number; children: number };
};

export default function EventCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const newCategory = useAutoSlug("", "");

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/taxonomy/event-categories", adminFetch);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const roots = useMemo(
    () => categories.filter((c) => c.parentId == null),
    [categories],
  );

  const ordered = useMemo(
    () => orderEventCategoriesForDisplay(categories),
    [categories],
  );

  const parentRootOptions = useMemo(
    () => roots.map((r) => ({ id: r.id, label: r.nameRu })),
    [roots],
  );

  const createCategory = async () => {
    if (!newCategory.source.trim()) {
      toast.error("Укажите Title");
      return;
    }
    const res = await fetch("/api/admin/taxonomy/event-categories", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newCategory.slug,
        title: newCategory.source,
        parentId: createParentId,
      }),
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
    router.push(EDIT_CATEGORY_HREF(id));
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Event Categories"
        description="Два уровня: корневая категория и подкатегории. Подкатегорию можно создать только у корня. Откройте строку в таблице для редактирования."
      />

      <div className="space-y-6">
        <DiscoveryCreateCard title="Create New Event Category">
          <DiscoveryParentSelector
            label="Родительская категория"
            helperText="Не выбрано — основная категория; выбран корень — создаётся подкатегория."
            value={createParentId}
            onChange={setCreateParentId}
            roots={parentRootOptions}
            emptyLabel="— Корневая категория —"
          />
          <DiscoveryTitleSlugCreateRow
            auto={newCategory}
            onCreate={createCategory}
            titlePlaceholder="Например: Семейные мастер-классы"
            slugPlaceholder="semejnye-master-klassy"
          />
        </DiscoveryCreateCard>

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
