"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { FilterSelect } from "@/components/ui/filter-select";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";
import { cn } from "@/lib/utils";

const adminFetch: RequestInit = { credentials: "include" };

const LIST_HREF = "/admin/taxonomy/signals";

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
  isActive: boolean;
};

type SignalRow = {
  id: string;
  slug: string;
  title: string;
  isSystem: boolean;
  icon: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  parentId: string | null;
  parent: { id: string; title: string; slug: string } | null;
  options: Option[];
  _count: { children: number; options: number };
};

export default function EditSignalPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [signal, setSignal] = useState<SignalRow | null>(null);
  const [roots, setRoots] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [resOne, resAll] = await Promise.all([
        fetch(`/api/admin/signals/${slug}`, adminFetch),
        fetch("/api/admin/signals", adminFetch),
      ]);
      if (!resAll.ok) {
        const err = await resAll.json().catch(() => ({}));
        toast.error(messageFromApiError(err, resAll.status));
        return;
      }
      const all = (await resAll.json()) as SignalRow[];
      const fallback = all.find((x) => x.slug === slug || x.id === slug) ?? null;
      const s = resOne.ok
        ? ((await resOne.json()) as SignalRow)
        : fallback;

      if (!s) {
        setNotFound(true);
        setSignal(null);
        return;
      }

      if (s.slug !== slug) {
        router.replace(`/admin/taxonomy/signals/${s.slug}`);
      }

      setSignal(s);
      setRoots(all.filter((x) => x.parentId == null));
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!signal || !confirm("Удалить сигнал?")) return;
    const res = await fetch(`/api/admin/signals/${signal.id}`, {
      ...adminFetch,
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Сигнал удалён");
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

  if (notFound || !signal) {
    return (
      <div className="p-6 md:p-4 space-y-4">
        <p className="text-sm text-gray-700">Сигнал не найден.</p>
        <Button variant="outline" asChild>
          <Link href={LIST_HREF}>К списку сигналов</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-4xl">
      <div>
        <Link
          href={LIST_HREF}
          className="text-sm text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
        >
          ← К списку сигналов
        </Link>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900 mt-2">Редактирование сигнала</h1>
        <p className="text-sm text-gray-600 mt-1 font-mono break-all">{signal.slug}</p>
      </div>

      <SignalEditor
        signal={signal}
        roots={roots}
        onReload={load}
        onDelete={handleDelete}
      />
    </div>
  );
}

function SignalEditor({
  signal,
  roots,
  onReload,
  onDelete,
}: {
  signal: SignalRow;
  roots: SignalRow[];
  onReload: () => Promise<void>;
  onDelete: () => void;
}) {
  const isSystemSignal = signal.isSystem;
  const titleSlug = useAutoSlug(signal.title, signal.slug, { mode: "edit" });
  const [icon, setIcon] = useState(signal.icon ?? "");
  const [order, setOrder] = useState(signal.order);
  const [isActive, setIsActive] = useState(signal.isActive);
  const [isFeatured, setIsFeatured] = useState(signal.isFeatured);
  const [parentId, setParentId] = useState<string | null>(signal.parentId);

  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [isValueEditedManually, setIsValueEditedManually] = useState(false);
  const [options, setOptions] = useState<Option[]>(signal.options ?? []);
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [highlightOptionId, setHighlightOptionId] = useState<string | null>(null);
  const [removingOptionIds, setRemovingOptionIds] = useState<string[]>([]);

  const hasChildren = signal._count.children > 0;

  useEffect(() => {
    setOptions(signal.options ?? []);
    setOptionError(null);
    setHighlightOptionId(null);
    setRemovingOptionIds([]);
  }, [signal.id, signal.options]);

  useEffect(() => {
    if (!highlightOptionId) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightOptionId((current) => (current === highlightOptionId ? null : current));
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [highlightOptionId]);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/signals/${signal.id}`, {
      ...adminFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await onReload();
      toast.success("Сохранено");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const handleSave = () => {
    patch({
      title: titleSlug.source,
      slug: titleSlug.slug,
      icon: icon.trim() || null,
      order,
      isActive,
      isFeatured,
      parentId,
    });
  };

  const moveSignal = async (mode: "moveUp" | "moveDown") => {
    const res = await fetch(`/api/admin/signals/${signal.id}`, {
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
    const res = await fetch(`/api/admin/signals/${signal.id}/options`, {
      ...adminFetch,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    if (res.ok) {
      const created = (await res.json()) as Option;
      return created;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(messageFromApiError(err, res.status));
    }
  };

  const updateOption = async (optionId: string, data: Partial<Option>) => {
    const res = await fetch(`/api/admin/signal-options/${optionId}`, {
      ...adminFetch,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = (await res.json()) as Option;
      setOptions((prev) => prev.map((opt) => (opt.id === optionId ? updated : opt)));
      toast.success("Опция сохранена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Удалить опцию?")) return;
    setRemovingOptionIds((prev) => (prev.includes(optionId) ? prev : [...prev, optionId]));
    const res = await fetch(`/api/admin/signal-options/${optionId}`, {
      ...adminFetch,
      method: "DELETE",
    });
    if (res.ok) {
      window.setTimeout(() => {
        setOptions((prev) => prev.filter((opt) => opt.id !== optionId));
        setRemovingOptionIds((prev) => prev.filter((id) => id !== optionId));
      }, 260);
      toast.success("Опция удалена");
    } else {
      setRemovingOptionIds((prev) => prev.filter((id) => id !== optionId));
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const handleAddOption = async () => {
    const label = newOptLabel.trim();
    const value = newOptValue.trim();
    if (!label) return;

    const finalValue = value || slugifyLabelToValue(label);
    if (!finalValue) return;

    setIsSubmittingOption(true);
    setOptionError(null);
    try {
      const created = await createOption(label, finalValue);
      if (created) {
        setOptions((prev) => [...prev, created]);
        setNewOptLabel("");
        setNewOptValue("");
        setIsValueEditedManually(false);
        setHighlightOptionId(created.id);
        toast.success("Опция добавлена");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось добавить опцию";
      setOptionError(message);
      toast.error(message);
    } finally {
      setIsSubmittingOption(false);
    }
  };

  const parentSelect = hasChildren ? (
    <div className="grid gap-1 max-w-md">
      <Label className="text-xs">Родительский сигнал</Label>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Есть под-сигналы — нельзя сделать эту запись дочерней. Сначала удалите или перенесите дочерние.
      </p>
      <Input readOnly value="Корневая" className="h-9 text-sm bg-gray-50" />
    </div>
  ) : (
    <div className="grid gap-1 max-w-md">
      <Label className="text-xs">Родительский сигнал</Label>
      <FilterSelect
        value={parentId ?? ""}
        placeholder="— Корневой сигнал —"
        options={roots
          .filter((r) => r.id !== signal.id)
          .map((r) => ({ value: r.id, label: r.title }))}
        onChange={(v) => setParentId(v || null)}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-base font-semibold font-mono text-gray-600 break-all">
          {titleSlug.slug}
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveSignal("moveUp")}
            title="Порядок среди соседей (вверх)"
            disabled={isSystemSignal}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => moveSignal("moveDown")}
            title="Порядок среди соседей (вниз)"
            disabled={isSystemSignal}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isSystemSignal}
            title={isSystemSignal ? "Системный сигнал нельзя удалить" : "Удалить сигнал"}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {parentSelect}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Title</Label>
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
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
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
          <div className="flex items-center gap-2 pt-5">
            <Checkbox checked={isFeatured} onCheckedChange={(c) => setIsFeatured(!!c)} />
            <Label className="text-xs">Featured</Label>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Опций: <span className="font-mono">{signal._count.options}</span>
          {isSystemSignal ? (
            <span className="ml-3 rounded bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              System
            </span>
          ) : null}
          {hasChildren ? (
            <span className="ml-3">
              Под-сигналов: <span className="font-mono">{signal._count.children}</span>
            </span>
          ) : null}
        </p>

        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Options</h3>

          <div className="space-y-2">
            {options.map((opt) => (
              <OptionRow
                key={opt.id}
                option={opt}
                onUpdate={updateOption}
                onDelete={deleteOption}
                isHighlighted={opt.id === highlightOptionId}
                isRemoving={removingOptionIds.includes(opt.id)}
              />
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
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddOption}
              disabled={isSubmittingOption}
            >
              {isSubmittingOption ? "Добавляем..." : "Add"}
            </Button>
          </div>
          {optionError ? (
            <p className="text-xs text-red-600">{optionError}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function OptionRow({
  option,
  onUpdate,
  onDelete,
  isHighlighted = false,
  isRemoving = false,
}: {
  option: Option;
  onUpdate: (id: string, data: Partial<Option>) => void;
  onDelete: (id: string) => void;
  isHighlighted?: boolean;
  isRemoving?: boolean;
}) {
  const [label, setLabel] = useState(option.label);
  const [value, setValue] = useState(option.value);
  const [orderInput, setOrderInput] = useState(String(option.order));
  const [isActive, setIsActive] = useState(option.isActive);
  const parsedOrder =
    orderInput.trim() === "" || Number.isNaN(Number(orderInput)) ? option.order : Number(orderInput);

  const hasChanges =
    label !== option.label ||
    value !== option.value ||
    parsedOrder !== option.order ||
    isActive !== option.isActive;

  const handleSave = () => {
    onUpdate(option.id, { label, value, order: parsedOrder, isActive });
  };

  return (
    <div className={cn(
      "flex items-center gap-2 bg-background p-2 rounded border transition-all duration-300",
      isHighlighted && "border-emerald-300 bg-emerald-50/50",
      isRemoving && "opacity-0 -translate-y-1 scale-[0.99] pointer-events-none",
    )}>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-8 text-sm flex-[2]"
        disabled={isRemoving}
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm font-mono flex-[2]"
        disabled={isRemoving}
      />
      <Input
        type="number"
        value={orderInput}
        onChange={(e) => setOrderInput(e.target.value)}
        className="h-8 text-sm w-16"
        disabled={isRemoving}
      />
      <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} disabled={isRemoving} />
      {hasChanges && !isRemoving && (
        <Button size="icon-xs" onClick={handleSave}>
          <Save className="w-3 h-3" />
        </Button>
      )}
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => onDelete(option.id)}
        disabled={isRemoving}
        title="Удалить опцию"
      >
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
