"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { messageFromApiError } from "@/lib/admin/messageFromApiError";

const adminFetch: RequestInit = { credentials: "include" };

type Entry = {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
};

export function DiscoveryFlatTaxonomyEditPage({
  listHref,
  listLabel,
  entityLabel,
}: {
  listHref: string;
  listLabel: string;
  entityLabel: string;
}) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/discovery/taxonomy-entries/${id}`, adminFetch);
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
      const data = (await res.json()) as Entry;
      setEntry(data);
      setEditorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!entry || !confirm(`Удалить ${entityLabel}?`)) return;
    const res = await fetch(`/api/admin/discovery/taxonomy-entries/${entry.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Удалено");
      router.push(listHref);
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
          <Link href={listHref}>{listLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-4xl">
      <div>
        <Link
          href={listHref}
          className="text-sm text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
        >
          {listLabel}
        </Link>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900 mt-2">Редактирование</h1>
        <p className="text-sm text-gray-600 mt-1 font-mono break-all">{entry.slug}</p>
      </div>

      <FlatTaxonomyEditor
        key={`${entry.id}-${editorKey}`}
        entry={entry}
        onReload={load}
        onDelete={handleDelete}
      />
    </div>
  );
}

function FlatTaxonomyEditor({
  entry,
  onReload,
  onDelete,
}: {
  entry: Entry;
  onReload: () => Promise<void>;
  onDelete: () => void;
}) {
  const titleSlug = useAutoSlug(entry.title, entry.slug, { mode: "edit" });
  const [order, setOrder] = useState(entry.sortOrder);
  const [isActive, setIsActive] = useState(entry.isActive);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/discovery/taxonomy-entries/${entry.id}`, {
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
      sortOrder: order,
      isActive,
    });
  };

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
            <Label>Порядок</Label>
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
        <p className="text-xs text-gray-500">
          Используется в событиях: <span className="font-mono">0</span> (связь будет добавлена позже).
        </p>
      </CardContent>
    </Card>
  );
}
