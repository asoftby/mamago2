"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";
import type { EventCategoryPublicationType } from "@prisma/client";
import {
  EVENT_CATEGORY_TYPE_TAB_LABELS,
} from "@/lib/taxonomy/eventCategoryPublicationType";
import { FilterSelect } from "@/components/ui/filter-select";
import { ConfirmDestructiveActionDialog } from "@/components/ui/confirm-destructive-action-dialog";
import { dispatchEventCategoryHardDeleted } from "@/lib/taxonomy/eventCategoryHardDeleteSync";
import { startUndoableHardDelete } from "@/lib/undo/undoableHardDelete";
import {
  RETURN_TO_PARAM,
  sanitizeReturnTo,
  withSavedToastQuery,
} from "@/lib/backoffice/saveFlow";

const adminFetch: RequestInit = { credentials: "include" };

function listHrefFromSearch(searchParams: URLSearchParams) {
  const t = searchParams.get("type");
  if (!t || !/^(EVENT|PLACE|OFFER|ROUTE|ARTICLE)$/i.test(t)) {
    return "/admin/taxonomy/categories";
  }
  return `/admin/taxonomy/categories?type=${encodeURIComponent(t.toUpperCase())}`;
}

function messageFromApiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    const inner = o.error;
    if (inner && typeof inner === "object") {
      const m = (inner as Record<string, unknown>).message;
      if (typeof m === "string") return m;
    }
  }
  return status ? `Ошибка ${status}` : "Не удалось сохранить";
}

type EventCategoryOptionRow = {
  id: string;
  label: string;
  value: string;
  order: number;
  isActive: boolean;
};

type EventCategory = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn?: string;
  type: EventCategoryPublicationType;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  supportsProgram: boolean;
  selectableInProgram: boolean;
  parentId: string | null;
  parent: { id: string; nameRu: string; slug: string; type?: EventCategoryPublicationType } | null;
  options: EventCategoryOptionRow[];
  _count: { activities: number; children: number };
};

export default function EditEventCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const listHref = listHrefFromSearch(searchParams);
  const listHrefAfterSave = useMemo(
    () => sanitizeReturnTo(searchParams.get(RETURN_TO_PARAM), listHref),
    [searchParams, listHref],
  );
  const id = params.id as string;

  const [category, setCategory] = useState<EventCategory | null>(null);
  const [roots, setRoots] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [resCat, resAll] = await Promise.all([
        fetch(`/api/admin/taxonomy/event-categories/${id}`, adminFetch),
        fetch("/api/admin/taxonomy/event-categories", adminFetch),
      ]);
      if (resCat.status === 404) {
        setNotFound(true);
        setCategory(null);
        return;
      }
      if (!resCat.ok) {
        const err = await resCat.json().catch(() => ({}));
        toast.error(messageFromApiError(err, resCat.status));
        setCategory(null);
        return;
      }
      if (!resAll.ok) {
        const err = await resAll.json().catch(() => ({}));
        toast.error(messageFromApiError(err, resAll.status));
        return;
      }
      const cat = (await resCat.json()) as EventCategory;
      const all = (await resAll.json()) as EventCategory[];
      setCategory(cat);
      setRoots(all.filter((c) => c.parentId == null && c.type === cat.type));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Tabs / type context are the single source of truth:
  // if user opened edit page with wrong/missing ?type=..., sync it to category.type.
  useEffect(() => {
    if (!category) return;
    const currentType = searchParams.get("type")?.toUpperCase() ?? "";
    if (currentType !== category.type) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("type", category.type);
      router.replace(`/admin/taxonomy/event-categories/${category.id}?${next.toString()}`);
    }
  }, [category, router, searchParams]);

  const handleDelete = async () => {
    if (!category) return;
    setDeleteLoading(true);
    setDeleteDialogOpen(false);
    startUndoableHardDelete({
      key: `eventCategory:${category.id}`,
      toastText: "Категория удалена",
      onOptimisticRemove: () => {
        router.push(listHref);
      },
      onUndoRestore: () => {
        // Best-effort: return to edit page if user stays in admin.
        router.push(`/admin/taxonomy/event-categories/${category.id}?type=${encodeURIComponent(category.type)}`);
      },
      commitDelete: async () => {
        const res = await fetch(`/api/admin/taxonomy/event-categories/${category.id}`, {
          ...adminFetch,
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(messageFromApiError(err, res.status));
        }
      },
      onCommitSuccess: () => {
        dispatchEventCategoryHardDeleted(category.id);
        router.refresh();
      },
      onCommitError: (e) => {
        const msg = e instanceof Error ? e.message : "Не удалось удалить";
        toast.error(msg);
      },
    });
    setDeleteLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 md:p-4">
        <p className="text-sm text-gray-600">Загрузка…</p>
      </div>
    );
  }

  if (notFound || !category) {
    return (
      <div className="p-6 md:p-4 space-y-4">
        <p className="text-sm text-gray-700">Категория не найдена.</p>
        <Button variant="outline" asChild>
          <Link href={listHref}>К списку категорий</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-4xl">
      <ConfirmDestructiveActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Удалить категорию?"
        description={
          category
            ? `Вы уверены, что хотите удалить «${category.nameRu}»?`
            : undefined
        }
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={listHref}
            className="text-sm text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
          >
            ← К списку категорий
          </Link>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900 mt-2">Редактирование категории</h1>
          <p className="text-sm text-gray-600 mt-1 font-mono break-all">{category.slug}</p>
        </div>
      </div>

      <EventCategoryEditor
        key={category.id}
        category={category}
        roots={roots}
        onReload={load}
        onDelete={handleDelete}
        listHrefAfterSave={listHrefAfterSave}
      />
    </div>
  );
}

