"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Share2 } from "lucide-react";
import { getNavIconButtonClassName } from "@/components/mobile/NavIconButton";
import { useHeaderFavoriteTargetId } from "@/contexts/PublicationIntentContext";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const buttonClass = getNavIconButtonClassName({ isActive: false, chrome: "dark", size: "compact" });

/** «♡» (если страница зарегистрировала избранное) и «поделиться» для хедера посадочной. */
export function MobileLandingActions() {
  const favoriteId = useHeaderFavoriteTargetId();
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (!favoriteId) return;
    const sync = () => setFavorite(isFavorite(favoriteId));
    sync();
    window.addEventListener("favorites-updated", sync);
    return () => window.removeEventListener("favorites-updated", sync);
  }, [favoriteId]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const title = document.title;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // отмена пользователем — не ошибка
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не получилось скопировать ссылку");
    }
  }, []);

  return (
    <>
      {favoriteId ? (
        <button
          type="button"
          aria-label={favorite ? "Убрать из идей" : "Сохранить в идеи"}
          aria-pressed={favorite}
          onClick={() => {
            const was = isFavorite(favoriteId);
            toggleFavorite(favoriteId);
            toast.success(was ? "Убрано из идей" : "Сохранено в идеи");
          }}
          className={buttonClass}
        >
          <Heart
            className={cn("h-5 w-5", favorite ? "fill-[#E86A3A] text-[#E86A3A]" : "text-gray-600")}
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      ) : null}
      <button type="button" aria-label="Поделиться" onClick={() => void handleShare()} className={buttonClass}>
        <Share2 className="h-5 w-5 text-gray-600" strokeWidth={1.75} aria-hidden />
      </button>
    </>
  );
}
