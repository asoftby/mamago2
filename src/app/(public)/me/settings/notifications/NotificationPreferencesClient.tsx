"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/toast";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useTelegramConnectionStatus } from "@/hooks/useTelegramConnectionStatus";
import { PlanNotificationScheduleSettings } from "./PlanNotificationScheduleSettings";

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
  { key: "TELEGRAM", title: "Telegram", shortTitle: "telegram" },
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
  const [telegramConfigured, setTelegramConfigured] = useState(
    initialData.telegramConfigured,
  );
  const [telegramUsername, setTelegramUsername] = useState(
    initialData.telegramUsername,
  );
  const [telegramBotUsername, setTelegramBotUsername] = useState(
    initialData.telegramBotUsername,
  );
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isPollingTelegram, setIsPollingTelegram] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const rowDefinitions = useMemo(
    () => getUserNotificationMatrixDefinitions(),
    [],
  );
  const { status: telegramStatus } = useTelegramConnectionStatus({
    enabled: true,
    polling: isPollingTelegram,
    onConnected: (status) => {
      setIsPollingTelegram(false);
      setTelegramConnected(true);
      setTelegramConfigured(status.configured ?? true);
      setTelegramUsername(status.username);
      setTelegramBotUsername(status.botUsername);
      toast.success("Telegram подключён");
    },
  });

  useEffect(() => {
    if (!telegramStatus) return;

    setTelegramConnected(telegramStatus.linked);
    setTelegramConfigured(telegramStatus.configured ?? false);
    setTelegramUsername(telegramStatus.username);
    setTelegramBotUsername(telegramStatus.botUsername);
  }, [telegramStatus]);

  const handleToggleChannel = (
    notificationType: NotificationType,
    channel: ChannelKey,
    enabled: boolean,
  ) => {
    const currentRow = prefs.get(notificationType);
    if (!currentRow) return;

    if (channel === "TELEGRAM" && enabled && !telegramConnected) {
      void handleTelegramConnect();
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

  async function handleTelegramConnect() {
    if (!telegramConfigured) {
      toast.error("Telegram бот пока не настроен на сервере");
      return;
    }

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
      toast.success(
        telegramBotUsername
          ? `Откройте @${telegramBotUsername} и нажмите Start`
          : "Откройте бота и нажмите Start",
      );
      setIsPollingTelegram(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось открыть Telegram",
      );
    } finally {
      setIsLinkingTelegram(false);
    }
  }

  const handleTelegramDisconnect = async () => {
    setIsDisconnectingTelegram(true);
    try {
      const res = await fetch("/api/settings/telegram", {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(json?.error ?? "Не удалось отключить Telegram");
      }

      setTelegramConnected(false);
      setTelegramUsername(undefined);
      setDisconnectDialogOpen(false);
      setIsPollingTelegram(false);
      setPrefs((prev) => {
        const next = cloneRowsMap(prev);
        for (const [notificationType, row] of next.entries()) {
          next.set(notificationType, {
            ...row,
            channels: {
              ...row.channels,
              TELEGRAM: false,
            },
          });
        }
        return next;
      });
      toast.success("Telegram отключён");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось отключить Telegram",
      );
    } finally {
      setIsDisconnectingTelegram(false);
    }
  };

  const handleSendTelegramTest = async () => {
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/notifications/telegram/test", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; code?: string }
        | null;

      if (!res.ok || !json?.ok) {
        if (json?.code === "TELEGRAM_NOT_CONNECTED") {
          throw new Error("Telegram ещё не подключён");
        }
        if (json?.code === "TELEGRAM_BOT_NOT_CONFIGURED") {
          throw new Error("Telegram бот не настроен на сервере");
        }
        if (json?.code === "TELEGRAM_SEND_FAILED") {
          throw new Error("Не удалось отправить сообщение в Telegram");
        }
        throw new Error("Не удалось отправить тестовое уведомление");
      }

      toast.success("Тестовое сообщение отправлено в Telegram");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось отправить тестовое уведомление",
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className={cn("flex flex-col", embedded ? "gap-5" : "gap-6")}>
      <section
          className={cn(
            "rounded-[28px] border px-5 py-5 sm:px-6",
            embedded && "rounded-2xl px-4 py-4 sm:px-5",
            !telegramConfigured
              ? "border-amber-200/80 bg-amber-50/70"
              : telegramConnected
              ? "border-[#24A1DE]/20 bg-[#24A1DE]/10"
              : "border-sky-200/80 bg-sky-50/70",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm",
                  !telegramConfigured
                    ? "text-amber-600"
                    : telegramConnected
                      ? "text-[#24A1DE]"
                      : "text-sky-600",
                )}
              >
                {!telegramConfigured ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : telegramConnected ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-950 sm:text-base">
                  {!telegramConfigured
                    ? "Telegram канал пока не настроен"
                    : telegramConnected
                      ? "Telegram подключён"
                      : "Подключите Telegram"}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {!telegramConfigured
                    ? "Фронт уже готов, но серверный бот ещё не сконфигурирован. После настройки канал станет доступен без дополнительных изменений UI."
                    : telegramConnected
                    ? telegramUsername
                      ? `Уведомления приходят в @${telegramUsername}`
                      : "Уведомления приходят в ваш Telegram"
                    : "Telegram нужен, чтобы получать важные уведомления и напоминания быстрее."}
                </p>
                {telegramConfigured && telegramBotUsername ? (
                  <p className="mt-1 text-xs text-stone-500">
                    Бот для подключения: @{telegramBotUsername}
                  </p>
                ) : null}
                {telegramConfigured && !telegramConnected ? (
                  <p className="mt-2 text-xs text-stone-500">
                    После нажатия «Подключить» откройте бота, нажмите Start и вернитесь сюда. Статус обновится автоматически.
                  </p>
                ) : null}
              </div>
            </div>

            {!telegramConfigured ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl bg-white"
                disabled
              >
                Бот не настроен
              </Button>
            ) : !telegramConnected ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl bg-white"
                onClick={handleTelegramConnect}
                disabled={isLinkingTelegram || isPollingTelegram}
              >
                {isLinkingTelegram || isPollingTelegram ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isLinkingTelegram ? "Открываем…" : "Ожидаем Start…"}
                  </>
                ) : (
                  "Подключить"
                )}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {!embedded ? <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl bg-white"
                  onClick={handleSendTelegramTest}
                  disabled={isSendingTest}
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Отправляем…
                    </>
                  ) : (
                    "Отправить тест"
                  )}
                </Button> : null}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl bg-white"
                  onClick={() => setDisconnectDialogOpen(true)}
                >
                  Отключить
                </Button>
              </div>
            )}
          </div>
        </section>

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
                  className="grid gap-4 md:grid-cols-[minmax(0,1fr)_88px_88px_88px] md:items-center"
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
                      "md:contents",
                    )}
                  >
                    {CHANNEL_OPTIONS.map((channel) => {
                      const telegramToggleBlocked =
                        channel.key === "TELEGRAM" &&
                        !telegramConfigured &&
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
                            "md:bg-transparent md:px-0 md:py-0",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[11px] font-medium text-neutral-500",
                              "md:hidden",
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
                {definition.notificationType === "REMINDER" ? (
                  <PlanNotificationScheduleSettings />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-sm text-stone-400">
        Изменения сохраняются автоматически
      </p>

      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent className="rounded-2xl border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              Telegram перестанет получать уведомления, а сам канал снова станет
              недоступен в настройках. Email и уведомления в приложении сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-stone-900 hover:bg-stone-800"
              onClick={handleTelegramDisconnect}
              disabled={isDisconnectingTelegram}
            >
              {isDisconnectingTelegram ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отключаем…
                </>
              ) : (
                "Отключить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
