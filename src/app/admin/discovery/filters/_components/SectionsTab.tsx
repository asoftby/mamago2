"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Trash2 } from "lucide-react";
import {
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  discoveryTh,
  discoveryTd,
} from "@/components/admin/discovery";
import type { Intent } from "@/lib/intent";

type IntentConfig = { key: Intent; label: string };

const INTENTS: IntentConfig[] = [
  { key: "kuda", label: "Куда пойти" },
  { key: "classes", label: "Занятия" },
  { key: "birthday", label: "Праздник" },
  { key: "routes", label: "Маршруты" },
];

type Placement = {
  id: string;
  sortOrder: number;
  isActive: boolean;
  filter: {
    id: string;
    slug: string;
    title: string;
    type: string;
    ui: string;
    optionsCount: number;
  };
};

type FilterDef = {
  id: string;
  slug: string;
  title: string;
};

const F: RequestInit = { credentials: "include" };

// ─── System filters block ───────────────────────────────────────────────────

type SystemFilterRow = {
  id: string | null;
  sectionKey: string;
  type: string;
  enabled: boolean;
};

const SYSTEM_FILTER_META: Record<string, { label: string; description: string }> = {
  BUDGET: {
    label: "Бюджет",
    description:
      "Слайдер строится автоматически по максимальной цене опубликованных предложений в разделе.",
  },
  FREE_ONLY: {
    label: "Только бесплатно",
    description: "Фильтр-переключатель для отображения только бесплатных предложений.",
  },
};

function SystemFiltersBlock({ intent }: { intent: Intent }) {
  const [rows, setRows] = useState<SystemFilterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const prevIntent = useRef<Intent | null>(null);

  const fetchSystemFilters = useCallback(async (sectionKey: Intent) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/discovery/system-filters?section=${sectionKey}`,
        F
      );
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prevIntent.current !== intent) {
      prevIntent.current = intent;
      fetchSystemFilters(intent);
    }
  }, [intent, fetchSystemFilters]);

  // also fetch on first mount
  useEffect(() => {
    fetchSystemFilters(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (type: string, currentEnabled: boolean) => {
    setSaving((s) => ({ ...s, [type]: true }));
    try {
      const res = await fetch("/api/admin/discovery/system-filters", {
        ...F,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey: intent, type, enabled: !currentEnabled }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.type === type ? { ...r, enabled: !currentEnabled } : r))
        );
      } else {
        toast.error("Не удалось сохранить");
      }
    } finally {
      setSaving((s) => ({ ...s, [type]: false }));
    }
  };

  if (loading) return <p className="text-sm text-gray-400 py-2">Загрузка...</p>;

  return (
    <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        Системные фильтры
      </p>
      <div className="space-y-3">
        {rows.map((row) => {
          const meta = SYSTEM_FILTER_META[row.type];
          if (!meta) return null;
          return (
            <div key={row.type} className="flex items-start gap-4">
              <button
                onClick={() => toggle(row.type, row.enabled)}
                disabled={saving[row.type]}
                className={cn(
                  "mt-0.5 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  row.enabled ? "bg-gray-900" : "bg-gray-300",
                  "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                )}
                role="switch"
                aria-checked={row.enabled}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                    row.enabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SectionsTab() {
  const [intent, setIntent] = useState<Intent>("kuda");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [allFilters, setAllFilters] = useState<FilterDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [addFilterId, setAddFilterId] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchPlacements = useCallback(async (intentKey: Intent) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/discovery/filter-placements?intent=${intentKey}`,
        F
      );
      if (res.ok) setPlacements(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlacements(intent);
  }, [intent, fetchPlacements]);

  useEffect(() => {
    fetch("/api/admin/filters", F)
      .then((r) => r.json())
      .then(setAllFilters)
      .catch(() => {});
  }, []);

  const available = allFilters.filter(
    (f) => !placements.some((p) => p.filter.id === f.id)
  );

  const add = async () => {
    if (!addFilterId) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/discovery/filter-placements", {
        ...F,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterId: addFilterId,
          intent,
          sortOrder: placements.length,
        }),
      });
      if (res.ok) {
        setAddFilterId("");
        await fetchPlacements(intent);
        toast.success("Фильтр добавлен");
      } else {
        toast.error("Не удалось добавить");
      }
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/discovery/filter-placements/${id}`, {
      ...F,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await fetchPlacements(intent);
  };

  const remove = async (id: string) => {
    if (!confirm("Убрать фильтр из раздела?")) return;
    await fetch(`/api/admin/discovery/filter-placements/${id}`, {
      ...F,
      method: "DELETE",
    });
    await fetchPlacements(intent);
    toast.success("Фильтр убран");
  };

  const currentLabel = INTENTS.find((i) => i.key === intent)?.label ?? intent;

  return (
    <div className="space-y-5">
      {/* Intent selector */}
      <div className="flex gap-2 flex-wrap">
        {INTENTS.map((cfg) => (
          <button
            key={cfg.key}
            onClick={() => setIntent(cfg.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              intent === cfg.key
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* System filters */}
      <SystemFiltersBlock intent={intent} />

      {/* Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Фильтры раздела:{" "}
            <span className="font-normal text-gray-600">{currentLabel}</span>
          </h3>
          <span className="text-xs text-gray-400">{placements.length} шт.</span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4">Загрузка...</p>
        ) : placements.length === 0 ? (
          <DiscoveryEmptyState
            title="Нет фильтров"
            description="Добавьте фильтры из справочника ниже."
          />
        ) : (
          <DiscoveryTaxonomyTable>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh("w-12")}>#</th>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh("w-24")}>Тип</th>
                <th className={discoveryTh("w-24")}>UI</th>
                <th className={discoveryTh("w-20")}>Опций</th>
                <th className={discoveryTh("w-20")}>Активен</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...placements]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((p) => (
                  <tr
                    key={p.id}
                    className="bg-white hover:bg-slate-50 transition-colors"
                  >
                    <td className={cn(discoveryTd(), "text-gray-400 text-xs tabular-nums")}>
                      {p.sortOrder}
                    </td>
                    <td className={cn(discoveryTd(), "font-medium text-gray-900")}>
                      {p.filter.title}
                    </td>
                    <td className={cn(discoveryTd(), "font-mono text-xs text-gray-600")}>
                      {p.filter.slug}
                    </td>
                    <td className={cn(discoveryTd(), "font-mono text-xs text-gray-600")}>
                      {p.filter.type}
                    </td>
                    <td className={cn(discoveryTd(), "font-mono text-xs text-gray-600")}>
                      {p.filter.ui}
                    </td>
                    <td className={cn(discoveryTd(), "text-gray-500 text-xs")}>
                      {p.filter.optionsCount}
                    </td>
                    <td className={discoveryTd()}>
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium transition-colors",
                          p.isActive
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {p.isActive ? "Да" : "Нет"}
                      </button>
                    </td>
                    <td className={discoveryTd()}>
                      <button
                        onClick={() => remove(p.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label="Убрать"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </DiscoveryTaxonomyTable>
        )}
      </div>

      {/* Add filter */}
      {available.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <span className="text-sm text-gray-500 shrink-0">Добавить фильтр:</span>
          <Select value={addFilterId} onValueChange={setAddFilterId}>
            <SelectTrigger className="w-64 h-8 text-sm">
              <SelectValue placeholder="Выбрать из справочника..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
                  <span className="ml-2 text-gray-400 font-mono text-xs">
                    {f.slug}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={!addFilterId || adding}>
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
