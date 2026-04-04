"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBackofficeSavedToast } from "@/hooks/useBackofficeSavedToast";
import { RETURN_TO_PARAM } from "@/lib/backoffice/saveFlow";
import { Label } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { cn } from "@/lib/utils";
import {
  DiscoveryTaxonomyPageShell,
  DiscoveryTaxonomyPageHeader,
  DiscoveryCreateCard,
  DiscoveryTitleSlugCreateRow,
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  DiscoveryTableChevronCell,
  discoveryTh,
  discoveryTd,
  discoveryTableRowClass,
} from "@/components/admin/discovery";

const adminFetch: RequestInit = { credentials: "include" };

const EDIT_FILTER_HREF = (id: string) => `/admin/discovery/filters/${id}`;

type Filter = {
  id: string;
  slug: string;
  title: string;
  type: string;
  ui: string;
  order: number;
  orderIndex: number;
  placement: "PRIMARY" | "SECONDARY" | "HIDDEN";
  isActive: boolean;
  options: { id: string }[];
};

export default function FiltersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filter[]>([]);

  useBackofficeSavedToast("Фильтр сохранён");
  const [loading, setLoading] = useState(true);

  const newFilter = useAutoSlug("", "");
  const [newType, setNewType] = useState("single");
  const [newUi, setNewUi] = useState("tabs");

  const fetchFilters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/filters", adminFetch);
      if (res.ok) {
        const data = await res.json();
        setFilters(data);
      }
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
      ...adminFetch,
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
      setNewUi("tabs");
      fetchFilters();
      toast.success("Фильтр создан");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const sorted = [...filters].sort((a, b) => a.orderIndex - b.orderIndex);

  const goToEdit = (id: string) => {
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const p = new URLSearchParams();
    p.set(RETURN_TO_PARAM, returnTo);
    router.push(`${EDIT_FILTER_HREF(id)}?${p.toString()}`);
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Filters"
        description="UI-слой: конфигурация фильтров каталога (тип, представление, опции). Не источник бизнес-данных — ссылается на категории, сигналы и др. Откройте строку для редактирования."
      />

      <div className="space-y-6">
        <DiscoveryCreateCard title="Create New Filter">
          <div className="grid gap-4 max-w-2xl md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Тип (single / multi)</Label>
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="single"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Логика выбора значений фильтра.</p>
            </div>
            <div className="grid gap-2">
              <Label>UI (tabs / dropdown / …)</Label>
              <Input
                value={newUi}
                onChange={(e) => setNewUi(e.target.value)}
                placeholder="tabs"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Как отображается блок в интерфейсе.</p>
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
          <div className="text-sm text-gray-600">Loading...</div>
        ) : sorted.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет фильтров"
            description="Создайте первый фильтр — затем настройте опции на странице редактирования."
          />
        ) : (
          <DiscoveryTaxonomyTable>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh()}>Тип</th>
                <th className={discoveryTh()}>UI</th>
                <th className={discoveryTh("w-20")}>Порядок</th>
                <th className={discoveryTh("w-24")}>Используется</th>
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
                  <td className={cn(discoveryTd(), "font-medium text-gray-900")}>{f.title}</td>
                  <td className={cn(discoveryTd(), "font-mono text-xs text-gray-700")}>{f.slug}</td>
                  <td className={cn(discoveryTd(), "text-gray-600 font-mono text-xs")}>{f.type}</td>
                  <td className={cn(discoveryTd(), "text-gray-600 font-mono text-xs")}>{f.ui}</td>
                  <td className={discoveryTd("text-gray-600")}>{f.orderIndex}</td>
                  <td className={discoveryTd("text-gray-600")}>{f.options?.length ?? 0}</td>
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
