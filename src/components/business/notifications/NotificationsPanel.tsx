"use client";

import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { NotificationFeed } from "./NotificationFeed";
import { NotificationSettingsInModal } from "./NotificationSettingsInModal";

type Panel = "list" | "settings";

export type NotificationsPanelProps = {
  /** Вызывается при закрытии popover/sheet (кнопка X и т.д.) */
  onClose: () => void;
  stream?: "user" | "business";
  onNotificationRead?: () => void;
  /** Родительское открытие — при закрытии сбрасываем list/settings */
  open?: boolean;
  /** В dropdown (popover) закрытие снаружи — кнопку X в шапке не показываем */
  showHeaderClose?: boolean;
};

/**
 * Тело центра уведомлений: единый список + настройки. Без табов «Новые / Прочитанные».
 */
export function NotificationsPanel({
  onClose,
  stream = "user",
  onNotificationRead,
  open = true,
  showHeaderClose = true,
}: NotificationsPanelProps) {
  const [panel, setPanel] = useState<Panel>("list");

  const handleClosePanel = () => {
    setPanel("list");
    onClose();
  };

  const settingsMode = stream === "business" ? "business" : "user";

  const headerList = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-4 py-3 sm:px-5">
      <h2 className="text-lg font-semibold text-neutral-900">Уведомления</h2>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          aria-label="Настройки уведомлений"
          onClick={() => setPanel("settings")}
        >
          <Settings className="h-5 w-5" />
        </button>
        {showHeaderClose ? (
          <ModalCloseButton
            type="button"
            className="shrink-0"
            onClick={handleClosePanel}
          />
        ) : null}
      </div>
    </div>
  );

  const headerSettings = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
          aria-label="Назад к списку"
          onClick={() => setPanel("list")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="truncate text-lg font-semibold text-neutral-900">
          Настройки уведомлений
        </h2>
      </div>
      {showHeaderClose ? (
        <ModalCloseButton
          type="button"
          className="shrink-0"
          onClick={handleClosePanel}
        />
      ) : null}
    </div>
  );

  return (
    <div className="flex max-h-[min(85vh,640px)] min-h-[280px] min-w-0 flex-col overflow-hidden bg-white">
      <span className="sr-only" aria-live="polite">
        {panel === "list" ? "Уведомления" : "Настройки уведомлений"}
      </span>
      {panel === "list" ? headerList : headerSettings}
      {panel === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <NotificationFeed
            key={stream}
            open={open}
            stream={stream}
            onNotificationRead={onNotificationRead}
            onClose={handleClosePanel}
            listClassName="min-h-0 flex-1"
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
          <NotificationSettingsInModal mode={settingsMode} />
        </div>
      )}
    </div>
  );
}
