"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { NotificationPolicy, NotificationPolicySurface, NotificationScenario, NotificationType } from "@prisma/client";
import { Bell, Clock3, Lock, Mail, Send, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";

type PolicyDto = NotificationPolicy;

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
                      <div className="mt-2 text-sm text-stone-800">
                        {[
                          policy.allowedInApp ? "app" : null,
                          policy.allowedEmail ? "email" : null,
                          policy.allowedTelegram ? "telegram" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
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
                    <Button asChild className="rounded-2xl" variant="outline">
                      <Link href={adminPath(`/communications/scenarios/${policy.key}?tab=policy`)}>
                        Настроить
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
