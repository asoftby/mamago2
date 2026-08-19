"use client";

import { formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { getMinCampSessionPrice } from "@/lib/offers/campPricing";
import { useState } from "react";
import Link from "next/link";
import { OfferStatusBadge } from "./OfferStatusBadge";
import { Eye, Pencil, Archive, ArchiveRestore, Trash2, Tag, BarChart3, Zap } from "lucide-react";
import { OfferStatus, OfferKind } from "@prisma/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
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
import { getOfferPublicUrl } from "@/lib/offers/offerPublicUrl";
import { getOfferPreviewPath } from "@/lib/content-preview/paths";
import { format as fmtDate } from "date-fns";

interface Offer {
  id: string;
  kind: OfferKind;
  durationType?: string | null;
  campProgramType?: string | null;
  title: string;
  description: string | null;
  coverImage: string | null;
  priceFrom: number | null;
  priceText: string | null;
  campSessions?: unknown;
  status: OfferStatus;
  archivedAt: Date | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  slug: string | null;
  place: {
    id: string;
    title: string;
    archivedAt: Date | null;
    city?: {
      slug: string;
    } | null;
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
  const campPriceFrom = offer.campProgramType
    ? getMinCampSessionPrice(offer.campSessions)
    : null;
  const effectivePriceFrom = offer.campProgramType ? campPriceFrom : offer.priceFrom;

  if (!offer.campProgramType && offer.priceText) {
    parts.push(normalizeUiCurrencyText(offer.priceText));
  } else if (effectivePriceFrom != null) {
    parts.push(formatPriceFrom(effectivePriceFrom, { hideZero: true }));
  } else if (offer.campProgramType) {
    parts.push("Цена зависит от смены");
  }
  return parts.join(" · ");
}

export function OfferCardHorizontal({
  offer,
  onDelete,
  onArchive,
  onUnarchive,
}: OfferCardHorizontalProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

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
  const createdLine = `Создано: ${fmtDate(new Date(offer.createdAt), "d MMMM yyyy", { locale: ru })}`;
  /** Для Next/Image: внешние URL как есть; /api/media через img в карточке */
  const offerImageForCard = offer.coverImage;

  const citySlug = offer.place.city?.slug;
  const publicOfferHref = (
    !offer.archivedAt &&
    !offer.place.archivedAt &&
    offer.status === "PUBLISHED" &&
    citySlug &&
    offer.slug
  )
    ? getOfferPublicUrl(offer, citySlug)
    : null;
  const viewOfferHref = publicOfferHref ?? getOfferPreviewPath(offer.id);

  const cardMetrics = {
    views: offer.metrics.views,
    saves: offer.metrics.saves,
    planAdds: offer.metrics.planAdds,
    ctaClicks: offer.metrics.ctaClicks,
  };

  const tip = offer.status === "PUBLISHED" && offer.metrics.views < 100
    ? {
        text: "Продвигайте предложение, чтобы получить больше заявок и увеличить охват.",
        ctaLabel: "Узнать больше",
        ctaHref: `/business/offers/${offer.id}/boost`,
      }
    : null;

  return (
    <>
      <BusinessPublicationCard
        type="offer"
        imageUrl={offerImageForCard}
        imageAlt={offer.title}
        placeholderIcon={Tag}
        title={offer.title}
        titleHref={viewOfferHref}
        imageHref={viewOfferHref}
        typeChip={
          <BusinessChip tone="muted" size="compact">
            {kindLabel}
          </BusinessChip>
        }
        subtitle={buildOfferSubtitle(offer)}
        statusRow={<OfferStatusBadge status={offer.status} />}
        updatedLine={updatedLine}
        createdLine={createdLine}
        metrics={cardMetrics}
        tip={tip}
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
              href={viewOfferHref}
              target="_blank"
              rel="noopener noreferrer"
              className={BUSINESS_PUBLICATION_ACTION_ICON}
              title="Просмотр"
              aria-label="Просмотр"
            >
              <Eye className="h-4 w-4" />
            </Link>

            <Link
              href={`/business/offers/${offer.id}/edit`}
              className={BUSINESS_PUBLICATION_ACTION_ICON}
              title="Редактировать"
              aria-label="Редактировать"
            >
              <Pencil className="h-4 w-4" />
            </Link>

            <Link
              href={`/business/offers/${offer.id}/boost`}
              className={cn(
                BUSINESS_PUBLICATION_ACTION_BUTTON,
                BUSINESS_PUBLICATION_ACTION_PROMOTE,
              )}
            >
              <Zap className="h-4 w-4 shrink-0 fill-stone-950" />
              Купить Boost
            </Link>

            {onArchive && offer.status !== "DRAFT" ? (
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
                onClick={() => void onDelete(offer.id)}
                className={BUSINESS_PUBLICATION_ACTION_DANGER_ICON}
                title="Удалить черновик"
                aria-label="Удалить черновик"
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
