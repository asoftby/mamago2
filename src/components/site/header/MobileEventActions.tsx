"use client";

import { useState } from "react";
import { Heart, Share2 } from "lucide-react";
import { getNavIconButtonClassName } from "@/components/mobile/NavIconButton";
import { ShareModal } from "@/components/shared/ShareModal";
import type { HeaderSaveAction } from "@/contexts/PublicationIntentContext";
import { cn } from "@/lib/utils";

const buttonClass = getNavIconButtonClassName({ isActive: false, chrome: "dark", size: "compact" });

/**
 * Единые действия мобильного хедера любой публикации (событие, место, оффер, статья…):
 * «поделиться» (ShareModal) всегда, «сохранить» (в план/идеи) — если страница его зарегистрировала.
 */
export function MobileEventActions({
  saveAction,
  fallbackNoun,
}: {
  saveAction: HeaderSaveAction | null;
  /** Слово для модалки шеринга, когда страница не зарегистрировала своё. */
  fallbackNoun?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" aria-label="Поделиться" onClick={() => setShareOpen(true)} className={buttonClass}>
        <Share2 className="h-5 w-5 text-gray-400" strokeWidth={1.75} aria-hidden />
      </button>
      {saveAction ? (
        <button
          type="button"
          aria-label={saveAction.saved ? "Сохранено" : "Сохранить"}
          aria-pressed={saveAction.saved}
          onClick={saveAction.onSave}
          className={buttonClass}
        >
          <Heart
            className={cn("h-5 w-5", saveAction.saved ? "fill-[#E86A3A] text-[#E86A3A]" : "text-gray-400")}
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      ) : null}
      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={saveAction?.shareTitle ?? (typeof document !== "undefined" ? document.title : "")}
        entityNoun={saveAction?.entityNoun ?? fallbackNoun}
      />
    </div>
  );
}
