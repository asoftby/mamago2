"use client";

import { useState } from "react";
import Link from "next/link";
import { OfferStatusBadge } from "./OfferStatusBadge";
import { Pencil, Archive, ArchiveRestore, Trash2, Tag, BarChart3, Zap } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublicationStatisticsDialog } from "@/components/business/shared/PublicationStatisticsDialog";
import { BusinessPublicationCard } from "@/components/business/shared/BusinessPublicationCard";
import {
  BUSINESS_PUBLICATION_ACTION_BUTTON,
  BUSINESS_PUBLICATION_ACTION_DANGER_ICON,
  BUSINESS_PUBLICATION_ACTION_ICON,
  BUSINESS_PUBLICATION_ACTION_NEUTRAL,
  BUSINESS_PUBLICATION_ACTION_PROMOTE,
} from "@/components/business/shared/BusinessPublicationCard";
import { formatUpdatedAgo } from "@/lib/date/formatUpdatedAgo";

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
  createdAt: Date;
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

function buildOfferSubtitle(offer: Offer): string {
  const parts: string[] = [offer.place.title];
  if (offer.dateFrom && offer.dateTo) {
    parts.push(
      `${format(new Date(offer.dateFrom), "d MMM", { locale: ru })} — ${format(new Date(offer.dateTo), "d MMM", { locale: ru })}`,
    );
  } else if (offer.dateFrom) {
    parts.push(
      format(new Date(offer.dateFrom), "d MMM yyyy", { locale: ru }),
    );
  }
  if (offer.priceText) {
    parts.push(offer.priceText);
  } else if (offer.priceFrom != null) {
    parts.push(`от ${offer.priceFrom} BYN`);
  }
  return parts.join(" · ");
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
  const updatedLine = formatUpdatedAgo(offer.updatedAt, offer.createdAt);
  /** Для Next/Image: внешние URL как есть; /api/media через img в карточке */
  const offerImageForCard = offer.coverImage;

  return (
    <>
      <BusinessPublicationCard
        type="offer"
        imageUrl={offerImageForCard}
        imageAlt={offer.title}
        placeholderIcon={Tag}
        title={offer.title}
        typeChip={
          <BusinessChip tone="muted" size="compact">
            {kindLabel}
          </BusinessChip>
        }
        subtitle={buildOfferSubtitle(offer)}
        statusRow={<OfferStatusBadge status={offer.status} />}
        updatedLine={updatedLine}
        actions={
          <>
            <button
              type="button"
              onClick={() => setStatisticsOpen(true)}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_NEUTRAL,
              )}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              Статистика
            </button>

            <Link
              href={`/business/offers/${offer.id}/edit`}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_NEUTRAL,
              )}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Редактировать
            </Link>

            <Link
              href={buildPromotionLaunchHref({
                publicationType: "OFFER",
                publicationId: offer.id,
              })}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_PROMOTE,
              )}
            >
              <Zap className="h-4 w-4 shrink-0 fill-stone-950" />
              Продвигать
            </Link>

            {onArchive ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="В архив"
                aria-label="В архив"
              >
                <Archive className="h-4 w-4" />
              </button>
            ) : null}

            {onUnarchive ? (
              <button
                type="button"
                onClick={handleUnarchive}
                disabled={isArchiving}
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="Восстановить"
                aria-label="Восстановить"
              >
                <ArchiveRestore className="h-4 w-4" />
              </button>
            ) : null}

            {offer.status === "DRAFT" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isDeleting}
                className={BUSINESS_PUBLICATION_ACTION_DANGER_ICON}
                title="Удалить"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </>
        }
      />
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
