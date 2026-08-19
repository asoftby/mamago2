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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ClassChip = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  signalDefinitionId: string | null;
};

export default function DiscoveryClassesAdminPage() {
  const [chips, setChips] = useState<ClassChip[]>([]);
  const [loading, setLoading] = useState(true);
  const draft = useAutoSlug("", "");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [isActive, setIsActive] = useState(true);
  const [signalDefinitionId, setSignalDefinitionId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/discovery/class-chips", {
        credentials: "include",
      });
      const data = await response.json();
      setChips(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () => [...chips].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)),
    [chips],
  );

  const createChip = async () => {
    if (!draft.source.trim()) {
      toast.error("Укажите название чипа");
      return;
    }

    const response = await fetch("/api/admin/discovery/class-chips", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.source,
        slug: draft.slug,
        description: description || null,
        icon: icon || null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        signalDefinitionId: signalDefinitionId || null,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось создать чип");
      return;
    }

    draft.hydrate("", "");
    setDescription("");
    setIcon("");
    setSortOrder("100");
    setIsActive(true);
    setSignalDefinitionId("");
    toast.success("Чип создан");
    await load();
  };

  const updateChip = async (chip: ClassChip) => {
    const response = await fetch(`/api/admin/discovery/class-chips/${chip.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chip),
    });
    if (!response.ok) {
      toast.error("Не удалось сохранить чип");
      return;
    }
    toast.success("Чип сохранён");
    await load();
  };

  const removeChip = async (chip: ClassChip) => {
    if (chip.isSystem || chip.slug === "all") {
      toast.error("Системный чип удалить нельзя");
      return;
    }
    const response = await fetch(`/api/admin/discovery/class-chips/${chip.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      toast.error("Не удалось удалить чип");
      return;
    }
    toast.success("Чип удалён");
    await load();
  };

  return (
    <DiscoveryTaxonomyPageShell>
      <DiscoveryTaxonomyPageHeader
        title="Discovery: Classes Chips"
        description="Управление верхними чипами публичной витрины /[city]/classes. Неактивные чипы не показываются пользователю, порядок идёт по sortOrder."
      />

      <div className="space-y-6">
        <DiscoveryCreateCard title="Создать чип занятий">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="chip-description">Описание</Label>
              <Input id="chip-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chip-icon">Иконка / emoji</Label>
              <Input id="chip-icon" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chip-sort">sortOrder</Label>
              <Input id="chip-sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chip-signal">Signal binding ID</Label>
              <Input
                id="chip-signal"
                value={signalDefinitionId}
                onChange={(e) => setSignalDefinitionId(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-muted-foreground">Показывать на публичной странице</span>
          </div>
          <DiscoveryTitleSlugCreateRow
            titleLabel="Название"
            auto={draft}
            onCreate={createChip}
            titlePlaceholder="Например: Лагеря"
            slugPlaceholder="camps"
          />
        </DiscoveryCreateCard>

        {loading ? (
          <div className="text-sm text-muted-foreground">Загружаем чипы…</div>
        ) : sorted.length === 0 ? (
          <DiscoveryEmptyState
            title="Пока нет чипов занятий"
            description="Добавьте первый чип, чтобы управлять верхней навигацией витрины /classes."
          />
        ) : (
          <DiscoveryTaxonomyTable
            minWidthClassName="min-w-[880px]"
            scrollLabel="Таблица чипов занятий, прокручивается по горизонтали"
          >
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={discoveryTh()}>Название</th>
                <th className={discoveryTh()}>Slug</th>
                <th className={discoveryTh()}>Описание</th>
                <th className={discoveryTh("w-24")}>Порядок</th>
                <th className={discoveryTh("w-24")}>Активен</th>
                <th className={discoveryTh("w-24")}>Default</th>
                <th className={discoveryTh("w-48")}>Binding</th>
                <th className={discoveryTh("w-40")}>Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((chip) => (
                <EditableChipRow
                  key={chip.id}
                  chip={chip}
                  onSave={updateChip}
                  onDelete={removeChip}
                />
              ))}
            </tbody>
          </DiscoveryTaxonomyTable>
        )}
      </div>
    </DiscoveryTaxonomyPageShell>
  );
}

function EditableChipRow({
  chip,
  onSave,
  onDelete,
}: {
  chip: ClassChip;
  onSave: (chip: ClassChip) => Promise<void>;
  onDelete: (chip: ClassChip) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ClassChip>(chip);

  useEffect(() => {
    setDraft(chip);
  }, [chip]);

  return (
    <tr className="align-top">
      <td className={cn(discoveryTd(), "min-w-[180px]")}>
        <Input value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
      </td>
      <td className={discoveryTd("min-w-[160px]")}>
        <Input
          value={draft.slug}
          disabled={draft.isSystem && draft.slug === "all"}
          onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
        />
      </td>
      <td className={discoveryTd("min-w-[240px]")}>
        <Input
          value={draft.description ?? ""}
          onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        />
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
          onCheckedChange={(isActive) => setDraft((prev) => ({ ...prev, isActive }))}
        />
      </td>
      <td className={discoveryTd()}>
        <Switch
          checked={draft.isDefault}
          onCheckedChange={(isDefault) => setDraft((prev) => ({ ...prev, isDefault }))}
        />
      </td>
      <td className={discoveryTd()}>
        <Input
          value={draft.signalDefinitionId ?? ""}
          placeholder="optional"
          onChange={(e) => setDraft((prev) => ({ ...prev, signalDefinitionId: e.target.value || null }))}
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
            disabled={draft.isSystem || draft.slug === "all"}
            onClick={() => void onDelete(draft)}
          >
            Удалить
          </Button>
        </div>
      </td>
    </tr>
  );
}