function EventCategoryEditor({
  category,
  roots,
  onReload,
  onDelete,
  listHrefAfterSave,
}: {
  category: EventCategory;
  roots: EventCategory[];
  onReload: () => Promise<void>;
  onDelete: () => void;
  listHrefAfterSave: string;
}) {
  const router = useRouter();
  const nameSlug = useAutoSlug(category.nameRu, category.slug, { mode: "edit" });
  const { hydrate: hydrateSlugFromServer } = nameSlug;

  const [icon, setIcon] = useState(category.icon ?? "");
  const [order, setOrder] = useState(category.sortOrder);
  const [isActive, setIsActive] = useState(category.isActive);
  const [isFeatured, setIsFeatured] = useState(category.isFeatured);
  const [supportsProgram, setSupportsProgram] = useState(category.supportsProgram);
  const [selectableInProgram, setSelectableInProgram] = useState(category.selectableInProgram);
  const [parentId, setParentId] = useState<string | null>(category.parentId);

  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [isValueEditedManually, setIsValueEditedManually] = useState(false);
  const [savingMain, setSavingMain] = useState(false);

  useEffect(() => {
    hydrateSlugFromServer(category.nameRu, category.slug);
    setIcon(category.icon ?? "");
    setOrder(category.sortOrder);
    setIsActive(category.isActive);
    setIsFeatured(category.isFeatured);
    setSupportsProgram(category.supportsProgram);
    setSelectableInProgram(category.selectableInProgram);
    setParentId(category.parentId);
  }, [
    category.id,
    category.nameRu,
    category.slug,
    category.icon,
    category.sortOrder,
    category.isActive,
    category.isFeatured,
    category.supportsProgram,
    category.selectableInProgram,
    category.parentId,
    hydrateSlugFromServer,
  ]);

  const hasChildren = category._count.children > 0;

  const handleSave = async () => {
    if (savingMain) return;
    const body: Record<string, unknown> = {
      nameRu: nameSlug.source,
      slug: nameSlug.slug,
      icon: icon.trim() || null,
      sortOrder: order,
      isActive,
      isFeatured,
      supportsProgram,
      selectableInProgram,
    };
    if (parentId !== category.parentId) {
      body.parentId = parentId;
    }
    setSavingMain(true);
    try {
      const res = await fetch(`/api/admin/taxonomy/event-categories/${category.id}`, {
        ...adminFetch,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push(withSavedToastQuery(listHrefAfterSave));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } finally {
      setSavingMain(false);
    }
  };

  const moveCategory = async (mode: "moveUp" | "moveDown") => {
    const res = await fetch(`/api/admin/taxonomy/event-categories/${category.id}`, {
      ...adminFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) await onReload();
    else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const createOption = async (label: string, value: string) => {
    const res = await fetch(`/api/admin/taxonomy/event-categories/${category.id}/options`, {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    if (res.ok) {
      await onReload();
      toast.success("Опция добавлена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const updateOption = async (optionId: string, data: Partial<EventCategoryOptionRow>) => {
    const res = await fetch(`/api/admin/taxonomy/event-category-options/${optionId}`, {
      ...adminFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await onReload();
      toast.success("Опция сохранена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Удалить опцию?")) return;
    const res = await fetch(`/api/admin/taxonomy/event-category-options/${optionId}`, {
      ...adminFetch,
      method: "DELETE",
    });
    if (res.ok) {
      await onReload();
      toast.success("Опция удалена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const handleAddOption = () => {
    const label = newOptLabel.trim();
    const value = newOptValue.trim();
    if (!label) return;
    const finalValue = value || slugifyLabelToValue(label);
    if (!finalValue) return;
    createOption(label, finalValue);
    setNewOptLabel("");
    setNewOptValue("");
    setIsValueEditedManually(false);
  };

  const options = category.options ?? [];

  const parentSelect = hasChildren ? (
    <div className="grid gap-1 max-w-md">
      <Label className="text-xs">Родительская категория</Label>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Есть подкатегории — нельзя сделать эту запись подкатегорией. Сначала удалите или перенесите дочерние
        категории.
      </p>
      <Input readOnly value="Корневая" className="h-9 text-sm bg-gray-50" />
    </div>
  ) : (
    <div className="grid gap-1 max-w-md">
      <Label className="text-xs">Родительская категория</Label>
      <FilterSelect
        value={parentId ?? ""}
        placeholder="— Корневая категория —"
        options={roots
          .filter((r) => r.type === category.type)
          .filter((r) => r.id !== category.id)
          .map((r) => ({ value: r.id, label: r.nameRu }))}
        onChange={(v) => setParentId(v || null)}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-base font-semibold font-mono text-gray-600 break-all">
          {nameSlug.slug}
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveCategory("moveUp")}
            title="Порядок среди соседей (вверх)"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveCategory("moveDown")}
            title="Порядок среди соседей (вниз)"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {parentSelect}

        <div className="grid gap-1 max-w-md">
          <Label className="text-xs">Тип публикации</Label>
          <p className="text-sm text-gray-800">
            {EVENT_CATEGORY_TYPE_TAB_LABELS[category.type]}
            <span className="text-xs text-gray-500 ml-2">(задаётся верхним табом; в форме не меняется)</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Название (RU)</Label>
            <Input value={nameSlug.source} onChange={(e) => nameSlug.setSource(e.target.value)} />
            <Label className="text-xs pt-1">Slug</Label>
            <Input
              className="font-mono text-sm"
              value={nameSlug.slug}
              onChange={(e) => nameSlug.setSlug(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Order</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </div>
          <div className="flex items-center gap-4 pb-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
              <Label>Active</Label>
            </div>
            <Button size="sm" onClick={() => void handleSave()} disabled={savingMain}>
              <Save className="w-4 h-4 mr-2" />
              {savingMain ? "Сохранение…" : "Save"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1">
            <Label className="text-xs">Icon</Label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="emoji or key"
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="grid gap-3 pt-5">
            <div className="flex items-center gap-2">
              <Checkbox checked={isFeatured} onCheckedChange={(c) => setIsFeatured(!!c)} />
              <Label className="text-xs">Featured</Label>
            </div>
            <div className="grid gap-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={supportsProgram}
                  onCheckedChange={(c) => setSupportsProgram(c === true)}
                />
                <div className="grid gap-0.5">
                  <Label className="text-xs">Поддерживает программу</Label>
                  <p className="text-xs text-gray-500">
                    Если эта категория выбрана как основная у события — редактор покажет блок «Что будет в программе».
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selectableInProgram}
                  onCheckedChange={(c) => setSelectableInProgram(c === true)}
                />
                <div className="grid gap-0.5">
                  <Label className="text-xs">Можно использовать в программе</Label>
                  <p className="text-xs text-gray-500">
                    Эту категорию можно выбирать как часть программы фестиваля/сложного события.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Used in activities: <span className="font-mono">{category._count.activities}</span>
          {hasChildren ? (
            <span className="ml-3">
              Подкатегорий: <span className="font-mono">{category._count.children}</span>
            </span>
          ) : null}
        </p>

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Options</h3>

          <div className="space-y-2">
            {options.map((opt) => (
              <OptionRow key={opt.id} option={opt} onUpdate={updateOption} onDelete={deleteOption} />
            ))}
          </div>

          <div className="flex gap-2 items-end pt-2 border-t">
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Label</Label>
              <Input
                value={newOptLabel}
                onChange={(e) => {
                  const nextLabel = e.target.value;
                  setNewOptLabel(nextLabel);
                  if (!isValueEditedManually) {
                    setNewOptValue(slugifyLabelToValue(nextLabel));
                  }
                }}
                placeholder="Label"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Value</Label>
              <Input
                value={newOptValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setNewOptValue(nextValue);
                  const trimmed = nextValue.trim();
                  setIsValueEditedManually(trimmed.length > 0);
                }}
                placeholder="value"
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddOption}>
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionRow({
  option,
  onUpdate,
  onDelete,
}: {
  option: EventCategoryOptionRow;
  onUpdate: (id: string, data: Partial<EventCategoryOptionRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState(option.label);
  const [value, setValue] = useState(option.value);
  const [order, setOrder] = useState(option.order);
  const [isActive, setIsActive] = useState(option.isActive);

  const hasChanges =
    label !== option.label ||
    value !== option.value ||
    order !== option.order ||
    isActive !== option.isActive;

  const handleSave = () => {
    onUpdate(option.id, { label, value, order, isActive });
  };

  return (
    <div className="flex items-center gap-2 bg-background p-2 rounded border">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-8 text-sm flex-[2]"
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm font-mono flex-[2]"
      />
      <Input
        type="number"
        value={order}
        onChange={(e) => setOrder(Number(e.target.value))}
        className="h-8 text-sm w-16"
      />
      <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
      {hasChanges && (
        <Button size="icon-xs" onClick={handleSave}>
          <Save className="w-3 h-3" />
        </Button>
      )}
      <Button size="icon-xs" variant="ghost" onClick={() => onDelete(option.id)}>
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
