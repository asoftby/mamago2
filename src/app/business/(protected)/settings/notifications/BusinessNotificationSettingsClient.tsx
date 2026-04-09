"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Mail, Bell, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { PreferenceRow } from "@/server/services/notificationPreference.service";
import type { NotificationType } from "@prisma/client";

// ── Groups ────────────────────────────────────────────────────────────────────

type Group = { title: string; types: NotificationType[] };

const GROUPS: Group[] = [
  {
    title: "Семья и план",
    types: ["WELCOME", "REMINDER", "RECOMMENDATION", "SYSTEM"],
  },
  {
    title: "Заявки",
    types: [
      "BUSINESS_VERIFIED",
      "BUSINESS_REJECTED",
      "BUSINESS_NEEDS_INFO",
    ],
  },
  {
    title: "Публикации",
    types: [
      "PLACE_APPROVED",
      "PLACE_NEEDS_CHANGES",
      "PLACE_REJECTED",
      "PLACE_UPDATE_APPROVED",
      "PLACE_UPDATE_NEEDS_REVISION",
      "PLACE_UPDATE_REJECTED",
      "OFFER_APPROVED",
      "OFFER_NEEDS_CHANGES",
      "OFFER_REJECTED",
    ],
  },
  {
    title: "Модерация",
    types: [
      "ACTIVITY_APPROVED",
      "ACTIVITY_NEEDS_CHANGES",
      "ACTIVITY_REJECTED",
    ],
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

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialPreferences: PreferenceRow[];
  /** Внутри NotificationsModal */
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
        <Bell className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="text-[10px] font-medium leading-tight text-gray-400">
          сайт
        </span>
      </div>
      <div className="flex w-[52px] flex-col items-center gap-1 text-center">
        <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="text-[10px] font-medium leading-tight text-gray-400">
          почта
        </span>
      </div>
      <div className="flex w-[52px] flex-col items-center gap-1 text-center opacity-40">
        <Send className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="text-[10px] font-medium leading-tight text-gray-400">
          Telegram
        </span>
      </div>
    </div>
  );
}

export function BusinessNotificationSettingsClient({
  initialPreferences,
  embedded = false,
}: Props) {
  const [prefs, setPrefs] = useState<PrefsMap>(
    () => new Map(initialPreferences.map((p) => [p.notificationType, p])),
  );
  const [pending, startTransition] = useTransition();

  const save = (
    type: NotificationType,
    patch: Partial<Pick<PreferenceRow, "inApp" | "email" | "telegram">>,
  ) => {
    setPrefs((prev) => {
      const next = new Map(prev);
      const cur = next.get(type)!;
      next.set(type, { ...cur, ...patch, isOverridden: true });
      return next;
    });

    startTransition(async () => {
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationType: type,
            inAppEnabled:    "inApp"    in patch ? patch.inApp    : null,
            emailEnabled:    "email"    in patch ? patch.email    : null,
            telegramEnabled: "telegram" in patch ? patch.telegram : null,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Не удалось сохранить");
        setPrefs((prev) => {
          const next = new Map(prev);
          const original = initialPreferences.find((p) => p.notificationType === type);
          if (original) next.set(type, original);
          return next;
        });
      }
    });
  };

  const visibleGroups = GROUPS.filter((g) => g.types.some((t) => prefs.has(t)));

  return (
    <div className={embedded ? "max-w-2xl space-y-4" : "max-w-2xl space-y-6 p-6"}>
      {!embedded ? (
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Уведомления</h1>
          <p className="mt-1 text-sm text-gray-500">
            Выберите как получать уведомления
          </p>
        </div>
      ) : null}

      {/* Preference groups */}
      {visibleGroups.map((group) => {
        const rows = group.types.filter((t) => prefs.has(t));
        return (
          <section
            key={group.title}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-3.5 rounded-t-2xl">
              <h2 className="min-w-0 flex-1 pt-0.5 text-sm font-semibold text-gray-700">
                {group.title}
              </h2>
              <ChannelColumnHeaders />
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-b-2xl">
              {rows.map((type) => {
                const pref = prefs.get(type)!;
                return (
                  <div key={type} className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <span className="text-sm text-gray-800 flex-1 min-w-0">
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

      {!embedded ? <TelegramBlock /> : null}
    </div>
  );
}

// ── Telegram block ────────────────────────────────────────────────────────────

function TelegramBlock() {
  // Stub: telegramChatId will come from user profile when adapter is wired
  const connected = false;
  const username: string | null = null;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Telegram</h2>
      </div>

      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {connected ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-gray-300 shrink-0" />
          )}
          <div>
            {connected ? (
              <>
                <p className="text-sm font-medium text-gray-900">Подключён</p>
                {username && (
                  <p className="text-xs text-gray-400 mt-0.5">@{username}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">Не подключён</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Подключите Telegram для мгновенных уведомлений
                </p>
              </>
            )}
          </div>
        </div>

        <button
          disabled
          className="shrink-0 h-9 px-4 rounded-xl text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
          title="Скоро"
        >
          {connected ? "Отключить" : "Подключить"}
        </button>
      </div>

      {!connected && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-400">
            Интеграция с Telegram появится в следующем обновлении.
          </p>
        </div>
      )}
    </section>
  );
}
