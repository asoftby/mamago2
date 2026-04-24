"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { orderSignalDefinitionsForDisplay } from "@/lib/taxonomy/signalHierarchy";
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

const EDIT_SIGNAL_HREF = (slug: string) => `/admin/taxonomy/signals/${slug}`;

type SignalRow = {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  parent: { id: string; title: string; slug: string } | null;
  order: number;
  _count: { children: number; options: number };
};

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const newSignal = useAutoSlug("", "");

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/signals", adminFetch);
      if (res.ok) {
        const data = await res.json();
        setSignals(data);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const roots = useMemo(
    () => signals.filter((s) => s.parentId == null),
    [signals],
  );

  const ordered = useMemo(
    () => orderSignalDefinitionsForDisplay(signals),
    [signals],
  );

  const parentRootOptions = useMemo(
    () => roots.map((r) => ({ id: r.id, label: r.title })),
    [roots],
  );

  const createSignal = async () => {
    if (!newSignal.source.trim()) {
      toast.error("Укажите Title");
      return;
    }
    const res = await fetch("/api/admin/signals", {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newSignal.slug,
        title: newSignal.source,
        parentId: createParentId,
      }),
    });
    if (res.ok) {
      newSignal.hydrate("", "");
      fetchSignals();
      toast.success("Сигнал создан");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const goToEdit = (slug: string) => {
    router.push(EDIT_SIGNAL_HREF(slug));
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Taxonomy: Signals"
        description="Два уровня: группа сигнала (Energy, Format, …) и значения внутри группы на странице редактирования. Под-сигнал можно создать только у корня. Откройте строку для настройки и опций."
      />

      <div className="space-y-6">
        <DiscoveryCreateCard title="Create New Signal">
          <DiscoveryParentSelector
            label="Родительский сигнал"
            helperText="Не выбрано — корневая группа; выбран корень — создаётся под-сигнал."
            value={createParentId}
            onChange={setCreateParentId}
            roots={parentRootOptions}
            emptyLabel="— Корневой сигнал —"
          />
          <DiscoveryTitleSlugCreateRow
            titleLabel="Title"
            auto={newSignal}
            onCreate={createSignal}
            titlePlaceholder="Например: Energy"
            slugPlaceholder="energy"
          />
        </DiscoveryCreateCard>

        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : ordered.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет сигналов"
            description="Создайте корневую группу сигнала или под-сигнал с помощью формы выше."
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
              {ordered.map((s) => (
                <tr
                  key={s.id}
                  role="link"
                  tabIndex={0}
                  className={discoveryTableRowClass(!!s.parentId)}
                  onClick={() => goToEdit(s.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToEdit(s.slug);
                    }
                  }}
                >
                  <td className={discoveryTd()}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2",
                        s.parentId && "pl-6 border-l-2 border-blue-300 ml-1",
                      )}
                    >
                      {s.parentId ? (
                        <span className="text-blue-500 text-xs font-mono" aria-hidden>
                          └
                        </span>
                      ) : null}
                      <span className="font-medium text-gray-900">{s.title}</span>
                    </span>
                  </td>
                  <td className={cn(discoveryTd(), "font-mono text-xs text-gray-700")}>{s.slug}</td>
                  <td className={discoveryTd("text-gray-600")}>
                    {s.parent ? (
                      <span>{s.parent.title}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className={discoveryTd("text-gray-600")}>{s.order}</td>
                  <td className={discoveryTd("text-gray-600")}>{s._count.options}</td>
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
