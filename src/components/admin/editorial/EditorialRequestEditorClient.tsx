"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorialRequestStatus } from "@prisma/client";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import type {
  EditorialClassChipOption,
  EditorialRequestDetail,
  EditorialSignalGroup,
} from "@/server/editorial/editorialRequestService";

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDatetimeValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

type EditorialRequestEditorClientProps = {
  initialRequest: EditorialRequestDetail | null;
  cities: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  signalGroups: EditorialSignalGroup[];
  classChips: EditorialClassChipOption[];
};

export function EditorialRequestEditorClient({
  initialRequest,
  cities,
  signalGroups,
  classChips,
}: EditorialRequestEditorClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initialRequest?.title ?? "");
  const [description, setDescription] = useState(
    initialRequest?.description ?? "",
  );
  const [cityId, setCityId] = useState(initialRequest?.cityId ?? "__all__");
  const [status, setStatus] = useState<EditorialRequestStatus>(
    (initialRequest?.status as EditorialRequestStatus | undefined) ??
      EditorialRequestStatus.DRAFT,
  );
  const [deadlineAt, setDeadlineAt] = useState(
    toLocalDatetimeValue(initialRequest?.deadlineAt ?? null),
  );
  const [discoverySignalIds, setDiscoverySignalIds] = useState<string[]>(
    initialRequest?.criteria.discoverySignalIds ?? [],
  );
  const [classChipSlugs, setClassChipSlugs] = useState<string[]>(
    initialRequest?.criteria.classChipSlugs ?? [],
  );

  const selectedCriteriaCount = useMemo(
    () => discoverySignalIds.length + classChipSlugs.length,
    [classChipSlugs.length, discoverySignalIds.length],
  );

  async function handleSave() {
    setSaving(true);

    try {
      const response = await fetch(
        initialRequest
          ? `/api/admin/editorial-requests/${initialRequest.id}`
          : "/api/admin/editorial-requests",
        {
          method: initialRequest ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
            cityId: cityId === "__all__" ? null : cityId,
            status,
            deadlineAt: fromLocalDatetimeValue(deadlineAt),
            criteria: {
              discoverySignalIds,
              classChipSlugs,
            },
          }),
        },
      );

      const json = (await response.json().catch(() => ({}))) as {
        item?: { id: string };
        error?: string;
      };

      if (!response.ok || !json.item) {
        toast.error(json.error ?? "Не удалось сохранить редакционный запрос");
        return;
      }

      toast.success(
        initialRequest
          ? "Редакционный запрос сохранён"
          : "Редакционный запрос создан",
      );

      if (initialRequest) {
        router.refresh();
      } else {
        router.push(`/admin/content/editorial-requests/${json.item.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-3xl border-stone-200/80">
      <CardHeader>
        <CardTitle>
          {initialRequest ? "Параметры редакционного запроса" : "Новый редакционный запрос"}
        </CardTitle>
        <CardDescription>
          Подбираем бизнесы только по опубликованным предложениям, без ручной классификации бизнеса.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="editorial-title">Заголовок</Label>
            <Input
              id="editorial-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Где отметить детский день рождения в Минске"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="editorial-description">Описание / внутренняя заметка</Label>
            <Textarea
              id="editorial-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Что именно ищем, ограничения по подборке, пожелания редакции"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Город</Label>
            <Select value={cityId} onValueChange={setCityId}>
              <SelectTrigger>
                <SelectValue placeholder="Все города" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Все города</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Статус</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as EditorialRequestStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EditorialRequestStatus.DRAFT}>
                  Черновик
                </SelectItem>
                <SelectItem value={EditorialRequestStatus.READY}>
                  Готов к подбору
                </SelectItem>
                <SelectItem value={EditorialRequestStatus.ARCHIVED}>
                  Архив
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editorial-deadline">Дедлайн</Label>
            <div className="relative">
              <CalendarClock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <Input
                id="editorial-deadline"
                className="pl-9"
                type="datetime-local"
                value={deadlineAt}
                onChange={(event) => setDeadlineAt(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Критерии</Label>
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              {selectedCriteriaCount > 0
                ? `Выбрано ${selectedCriteriaCount} критерия(ев). Preview обновится после сохранения.`
                : "Без сигналов и class chips система не будет подбирать бизнесы автоматически."}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {signalGroups.map((group) => (
            <CardMultiSelect
              key={group.id}
              label={group.title}
              placeholder="Выберите сигналы"
              values={discoverySignalIds}
              onChange={setDiscoverySignalIds}
              options={group.options.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              allowClear
              applyMode="manual"
              maxSelected={24}
            />
          ))}

          <CardMultiSelect
            label="Class chips"
            placeholder="Выберите class chips"
            values={classChipSlugs}
            onChange={setClassChipSlugs}
            options={classChips.map((chip) => ({
              value: chip.slug,
              label: chip.title,
            }))}
            allowClear
            applyMode="manual"
            maxSelected={12}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <p className="text-sm text-stone-500">
            Telegram sending will be added in Phase 2.
          </p>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {initialRequest ? "Сохранить" : "Создать запрос"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
