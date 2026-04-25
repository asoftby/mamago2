"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  NotificationSettingsRow,
  NotificationSettingsSurfaceData,
} from "@/lib/notifications/settingsDomain";
import {
  getUserNotificationMatrixDefinitions,
  SYSTEM_NOTIFICATION_GUARD_MESSAGE,
  wouldDisableLastSystemNotificationChannel,
} from "@/lib/notifications/userNotificationPresentation";

interface Props {
  initialData: NotificationSettingsSurfaceData;
  embedded?: boolean;
}

type RowsMap = Map<NotificationType, NotificationSettingsRow>;
type ChannelKey = NotificationChannel;
type SavePatch = {
  notificationType: NotificationType;
  channel: ChannelKey;
  enabled: boolean;
};

const CHANNEL_OPTIONS: Array<{
  key: ChannelKey;
  title: string;
  shortTitle: string;
}> = [
  { key: "IN_APP", title: "В приложении", shortTitle: "приложение" },
  { key: "EMAIL", title: "Email", shortTitle: "email" },
  { key: "TELEGRAM", title: "Telegram", shortTitle: "TG" },
];

function buildRowsMap(data: NotificationSettingsSurfaceData): RowsMap {
  return new Map(data.rows.map((row) => [row.notificationType, row]));
}

function cloneRowsMap(source: RowsMap): RowsMap {
  return new Map(
    Array.from(source.entries()).map(([type, row]) => [
      type,
      {
        ...row,
        channels: { ...row.channels },
      },
    ]),
  );
}

function applyPatch(source: RowsMap, patch: SavePatch): RowsMap {
  const next = cloneRowsMap(source);
  const row = next.get(patch.notificationType);
  if (!row) return next;

  next.set(patch.notificationType, {
    ...row,
    channels: {
      ...row.channels,
      [patch.channel]: patch.enabled,
    },
    isOverridden: true,
  });

  return next;
}

