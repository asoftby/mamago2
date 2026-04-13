"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { OfferStatusBadge } from "./OfferStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Tag, MapPin, Calendar } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";

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

  return (
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

          <div className="mb-5 flex flex-wrap gap-2">
            <BusinessChip>Просмотры: {offer.metrics.views}</BusinessChip>
            <BusinessChip>Сохранения: {offer.metrics.saves}</BusinessChip>
            <BusinessChip>В план: {offer.metrics.planAdds}</BusinessChip>
            <BusinessChip>Переходы: {offer.metrics.ctaClicks}</BusinessChip>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/business/offers/${offer.id}/edit`}
              className="inline-flex items-center gap-1 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
            >
              <Pencil className="w-4 h-4" />
              Редактировать
            </Link>

            <Link
              href={buildPromotionLaunchHref({
                publicationType: "OFFER",
                publicationId: offer.id,
              })}
              className="inline-flex items-center gap-1 rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Продвигать
            </Link>

            {onArchive && (
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                title="В архив"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            {onUnarchive && (
              <button
                onClick={handleUnarchive}
                disabled={isArchiving}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                title="Восстановить"
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            )}

            {offer.status === "DRAFT" && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
