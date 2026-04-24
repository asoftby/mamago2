"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";
import {
  RETURN_TO_PARAM,
  sanitizeReturnTo,
  withSavedToastQuery,
} from "@/lib/backoffice/saveFlow";
import type { OccasionType } from "@prisma/client";
import { occasionTypeLabel } from "@/lib/taxonomy/occasionTypeLabels";

const adminFetch: RequestInit = { credentials: "include" };

type OccasionEntry = {
  id: string;
  name: string;
  slug: string;
  type: OccasionType;
  sortOrder: number;
  isActive: boolean;
};

export function OccasionEditPage({
  listHrefBase,
  listLabel,
  entityLabel,
}: {
  listHrefBase: string;
  listLabel: string;
  entityLabel: string;
}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<OccasionEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const listHrefWithType = useMemo(() => {
    if (!entry) return listHrefBase;
    return `${listHrefBase}?type=${encodeURIComponent(entry.type)}`;
  }, [entry, listHrefBase]);

  const listHrefAfterSave = useMemo(
    () => sanitizeReturnTo(searchParams.get(RETURN_TO_PARAM), listHrefWithType),
    [searchParams, listHrefWithType],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/occasions/${id}`, adminFetch);
      if (res.status === 404) {
        setNotFound(true);
        setEntry(null);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
        setEntry(null);
        return;
      }
      const data = (await res.json()) as OccasionEntry;
      setEntry(data);
      setEditorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!entry) return;
    const q = searchParams.get("type");
    if (q && q.toUpperCase() !== entry.type) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("type", entry.type);
      router.replace(`/admin/discovery/occasions/${entry.id}?${next.toString()}`);
    }
  }, [entry, router, searchParams]);

  const handleDelete = async () => {
    if (!entry || !confirm(`Удалить ${entityLabel}?`)) return;
    const res = await fetch(`/api/admin/occasions/${entry.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Удалено");
      router.push(listHrefAfterSave);
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

  if (notFound || !entry) {
    return (
      <div className="p-6 md:p-4 space-y-4">
        <p className="text-sm text-gray-700">Запись не найдена.</p>
        <Button variant="outline" asChild>
          <Link href={listHrefBase}>{listLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-4xl">
      <div>
        <Link
          href={listHrefWithType}
          className="text-sm text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
        >
          {listLabel}
        </Link>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900 mt-2">Редактирование</h1>
        <p className="text-sm text-gray-600 mt-1 font-mono break-all">{entry.slug}</p>
      </div>

      <OccasionEditor
        key={`${entry.id}-${editorKey}`}
        entry={entry}
        onDelete={handleDelete}
        onSaved={() => {
          router.push(withSavedToastQuery(listHrefAfterSave));
        }}
      />
    </div>
  );
}

function OccasionEditor({
  entry,
  onDelete,
  onSaved,
}: {
  entry: OccasionEntry;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const nameSlug = useAutoSlug(entry.name, entry.slug, { mode: "edit" });
  const [orderInput, setOrderInput] = useState(String(entry.sortOrder));
  const [isActive, setIsActive] = useState(entry.isActive);
  const [saving, setSaving] = useState(false);

  const parsedOrder =
    orderInput.trim() === "" || Number.isNaN(Number(orderInput))
      ? entry.sortOrder
      : Number(orderInput);

  const patch = async (body: Record<string, unknown>) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/occasions/${entry.id}`, {
        ...adminFetch,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSaved();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(messageFromApiError(err, res.status));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    void patch({
      name: nameSlug.source,
      slug: nameSlug.slug,
      sortOrder: parsedOrder,
      isActive,
    });
  };

  const hasChanges =
    nameSlug.source !== entry.name ||
    nameSlug.slug !== entry.slug ||
    parsedOrder !== entry.sortOrder ||
    isActive !== entry.isActive;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold font-mono text-gray-600 break-all">
          {nameSlug.slug}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-1.5 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">Тип</span>
          <span className="font-medium text-gray-900">{occasionTypeLabel(entry.type)}</span>
          <span className="text-xs text-gray-500 font-mono">{entry.type}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Название</Label>
            <Input
              value={nameSlug.source}
              onChange={(e) => nameSlug.setSource(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input
              className="font-mono text-sm"
              value={nameSlug.slug}
              onChange={(e) => nameSlug.setSlug(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2 w-32">
            <Label>Порядок</Label>
            <Input
              type="number"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(!!c)} />
            <Label>Active</Label>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="mb-0.5"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Сохранение…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
