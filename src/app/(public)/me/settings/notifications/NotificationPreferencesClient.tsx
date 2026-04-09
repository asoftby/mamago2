"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Mail, Bell, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PreferenceRow } from "@/server/services/notificationPreference.service";
import type { NotificationType } from "@prisma/client";

// ── Groups ────────────────────────────────────────────────────────────────────

type Group = {
  title: string;
  types: NotificationType[];
};

const GROUPS: Group[] = [
  {
    title: "Мои публикации",
    types: [
      "PLACE_APPROVED",
      "PLACE_NEEDS_CHANGES",
      "PLACE_REJECTED",
      "PLACE_UPDATE_APPROVED",
      "PLACE_UPDATE_NEEDS_REVISION",
      "PLACE_UPDATE_REJECTED",
      "ACTIVITY_APPROVED",
      "ACTIVITY_NEEDS_CHANGES",
      "ACTIVITY_REJECTED",
      "OFFER_APPROVED",
      "OFFER_NEEDS_CHANGES",
      "OFFER_REJECTED",
    ],
  },
  {
    title: "Заявки и ответы",
    types: [
      "BUSINESS_VERIFIED",
      "BUSINESS_REJECTED",
      "BUSINESS_NEEDS_INFO",
    ],
  },
  {
    title: "План и напоминания",
    types: ["WELCOME", "REMINDER", "RECOMMENDATION", "SYSTEM"],
  },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  PLACE_APPROVED:              "Место опубликовано",
  PLACE_NEEDS_CHANGES:         "Место требует правок",
  PLACE_REJECTED:              "Место отклонено",
  PLACE_UPDATE_APPROVED:       "Изменения места опубликованы",
  PLACE_UPDATE_NEEDS_REVISION: "Изменения места требуют правок",
  PLACE_UPDATE_REJECTED:       "Изменения места отклонены",
  ACTIVITY_APPROVED:           "Событие опубликовано",
  ACTIVITY_NEEDS_CHANGES:      "Событие требует правок",
  ACTIVITY_REJECTED:           "Событие отклонено",
  OFFER_APPROVED:              "Предложение опубликовано",
  OFFER_NEEDS_CHANGES:         "Предложение требует правок",
  OFFER_REJECTED:              "Предложение отклонено",
  BUSINESS_VERIFIED:           "Верификация пройдена",
  BUSINESS_REJECTED:           "Верификация отклонена",
  BUSINESS_NEEDS_INFO:         "Требуется дополнительная информация",
  WELCOME:                     "Приветствие и онбординг",
  REMINDER:                    "Напоминания",
  RECOMMENDATION:              "Подборки и рекомендации",
  SYSTEM:                      "Системные уведомления",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialPreferences: PreferenceRow[];
  /** Внутри NotificationsModal — без лишних отступов и нижней ремарки */
  embedded?: boolean;
}

type PrefsMap = Map<NotificationType, PreferenceRow>;

function ChannelColumnHeaders() {
  return (
    <div
      className="flex shrink-0 items-start justify-end gap-3 sm:gap-4"
      aria-hidden
    >
      <div className="flex w-[52px] flex-col items-center gap-1 text-center">
        <Bell className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="text-[10px] font-medium leading-tight text-neutral-400">
          сайт
        </span>
      </div>
      <div className="flex w-[52px] flex-col items-center gap-1 text-center">
        <Mail className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="text-[10px] font-medium leading-tight text-neutral-400">
          почта
        </span>
      </div>
      <div className="flex w-[52px] flex-col items-center gap-1 text-center opacity-40">
        <Send className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="text-[10px] font-medium leading-tight text-neutral-400">
          Telegram
        </span>
      </div>
    </div>
  );
}

export function NotificationPreferencesClient({
  initialPreferences,
  embedded = false,
}: Props) {
  const [prefs, setPrefs] = useState<PrefsMap>(
    () => new Map(initialPreferences.map((p) => [p.notificationType, p])),
  );
  const [pending, startTransition] = useTransition();

  const save = (type: NotificationType, patch: Partial<Pick<PreferenceRow, "inApp" | "email" | "telegram">>) => {
    // Optimistic update
    setPrefs((prev) => {
      const next = new Map(prev);
      const current = next.get(type)!;
      next.set(type, { ...current, ...patch, isOverridden: true });
      return next;
    });

    startTransition(async () => {
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationType: type,
            inAppEnabled:    patch.inApp    ?? null,
            emailEnabled:    patch.email    ?? null,
            telegramEnabled: patch.telegram ?? null,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Не удалось сохранить");
        // Revert on error
        setPrefs((prev) => {
          const next = new Map(prev);
          const original = initialPreferences.find((p) => p.notificationType === type);
          if (original) next.set(type, original);
          return next;
        });
      }
    });
  };

  // Only render groups that have at least one pref available for this user's role
  const visibleGroups = GROUPS.filter((g) =>
    g.types.some((t) => prefs.has(t)),
  );

  return (
    <div className={embedded ? "space-y-3" : "space-y-4"}>
      {visibleGroups.map((group) => {
        const rows = group.types.filter((t) => prefs.has(t));
        if (!rows.length) return null;

        return (
          <section
            key={group.title}
            className="rounded-2xl border border-neutral-100 bg-white shadow-sm"
          >
            <div
              className={cn(
                "sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-neutral-100 bg-white px-5 py-3.5",
                "rounded-t-2xl",
              )}
            >
              <h2 className="min-w-0 flex-1 pt-0.5 text-sm font-semibold text-neutral-700">
                {group.title}
              </h2>
              <ChannelColumnHeaders />
            </div>

            <div className="divide-y divide-neutral-100 overflow-hidden rounded-b-2xl">
              {rows.map((type) => {
                const pref = prefs.get(type)!;
                return (
                  <div key={type} className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <span className="text-sm text-neutral-800 flex-1 min-w-0">
                      {TYPE_LABELS[type]}
                    </span>

                    <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                      <div className="flex w-[52px] justify-center">
                        <Toggle
                          checked={pref.inApp}
                          onChange={(v) => save(type, { inApp: v })}
                          disabled={pending}
                          aria-label={`${TYPE_LABELS[type]}: сайт`}
                        />
                      </div>
                      <div className="flex w-[52px] justify-center">
                        <Toggle
                          checked={pref.email}
                          onChange={(v) => save(type, { email: v })}
                          disabled={pending}
                          aria-label={`${TYPE_LABELS[type]}: почта`}
                        />
                      </div>
                      <div className="flex w-[52px] justify-center opacity-40">
                        <Toggle
                          checked={pref.telegram}
                          onChange={(v) => save(type, { telegram: v })}
                          disabled
                          aria-label={`${TYPE_LABELS[type]}: Telegram`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!embedded ? (
        <p className="text-xs text-neutral-400 px-1">
          Каналы Email и Telegram применяются, когда доставка для них включена на
          стороне сервиса.
        </p>
      ) : null}
    </div>
  );
}
