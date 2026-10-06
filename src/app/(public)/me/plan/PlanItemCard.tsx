"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatHHMM } from "@/lib/formatters/date";
import { resolvePlanItemCategoryLabel } from "@/features/my-plan/lib/planItemMeta";
import {
  authorCaption,
  shouldRefreshAfter,
  showFamilyUi,
  visibilityErrorMessage,
  type FamilyView,
} from "@/features/my-plan/lib/planVisibilityView";
import type { SerializedPlanItem } from "./PlanPageClient";

export type VisibilityChange = (
  itemId: string,
  next: { visibility: "PRIVATE" | "FAMILY"; updatedAt: string },
) => void;

function formatTime(iso: string | null): string | null {
  return formatHHMM(iso) || null;
}

export function PlanItemCard({
  item,
  onRemove,
  familyView = null,
  onVisibilityChange,
}: {
  item: SerializedPlanItem;
  onRemove: (id: string) => void;
  /** Non-null only for a family with 2+ adults; otherwise the card looks as before. */
  familyView?: FamilyView | null;
  onVisibilityChange?: VisibilityChange;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const familyUi = showFamilyUi(familyView);
  const currentUserId = familyView?.currentUserId ?? "";
  const isPrivate = familyUi && item.visibility === "PRIVATE";
  const isOwn = !item.authorId || item.authorId === currentUserId;
  const caption = familyUi ? authorCaption(item, currentUserId) : null;
  const title = item.activity?.title ?? item.title ?? "Активность";
  const image = item.activity?.coverImageUrl ?? item.coverImageUrl;
  const category = resolvePlanItemCategoryLabel(item.activity);
  const time = formatTime(item.effectiveStartsAt);
  const age = item.activity?.ageLabel ?? null;
  const price = item.activity?.priceLabel ?? null;
  const venueName = item.activity?.venueName ?? null;
  const venueAddress = item.activity?.venueAddress ?? null;
  const unavailable =
    item.planAvailability === "business_disabled" ||
    item.planAvailability === "missing_activity";

  const href =
    item.activityId && !unavailable
      ? publicActivityPath(item.activityId, "minsk", item.activity?.slug)
      : null;

  const metaLine = [age, time, price].filter(Boolean).join(" · ");

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/save/plan?planItemId=${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("plan_remove_failed");
      onRemove(item.id);
      toast("Убрано из плана", { duration: 2000 });
    } catch {
      toast.error("Не удалось удалить");
    } finally {
      setRemoving(false);
    }
  };

  const handleVisibility = async () => {
    if (changingVisibility) return;
    const next = isPrivate ? "FAMILY" : "PRIVATE";
    setChangingVisibility(true);
    try {
      const res = await fetch(`/api/plan/items/${item.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: next,
          ...(item.updatedAt ? { expectedUpdatedAt: item.updatedAt } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; item?: { visibility: "PRIVATE" | "FAMILY"; updatedAt: string } }
        | null;
      if (!res.ok || !data?.item) {
        toast.error(visibilityErrorMessage(data?.error));
        if (shouldRefreshAfter(data?.error)) router.refresh();
        return;
      }
      onVisibilityChange?.(item.id, { visibility: data.item.visibility, updatedAt: data.item.updatedAt });
      toast(next === "FAMILY" ? "Теперь видно семье" : "Теперь видите только вы", { duration: 2000 });
    } catch {
      toast.error(visibilityErrorMessage(null));
    } finally {
      setChangingVisibility(false);
    }
  };

  const imageNode = (
    <div
      className="h-[118px] w-[176px] shrink-0 overflow-hidden rounded-[14px] max-sm:h-[84px] max-sm:w-[112px] max-sm:rounded-[12px]"
      style={{ background: "#EEE8DE" }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-4 text-center">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "rgba(20,18,16,.45)" }}
          >
            mamaGo
          </span>
        </div>
      )}
    </div>
  );

  return (
    <article
      className="group grid grid-cols-[176px_minmax(0,1fr)_auto] items-center gap-5 rounded-[18px] border p-[14px] transition-[border-color,transform] duration-200 max-sm:grid-cols-[112px_minmax(0,1fr)_auto] max-sm:gap-3 max-sm:p-3"
      style={{
        background: isPrivate ? "#F3EFE7" : "#FAF7F1",
        borderColor: "rgba(20,18,16,.10)",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = "rgba(20,18,16,.28)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "rgba(20,18,16,.10)";
      }}
    >
      {href ? (
        <Link href={href} aria-label={`Открыть «${title}»`}>
          {imageNode}
        </Link>
      ) : imageNode}

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: "var(--primary)" }}
            >
              {category}
            </span>
          )}
          {isPrivate && (
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              style={{ color: "rgba(20,18,16,.62)" }}
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Видите только вы
            </span>
          )}
          {caption && (
            <span className="text-[11px]" style={{ color: "rgba(20,18,16,.62)" }}>
              {caption}
            </span>
          )}
          {unavailable && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: "#D6342B" }}
            >
              снято
            </span>
          )}
        </div>

        {href ? (
          <Link href={href} className="min-w-0 no-underline">
            <h3
              className="font-display line-clamp-2 text-[22px] leading-[1.08] tracking-[-0.015em] max-sm:text-[17px]"
              style={{ margin: 0, color: "#141210" }}
            >
              {title}
            </h3>
          </Link>
        ) : (
          <h3
            className="font-display line-clamp-2 text-[22px] leading-[1.08] tracking-[-0.015em] max-sm:text-[17px]"
            style={{ margin: 0, color: "#141210" }}
          >
            {title}
          </h3>
        )}

        {(venueName || venueAddress) && (
          <div className="mt-0.5 flex min-w-0 flex-col gap-0.5">
            {venueName && (
              <span
                className="truncate text-[13px] font-medium max-sm:text-[12px]"
                style={{ color: "#3A332B" }}
              >
                {venueName}
              </span>
            )}
            {venueAddress && (
              <span
                className="truncate text-[12px] max-sm:text-[11px]"
                style={{ color: "rgba(20,18,16,.55)" }}
              >
                {venueAddress}
              </span>
            )}
          </div>
        )}

        {metaLine && (
          <span
            className="mt-0.5 text-[13px] max-sm:text-[11px]"
            style={{ color: "rgba(20,18,16,.58)" }}
          >
            {metaLine}
          </span>
        )}
      </div>

      <div className="flex h-full min-w-[54px] flex-col items-end justify-between py-1 max-sm:min-w-[34px]">
        {href ? (
          <Link
            href={href}
            aria-label={`Перейти к «${title}»`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[22px] leading-none no-underline transition-transform hover:translate-x-1 max-sm:h-8 max-sm:w-8 max-sm:text-[18px]"
            style={{ color: "#141210" }}
          >
            →
          </Link>
        ) : (
          <span className="h-9 w-9 max-sm:h-8 max-sm:w-8" />
        )}

        {familyUi && isOwn && (
          <button
            type="button"
            onClick={handleVisibility}
            disabled={changingVisibility}
            className="text-[11px]"
            style={{
              color: "var(--primary)",
              cursor: changingVisibility ? "default" : "pointer",
            }}
          >
            {changingVisibility ? "…" : isPrivate ? "Поделиться с семьёй" : "Сделать личным"}
          </button>
        )}

        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          className="text-[11px] opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          style={{
            color: "rgba(20,18,16,.48)",
            cursor: removing ? "default" : "pointer",
          }}
        >
          {removing ? "Удаляем…" : "Убрать"}
        </button>
      </div>
    </article>
  );
}
