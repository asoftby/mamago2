"use client";

import { useEffect, useState, useCallback } from "react";
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
