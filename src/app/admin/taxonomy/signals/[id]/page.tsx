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
import { toast } from "sonner";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { nativeSelectFieldClassNameFlush } from "@/components/ui/native-select-classes";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";

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
  const id = params.id as string;

  const [signal, setSignal] = useState<SignalRow | null>(null);
  const [roots, setRoots] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [resOne, resAll] = await Promise.all([
        fetch(`/api/admin/signals/${id}`, adminFetch),
        fetch("/api/admin/signals", adminFetch),
      ]);
      if (resOne.status === 404) {
        setNotFound(true);
        setSignal(null);
        return;
      }
      if (!resOne.ok) {
        const err = await resOne.json().catch(() => ({}));
        toast.error(messageFromApiError(err, resOne.status));
        setSignal(null);
        return;
      }
      if (!resAll.ok) {
        const err = await resAll.json().catch(() => ({}));
        toast.error(messageFromApiError(err, resAll.status));
        return;
      }
      const s = (await resOne.json()) as SignalRow;
      const all = (await resAll.json()) as SignalRow[];
      setSignal(s);
      setRoots(all.filter((x) => x.parentId == null));
      setEditorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        key={`${signal.id}-${editorKey}`}
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
  const titleSlug = useAutoSlug(signal.title, signal.slug, { mode: "edit" });
  const [icon, setIcon] = useState(signal.icon ?? "");
  const [order, setOrder] = useState(signal.order);
  const [isActive, setIsActive] = useState(signal.isActive);
  const [isFeatured, setIsFeatured] = useState(signal.isFeatured);
  const [parentId, setParentId] = useState<string | null>(signal.parentId);

  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [isValueEditedManually, setIsValueEditedManually] = useState(false);

  const hasChildren = signal._count.children > 0;

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
      await onReload();
      toast.success("Опция добавлена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
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
      await onReload();
      toast.success("Опция сохранена");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(messageFromApiError(err, res.status));
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Удалить опцию?")) return;
    const res = await fetch(`/api/admin/signal-options/${optionId}`, {
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

  const options = signal.options ?? [];

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
      <select
        className={nativeSelectFieldClassNameFlush}
        value={parentId ?? ""}
        onChange={(e) => setParentId(e.target.value || null)}
      >
        <option value="">— Корневой сигнал —</option>
        {roots
          .filter((r) => r.id !== signal.id)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
      </select>
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
                    // If user cleared VALUE -> allow auto-generation again.
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
  option: Option;
  onUpdate: (id: string, data: Partial<Option>) => void;
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
