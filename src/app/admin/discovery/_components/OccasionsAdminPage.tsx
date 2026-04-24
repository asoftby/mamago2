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
import type { OccasionType } from "@prisma/client";
import { occasionTypeLabel } from "@/lib/taxonomy/occasionTypeLabels";

const adminFetch: RequestInit = { credentials: "include" };

const OCCASION_TYPES: OccasionType[] = ["HOLIDAY", "SEASON", "EVENT", "FAMILY"];

type OccasionRow = {
  id: string;
  name: string;
  slug: string;
  type: OccasionType;
  sortOrder: number;
  isActive: boolean;
};

const listHref = "/admin/discovery/occasions";

function parseTypeParam(raw: string | null): OccasionType | null {
  if (raw == null || raw === "" || raw === "all") return null;
  const u = raw.toUpperCase();
  if (u === "HOLIDAY" || u === "SEASON" || u === "EVENT" || u === "FAMILY") {
    return u as OccasionType;
  }
  return null;
}

export function OccasionsAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useBackofficeSavedToast("Повод сохранён");
  const rawType = searchParams.get("type");
  const activeType = parseTypeParam(rawType);
  const invalidTypeParam =
    rawType != null && rawType !== "" && rawType !== "all" && activeType === null;

  const [rows, setRows] = useState<OccasionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const auto = useAutoSlug("", "");

  const setTab = (type: OccasionType | null) => {
    if (type == null) {
      router.replace(listHref);
    } else {
      router.replace(`${listHref}?type=${encodeURIComponent(type)}`);
    }
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/occasions", adminFetch);
      if (res.ok) {
        const data = (await res.json()) as OccasionRow[];
        setRows(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } catch {
      toast.error("Не удалось загрузить поводы. Проверьте сеть и обновите страницу.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (invalidTypeParam) {
      router.replace(listHref);
    }
  }, [invalidTypeParam, router]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    if (activeType == null) return sorted;
    return sorted.filter((r) => r.type === activeType);
  }, [sorted, activeType]);

  const createRow = async () => {
    if (activeType == null) {
      toast.error("Выберите тип повода в табах сверху");
      return;
    }
    if (!auto.source.trim()) {
      toast.error("Укажите название");
      return;
    }
    const res = await fetch("/api/admin/occasions", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: auto.source,
        slug: auto.slug,
        type: activeType,
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

  const goToEdit = (r: OccasionRow) => {
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const p = new URLSearchParams();
    p.set("type", r.type);
    p.set(RETURN_TO_PARAM, returnTo);
    router.push(`/admin/discovery/occasions/${r.id}?${p.toString()}`);
  };

  const showTypeColumn = activeType == null;

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Occasions"
        description="Плоский справочник поводов. Выберите тип в табах, чтобы отфильтровать список и создать запись."
      />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Тип повода">
          <Button
            type="button"
            role="tab"
            aria-selected={activeType == null}
            variant={activeType == null ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setTab(null)}
          >
            Все
          </Button>
          {OCCASION_TYPES.map((t) => {
            const selected = activeType === t;
            return (
              <Button
                key={t}
                type="button"
                role="tab"
                aria-selected={selected}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setTab(t)}
              >
                {occasionTypeLabel(t)}
              </Button>
            );
          })}
        </div>

        {activeType == null ? (
          <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Чтобы создать повод, выберите тип в табах выше (не режим «Все»).
          </div>
        ) : (
          <DiscoveryCreateCard
            title={`Новый повод — ${occasionTypeLabel(activeType)}`}
          >
            <DiscoveryTitleSlugCreateRow
              auto={auto}
              onCreate={createRow}
              titlePlaceholder="Название записи"
              slugPlaceholder="slug"
            />
          </DiscoveryCreateCard>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <DiscoveryEmptyState
            title={activeType ? "Нет записей этого типа" : "Пока нет записей"}
            description={
              activeType
                ? "Создайте запись формой выше или переключите таб."
                : "Добавьте поводы, выбрав тип в табах."
            }
          />
        ) : (
          <DiscoveryTaxonomyTable>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                {showTypeColumn ? <th className={discoveryTh()}>Type</th> : null}
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
                  {showTypeColumn ? (
                    <td className={discoveryTd("text-gray-700")}>{occasionTypeLabel(r.type)}</td>
                  ) : null}
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
