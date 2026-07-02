"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DirectPlatformSettingsDTO,
  DirectPolicyPublicationType,
  DirectTypePolicy,
} from "@/server/services/direct/directPlatformSettings.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type DirectCommunicationMode = "CONTACTS_ONLY" | "DIRECT_ONLY" | "DIRECT_AND_CONTACTS" | "EXTERNAL_BOOKING";
type DirectContactVisibility = "ALWAYS" | "AFTER_FIRST_REQUEST" | "AFTER_BUSINESS_CONFIRMATION" | "NEVER";

const MODE_LABELS: Record<DirectCommunicationMode, string> = {
  CONTACTS_ONLY: "Только контакты",
  DIRECT_ONLY: "Только Direct",
  DIRECT_AND_CONTACTS: "Direct и контакты",
  EXTERNAL_BOOKING: "Внешняя ссылка",
};

const ALL_MODES: DirectCommunicationMode[] = [
  "CONTACTS_ONLY",
  "DIRECT_ONLY",
  "DIRECT_AND_CONTACTS",
  "EXTERNAL_BOOKING",
];

const VISIBILITY_LABELS: Record<DirectContactVisibility, string> = {
  ALWAYS: "Сразу",
  AFTER_FIRST_REQUEST: "После первой заявки",
  AFTER_BUSINESS_CONFIRMATION: "После подтверждения бизнеса",
  NEVER: "Никогда",
};

const PUBLICATION_TYPE_LABELS: Record<DirectPolicyPublicationType, string> = {
  OFFER: "Предложения (Offer)",
  EVENT: "События (Event)",
  PLACE: "Места (Place)",
};

const PUBLICATION_TYPES: DirectPolicyPublicationType[] = ["OFFER", "EVENT", "PLACE"];

const DAY_OPTIONS_CLOSE = [7, 14, 30, 60, 90];
const DAY_OPTIONS_ARCHIVE = [30, 60, 90, 180];

function daysToSelectValue(days: number | null): string {
  return days === null ? "never" : String(days);
}
function selectValueToDays(value: string): number | null {
  return value === "never" ? null : Number.parseInt(value, 10);
}

