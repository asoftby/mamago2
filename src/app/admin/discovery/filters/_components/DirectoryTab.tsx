"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { useBackofficeSavedToast } from "@/hooks/useBackofficeSavedToast";
import { RETURN_TO_PARAM } from "@/lib/backoffice/saveFlow";
import { Label } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DiscoveryCreateCard,
  DiscoveryTitleSlugCreateRow,
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  DiscoveryTableChevronCell,
  discoveryTh,
  discoveryTd,
  discoveryTableRowClass,
} from "@/components/admin/discovery";
import {
  FILTER_TYPE_VALUES,
  FILTER_TYPE_LABELS,
  FILTER_UI_LABELS,
  TYPE_UI_COMPATIBILITY,
  type FilterType,
  type FilterUi,
} from "@/lib/discovery/filterDefinitionTypes";

const EDIT_HREF = (id: string) => `/admin/discovery/filters/${id}`;
const F: RequestInit = { credentials: "include" };

type Filter = {
  id: string;
  slug: string;
  title: string;
  type: string;
  ui: string;
  orderIndex: number;
  isActive: boolean;
  options: { id: string }[];
};

export function DirectoryTab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useBackofficeSavedToast("Фильтр сохранён");

  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);

  const newFilter = useAutoSlug("", "");
  const [newType, setNewType] = useState<FilterType>("single");
  const [newUi, setNewUi] = useState<FilterUi>("chips");

  const fetchFilters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/filters", F);
      if (res.ok) setFilters(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  const createFilter = async () => {
    if (!newFilter.source.trim()) {
      toast.error("Укажите название");
      return;
    }
    const res = await fetch("/api/admin/filters", {
      ...F,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newFilter.slug,
        title: newFilter.source,
        type: newType,
        ui: newUi,
      }),
    });
    if (res.ok) {
      newFilter.hydrate("", "");
      setNewType("single");
      setNewUi("chips");
      await fetchFilters();
      toast.success("Фильтр создан");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const goToEdit = (id: string) => {
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const p = new URLSearchParams();
    p.set(RETURN_TO_PARAM, returnTo);
    router.push(`${EDIT_HREF(id)}?${p.toString()}`);
  };

  const sorted = [...filters].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-6">
      <DiscoveryCreateCard title="Создать фильтр">
        <div className="grid gap-4 max-w-2xl md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Тип значения</Label>
            <Select
              value={newType}
              onValueChange={(val) => {
                const t = val as FilterType;
                setNewType(t);
                const compatible = TYPE_UI_COMPATIBILITY[t];
                if (compatible && !compatible.includes(newUi)) {
                  setNewUi(compatible[0]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FILTER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>UI-компонент</Label>
            <Select
              value={newUi}
              onValueChange={(val) => setNewUi(val as FilterUi)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_UI_COMPATIBILITY[newType].map((u) => (
                  <SelectItem key={u} value={u}>
                    {FILTER_UI_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DiscoveryTitleSlugCreateRow
          titleLabel="Название"
          auto={newFilter}
          onCreate={createFilter}
          titlePlaceholder="Например: Метро"
          slugPlaceholder="metro"
        />
      </DiscoveryCreateCard>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : sorted.length === 0 ? (
        <DiscoveryEmptyState
          title="Нет фильтров"
          description="Создайте первый фильтр и настройте опции на странице редактирования."
        />
      ) : (
        <DiscoveryTaxonomyTable
          minWidthClassName="min-w-[800px]"
          scrollLabel="Таблица справочника фильтров, прокручивается по горизонтали"
        >
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={discoveryTh()}>Название</th>
              <th className={discoveryTh()}>Slug</th>
              <th className={discoveryTh()}>Тип</th>
              <th className={discoveryTh()}>UI</th>
              <th className={discoveryTh("w-20")}>Порядок</th>
              <th className={discoveryTh("w-20")}>Опций</th>
              <th className="w-10 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((f) => (
              <tr
                key={f.id}
                role="link"
                tabIndex={0}
                className={discoveryTableRowClass(false)}
                onClick={() => goToEdit(f.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToEdit(f.id);
                  }
                }}
              >
                <td className={cn(discoveryTd(), "font-medium text-gray-900")}>
                  {f.title}
                </td>
                <td className={cn(discoveryTd(), "font-mono text-xs text-gray-700")}>
                  {f.slug}
                </td>
                <td className={cn(discoveryTd(), "font-mono text-xs text-gray-600")}>
                  {f.type}
                </td>
                <td className={cn(discoveryTd(), "font-mono text-xs text-gray-600")}>
                  {f.ui}
                </td>
                <td className={discoveryTd("text-gray-500 text-xs tabular-nums")}>
                  {f.orderIndex}
                </td>
                <td className={discoveryTd("text-gray-500 text-xs tabular-nums")}>
                  {f.options?.length ?? 0}
                </td>
                <DiscoveryTableChevronCell />
              </tr>
            ))}
          </tbody>
        </DiscoveryTaxonomyTable>
      )}
    </div>
  );
}
