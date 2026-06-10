"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { orderSignalDefinitionsForDisplay } from "@/lib/taxonomy/signalHierarchy";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { SignalDomain, SignalEntityType, SignalStatus, SignalUsageType } from "@prisma/client";
import { SIGNAL_USAGE_TYPE_LABELS } from "@/lib/signals/signalUsageType";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  domain: SignalDomain | null;
  entityTypes: SignalEntityType[];
  status: SignalStatus;
  replacedById: string | null;
  replacedBy: { id: string; title: string; slug: string } | null;
  usageType: SignalUsageType | null;
  _count: { children: number; options: number };
};

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const newSignal = useAutoSlug("", "");

  const fetchSignals = async (tab: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("includeDeprecated", "true"); // Show all signals in admin
      if (tab === "plan") {
        params.set("planOnboarding", "true");
      } else if (tab !== "all") {
        params.set("domain", tab);
      }
      
      const res = await fetch(`/api/admin/signals?${params.toString()}`, adminFetch);
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
    fetchSignals(activeTab);
  }, [activeTab]);

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
      fetchSignals(activeTab);
      toast.success("Сигнал создан");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const goToEdit = (slug: string) => {
    router.push(EDIT_SIGNAL_HREF(slug));
  };

  const formatEntityTypes = (entityTypes: SignalEntityType[]) => {
    if (entityTypes.length === 0) return "—";
    return entityTypes.join(", ");
  };

  const formatDomain = (domain: SignalDomain | null) => {
    if (!domain) return "—";
    const labels = {
      [SignalDomain.PROFILE]: "Профиль",
      [SignalDomain.DISCOVERY]: "Подборка",
      [SignalDomain.RECOMMENDATION]: "Рекомендации",
    };
    return labels[domain] || domain;
  };

  const getStatusBadge = (status: SignalStatus, replacedBy?: { title: string; slug: string } | null) => {
    if (status === SignalStatus.DEPRECATED) {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">
            DEPRECATED
          </Badge>
          {replacedBy && (
            <span className="text-xs text-gray-500">
              → {replacedBy.title}
            </span>
          )}
        </div>
      );
    }
    return (
      <Badge variant="default" className="text-xs bg-green-100 text-green-800">
        ACTIVE
      </Badge>
    );
  };

  const formatUsageType = (usageType: SignalUsageType | null) => {
    if (!usageType) return "—";
    return SIGNAL_USAGE_TYPE_LABELS[usageType] ?? usageType;
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Сигналы"
        description="Сигналы помогают описывать интересы, формат, возраст, темп и другие признаки для подбора событий и рекомендаций. Сначала создаётся группа, затем значения внутри неё. Откройте строку, чтобы настроить параметры."
      />

      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Все сигналы</TabsTrigger>
            <TabsTrigger value={SignalDomain.PROFILE}>Профиль</TabsTrigger>
            <TabsTrigger value={SignalDomain.DISCOVERY}>Подборка</TabsTrigger>
            <TabsTrigger value={SignalDomain.RECOMMENDATION}>Рекомендации</TabsTrigger>
            <TabsTrigger value="plan">Онбординг плана</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
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
                    <th className={discoveryTh()}>Domain</th>
                    <th className={discoveryTh()}>Usage</th>
                    <th className={discoveryTh()}>Entity Types</th>
                    <th className={discoveryTh()}>Status</th>
                    <th className={discoveryTh()}>Родитель</th>
                    <th className={discoveryTh("w-20")}>Порядок</th>
                    <th className={discoveryTh("w-24")}>Используется</th>
                    <th className="w-10 px-2 py-3" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ordered.map((s) => {
                    const isDeprecated = s.status === SignalStatus.DEPRECATED;
                    return (
                      <tr
                        key={s.id}
                        role="link"
                        tabIndex={isDeprecated ? -1 : 0}
                        className={cn(
                          discoveryTableRowClass(!!s.parentId),
                          isDeprecated && "opacity-60 cursor-not-allowed bg-gray-50"
                        )}
                        onClick={() => !isDeprecated && goToEdit(s.slug)}
                        onKeyDown={(e) => {
                          if (!isDeprecated && (e.key === "Enter" || e.key === " ")) {
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
                              isDeprecated && "text-gray-500"
                            )}
                          >
                            {s.parentId ? (
                              <span className="text-blue-500 text-xs font-mono" aria-hidden>
                                └
                              </span>
                            ) : null}
                            <span className={cn("font-medium", isDeprecated ? "text-gray-500" : "text-gray-900")}>
                              {s.title}
                            </span>
                          </span>
                        </td>
                        <td className={cn(discoveryTd(), "font-mono text-xs", isDeprecated ? "text-gray-500" : "text-gray-700")}>
                          {s.slug}
                        </td>
                        <td className={discoveryTd("text-gray-600")}>
                          {formatDomain(s.domain)}
                        </td>
                        <td className={discoveryTd("text-gray-600")}>
                          <span className="text-xs">{formatUsageType(s.usageType)}</span>
                        </td>
                        <td className={discoveryTd("text-gray-600")}>
                          <span className="text-xs">{formatEntityTypes(s.entityTypes)}</span>
                        </td>
                        <td className={discoveryTd()}>
                          {getStatusBadge(s.status, s.replacedBy)}
                        </td>
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
                    );
                  })}
                </tbody>
              </DiscoveryTaxonomyTable>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DiscoveryTaxonomyPageShell>
  );
}
