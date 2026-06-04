"use client";

import { NotificationSettingsTable } from "./NotificationSettingsTable";

export function NotificationSettingsPanel({
  surface,
}: {
  surface: "USER" | "BUSINESS";
}) {
  const title =
    surface === "BUSINESS" ? "Настройки уведомлений" : "Настройки уведомлений";
  const description =
    surface === "BUSINESS"
      ? "Выберите, какие уведомления получать и через какие каналы."
      : "Выберите, какие уведомления получать и через какие каналы.";

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-neutral-950">{title}</h2>
        <p className="max-w-2xl text-sm text-neutral-500">{description}</p>
        <p className="text-xs font-medium text-neutral-400">
          Изменения сохраняются автоматически
        </p>
      </div>

      <NotificationSettingsTable
        surface={surface}
        className="space-y-5"
      />
    </div>
  );
}
