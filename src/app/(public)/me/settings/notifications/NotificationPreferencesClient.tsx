"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/button";
import { Bell, Mail, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  NotificationSettingsGroupId,
  NotificationSettingsRow,
  NotificationSettingsSurfaceData,
} from "@/lib/notifications/settingsDomain";
import type { NotificationType } from "@prisma/client";

interface Props {
  initialData: NotificationSettingsSurfaceData;
  /** Внутри NotificationsModal — без верхнего Telegram-баннера */
  embedded?: boolean;
}

type RowsMap = Map<NotificationType, NotificationSettingsRow>;

function buildRowsMap(data: NotificationSettingsSurfaceData): RowsMap {
  return new Map(data.rows.map((row) => [row.notificationType, row]));
}

// "Важное" — чуть более выразительный заголовок
const PRIORITY_GROUP_IDS: Set<NotificationSettingsGroupId> = new Set(["user-important"]);

// ── Channel header ────────────────────────────────────────────────────────────

function ChannelHeaders({ telegramConnected }: { telegramConnected: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-hidden>
      <div className="flex w-12 flex-col items-center gap-0.5">
        <Bell className="h-3.5 w-3.5 text-neutral-400" />
        <span className="text-[10px] font-medium text-neutral-400">сайт</span>
      </div>
      <div className="flex w-12 flex-col items-center gap-0.5">
        <Mail className="h-3.5 w-3.5 text-neutral-400" />
        <span className="text-[10px] font-medium text-neutral-400">почта</span>
      </div>
      <div
        className={cn(
          "flex w-12 flex-col items-center gap-0.5",
          !telegramConnected && "opacity-35",
        )}
      >
        <Send className="h-3.5 w-3.5 text-neutral-400" />
        <span className="text-[10px] font-medium text-neutral-400">TG</span>
      </div>
    </div>
  );
}

// ── Single notification row ───────────────────────────────────────────────────

interface RowProps {
  row: NotificationSettingsRow;
  telegramConnected: boolean;
  pending: boolean;
  onSave: (
    type: NotificationType,
    patch: Partial<NotificationSettingsRow["channels"]>,
  ) => void;
}

function NotificationRow({ row, telegramConnected, pending, onSave }: RowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      {/* Label + description */}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium leading-snug text-neutral-900">
          {row.label}
        </p>
        {row.description ? (
          <p className="mt-0.5 text-xs leading-snug text-neutral-500">
            {row.description}
          </p>
        ) : null}
      </div>

      {/* Toggles */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex w-12 justify-center">
          <Toggle
            checked={row.channels.IN_APP}
            onChange={(v) => onSave(row.notificationType, { IN_APP: v })}
            disabled={pending}
            aria-label={`${row.label}: сайт`}
          />
        </div>
        <div className="flex w-12 justify-center">
          <Toggle
            checked={row.channels.EMAIL}
            onChange={(v) => onSave(row.notificationType, { EMAIL: v })}
            disabled={pending}
            aria-label={`${row.label}: почта`}
          />
        </div>
        <div
          className={cn(
            "flex w-12 justify-center",
            !telegramConnected && "opacity-35",
          )}
        >
          <Toggle
            checked={row.channels.TELEGRAM}
            onChange={(v) => onSave(row.notificationType, { TELEGRAM: v })}
            disabled={pending || !telegramConnected}
            aria-label={`${row.label}: Telegram`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationPreferencesClient({
  initialData,
  embedded = false,
}: Props) {
  const [prefs, setPrefs] = useState<RowsMap>(() => buildRowsMap(initialData));
  const [pending, startTransition] = useTransition();
  const [telegramConnected, setTelegramConnected] = useState(
    initialData.telegramConnected,
  );
  const [telegramUsername, setTelegramUsername] = useState(
    initialData.telegramUsername,
  );
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);

  const save = (
    type: NotificationType,
    patch: Partial<NotificationSettingsRow["channels"]>,
  ) => {
    setPrefs((prev) => {
      const next = new Map(prev);
      const cur = next.get(type);
      if (!cur) return prev;
      next.set(type, { ...cur, channels: { ...cur.channels, ...patch }, isOverridden: true });
      return next;
    });

    startTransition(async () => {
      try {
        const [[channel, enabled]] = Object.entries(patch) as Array<
          [keyof NotificationSettingsRow["channels"], boolean]
        >;
        const res = await fetch("/api/notifications/settings?surface=user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationType: type, channel, enabled }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Не удалось сохранить");
        setPrefs(buildRowsMap(initialData));
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
          const r = await fetch("/api/settings/telegram/status", {
            credentials: "include",
            cache: "no-store",
          });
          const s = (await r.json()) as { linked?: boolean; username?: string };
          if (r.ok && s.linked) {
            setTelegramConnected(true);
            setTelegramUsername(s.username);
          }
        } catch { /* passive refresh */ }
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть Telegram");
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  return (
    <div className={cn("flex flex-col", embedded ? "gap-3" : "gap-4")}>

      {/* ── Telegram banner (full-page only) ─────────────────────────────── */}
      {!embedded && (
        <section
          className={cn(
            "overflow-hidden rounded-2xl border shadow-sm",
            telegramConnected
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-white",
          )}
        >
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white",
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
                <p className="text-sm font-semibold text-neutral-900">
                  {telegramConnected
                    ? "Telegram подключён"
                    : "Подключите Telegram для уведомлений"}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {telegramConnected
                    ? telegramUsername
                      ? `Уведомления приходят в @${telegramUsername}.`
                      : "Уведомления приходят прямо в Telegram."
                    : "Так вы быстрее увидите напоминания и важные обновления."}
                </p>
              </div>
            </div>
            {!telegramConnected && (
              <Button
                type="button"
                onClick={() => void handleTelegramConnect()}
                disabled={isLinkingTelegram}
                className="h-11 rounded-xl px-5 sm:shrink-0"
              >
                {isLinkingTelegram ? "Готовим ссылку…" : "Подключить Telegram"}
              </Button>
            )}
          </div>
        </section>
      )}

      {/* ── Notification groups ───────────────────────────────────────────── */}
      {initialData.groups.map((group) => {
        const rows = group.rows
          .map((r) => prefs.get(r.notificationType))
          .filter((r): r is NotificationSettingsRow => Boolean(r));
        if (!rows.length) return null;

        const isPriority = PRIORITY_GROUP_IDS.has(group.id);

        return (
          <section
            key={group.id}
            className={cn(
              "overflow-hidden rounded-2xl border bg-white shadow-sm",
              isPriority ? "border-neutral-200" : "border-neutral-100",
            )}
          >
            {/* Group header */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5",
                isPriority
                  ? "border-neutral-200 bg-neutral-50"
                  : "border-neutral-100 bg-white",
              )}
            >
              <div className="min-w-0 flex-1">
                <h2
                  className={cn(
                    "text-sm font-semibold",
                    isPriority ? "text-neutral-900" : "text-neutral-600",
                  )}
                >
                  {group.title}
                </h2>
              </div>
              <ChannelHeaders telegramConnected={telegramConnected} />
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-100">
              {rows.map((row) => (
                <NotificationRow
                  key={row.notificationType}
                  row={row}
                  telegramConnected={telegramConnected}
                  pending={pending}
                  onSave={save}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Footer hint ───────────────────────────────────────────────────── */}
      {!embedded && (
        <p className="px-1 text-xs text-neutral-400">
          Изменения сохраняются автоматически.
        </p>
      )}
    </div>
  );
}
