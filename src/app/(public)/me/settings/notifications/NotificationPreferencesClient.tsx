"use client";

import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Mail, Bell, Send } from "lucide-react";
import { toast } from "sonner";
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
    types: ["SYSTEM"],
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
  SYSTEM:                      "Напоминания и подборки",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialPreferences: PreferenceRow[];
}

type PrefsMap = Map<NotificationType, PreferenceRow>;

export function NotificationPreferencesClient({ initialPreferences }: Props) {
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
    <div className="space-y-4">
      {/* Channel legend */}
      <div className="flex items-center gap-5 px-1 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />В приложении</span>
        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</span>
        <span className="flex items-center gap-1.5 opacity-40"><Send className="h-3.5 w-3.5" />Telegram</span>
      </div>

      {visibleGroups.map((group) => {
        const rows = group.types.filter((t) => prefs.has(t));
        if (!rows.length) return null;

        return (
          <section
            key={group.title}
            className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-700">{group.title}</h2>
            </div>

            <div className="divide-y divide-neutral-100">
              {rows.map((type) => {
                const pref = prefs.get(type)!;
                return (
                  <div key={type} className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <span className="text-sm text-neutral-800 flex-1 min-w-0">
                      {TYPE_LABELS[type]}
                    </span>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* In-app */}
                      <Toggle
                        checked={pref.inApp}
                        onChange={(v) => save(type, { inApp: v })}
                        disabled={pending}
                        aria-label={`${TYPE_LABELS[type]}: в приложении`}
                      />
                      {/* Email */}
                      <Toggle
                        checked={pref.email}
                        onChange={(v) => save(type, { email: v })}
                        disabled={pending}
                        aria-label={`${TYPE_LABELS[type]}: email`}
                      />
                      {/* Telegram — disabled until implemented */}
                      <Toggle
                        checked={pref.telegram}
                        onChange={(v) => save(type, { telegram: v })}
                        disabled
                        aria-label={`${TYPE_LABELS[type]}: telegram`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-neutral-400 px-1">
        Telegram пока недоступен — появится в следующем обновлении.
      </p>
    </div>
  );
}
