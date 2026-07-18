"use client";

/**
 * InstagramAvatarImport
 *
 * Compact helper block shown on the Logo step when Instagram handle is set
 * in the form (и при создании, и при редактировании — можно заменить лого).
 *
 * Allows one-click import of the Instagram profile avatar as the place logo.
 * Best-effort: shows a friendly error if Instagram is unavailable.
 */

import { useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface InstagramAvatarImportProps {
  instagramHandle: string;
  wizardSessionId: string;
  onImportComplete: (mediaId: string, url: string) => void;
  disabled?: boolean;
  className?: string;
  /** Уже есть логотип (в т.ч. при редактировании) — показываем формулировку «заменить». */
  replaceExisting?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  INSTAGRAM_REQUIRED:
    "Укажите Instagram аккаунт на шаге «Контакты».",
  INVALID_INSTAGRAM_USERNAME:
    "Не удалось определить Instagram аккаунт. Проверьте поле Instagram на шаге «Контакты».",
  INSTAGRAM_TIMEOUT:
    "Instagram не ответил вовремя. Попробуйте позже или загрузите логотип вручную.",
  INSTAGRAM_PROFILE_UNAVAILABLE:
    "Профиль Instagram недоступен или закрыт.",
  INSTAGRAM_AVATAR_UNAVAILABLE:
    "Не удалось получить аватар из Instagram. Загрузите логотип вручную.",
  INSTAGRAM_FETCH_FAILED:
    "Не удалось получить данные из Instagram. Загрузите логотип вручную.",
  IMAGE_UPLOAD_FAILED:
    "Не удалось загрузить изображение. Попробуйте ещё раз или загрузите логотип вручную.",
};

const DEFAULT_ERROR =
  "Не удалось получить фото из Instagram. Загрузите логотип вручную.";

export function InstagramAvatarImport({
  instagramHandle,
  wizardSessionId,
  onImportComplete,
  disabled = false,
  className,
  replaceExisting = false,
}: InstagramAvatarImportProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);

    const payload = {
      instagram: instagramHandle,
      wizardSessionId,
    };

    if (process.env.NODE_ENV === "development") {
      console.debug("[InstagramAvatar] request payload", payload);
    }

    try {
      const response = await fetch("/api/business/instagram/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let result: Record<string, unknown> = {};
      try {
        result = await response.json();
      } catch {
        // non-JSON response
      }

      if (process.env.NODE_ENV === "development") {
        console.debug("[InstagramAvatar] response", { status: response.status, result });
      }

      if (!response.ok || !result.ok) {
        const errorCode = typeof result.error === "string" ? result.error : "";
        const message = ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR;
        toast.error(message);
        return;
      }

      const image = result.image as { id: string; url: string } | undefined;
      if (!image?.id || !image?.url) {
        toast.error(DEFAULT_ERROR);
        return;
      }

      onImportComplete(image.id, image.url);
      toast.success("Логотип добавлен из Instagram");
    } catch (err) {
      console.error("[InstagramAvatarImport] Network error:", err);
      toast.error(DEFAULT_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const displayHandle = instagramHandle.startsWith("@")
    ? instagramHandle
    : `@${instagramHandle}`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Instagram className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm text-foreground leading-tight">
            {replaceExisting
              ? "Заменить логотип из Instagram"
              : "Можно взять логотип из Instagram"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{displayHandle}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleImport}
        disabled={isLoading || disabled}
        className="shrink-0 text-xs h-8"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Получаем…
          </>
        ) : replaceExisting ? (
          "Обновить из Instagram"
        ) : (
          "Загрузить логотип из Instagram"
        )}
      </Button>
    </div>
  );
}
