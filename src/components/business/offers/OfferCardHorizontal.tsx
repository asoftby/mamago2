"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { OfferStatusBadge } from "./OfferStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Tag, MapPin, Calendar, BarChart3, Zap } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublicationStatisticsDialog } from "@/components/business/shared/PublicationStatisticsDialog";

interface Offer {
  id: string;
  kind: OfferKind;
  title: string;
  description: string | null;
  coverImage: string | null;
  priceFrom: number | null;
  priceText: string | null;
  status: OfferStatus;
  dateFrom: Date | null;
  dateTo: Date | null;
  place: {
    id: string;
    title: string;
  };
  updatedAt: Date;
  metrics: {
    views: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
}

interface OfferCardHorizontalProps {
  offer: Offer;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

export function OfferCardHorizontal({
  offer,
  onDelete,
  onArchive,
  onUnarchive,
}: OfferCardHorizontalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить это предложение?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(offer.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось удалить предложение"));
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;

    setIsArchiving(true);
    try {
      await onArchive(offer.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось архивировать предложение"));
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;

    setIsArchiving(true);
    try {
      await onUnarchive(offer.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось восстановить предложение"));
      setIsArchiving(false);
    }
  };

  const kindLabel = offer.kind === "EVENT" ? "Мероприятие" : "Услуга";
  const updatedLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(offer.updatedAt));
  const actionButtonClass =
    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const neutralActionClass =
    "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950";
  const promoteActionClass =
    "bg-[#C6FF72] text-stone-950 shadow-[0_8px_22px_rgba(132,204,22,0.22)] hover:bg-[#B8FF65] hover:shadow-[0_10px_28px_rgba(132,204,22,0.32)]";
  const ghostIconActionClass =
    "h-10 w-10 rounded-2xl text-stone-500 hover:bg-stone-100 hover:text-stone-900";

  return (
    <>
    <div className="rounded-[26px] border border-stone-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-stone-300 hover:shadow-[0_14px_32px_rgba(15,23,42,0.05)] md:p-5">
      <div className="flex gap-4">
        {/* Cover Image */}
        {offer.coverImage ? (
          <div className="flex h-24 w-24 flex-shrink-0 overflow-hidden rounded-[22px] bg-stone-100 ring-1 ring-stone-200/70">
            <Image
              src={offer.coverImage}
              alt={offer.title}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-[22px] bg-stone-100 text-stone-400 ring-1 ring-stone-200/70">
            <Tag className="w-8 h-8" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="text-lg font-semibold text-stone-950">
                  {offer.title}
                </h3>
                <BusinessChip tone="muted" size="compact">
                  {kindLabel}
                </BusinessChip>
              </div>
              {offer.description && (
                <p className="line-clamp-2 text-sm leading-7 text-stone-600">
                  {offer.description}
                </p>
              )}
            </div>
            <OfferStatusBadge status={offer.status} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{offer.place.title}</span>
            </div>
            {offer.dateFrom && offer.dateTo && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(offer.dateFrom), "d MMM", { locale: ru })} - {format(new Date(offer.dateTo), "d MMM", { locale: ru })}
                </span>
              </div>
            )}
            {offer.priceText && (
              <span>{offer.priceText}</span>
            )}
            {offer.priceFrom !== null && !offer.priceText && (
              <span>от {offer.priceFrom} BYN</span>
            )}
            <span>Обновлено {updatedLabel}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            <button
              type="button"
              onClick={() => setStatisticsOpen(true)}
              className={cn(actionButtonClass, neutralActionClass)}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              Статистика
            </button>

            <Link
              href={`/business/offers/${offer.id}/edit`}
              className={cn(actionButtonClass, neutralActionClass)}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Редактировать
            </Link>

            <Link
              href={buildPromotionLaunchHref({
                publicationType: "OFFER",
                publicationId: offer.id,
              })}
              className={cn(actionButtonClass, promoteActionClass, "px-4 font-semibold")}
            >
              <Zap className="h-4 w-4 shrink-0 fill-stone-950" />
              Продвигать
            </Link>

            {onArchive && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                className={cn(actionButtonClass, ghostIconActionClass)}
                title="В архив"
                aria-label="В архив"
              >
                <Archive className="h-4 w-4" />
              </button>
            )}

            {onUnarchive && (
              <button
                type="button"
                onClick={handleUnarchive}
                disabled={isArchiving}
                className={cn(actionButtonClass, ghostIconActionClass)}
                title="Восстановить"
                aria-label="Восстановить"
              >
                <ArchiveRestore className="h-4 w-4" />
              </button>
            )}

            {offer.status === "DRAFT" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-10 w-10 shrink-0 rounded-2xl p-0 text-stone-400 hover:bg-red-50 hover:text-red-600"
                title="Удалить"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    <PublicationStatisticsDialog
      open={statisticsOpen}
      onOpenChange={setStatisticsOpen}
      title={offer.title}
      entityLabel="предложения"
      metrics={offer.metrics}
    />
    </>
  );
}
