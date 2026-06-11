"use client";

import { useCallback, useEffect, useState } from "react";
import { NotificationPreferencesClient } from "@/app/(public)/me/settings/notifications/NotificationPreferencesClient";
import { BusinessNotificationSettingsClient } from "@/app/business/(protected)/settings/notifications/BusinessNotificationSettingsClient";
import {
  buildEmptyNotificationSettingsSurfaceData,
  type NotificationSettingsSurface,
  type NotificationSettingsSurfaceData,
} from "@/lib/notifications/settingsDomain";
import { TelegramStatusRow } from "./TelegramStatusRow";

type Mode = "user" | "business";

type Props = {
  mode: Mode;
};

function toSurface(mode: Mode): NotificationSettingsSurface {
  return mode === "business" ? "BUSINESS" : "USER";
}

/**
 * Настройки каналов (in-app / email / telegram) внутри NotificationsModal без отдельного route.
 * После подключения Telegram перезагружает данные с сервера — toggles становятся активны сразу.
 */
export function NotificationSettingsInModal({ mode }: Props) {
  const surface = toSurface(mode);
  const [data, setData] = useState<NotificationSettingsSurfaceData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/notifications/settings?surface=${surface.toLowerCase()}`,
        { credentials: "include" },
      );
      const json = (await response.json()) as NotificationSettingsSurfaceData;
      setData(response.ok ? json : buildEmptyNotificationSettingsSurfaceData(surface));
    } catch {
      setData(buildEmptyNotificationSettingsSurfaceData(surface));
    }
  }, [surface]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadData]);

  if (data === null) {
    return (
      <div className="py-10 text-center text-sm text-neutral-500">Загрузка…</div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <TelegramStatusRow
        connected={data.telegramConnected}
        canSendTelegramTest={data.canSendTelegramTest}
        onConnected={loadData}
        onDisconnected={loadData}
      />
      {mode === "user" ? (
        <NotificationPreferencesClient
          initialData={data}
          embedded
        />
      ) : (
        <BusinessNotificationSettingsClient
          initialData={data}
          embedded
        />
      )}
    </div>
  );
}
