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
import { ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import {
  DiscoveryTaxonomyTable,
  DiscoveryEmptyState,
  discoveryTh,
  discoveryTd,
} from "@/components/admin/discovery";

type Category = {
  id: string;
  nameRu: string;
  slug: string;
  sortOrder: number;
  _count: { filterPlacements: number };
};

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

type FilterDef = { id: string; slug: string; title: string };

const F: RequestInit = { credentials: "include" };

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, Placement[]>>({});
  const [loadingPlacements, setLoadingPlacements] = useState<Record<string, boolean>>({});
  const [allFilters, setAllFilters] = useState<FilterDef[]>([]);
  const [addFilterId, setAddFilterId] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoadingCats(true);
    fetch("/api/admin/discovery/filter-placements/categories", F)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCats(false));

    fetch("/api/admin/filters", F)
      .then((r) => r.json())
      .then(setAllFilters)
      .catch(() => {});
  }, []);

  const fetchCategoryPlacements = useCallback(async (categoryId: string) => {
    setLoadingPlacements((p) => ({ ...p, [categoryId]: true }));
    try {
      const res = await fetch(
        `/api/admin/discovery/filter-placements?categoryId=${categoryId}`,
        F
      );
      if (res.ok) {
        const data = await res.json();
        setPlacements((p) => ({ ...p, [categoryId]: data }));
      }
    } finally {
      setLoadingPlacements((p) => ({ ...p, [categoryId]: false }));
    }
  }, []);

  const toggle = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!placements[id]) fetchCategoryPlacements(id);
    }
  };

  const toggleActive = async (placementId: string, isActive: boolean, categoryId: string) => {
    await fetch(`/api/admin/discovery/filter-placements/${placementId}`, {
      ...F,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    await fetchCategoryPlacements(categoryId);
  };

  const remove = async (placementId: string, categoryId: string) => {
    if (!confirm("Убрать фильтр из категории?")) return;
    await fetch(`/api/admin/discovery/filter-placements/${placementId}`, {
      ...F,
      method: "DELETE",
    });
    await fetchCategoryPlacements(categoryId);
    setCategories((cats) =>
      cats.map((c) =>
        c.id === categoryId
          ? { ...c, _count: { filterPlacements: Math.max(0, c._count.filterPlacements - 1) } }
          : c
      )
    );
    toast.success("Фильтр убран");
  };

  const add = async (categoryId: string) => {
    const filterId = addFilterId[categoryId];
    if (!filterId) return;
    setAdding((a) => ({ ...a, [categoryId]: true }));
    try {
      const catPlacements = placements[categoryId] ?? [];
      const res = await fetch("/api/admin/discovery/filter-placements", {
        ...F,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterId,
          categoryId,
          sortOrder: catPlacements.length,
        }),
      });
      if (res.ok) {
        setAddFilterId((a) => ({ ...a, [categoryId]: "" }));
        await fetchCategoryPlacements(categoryId);
        setCategories((cats) =>
          cats.map((c) =>
            c.id === categoryId
              ? { ...c, _count: { filterPlacements: c._count.filterPlacements + 1 } }
              : c
          )
        );
        toast.success("Фильтр добавлен");
      } else {
        toast.error("Не удалось добавить");
      }
    } finally {
      setAdding((a) => ({ ...a, [categoryId]: false }));
    }
  };

  if (loadingCats) {
    return <p className="text-sm text-gray-400 py-6">Загрузка категорий...</p>;
  }

  if (categories.length === 0) {
    return (
      <DiscoveryEmptyState
        title="Нет категорий"
        description="Категории событий не найдены."
      />
    );
  }

  return (
    <div className="space-y-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {categories.map((cat, idx) => {
        const isOpen = expanded === cat.id;
        const catPlacements = placements[cat.id] ?? [];
        const isLoading = loadingPlacements[cat.id] ?? false;
        const available = allFilters.filter(
          (f) => !catPlacements.some((p) => p.filter.id === f.id)
        );

        return (
          <div
            key={cat.id}
            className={cn(idx > 0 && "border-t border-gray-100")}
          >
            {/* Category row */}
            <button
              onClick={() => toggle(cat.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-gray-400 shrink-0">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <span className="font-medium text-gray-900 flex-1">{cat.nameRu}</span>
              <span className="font-mono text-xs text-gray-400 mr-3">{cat.slug}</span>
              {cat._count.filterPlacements > 0 ? (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                  {cat._count.filterPlacements} фильтров
                </span>
              ) : (
                <span className="text-xs text-gray-300">нет фильтров</span>
              )}
            </button>

            {/* Expanded panel */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-slate-50/60 px-6 py-4 space-y-4">
                {isLoading ? (
                  <p className="text-sm text-gray-400">Загрузка...</p>
                ) : catPlacements.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    Нет дополнительных фильтров для этой категории.
                  </p>
                ) : (
                  <DiscoveryTaxonomyTable scrollLabel="Таблица категорий фильтров, прокручивается по горизонтали">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className={discoveryTh("w-12")}>#</th>
                        <th className={discoveryTh()}>Название</th>
                        <th className={discoveryTh()}>Slug</th>
                        <th className={discoveryTh("w-24")}>Тип</th>
                        <th className={discoveryTh("w-20")}>Активен</th>
                        <th className="w-10 px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[...catPlacements]
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
                            <td className={discoveryTd()}>
                              <button
                                onClick={() =>
                                  toggleActive(p.id, p.isActive, cat.id)
                                }
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
                                onClick={() => remove(p.id, cat.id)}
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

                {/* Add filter for category */}
                {available.length > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <Select
                      value={addFilterId[cat.id] ?? ""}
                      onValueChange={(v) =>
                        setAddFilterId((a) => ({ ...a, [cat.id]: v }))
                      }
                    >
                      <SelectTrigger className="w-60 h-8 text-sm bg-white">
                        <SelectValue placeholder="Добавить фильтр..." />
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => add(cat.id)}
                      disabled={!addFilterId[cat.id] || adding[cat.id]}
                    >
                      Добавить
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
