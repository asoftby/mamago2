"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Loader2, Mail, Send } from "lucide-react";
import { NotificationChannel, type NotificationType } from "@prisma/client";
import { toast } from "@/lib/toast";
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
import {
  buildEmptyNotificationSettingsSurfaceData,
  type NotificationSettingsSurface,
  type NotificationSettingsSurfaceData,
} from "@/lib/notifications/settingsDomain";
import { useTelegramConnectionStatus } from "@/hooks/useTelegramConnectionStatus";

type Props = {
  surface?: NotificationSettingsSurface;
  initialData?: NotificationSettingsSurfaceData;
  compact?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  className?: string;
};

function ChannelHeaders({ telegramConnected }: { telegramConnected: boolean }) {
  return (
    <div className="flex shrink-0 items-start justify-end gap-3 sm:gap-4">
      <div className="flex w-[52px] flex-col items-center gap-1 text-center">
        <Bell className="h-3.5 w-3.5 shrink-0 text-stone-400" />
        <span className="text-[10px] font-medium leading-tight text-stone-400">
          сайт
        </span>
      </div>
      <div className="flex w-[52px] flex-col items-center gap-1 text-center">
        <Mail className="h-3.5 w-3.5 shrink-0 text-stone-400" />
        <span className="text-[10px] font-medium leading-tight text-stone-400">
          почта
        </span>
      </div>
      <div
        className={cn(
          "flex w-[52px] flex-col items-center gap-1 text-center",
          !telegramConnected && "opacity-40",
        )}
      >
        <Send className="h-3.5 w-3.5 shrink-0 text-stone-400" />
        <span className="text-[10px] font-medium leading-tight text-stone-400">
          Telegram
        </span>
      </div>
    </div>
  );
}

function buildSettingsApiHref(surface: NotificationSettingsSurface): string {
  return `/api/notifications/settings?surface=${surface.toLowerCase()}`;
}