export function NotificationPreferencesClient({
  initialData,
  embedded = false,
}: Props) {
  const [prefs, setPrefs] = useState<RowsMap>(() => buildRowsMap(initialData));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [telegramConnected, setTelegramConnected] = useState(
    initialData.telegramConnected,
  );
  const [telegramUsername, setTelegramUsername] = useState(
    initialData.telegramUsername,
  );
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);

  const rowDefinitions = useMemo(
    () => getUserNotificationMatrixDefinitions(),
    [],
  );

  const handleToggleChannel = (
    notificationType: NotificationType,
    channel: ChannelKey,
    enabled: boolean,
  ) => {
    const currentRow = prefs.get(notificationType);
    if (!currentRow) return;

    if (channel === "TELEGRAM" && enabled && !telegramConnected) {
      toast.info("Сначала подключите Telegram");
      return;
    }

    if (
      wouldDisableLastSystemNotificationChannel({
        notificationType,
        channels: currentRow.channels,
        channel,
        enabled,
      })
    ) {
      toast.error(SYSTEM_NOTIFICATION_GUARD_MESSAGE);
      return;
    }

    const previous = cloneRowsMap(prefs);
    const patch: SavePatch = { notificationType, channel, enabled };
    setPrefs((prev) => applyPatch(prev, patch));
    setPendingKey(`${notificationType}:${channel}`);

    startTransition(async () => {
      try {
        const res = await fetch("/api/notifications/settings?surface=user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as
            | { error?: string; message?: string }
            | null;

          if (json?.error === "SYSTEM_CHANNEL_REQUIRED") {
            throw new Error(
              json.message ?? SYSTEM_NOTIFICATION_GUARD_MESSAGE,
            );
          }

          if (json?.error === "Telegram is not connected") {
            throw new Error("Сначала подключите Telegram");
          }

          throw new Error("Не удалось сохранить");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось сохранить",
        );
        setPrefs(previous);
      } finally {
        setPendingKey((current) =>
          current === `${notificationType}:${channel}` ? null : current,
        );
      }
    });
  };

  const handleTelegramConnect = async () => {
    setIsLinkingTelegram(true);
    try {
      const res = await fetch("/api/settings/telegram/link", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Не удалось создать ссылку для Telegram");
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
      toast.success("Откройте бота и нажмите Start");
      window.setTimeout(async () => {
        try {
          const response = await fetch("/api/settings/telegram/status", {
            credentials: "include",
            cache: "no-store",
          });
          const status = (await response.json()) as {
            linked?: boolean;
            username?: string;
          };
          if (response.ok && status.linked) {
            setTelegramConnected(true);
            setTelegramUsername(status.username);
          }
        } catch {
          // Passive refresh only.
        }
      }, 3000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось открыть Telegram",
      );
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  return (
    <div className={cn("flex flex-col", embedded ? "gap-5" : "gap-6")}>
      {!embedded && (
        <section
          className={cn(
            "rounded-[28px] border px-5 py-5 sm:px-6",
            telegramConnected
              ? "border-emerald-200/80 bg-emerald-50/70"
              : "border-sky-200/80 bg-sky-50/70",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm",
                  telegramConnected ? "text-emerald-600" : "text-sky-600",
                )}
              >
                {telegramConnected ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-950 sm:text-base">
                  {telegramConnected ? "Telegram подключён" : "Подключите Telegram"}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {telegramConnected
                    ? telegramUsername
                      ? `Уведомления приходят в @${telegramUsername}`
                      : "Уведомления приходят в ваш Telegram"
                    : "Telegram нужен, чтобы получать важные уведомления и напоминания быстрее."}
                </p>
              </div>
            </div>

            {!telegramConnected ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl bg-white"
                onClick={handleTelegramConnect}
                disabled={isLinkingTelegram}
              >
                {isLinkingTelegram ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Открываем…
                  </>
                ) : (
                  "Подключить"
                )}
              </Button>
            ) : null}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-neutral-100 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-neutral-900">Уведомления</h2>
        </div>

        <div
          className={cn(
            "grid-cols-[minmax(0,1fr)_88px_88px_88px] gap-3 border-b border-neutral-100 px-6 py-3 text-xs font-medium uppercase tracking-[0.08em] text-neutral-400",
            embedded ? "hidden" : "hidden md:grid",
          )}
        >
          <span>Тип уведомлений</span>
          {CHANNEL_OPTIONS.map((channel) => (
            <span key={channel.key} className="text-center">
              {channel.shortTitle}
            </span>
          ))}
        </div>

        <div className="divide-y divide-neutral-100">
          {rowDefinitions.map((definition) => {
            const row = prefs.get(definition.notificationType);
            if (!row) return null;

            const Icon = definition.icon;

            return (
              <div
                key={definition.notificationType}
                className="px-5 py-4 sm:px-6 sm:py-5"
              >
                <div
                  className={cn(
                    "grid gap-4",
                    embedded
                      ? ""
                      : "md:grid-cols-[minmax(0,1fr)_88px_88px_88px] md:items-center",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 sm:text-[15px]">
                          {definition.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-neutral-500">
                          {definition.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid grid-cols-3 gap-2",
                      embedded ? "" : "md:contents",
                    )}
                  >
                    {CHANNEL_OPTIONS.map((channel) => {
                      const telegramToggleBlocked =
                        channel.key === "TELEGRAM" &&
                        !telegramConnected &&
                        row.channels.TELEGRAM !== true;
                      const disabled =
                        pending ||
                        pendingKey === `${definition.notificationType}:${channel.key}` ||
                        telegramToggleBlocked;

                      return (
                        <div
                          key={channel.key}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-2xl bg-stone-50/70 px-3 py-3",
                            embedded ? "" : "md:bg-transparent md:px-0 md:py-0",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[11px] font-medium text-neutral-500",
                              embedded ? "" : "md:hidden",
                            )}
                          >
                            {channel.shortTitle}
                          </span>
                          <Toggle
                            checked={row.channels[channel.key]}
                            onChange={(value) =>
                              handleToggleChannel(
                                definition.notificationType,
                                channel.key,
                                value,
                              )}
                            disabled={disabled}
                            aria-label={`${definition.title}: ${channel.title}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-stone-400">
        Изменения сохраняются автоматически
      </p>
    </div>
  );
}
