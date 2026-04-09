"use client";

import { useEffect, useState } from "react";
import { NotificationPreferencesClient } from "@/app/(public)/me/settings/notifications/NotificationPreferencesClient";
import { BusinessNotificationSettingsClient } from "@/app/business/(protected)/settings/notifications/BusinessNotificationSettingsClient";
import type { PreferenceRow } from "@/server/services/notificationPreference.service";
import { TelegramStatusRow } from "./TelegramStatusRow";

type Mode = "user" | "business";

type Props = {
  mode: Mode;
};

/**
 * Настройки каналов (in-app / email / telegram) внутри NotificationsModal без отдельного route.
 */
export function NotificationSettingsInModal({ mode }: Props) {
  const [prefs, setPrefs] = useState<PreferenceRow[] | null>(null);
  const [telegramConnected, setTelegramConnected] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [pRes, nRes] = await Promise.all([
          fetch("/api/notifications/preferences", { credentials: "include" }),
          fetch("/api/notifications?limit=1", { credentials: "include" }),
        ]);
        if (!alive) return;
        const pJson = (await pRes.json()) as { preferences?: PreferenceRow[] };
        const nJson = (await nRes.json()) as { telegramConnected?: boolean };
        setPrefs(pJson.preferences ?? []);
        setTelegramConnected(nJson.telegramConnected === true);
      } catch {
        if (alive) {
          setPrefs([]);
          setTelegramConnected(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (prefs === null) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">Загрузка…</div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <TelegramStatusRow connected={telegramConnected} />
      {mode === "user" ? (
        <NotificationPreferencesClient
          initialPreferences={prefs}
          embedded
        />
      ) : (
        <BusinessNotificationSettingsClient
          initialPreferences={prefs}
          embedded
        />
      )}
    </div>
  );
}
