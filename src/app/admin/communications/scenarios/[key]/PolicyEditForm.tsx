"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationPolicy } from "@prisma/client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PolicyFormState = {
  enabled: boolean;
  allowedInApp: boolean;
  allowedEmail: boolean;
  allowedTelegram: boolean;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultTelegram: boolean;
  minCooldownMinutes: string;
  maxPerDay: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  digestTime: string;
  defaultReminderOffsetMinutes: string;
  availableReminderOffsets: string;
  description: string;
};

function toFormState(policy: NotificationPolicy): PolicyFormState {
  return {
    enabled: policy.enabled,
    allowedInApp: policy.allowedInApp,
    allowedEmail: policy.allowedEmail,
    allowedTelegram: policy.allowedTelegram,
    defaultInApp: policy.defaultInApp,
    defaultEmail: policy.defaultEmail,
    defaultTelegram: policy.defaultTelegram,
    minCooldownMinutes: policy.minCooldownMinutes?.toString() ?? "",
    maxPerDay: policy.maxPerDay?.toString() ?? "",
    quietHoursEnabled: policy.quietHoursEnabled,
    quietHoursStart: policy.quietHoursStart ?? "",
    quietHoursEnd: policy.quietHoursEnd ?? "",
    digestTime: policy.digestTime ?? "",
    defaultReminderOffsetMinutes: policy.defaultReminderOffsetMinutes?.toString() ?? "",
    availableReminderOffsets: (policy.availableReminderOffsets ?? []).join(", "),
    description: policy.description ?? "",
  };
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOffsets(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0)
    .map((part) => Math.round(part));
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
      <div>
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-stone-900">
          {label}
        </Label>
        {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function PolicyEditForm({ policy }: { policy: NotificationPolicy }) {
  const router = useRouter();
  const [form, setForm] = useState<PolicyFormState>(() => toFormState(policy));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PolicyFormState>(key: K, value: PolicyFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/admin/communications/notifications/policies/${policy.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            enabled: form.enabled,
            allowedInApp: form.allowedInApp,
            allowedEmail: form.allowedEmail,
            allowedTelegram: form.allowedTelegram,
            defaultInApp: form.defaultInApp,
            defaultEmail: form.defaultEmail,
            defaultTelegram: form.defaultTelegram,
            minCooldownMinutes: parseNumberOrNull(form.minCooldownMinutes),
            maxPerDay: parseNumberOrNull(form.maxPerDay),
            quietHoursEnabled: form.quietHoursEnabled,
            quietHoursStart: form.quietHoursStart || null,
            quietHoursEnd: form.quietHoursEnd || null,
            digestTime: form.digestTime || null,
            defaultReminderOffsetMinutes: parseNumberOrNull(form.defaultReminderOffsetMinutes),
            availableReminderOffsets: parseOffsets(form.availableReminderOffsets),
            description: form.description || null,
          }),
        },
      );
      const data = (await resp.json().catch(() => ({}))) as { item?: unknown; error?: string };
      if (!resp.ok || !data.item) {
        throw new Error(data.error ?? "Не удалось сохранить политику");
      }
      toast.success("Политика обновлена");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить политику");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Состояние и каналы</CardTitle>
          <CardDescription>
            Allowed — потолок: какие каналы в принципе разрешены для сценария.
            Default — что включено пользователю без личной настройки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            id="enabled"
            label="Сценарий активен"
            description="Быстро выключить без удаления настроек."
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
          />

          <div className="rounded-2xl border border-stone-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Allowed channels</h3>
            <div className="space-y-2">
              <ToggleRow id="allowedInApp" label="In-app" checked={form.allowedInApp} onChange={(v) => set("allowedInApp", v)} />
              <ToggleRow id="allowedEmail" label="Email" checked={form.allowedEmail} onChange={(v) => set("allowedEmail", v)} />
              <ToggleRow id="allowedTelegram" label="Telegram" checked={form.allowedTelegram} onChange={(v) => set("allowedTelegram", v)} />
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">Default channels</h3>
            <div className="space-y-2">
              <ToggleRow id="defaultInApp" label="In-app" checked={form.defaultInApp} onChange={(v) => set("defaultInApp", v)} />
              <ToggleRow id="defaultEmail" label="Email" checked={form.defaultEmail} onChange={(v) => set("defaultEmail", v)} />
              <ToggleRow id="defaultTelegram" label="Telegram" checked={form.defaultTelegram} onChange={(v) => set("defaultTelegram", v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Лимиты и тайминги</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minCooldownMinutes">Min cooldown, мин</Label>
              <Input
                id="minCooldownMinutes"
                inputMode="numeric"
                value={form.minCooldownMinutes}
                onChange={(e) => set("minCooldownMinutes", e.target.value)}
                className="rounded-2xl"
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPerDay">Max per day</Label>
              <Input
                id="maxPerDay"
                inputMode="numeric"
                value={form.maxPerDay}
                onChange={(e) => set("maxPerDay", e.target.value)}
                className="rounded-2xl"
                placeholder="—"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Quiet hours</h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Ограничение отправок в ночные часы.{" "}
                  <span className="font-medium text-amber-700">Пока не влияет — enforcement в 2.4.</span>
                </p>
              </div>
              <Switch
                checked={form.quietHoursEnabled}
                onCheckedChange={(v) => set("quietHoursEnabled", v)}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quietHoursStart">Начало</Label>
                <Input
                  id="quietHoursStart"
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => set("quietHoursStart", e.target.value)}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quietHoursEnd">Конец</Label>
                <Input
                  id="quietHoursEnd"
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => set("quietHoursEnd", e.target.value)}
                  className="rounded-2xl"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="digestTime">Digest time</Label>
              <Input
                id="digestTime"
                type="time"
                value={form.digestTime}
                onChange={(e) => set("digestTime", e.target.value)}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultReminderOffsetMinutes">Reminder offset, мин</Label>
              <Input
                id="defaultReminderOffsetMinutes"
                inputMode="numeric"
                value={form.defaultReminderOffsetMinutes}
                onChange={(e) => set("defaultReminderOffsetMinutes", e.target.value)}
                className="rounded-2xl"
                placeholder="—"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="availableReminderOffsets">Available reminder offsets</Label>
            <Input
              id="availableReminderOffsets"
              placeholder="30, 60, 120, 180"
              value={form.availableReminderOffsets}
              onChange={(e) => set("availableReminderOffsets", e.target.value)}
              className="rounded-2xl"
            />
            <p className="text-xs text-stone-500">Список минут через запятую.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Описание</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="rounded-2xl"
              placeholder="Для внутреннего использования"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-2xl"
        >
          {saving ? "Сохранение…" : "Сохранить политику"}
        </Button>
      </div>
    </div>
  );
}