export function NotificationSettingsTable({
  surface = "BUSINESS",
  initialData,
  compact = false,
  pageTitle,
  pageDescription,
  className,
}: Props) {
  const [data, setData] = useState<NotificationSettingsSurfaceData | null>(
    initialData ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use unified Telegram status hook with controlled polling
  const [isPolling, setIsPolling] = useState(false);
  const { status: telegramStatus } = useTelegramConnectionStatus({
    enabled: true,
    polling: isPolling,
    onConnected: (status) => {
      setIsPolling(false);
      setData((prev) =>
        prev
          ? {
              ...prev,
              telegramConnected: true,
              telegramUsername: status.username,
            }
          : prev,
      );
      toast.success("Telegram подключён");
    },
  });

  // Sync telegram status from hook to data state
  useEffect(() => {
    if (telegramStatus && data) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              telegramConnected: telegramStatus.linked,
              telegramUsername: telegramStatus.username,
            }
          : prev,
      );
    }
  }, [telegramStatus, data]);

  useEffect(() => {
    if (initialData) return;

    let alive = true;
    void (async () => {
      try {
        const res = await fetch(buildSettingsApiHref(surface), {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const json = (await res.json()) as NotificationSettingsSurfaceData;
        if (!alive) return;
        setData(json);
      } catch {
        if (!alive) return;
        setError("Не удалось загрузить настройки уведомлений.");
        setData(buildEmptyNotificationSettingsSurfaceData(surface));
      }
    })();

    return () => {
      alive = false;
    };
  }, [initialData, surface]);

  const handleToggle = (
    notificationType: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ) => {
    if (!data) return;
    if (channel === NotificationChannel.TELEGRAM && !data.telegramConnected) {
      return;
    }

    const rollback = data;
    setError(null);
    setPendingKey(`${notificationType}:${channel}`);
    setData({
      ...data,
      rows: data.rows.map((row) =>
        row.notificationType === notificationType
          ? {
              ...row,
              channels: {
                ...row.channels,
                [channel]: enabled,
              },
            }
          : row,
      ),
      groups: data.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) =>
          row.notificationType === notificationType
            ? {
                ...row,
                channels: {
                  ...row.channels,
                  [channel]: enabled,
                },
              }
            : row,
        ),
      })),
    });

    startTransition(async () => {
      try {
        const res = await fetch(buildSettingsApiHref(surface), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            notificationType,
            channel,
            enabled,
          }),
        });

        if (!res.ok) {
          throw new Error("save_failed");
        }
      } catch {
        setError("Не удалось сохранить изменение. Попробуйте ещё раз.");
        setData(rollback);
      } finally {
        setPendingKey(null);
      }
    });
  };

  const handleConnectTelegram = async () => {
    setError(null);
    setIsLinkingTelegram(true);

    try {
      const res = await fetch("/api/settings/telegram/link", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Не удалось начать подключение Telegram");
      }

      window.open(json.url, "_blank", "noopener,noreferrer");
      
      // Start polling for connection status
      setIsPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать подключение Telegram");
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    setError(null);
    setIsUnlinkingTelegram(true);

    try {
      const res = await fetch("/api/settings/telegram", {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(json?.error || "Не удалось отключить Telegram");
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              telegramConnected: false,
              telegramUsername: undefined,
            }
          : prev,
      );
      setUnlinkDialogOpen(false);
      toast.success("Telegram отключён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отключить Telegram");
    } finally {
      setIsUnlinkingTelegram(false);
    }
  };

  if (!data) {
    return (
      <div className={cn("py-10 text-center text-sm text-stone-500", className)}>
        Загрузка настроек…
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact ? "space-y-4" : "space-y-6",
        className,
      )}
    >
      {!compact && pageTitle ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950">
            {pageTitle}
          </h1>
          {pageDescription ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
              {pageDescription}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.telegramConnected ? (
        <div className="flex items-center gap-3 rounded-[22px] border border-emerald-200/80 bg-emerald-50/80 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <Send className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-950">
              Telegram подключён
            </p>
            <p className="mt-1 text-xs leading-6 text-stone-600">
              {data.telegramUsername
                ? `Подключён аккаунт @${data.telegramUsername}. Теперь этот канал доступен для уведомлений.`
                : "Telegram-канал доступен для уведомлений."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={() => setUnlinkDialogOpen(true)}
          >
            Отключить
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-[22px] border border-sky-200/80 bg-sky-50/80 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <Send className="h-4 w-4 text-sky-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-950">
              Подключите Telegram, чтобы получать уведомления
            </p>
            <p className="mt-1 text-xs leading-6 text-stone-600">
              Пока Telegram не подключён, этот канал недоступен и остаётся серым.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl bg-white"
            onClick={handleConnectTelegram}
            disabled={isLinkingTelegram || isPolling}
          >
            {isLinkingTelegram || isPolling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isLinkingTelegram ? "Открываем…" : "Ожидаем подключение…"}
              </>
            ) : (
              "Подключить"
            )}
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {data.groups.map((group) => (
        <section
          key={group.id}
          className="overflow-hidden rounded-[24px] border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="pt-0.5 text-sm font-semibold text-stone-700">
                {group.title}
              </h2>
              {group.description ? (
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {group.description}
                </p>
              ) : null}
            </div>
            <ChannelHeaders telegramConnected={data.telegramConnected} />
          </div>
          <div className="divide-y divide-stone-100">
            {group.rows.map((row) => (
              <div
                key={row.notificationType}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <span className="min-w-0 flex-1 text-sm text-stone-800">
                  {row.label}
                </span>
                <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                  {[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.TELEGRAM].map(
                    (channel) => {
                      const isTelegram = channel === NotificationChannel.TELEGRAM;
                      const isDisabled =
                        isPending ||
                        pendingKey === `${row.notificationType}:${channel}` ||
                        (isTelegram && !data.telegramConnected);

                      return (
                        <div
                          key={channel}
                          className={cn(
                            "flex w-[52px] justify-center",
                            isTelegram && !data.telegramConnected && "opacity-40",
                          )}
                        >
                          <Toggle
                            checked={row.channels[channel]}
                            onChange={(value) =>
                              handleToggle(row.notificationType, channel, value)
                            }
                            disabled={isDisabled}
                            aria-label={`${row.label}: ${channel}`}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              После отключения Telegram-канал станет недоступен для уведомлений, но настройки сайта и почты сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-stone-900 hover:bg-stone-800"
              onClick={handleDisconnectTelegram}
              disabled={isUnlinkingTelegram}
            >
              {isUnlinkingTelegram ? (
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
