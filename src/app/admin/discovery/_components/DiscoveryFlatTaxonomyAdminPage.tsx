"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Совпадает с Prisma `DiscoveryTaxonomyAxis`. */
export type DiscoveryTaxonomyAxisKey = "OCCASION" | "THEME" | "GENRE";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
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

export type FlatTaxonomyRow = {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

export function DiscoveryFlatTaxonomyAdminPage({
  axis,
  title,
  description,
  createCardTitle,
  listSegment,
}: {
  axis: DiscoveryTaxonomyAxisKey;
  title: string;
  description: string;
  createCardTitle: string;
  /** Сегмент URL: `occasions` → `/admin/discovery/occasions/[id]` */
  listSegment: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FlatTaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const auto = useAutoSlug("", "");

  const editHref = (id: string) => `/admin/discovery/${listSegment}/${id}`;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/discovery/taxonomy-entries?axis=${axis}`,
        adminFetch,
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } finally {
      setLoading(false);
    }
  }, [axis]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [rows],
  );

  const createRow = async () => {
    if (!auto.source.trim()) {
      toast.error("Укажите название");
      return;
    }
    const res = await fetch("/api/admin/discovery/taxonomy-entries", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        axis,
        title: auto.source,
        slug: auto.slug,
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

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader title={title} description={description} />

      <div className="space-y-6">
        <DiscoveryCreateCard title={createCardTitle}>
          <DiscoveryTitleSlugCreateRow
            titleLabel="Название"
            auto={auto}
            onCreate={createRow}
            titlePlaceholder="Название записи"
            slugPlaceholder="slug"
          />
        </DiscoveryCreateCard>

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : sorted.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет записей"
            description="Добавьте первую запись справочника с помощью формы выше."
          />
        ) : (
          <DiscoveryTaxonomyTable>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh()}>Родитель</th>
                <th className={discoveryTh("w-20")}>Порядок</th>
                <th className={discoveryTh("w-24")}>Используется</th>
                <th className="w-10 px-2 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  className={discoveryTableRowClass(false)}
                  onClick={() => router.push(editHref(r.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(editHref(r.id));
                    }
                  }}
                >
                  <td className={discoveryTd("font-medium text-gray-900")}>{r.title}</td>
                  <td className={discoveryTd("font-mono text-xs text-gray-700")}>{r.slug}</td>
                  <td className={discoveryTd("text-gray-400")}>—</td>
                  <td className={discoveryTd("text-gray-600")}>{r.sortOrder}</td>
                  <td className={discoveryTd("text-gray-600")}>0</td>
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
