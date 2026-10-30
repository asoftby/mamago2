"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared visual presentation for publication detail pages.
 *
 * The parent owns save/auth/plan and share flows. In particular this component
 * must never treat a share-sheet open as a completed share.
 * visibleSavers MUST contain only profiles with explicit public-save consent.
 */
export type PublicSaver = {
  avatarUrl: string | null;
};

export interface PublicationSaveShareProps {
  isSaved: boolean;
  publicationKind?: "event" | "offer" | "place";
  publicationId?: string;
  onSave: () => void;
  onShare: () => void;
  isSaving?: boolean;
  /** Unique saved-user count, not number of Idea/PlanItem records. */
  saveCount?: number | null;
  /** Most recent consented public savers, newest first; never family-private records. */
  visibleSavers?: readonly PublicSaver[];
  className?: string;
  footer?: ReactNode;
}

export function PublicationSaveShare({
  isSaved,
  publicationKind,
  publicationId,
  onSave,
  onShare,
  isSaving = false,
  saveCount,
  visibleSavers = [],
  className,
  footer,
}: PublicationSaveShareProps) {
  const [remoteCount, setRemoteCount] = useState<number | null>(null);
  const [remoteSavers, setRemoteSavers] = useState<PublicSaver[]>([]);
  const refresh = useCallback(async () => {
    if (!publicationKind || !publicationId) return;
    try {
      const params = new URLSearchParams({ kind: publicationKind, id: publicationId });
      const res = await fetch("/api/publication/save-summary?" + params.toString(), { cache: "no-store" });
      if (!res.ok) return;
      const summary: { count?: number; visibleSavers?: PublicSaver[] } = await res.json();
      setRemoteSavers(Array.isArray(summary.visibleSavers) ? summary.visibleSavers : []);
      if (typeof summary.count === "number" && Number.isFinite(summary.count)) {
        setRemoteCount(Math.max(0, Math.floor(summary.count)));
      }
    } catch {
      // The actions remain available if the public counter cannot load.
    }
  }, [publicationKind, publicationId]);

  useEffect(() => {
    void refresh();
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; id?: string }>).detail;
      if (detail?.kind === publicationKind && detail.id === publicationId) void refresh();
    };
    window.addEventListener("publication-save-changed", onUpdated);
    return () => window.removeEventListener("publication-save-changed", onUpdated);
  }, [publicationKind, publicationId, refresh]);

  const supplied = typeof saveCount === "number" && Number.isFinite(saveCount) ? saveCount : remoteCount;
  const total = typeof supplied === "number" && Number.isFinite(supplied)
    ? Math.max(0, Math.floor(supplied))
    : null;
  const avatars = (publicationKind && publicationId ? remoteSavers : visibleSavers)
    .filter((saver) => Boolean(saver.avatarUrl)).slice(0, 5);

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Сохранено" : "Сохранить публикацию"}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E86A3A]",
            isSaved
              ? "border-[#E86A3A]/25 bg-[#FFE9DF] text-[#C2522A]"
              : "border-[#E86A3A]/30 bg-[#FFF0E8] text-[#D4562B] hover:bg-[#FFE2D3]",
            isSaving && "cursor-wait opacity-60",
          )}
        >
          <Heart aria-hidden="true" className={cn("h-5 w-5 shrink-0", isSaved && "fill-current")} />
          <span>{isSaved ? "Сохранено" : "Сохранить"}</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#141210]/15 px-3 text-sm font-semibold text-[#141210]",
            "transition-colors hover:bg-[#141210]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E86A3A]",
          )}
        >
          <Share2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>Поделиться</span>
        </button>
      </div>
      {total !== null && total >= 3 && (
        <div className="mt-3 flex min-h-9 items-center gap-3">
          {avatars.length > 0 && (
            <div className="flex shrink-0 items-center pl-1" aria-hidden="true">
              {avatars.map((saver, index) => (
                // Images here are optional, consent-gated inputs supplied by the server.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${saver.avatarUrl}-${index}`}
                  src={saver.avatarUrl!}
                  alt=""
                  width={36}
                  height={36}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="-ml-1 h-9 w-9 rounded-full border-2 border-white bg-neutral-100 object-cover"
                />
              ))}
            </div>
          )}
          <span className="text-sm text-[#141210]/65">
            Сохранили <span className="font-semibold text-[#E86A3A]">{total}</span>
          </span>
        </div>
      )}
      {footer}
    </div>
  );
}
