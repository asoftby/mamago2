"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotificationPolicy, NotificationPolicySurface, NotificationScenario, NotificationType } from "@prisma/client";
import { Bell, Clock3, Lock, Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PolicyDto = NotificationPolicy;

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

const POLICY_META: Record<
  string,
  { title: string; subtitle: string; icon: typeof Bell }
> = {
  PLAN_EVENT_2H_BEFORE: {
    title: "Напоминание о событии в плане",
    subtitle: "Точечный reminder перед стартом события.",
    icon: Clock3,
  },
  PLAN_TOMORROW_DIGEST: {
    title: "Завтра в плане",
    subtitle: "Вечерняя сводка по завтрашним планам пользователя.",
    icon: Bell,
  },
  BOOKING_REQUESTS: {
    title: "Заявки",
    subtitle: "Новые заявки и важные изменения по ним.",
    icon: Mail,
  },
  ADMIN_MODERATION: {
    title: "Модерация",
    subtitle: "Сигналы для команды модерации и редакторов.",
    icon: ShieldCheck,
  },
  BUSINESS_VERIFICATION: {
    title: "Верификация бизнеса",
    subtitle: "Статусы проверки бизнеса и сопутствующие шаги.",
    icon: Lock,
  },
  SYSTEM_NOTIFICATIONS: {
    title: "Системные уведомления",
    subtitle: "Безопасность, критические статусы и сервисные сигналы.",
    icon: Send,
  },
};

function toFormState(policy: PolicyDto): PolicyFormState {
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

function surfaceLabel(surface: NotificationPolicySurface): string {
  switch (surface) {
    case "USER":
      return "User";
    case "BUSINESS":
      return "Business";
    case "ADMIN":
      return "Admin";
    case "SYSTEM":
      return "System";
    default:
      return surface;
  }
}

function describeScenario(policy: {
  scenario: NotificationScenario | null;
  notificationType: NotificationType | null;
}) {
  if (policy.scenario) return policy.scenario;
  if (policy.notificationType) return policy.notificationType;
  return "MANUAL";
}

export function AdminNotificationPoliciesClient() {
  const [items, setItems] = useState<PolicyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedPending, setSeedPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<PolicyDto | null>(null);
  const [formState, setFormState] = useState<PolicyFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/communications/notifications/policies", {
        credentials: "include",
      });
      const data = (await response.json().catch(() => ({}))) as { items?: PolicyDto[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить политики");
      }
      setItems(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить политики");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openEditor = (policy: PolicyDto) => {
    setSelected(policy);
    setFormState(toFormState(policy));
    setSheetOpen(true);
  };

  const sortedItems = useMemo(() => items, [items]);

  const handleSeed = async () => {
    setSeedPending(true);
    try {
      const response = await fetch("/api/admin/communications/notifications/policies/seed", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json().catch(() => ({}))) as {
        items?: PolicyDto[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось создать дефолтные политики");
      }
      setItems(data.items ?? []);
      toast.success("Дефолтные политики созданы");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать дефолтные политики");
    } finally {
      setSeedPending(false);
    }
  };

  const handleSave = async () => {
    if (!selected || !formState) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/communications/notifications/policies/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: formState.enabled,
          allowedInApp: formState.allowedInApp,
          allowedEmail: formState.allowedEmail,
          allowedTelegram: formState.allowedTelegram,
          defaultInApp: formState.defaultInApp,
          defaultEmail: formState.defaultEmail,
          defaultTelegram: formState.defaultTelegram,
          minCooldownMinutes: parseNumberOrNull(formState.minCooldownMinutes),
          maxPerDay: parseNumberOrNull(formState.maxPerDay),
          quietHoursEnabled: formState.quietHoursEnabled,
          quietHoursStart: formState.quietHoursStart || null,
          quietHoursEnd: formState.quietHoursEnd || null,
          digestTime: formState.digestTime || null,
          defaultReminderOffsetMinutes: parseNumberOrNull(formState.defaultReminderOffsetMinutes),
          availableReminderOffsets: parseOffsets(formState.availableReminderOffsets),
          description: formState.description || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { item?: PolicyDto; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Не удалось сохранить политику");
      }
      setItems((prev) => prev.map((item) => (item.id === data.item?.id ? data.item : item)));
      setSelected(data.item);
      setFormState(toFormState(data.item));
      toast.success("Политика обновлена");
      setSheetOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить политику");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {loading ? (
        <Card className="rounded-3xl border-stone-200/90">
          <CardContent className="flex min-h-[220px] items-center justify-center">
            <div className="text-sm text-stone-500">Загружаем политики уведомлений…</div>
          </CardContent>
        </Card>
      ) : sortedItems.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-stone-300">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-600">
              <Bell className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-stone-950">Политики ещё не созданы</h3>
              <p className="max-w-xl text-sm text-stone-500">
                Для MVP достаточно засидить дефолтные сценарии и затем подстроить каналы,
                cooldown и reminder offsets.
              </p>
            </div>
            <Button className="rounded-2xl" onClick={() => void handleSeed()} disabled={seedPending}>
              {seedPending ? "Создаём…" : "Создать дефолтные политики"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {sortedItems.map((policy) => {
            const meta = POLICY_META[policy.key] ?? {
              title: policy.key,
              subtitle: policy.description ?? "Notification policy",
              icon: Bell,
            };
            const Icon = meta.icon;

            return (
              <Card key={policy.id} className="rounded-3xl border-stone-200/90">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{meta.title}</CardTitle>
                        <CardDescription className="mt-1">{meta.subtitle}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                          policy.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-stone-200 bg-stone-100 text-stone-600",
                        )}
                      >
                        {policy.enabled ? "Включено" : "Выключено"}
                      </span>
                      {policy.isSystemLocked ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Locked
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-stone-600">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">{surfaceLabel(policy.surface)}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">{describeScenario(policy)}</span>
                    {policy.defaultReminderOffsetMinutes ? (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">
                        Offset {policy.defaultReminderOffsetMinutes}m
                      </span>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-stone-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Allowed</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-stone-800">
                        {policy.allowedInApp ? <Bell className="h-4 w-4" /> : null}
                        {policy.allowedEmail ? <Mail className="h-4 w-4" /> : null}
                        {policy.allowedTelegram ? <MessageCircle className="h-4 w-4" /> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Cooldown</div>
                      <div className="mt-2 text-sm font-medium text-stone-900">
                        {policy.minCooldownMinutes ? `${policy.minCooldownMinutes} мин` : "—"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-stone-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.14em] text-stone-400">Max / day</div>
                      <div className="mt-2 text-sm font-medium text-stone-900">
                        {policy.maxPerDay ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-stone-500">{policy.description ?? "Без описания"}</div>
                    <Button className="rounded-2xl" variant="outline" onClick={() => openEditor(policy)}>
                      Настроить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(nextOpen) => {
          setSheetOpen(nextOpen);
          if (!nextOpen) {
            setSelected(null);
            setFormState(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {selected && formState ? (
            <>
              <SheetHeader className="border-b border-border px-6 py-4 text-left">
                <SheetTitle>{POLICY_META[selected.key]?.title ?? selected.key}</SheetTitle>
                <SheetDescription>
                  Управление каналами, cooldown и временными ограничениями для этого сценария.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
                    <div>
                      <Label className="text-sm font-medium">Сценарий активен</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Можно быстро выключить policy без удаления настроек.
                      </p>
                    </div>
                    <Switch checked={formState.enabled} onCheckedChange={(checked) => setFormState((prev) => prev ? { ...prev, enabled: checked } : prev)} />
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <h3 className="text-sm font-semibold text-stone-900">Allowed channels</h3>
                    <div className="mt-4 grid gap-4">
                      {[
                        ["allowedInApp", "In-app"],
                        ["allowedEmail", "Email"],
                        ["allowedTelegram", "Telegram"],
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-sm">{label}</Label>
                          <Switch
                            checked={formState[key as keyof PolicyFormState] as boolean}
                            onCheckedChange={(checked) =>
                              setFormState((prev) => prev ? { ...prev, [key]: checked } : prev)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <h3 className="text-sm font-semibold text-stone-900">Default channels</h3>
                    <div className="mt-4 grid gap-4">
                      {[
                        ["defaultInApp", "In-app"],
                        ["defaultEmail", "Email"],
                        ["defaultTelegram", "Telegram"],
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <Label className="text-sm">{label}</Label>
                          <Switch
                            checked={formState[key as keyof PolicyFormState] as boolean}
                            onCheckedChange={(checked) =>
                              setFormState((prev) => prev ? { ...prev, [key]: checked } : prev)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="minCooldownMinutes">Min cooldown, мин</Label>
                      <Input
                        id="minCooldownMinutes"
                        inputMode="numeric"
                        value={formState.minCooldownMinutes}
                        onChange={(event) => setFormState((prev) => prev ? { ...prev, minCooldownMinutes: event.target.value } : prev)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPerDay">Max per day</Label>
                      <Input
                        id="maxPerDay"
                        inputMode="numeric"
                        value={formState.maxPerDay}
                        onChange={(event) => setFormState((prev) => prev ? { ...prev, maxPerDay: event.target.value } : prev)}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-900">Quiet hours</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ограничение отправок в ночные часы.
                        </p>
                      </div>
                      <Switch
                        checked={formState.quietHoursEnabled}
                        onCheckedChange={(checked) => setFormState((prev) => prev ? { ...prev, quietHoursEnabled: checked } : prev)}
                      />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursStart">Начало</Label>
                        <Input
                          id="quietHoursStart"
                          type="time"
                          value={formState.quietHoursStart}
                          onChange={(event) => setFormState((prev) => prev ? { ...prev, quietHoursStart: event.target.value } : prev)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quietHoursEnd">Конец</Label>
                        <Input
                          id="quietHoursEnd"
                          type="time"
                          value={formState.quietHoursEnd}
                          onChange={(event) => setFormState((prev) => prev ? { ...prev, quietHoursEnd: event.target.value } : prev)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="digestTime">Digest time</Label>
                      <Input
                        id="digestTime"
                        type="time"
                        value={formState.digestTime}
                        onChange={(event) => setFormState((prev) => prev ? { ...prev, digestTime: event.target.value } : prev)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="defaultReminderOffsetMinutes">Reminder offset, мин</Label>
                      <Input
                        id="defaultReminderOffsetMinutes"
                        inputMode="numeric"
                        value={formState.defaultReminderOffsetMinutes}
                        onChange={(event) => setFormState((prev) => prev ? { ...prev, defaultReminderOffsetMinutes: event.target.value } : prev)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availableReminderOffsets">Available reminder offsets</Label>
                    <Input
                      id="availableReminderOffsets"
                      placeholder="30, 60, 120, 180"
                      value={formState.availableReminderOffsets}
                      onChange={(event) => setFormState((prev) => prev ? { ...prev, availableReminderOffsets: event.target.value } : prev)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Список минут через запятую, доступный для сценария напоминаний.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Описание</Label>
                    <Input
                      id="description"
                      value={formState.description}
                      onChange={(event) => setFormState((prev) => prev ? { ...prev, description: event.target.value } : prev)}
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Отмена
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Сохраняем…" : "Сохранить"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
