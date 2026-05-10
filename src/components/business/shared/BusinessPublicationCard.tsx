"use client";

import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

export const BUSINESS_PUBLICATION_ACTION_BUTTON =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

export const BUSINESS_PUBLICATION_ACTION_NEUTRAL =
  "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950";

export const BUSINESS_PUBLICATION_ACTION_PROMOTE =
  "bg-[#C6FF72] text-stone-950 shadow-[0_8px_22px_rgba(132,204,22,0.22)] hover:bg-[#B8FF65] hover:shadow-[0_10px_28px_rgba(132,204,22,0.32)] px-4 font-semibold";

export const BUSINESS_PUBLICATION_ACTION_ICON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl p-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-50";

export const BUSINESS_PUBLICATION_ACTION_DANGER_ICON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl p-0 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50";

export type BusinessPublicationType = "place" | "event" | "offer";

const AVATAR_PX = 72;
const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type BusinessPublicationCardProps = {
  type: BusinessPublicationType;
  imageUrl: string | null;
  imageAlt: string;
  /** Оборачивает круглое изображение в ссылку (например на публичную карточку места). */
  imageHref?: string;
  placeholderIcon: LucideIcon;
  title: string;
  titleHref?: string;
  /** Маленький чип типа (Event, Услуга и т.д.); для места обычно не передаётся. */
  typeChip?: ReactNode;
  /** Вторая строка: адрес / место / даты (одна строка, truncate). */
  subtitle: string;
  /** Строка статуса и доп. бейджи под сабтайтлом. */
  statusRow?: ReactNode;
  /** Уже полная строка «Обновлено: …» или null */
  updatedLine?: string | null;
  footnote?: ReactNode;
  actions: ReactNode;
  className?: string;
};

export function BusinessPublicationCard({
  type,
  imageUrl,
  imageAlt,
  imageHref,
  placeholderIcon: PlaceholderIcon,
  title,
  titleHref,
  typeChip,
  subtitle,
  statusRow,
  updatedLine,
  footnote,
  actions,
  className,
}: BusinessPublicationCardProps) {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const roundedImage = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/70",
        "size-[72px]",
      )}
    >
      {imageUrl ? (
        isAppMediaUrl(imageUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element -- app media URLs
          <img
            src={imageUrl}
            alt={imageAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes={`${AVATAR_PX}px`}
            unoptimized={isAppMediaUrl(imageUrl)}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-400">
          <PlaceholderIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );

  const imageSlot = imageHref ? (
    <Link
      href={imageHref}
      className="shrink-0 self-start md:self-center"
      aria-label={imageAlt}
    >
      {roundedImage}
    </Link>
  ) : (
    <div className="shrink-0 self-start md:self-center">{roundedImage}</div>
  );

  return (
    <div
      className={cn(
        "group flex flex-col gap-4 rounded-[24px] border border-stone-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-stone-300 hover:shadow-[0_14px_32px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:p-5",
        className,
      )}
      data-publication-type={type}
    >
      <div className="flex min-w-0 flex-1 gap-4 md:items-center">
        {imageSlot}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {titleHref ? (
              <Link href={titleHref} className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-stone-950 transition-colors hover:text-stone-700">
                  {title}
                </h3>
              </Link>
            ) : (
              <h3 className="min-w-0 truncate text-lg font-semibold text-stone-950">
                {title}
              </h3>
            )}
            {typeChip}
          </div>

          {subtitle ? (
            <p className="truncate text-sm text-stone-600">{subtitle}</p>
          ) : null}

          {statusRow ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">{statusRow}</div>
          ) : null}

          {hasHydrated && updatedLine ? (
            <p className="pt-0.5 text-xs text-stone-500">{updatedLine}</p>
          ) : null}

          {footnote ? <div className="pt-0.5">{footnote}</div> : null}
        </div>
      </div>

      <div className="flex w-full max-w-full shrink-0 flex-wrap gap-2 border-t border-stone-100 pt-4 md:w-auto md:justify-end md:border-t-0 md:pt-0">
        {actions}
      </div>
    </div>
  );
}
