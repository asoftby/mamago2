"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import {
  DiscoveryCreateCard,
  DiscoveryEmptyState,
  DiscoveryTaxonomyPageHeader,
  DiscoveryTaxonomyPageShell,
  DiscoveryTaxonomyTable,
  discoveryTd,
  discoveryTh,
} from "@/components/admin/discovery";
import { DiscoveryTitleSlugCreateRow } from "@/components/admin/discovery/DiscoveryTitleSlugCreateRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DiscoveryTagItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  articleCount: number;
};

export function DiscoveryTagsAdminPage() {
  const [tags, setTags] = useState<DiscoveryTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const draft = useAutoSlug("", "");
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/discovery-tags?includeInactive=1", {
        credentials: "include",
      });
      const data = await response.json().catch(() => []);
      setTags(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () => [...tags].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)),
    [tags],
  );

  const createTag = async () => {
    if (!draft.source.trim()) {
      toast.error("Укажите название тега");
      return;
    }

    const response = await fetch("/api/admin/discovery-tags", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.source,
        slug: draft.slug,
        description: description || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Не удалось создать тег");
      return;
    }

    draft.hydrate("", "");
    setDescription("");
    setSeoTitle("");
    setSeoDescription("");
    setSortOrder("100");
    setIsActive(true);
    toast.success("Тег создан");
    await load();
  };

  const updateTag = async (tag: DiscoveryTagItem) => {
    const response = await fetch(`/api/admin/discovery-tags/${tag.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tag),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Не удалось сохранить тег");
      return;
    }
    toast.success("Тег сохранён");
    await load();
  };

  const disableTag = async (tag: DiscoveryTagItem) => {
    const response = await fetch(`/api/admin/discovery-tags/${tag.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Не удалось отключить тег");
      return;
    }
    toast.success("Тег отключён");
    await load();
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Теги discovery"
        description="Глобальные теги для публикаций. Тег не привязан к городу, а городская выдача определяется через параметры статьи."
      />

      <div className="space-y-6">
        <DiscoveryCreateCard title="Создать тег">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="tag-description">Описание</Label>
              <Textarea
                id="tag-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tag-seo-title">SEO title</Label>
              <Input id="tag-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tag-sort">Порядок</Label>
              <Input id="tag-sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="tag-seo-description">SEO description</Label>
              <Textarea
                id="tag-seo-description"
                rows={3}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-muted-foreground">Активный тег доступен в редакторах публикаций</span>
          </div>
          <DiscoveryTitleSlugCreateRow
            titleLabel="Название"
            auto={draft}
            onCreate={createTag}
            titlePlaceholder="Например: Животные"
            slugPlaceholder="zhivotnye"
          />
        </DiscoveryCreateCard>

        {loading ? (
          <div className="text-sm text-muted-foreground">Загружаем теги…</div>
        ) : sorted.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет тегов"
            description="Добавьте первый тег, чтобы использовать его в публикациях и теговых страницах."
          />
        ) : (
          <DiscoveryTaxonomyTable
            minWidthClassName="min-w-[1000px]"
            scrollLabel="Таблица тегов, прокручивается по горизонтали"
          >
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh("min-w-[180px]")}>Название</th>
                <th className={discoveryTh("min-w-[160px]")}>Slug</th>
                <th className={discoveryTh("min-w-[220px]")}>Описание</th>
                <th className={discoveryTh("min-w-[220px]")}>SEO title</th>
                <th className={discoveryTh("min-w-[280px]")}>SEO description</th>
                <th className={discoveryTh("w-24")}>Статей</th>
                <th className={discoveryTh("w-24")}>Порядок</th>
                <th className={discoveryTh("w-24")}>Активен</th>
                <th className={discoveryTh("w-40")}>Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((tag) => (
                <EditableTagRow
                  key={tag.id}
                  tag={tag}
                  onSave={updateTag}
                  onDisable={disableTag}
                />
              ))}
            </tbody>
          </DiscoveryTaxonomyTable>
        )}
      </div>
    </DiscoveryTaxonomyPageShell>
  );
}

function EditableTagRow({
  tag,
  onSave,
  onDisable,
}: {
  tag: DiscoveryTagItem;
  onSave: (tag: DiscoveryTagItem) => Promise<void>;
  onDisable: (tag: DiscoveryTagItem) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DiscoveryTagItem>(tag);

  useEffect(() => {
    setDraft(tag);
  }, [tag]);

  return (
    <tr className="align-top">
      <td className={cn(discoveryTd(), "min-w-[180px]")}>
        <Input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
      </td>
      <td className={discoveryTd("min-w-[160px]")}>
        <Input value={draft.slug} onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))} />
      </td>
      <td className={discoveryTd("min-w-[220px]")}>
        <Textarea
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value || null }))}
        />
      </td>
      <td className={discoveryTd("min-w-[220px]")}>
        <Input
          value={draft.seoTitle ?? ""}
          onChange={(e) => setDraft((prev) => ({ ...prev, seoTitle: e.target.value || null }))}
        />
      </td>
      <td className={discoveryTd("min-w-[280px]")}>
        <Textarea
          rows={3}
          value={draft.seoDescription ?? ""}
          onChange={(e) => setDraft((prev) => ({ ...prev, seoDescription: e.target.value || null }))}
        />
      </td>
      <td className={cn(discoveryTd(), "text-sm text-muted-foreground")}>
        {draft.articleCount}
      </td>
      <td className={discoveryTd()}>
        <Input
          value={String(draft.sortOrder)}
          inputMode="numeric"
          onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))}
        />
      </td>
      <td className={discoveryTd()}>
        <Switch
          checked={draft.isActive}
          onCheckedChange={(nextIsActive) => setDraft((prev) => ({ ...prev, isActive: nextIsActive }))}
        />
      </td>
      <td className={discoveryTd()}>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void onSave(draft)}>
            Сохранить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onDisable(draft)}
            disabled={!draft.isActive}
          >
            Отключить
          </Button>
        </div>
      </td>
    </tr>
  );
}
