"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { H3, Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterOptionRow } from "../FilterOptionRow";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import {
  RETURN_TO_PARAM,
  sanitizeReturnTo,
  withSavedToastQuery,
} from "@/lib/backoffice/saveFlow";
import {
  FILTER_TYPE_VALUES,
  FILTER_TYPE_LABELS,
  FILTER_UI_LABELS,
  FILTER_PLACEMENT_VALUES,
  FILTER_PLACEMENT_LABELS,
  TYPE_UI_COMPATIBILITY,
  isCompatibleTypeUi,
  getCompatibleUis,
  type FilterType,
  type FilterUi,
  type FilterPlacement,
} from "@/lib/discovery/filterDefinitionTypes";

const adminFetch: RequestInit = { credentials: "include" };

const LIST_HREF = "/admin/discovery/filters";

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
  orderIndex: number;
  isActive: boolean;
};

type Filter = {
  id: string;
  slug: string;
  title: string;
  type: string;
  ui: string;
  order: number;
  orderIndex: number;
  placement: string;
  isActive: boolean;
  showTitle: boolean;
  options: Option[];
};

export default function EditFilterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const listHrefAfterSave = useMemo(
    () => sanitizeReturnTo(searchParams.get(RETURN_TO_PARAM), LIST_HREF),
    [searchParams],
  );

  const [filter, setFilter] = useState<Filter | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  /** Первый заход на страницу: полноэкранный лоадер. */
  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/filters/${id}`, adminFetch);
      if (res.status === 404) {
        setNotFound(true);
        setFilter(null);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
        setFilter(null);
        return;
      }
      const data = (await res.json()) as Filter;
      setFilter(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * После сохранения опции / reorder — только подтянуть данные с сервера.
   * Без loading=true, чтобы не размонтировать страницу и не сбрасывать скролл.
   */
  const refreshFilter = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/filters/${id}`, adminFetch);
      if (!res.ok) return;
      const data = (await res.json()) as Filter;
      setFilter(data);
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!filter || !confirm("Удалить фильтр?")) return;
    const res = await fetch(`/api/admin/filters/${filter.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Удалено");
      router.push(LIST_HREF);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-4">
        <p className="text-sm text-gray-600">Загрузка…</p>
      </div>
    );
  }

  if (notFound || !filter) {
    return (
      <div className="p-6 md:p-4 space-y-4">
        <p className="text-sm text-gray-700">Фильтр не найден.</p>
        <Button variant="outline" asChild>
          <Link href={LIST_HREF}>К списку фильтров</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-5xl">
      <div>
        <Link
          href={LIST_HREF}
          className="text-sm text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
        >
          ← К списку фильтров
        </Link>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900 mt-2">Редактирование фильтра</h1>
        <p className="text-sm text-gray-600 mt-1 font-mono break-all">{filter.slug}</p>
      </div>

      <FilterEditor
        key={filter.id}
        filter={filter}
        onRefresh={refreshFilter}
        onDelete={handleDelete}
        listHrefAfterSave={listHrefAfterSave}
      />
    </div>
  );
}

function FilterEditor({
  filter,
  onRefresh,
  onDelete,
  listHrefAfterSave,
}: {
  filter: Filter;
  /** Тихое обновление списка опций без полноэкранной загрузки */
  onRefresh: () => Promise<void>;
  onDelete: () => void;
  listHrefAfterSave: string;
}) {
  const router = useRouter();
  const titleSlug = useAutoSlug(filter.title, filter.slug, { mode: "edit" });
  const [type, setType] = useState<FilterType>(
    (filter.type as FilterType) || "single",
  );
  const [ui, setUi] = useState<FilterUi>(
    (filter.ui as FilterUi) || "chips",
  );
  const [orderIndex, setOrderIndex] = useState(filter.orderIndex);
  const [isActive, setIsActive] = useState(filter.isActive);
  const [showTitle, setShowTitle] = useState(filter.showTitle ?? true);
  const [placement, setPlacement] = useState<FilterPlacement>(
    (FILTER_PLACEMENT_VALUES.includes(filter.placement as FilterPlacement)
      ? filter.placement
      : "PRIMARY") as FilterPlacement,
  );

  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [savingMain, setSavingMain] = useState(false);

  const saveMainFields = async () => {
    if (savingMain) return;
    if (!isCompatibleTypeUi(type, ui)) {
      toast.error(
        `Несовместимая пара: type="${type}" не поддерживает ui="${ui}". ` +
          `Для type=${type} допустимы: ${getCompatibleUis(type).join(", ")}`,
      );
      return;
    }
    setSavingMain(true);
    try {
      const res = await fetch(`/api/admin/filters/${filter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleSlug.source,
          slug: titleSlug.slug,
          type,
          ui,
          isActive,
          showTitle,
          placement,
          orderIndex,
        }),
      });
      if (res.ok) {
        router.push(withSavedToastQuery(listHrefAfterSave));
      } else {
        toast.error("Не удалось сохранить");
      }
    } finally {
      setSavingMain(false);
    }
  };

  const createOption = async (filterId: string, label: string, value: string) => {
    const res = await fetch(`/api/admin/filters/${filterId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    if (res.ok) await onRefresh();
  };

  const updateOption = async (optionId: string, data: Partial<Option>) => {
    const res = await fetch(`/api/admin/filter-options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await onRefresh();
      return true;
    }
    toast.error("Не удалось сохранить опцию");
    return false;
  };

  const reorderOption = async (optionId: string, direction: "UP" | "DOWN") => {
    const res = await fetch("/api/admin/filters/options/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, direction }),
    });
    if (res.ok) await onRefresh();
    else toast.error("Не удалось изменить порядок");
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Удалить опцию?")) return;
    const res = await fetch(`/api/admin/filter-options/${optionId}`, {
      method: "DELETE",
    });
    if (res.ok) await onRefresh();
  };

  const handleSave = () => {
    void saveMainFields();
  };

  const handleAddOption = () => {
    if (!newOptLabel.trim() || !newOptValue.trim()) return;
    createOption(filter.id, newOptLabel.trim(), newOptValue.trim());
    setNewOptLabel("");
    setNewOptValue("");
  };

  const opts = [...filter.options].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold font-mono text-gray-600 break-all">
          {titleSlug.slug}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Название</Label>
            <Input
              value={titleSlug.source}
              onChange={(e) => titleSlug.setSource(e.target.value)}
            />
            <Label className="text-xs pt-1">Slug</Label>
            <Input
              className="font-mono text-sm"
              value={titleSlug.slug}
              onChange={(e) => titleSlug.setSlug(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Тип</Label>
            <Select
              value={type}
              onValueChange={(val) => {
                const t = val as FilterType;
                setType(t);
                // Auto-reset ui to a compatible value when type changes
                const compatible = TYPE_UI_COMPATIBILITY[t];
                if (compatible && !compatible.includes(ui)) {
                  setUi(compatible[0]);
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
            <Label>UI</Label>
            <Select
              value={ui}
              onValueChange={(val) => setUi(val as FilterUi)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_UI_COMPATIBILITY[type].map((u) => (
                  <SelectItem key={u} value={u}>
                    {FILTER_UI_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">
              Допустимо для {type}: {TYPE_UI_COMPATIBILITY[type].join(", ")}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Placement</Label>
            <Select
              value={placement}
              onValueChange={(val) => setPlacement(val as FilterPlacement)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_PLACEMENT_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {FILTER_PLACEMENT_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 w-20">
            <Label>Order</Label>
            <Input
              type="number"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-4 pb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={showTitle} onCheckedChange={(c) => setShowTitle(!!c)} />
              <Label>Показывать заголовок</Label>
            </div>
            <Button size="sm" onClick={handleSave} disabled={savingMain}>
              <Save className="w-4 h-4 mr-2" />
              {savingMain ? "Сохранение…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <H3>Options</H3>
          <div className="space-y-2">
            {opts.map((opt, index) => (
              <FilterOptionRow
                key={opt.id}
                option={opt}
                index={index}
                totalOptions={opts.length}
                onUpdate={updateOption}
                onReorder={reorderOption}
                onDelete={deleteOption}
              />
            ))}
          </div>

          <div className="flex gap-2 items-end pt-2 border-t">
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={newOptLabel}
                onChange={(e) => setNewOptLabel(e.target.value)}
                placeholder="Label"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Value</Label>
              <Input
                value={newOptValue}
                onChange={(e) => setNewOptValue(e.target.value)}
                placeholder="value"
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddOption}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