export function DirectSettingsForm({ initialSettings }: { initialSettings: DirectPlatformSettingsDTO }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const lastUpdated = useMemo(() => new Date(settings.updatedAt).toLocaleString("ru-RU"), [settings.updatedAt]);

  function updateTypePolicy(type: DirectPolicyPublicationType, patch: Partial<DirectTypePolicy>) {
    setSettings((prev) => ({
      ...prev,
      publicationTypePolicy: {
        ...prev.publicationTypePolicy,
        [type]: { ...prev.publicationTypePolicy[type], ...patch },
      },
    }));
  }

  function toggleAllowedMode(type: DirectPolicyPublicationType, mode: DirectCommunicationMode, checked: boolean) {
    const policy = settings.publicationTypePolicy[type];
    let allowedModes = checked
      ? [...policy.allowedModes, mode]
      : policy.allowedModes.filter((m) => m !== mode);
    if (allowedModes.length === 0) allowedModes = [mode]; // never allow an empty set
    const defaultMode = allowedModes.includes(policy.defaultMode) ? policy.defaultMode : allowedModes[0];
    updateTypePolicy(type, { allowedModes, defaultMode });
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/direct/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Не удалось сохранить настройки");
      }
      const updated = (await res.json()) as DirectPlatformSettingsDTO;
      setSettings(updated);
      setSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Последнее изменение: {lastUpdated}</p>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-emerald-600">Сохранено {savedAt.toLocaleTimeString("ru-RU")}</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
            {isSaving ? "Сохранение…" : "Сохранить изменения"}
          </Button>
        </div>
      </div>

      {/* Общие настройки */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Общие настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-4 py-3">
            <div>
              <Label className="text-sm font-medium text-stone-800">
                Разрешить бизнесу начинать переписку после завершённого обращения
              </Label>
              <p className="mt-1 text-xs text-stone-500">
                По умолчанию выключено — бизнес никогда не инициирует Direct первым. Заготовка для будущих
                сервисных сценариев («Ваш заказ готов», «Новое предложение через неделю») — сама отправка пока
                не реализована, это только политика платформы.
              </p>
            </div>
            <Switch
              checked={settings.allowBusinessReopenAfterCompletion}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, allowBusinessReopenAfterCompletion: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Типы публикаций */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Типы публикаций</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {PUBLICATION_TYPES.map((type) => {
            const policy = settings.publicationTypePolicy[type];
            return (
              <div key={type} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-stone-900">{PUBLICATION_TYPE_LABELS[type]}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Direct включён</span>
                    <Switch
                      checked={policy.enabled}
                      onCheckedChange={(checked) => updateTypePolicy(type, { enabled: checked })}
                    />
                  </div>
                </div>

                {policy.enabled && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-stone-500">Доступные режимы</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {ALL_MODES.map((mode) => (
                          <label key={mode} className="flex items-center gap-2 text-sm text-stone-700">
                            <Checkbox
                              checked={policy.allowedModes.includes(mode)}
                              onCheckedChange={(checked) => toggleAllowedMode(type, mode, checked === true)}
                            />
                            {MODE_LABELS[mode]}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-stone-500">Режим по умолчанию</Label>
                        <Select
                          value={policy.defaultMode}
                          onValueChange={(value) => updateTypePolicy(type, { defaultMode: value as DirectCommunicationMode })}
                        >
                          <SelectTrigger className="mt-1 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {policy.allowedModes.map((mode) => (
                              <SelectItem key={mode} value={mode}>
                                {MODE_LABELS[mode]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end gap-2 pb-1">
                        <Checkbox
                          checked={policy.businessOverrideAllowed}
                          onCheckedChange={(checked) => updateTypePolicy(type, { businessOverrideAllowed: checked === true })}
                        />
                        <span className="text-sm text-stone-700">Бизнес может менять режим сам</span>
                      </div>

                      <div className="flex items-end gap-2 pb-1">
                        <Checkbox
                          checked={policy.directRequired}
                          onCheckedChange={(checked) => updateTypePolicy(type, { directRequired: checked === true })}
                        />
                        <span className="text-sm text-stone-700">Direct обязателен</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Contact Visibility & Lifecycle */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Видимость контактов и жизненный цикл</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Когда показывать контакты</Label>
            <Select
              value={settings.contactVisibility}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, contactVisibility: value as DirectContactVisibility }))}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VISIBILITY_LABELS) as DirectContactVisibility[]).map((v) => (
                  <SelectItem key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Автозавершение обращения</Label>
            <Select
              value={daysToSelectValue(settings.autoCloseDays)}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, autoCloseDays: selectValueToDays(value) }))}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Никогда</SelectItem>
                {DAY_OPTIONS_CLOSE.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Через {d} дней
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Автоархивация</Label>
            <Select
              value={daysToSelectValue(settings.autoArchiveDays)}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, autoArchiveDays: selectValueToDays(value) }))}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Никогда</SelectItem>
                {DAY_OPTIONS_ARCHIVE.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Через {d} дней
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="col-span-full text-xs text-stone-400">
            Пока это только хранение настроек — поведение (авто-показ контактов, cron автозавершения/архивации)
            будет подключено в следующей фазе.
          </p>
        </CardContent>
      </Card>

      {/* Flood Protection */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Flood Protection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Сообщений подряд</Label>
            <Input
              type="number"
              min={2}
              max={50}
              value={settings.floodMessageCount}
              onChange={(e) => setSettings((prev) => ({ ...prev, floodMessageCount: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Интервал (секунды)</Label>
            <Input
              type="number"
              min={5}
              max={600}
              value={settings.floodIntervalSeconds}
              onChange={(e) => setSettings((prev) => ({ ...prev, floodIntervalSeconds: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Блокировка (минуты)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={settings.floodLockMinutes}
              onChange={(e) => setSettings((prev) => ({ ...prev, floodLockMinutes: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* No Reply Cap */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>No Reply Cap</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-stone-500">Сообщений бизнеса без ответа</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={settings.noReplyCapCount}
              onChange={(e) => setSettings((prev) => ({ ...prev, noReplyCapCount: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Detection */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Contact Detection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["contactDetectPhone", "Телефон"],
              ["contactDetectEmail", "Email"],
              ["contactDetectLink", "Ссылки"],
              ["contactDetectTelegram", "Telegram"],
              ["contactDetectWhatsapp", "WhatsApp"],
              ["contactDetectInstagram", "Instagram"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-stone-700">
              <Checkbox
                checked={settings[key]}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, [key]: checked === true }))}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
