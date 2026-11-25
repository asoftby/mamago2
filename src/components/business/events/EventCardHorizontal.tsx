"use client";

import { formatPrice, formatPriceFrom, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Pencil,
  Eye,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  BarChart3,
  Users,
  Zap,
} from "lucide-react";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";
import { cn } from "@/lib/utils";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { buildPromotionLaunchHref } from "@/lib/promotion/shared";
import { PublicationStatisticsDialog } from "@/components/business/shared/PublicationStatisticsDialog";
import { BusinessPublicationCard } from "@/components/business/shared/BusinessPublicationCard";
import {
  BUSINESS_PUBLICATION_ACTION_BUTTON,
  BUSINESS_PUBLICATION_ACTION_DANGER_ICON,
  BUSINESS_PUBLICATION_ACTION_ICON,
  BUSINESS_PUBLICATION_ACTION_NEUTRAL,
  BUSINESS_PUBLICATION_ACTION_PROMOTE,
  BUSINESS_PUBLICATION_ACTIONS_ICON_ROW,
  BUSINESS_PUBLICATION_ACTIONS_PRIMARY_ROW,
} from "@/components/business/shared/BusinessPublicationCard";
import { formatUpdatedAgo } from "@/lib/date/formatUpdatedAgo";
import { PublicationStatusChip } from "@/components/business/shared/PublicationStatusChip";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { publicActivityPath, toAbsolutePublicUrl } from "@/lib/business/eventPublicLink";
import { activityTypeLabelRu } from "@/lib/activity/activityTypeLabelsRu";
import { BUSINESS_DASHBOARD_MVP } from "@/config/businessDashboardMvp";
import { BoostLauncher } from "@/components/business/promotion/BoostLauncher";
import { getActiveBoostEndAt } from "@/lib/promotion/boostCountdown";
import { EVENT_PROMOTE_BLOCK_TITLE, getEventPromoteBlockReason } from "@/lib/promotion/canPromoteEvent";
import type { EventTemporalState } from "@/lib/events/eventTemporalState";
import type { ActivityPromotionPerformance } from "@/server/services/promotion/boostPerformance.service";
import { getPlaceSearchAddressMetaLine } from "@/lib/placeLocationString";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import {
  PublicationBoostActiveButton,
  PublicationBoostLightningBadge,
} from "@/components/business/shared/PublicationBoostActiveUi";

interface Activity {
  id: string;
  type: ActivityType;
  status: ContentStatus;
  slug?: string | null;
  city?: {
    slug: string;
  } | null;
  title: string;
  shortDesc: string;
  coverImageUrl?: string | null;
  coverImage?: {
    publicUrl: string | null;
  } | null;
  scheduleMode: ScheduleMode;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  place: {
    id: string;
    title: string;
    shortAddress?: string | null;
    formattedAddr?: string | null;
    customAddress?: string | null;
    city?: {
      slug: string;
      name?: string;
    } | null;
  } | null;
  venue?: {
    title?: string | null;
    addressLine?: string | null;
  } | null;
  images: Array<{
    id: string;
    url: string;
  }>;
  updatedAt: Date;
  createdAt: Date;
  nextOccurrenceAt?: Date | null;
  displayOccurrenceAt?: Date | null;
  /** Сессионное состояние (getEventTemporalState по неотозванным сеансам); считает страница списка. */
  temporalState?: EventTemporalState | null;
  isPromoted?: boolean;
  /** Eligibility must come from the server, not from client-side status. */
  boostDisabled?: boolean;
  boostNextFreeAt?: string | null;
  promotionPerformance?: ActivityPromotionPerformance | null;
  metrics?: {
    views: number;
    saves: number;
    planAdds: number;
    ctaClicks: number;
  };
}

interface EventCardHorizontalProps {
  activity: Activity;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUnarchive?: (id: string) => Promise<void>;
}

export function canShowEventDeleteAction(status: ContentStatus): boolean {
  return status === ContentStatus.DRAFT;
}

export function canShowEventArchiveAction(status: ContentStatus): boolean {
  const archivableStatuses: ContentStatus[] = [
    ContentStatus.PENDING,
    ContentStatus.PUBLISHED,
    ContentStatus.NEEDS_REVISION,
    ContentStatus.REJECTED,
    ContentStatus.PENDING_UPDATE,
    ContentStatus.SCHEDULED,
  ];
  return archivableStatuses.includes(status);
}

function buildEventAddressLine(activity: Activity): string | null {
  if (activity.place) {
    const formatted = getPlaceSearchAddressMetaLine({
      city: activity.place.city?.name ? { name: activity.place.city.name } : null,
      shortAddress: activity.place.shortAddress,
      formattedAddr: activity.place.formattedAddr,
      customAddress: activity.place.customAddress,
    });
    if (formatted && formatted !== "Место") {
      return `Адрес: ${formatted}`;
    }
    if (activity.place.title?.trim()) {
      return `Адрес: ${activity.place.title.trim()}`;
    }
  }
  const venueAddress = activity.venue?.addressLine?.trim();
  if (venueAddress) {
    return `Адрес: ${venueAddress}`;
  }
  const venueTitle = activity.venue?.title?.trim();
  if (venueTitle) {
    return `Адрес: ${venueTitle}`;
  }
  return null;
}

function buildEventSubtitle(activity: Activity): ReactNode {
  const addressLine = buildEventAddressLine(activity);

  const datePriceParts: string[] = [];
  const displayedDate = activity.displayOccurrenceAt ?? activity.nextOccurrenceAt;
  if (displayedDate) {
    datePriceParts.push(
      format(new Date(displayedDate), "d MMM yyyy", {
        locale: ru,
      }),
    );
  }
  if (activity.priceText) {
    datePriceParts.push(formatPrice(activity.priceText));
  } else if (activity.priceFrom != null) {
    datePriceParts.push(formatPriceFrom(activity.priceFrom, { hideZero: true }));
  }
  const datePriceLine =
    datePriceParts.length > 0
      ? datePriceParts.join(" · ")
      : null;

  if (!addressLine && !datePriceLine) {
    return activity.shortDesc?.trim() || "Место и время уточняются";
  }

  return (
    <>
      {addressLine ? <p className="w-full truncate">{addressLine}</p> : null}
      {datePriceLine ? (
        <p className="w-full">
          {renderCurrencyText(normalizeUiCurrencyText(datePriceLine), { iconSize: "sm" })}
        </p>
      ) : null}
    </>
  );
}

export function EventCardHorizontal({
  activity,
  onDelete,
  onArchive,
  onUnarchive,
}: EventCardHorizontalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isArchiving, setIsArchiving] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);

  const coverImageUrl =
    activity.coverImage?.publicUrl ??
    activity.coverImageUrl ??
    activity.images[0]?.url ??
    null;
  const currentSearch = searchParams.toString();
  const returnTo = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const publicEventHref =
    activity.status === ContentStatus.PUBLISHED ||
    activity.status === ContentStatus.PENDING_UPDATE ||
    activity.status === ContentStatus.SCHEDULED
      ? toAbsolutePublicUrl(
          publicActivityPath(
            activity.id,
            activity.city?.slug ?? activity.place?.city?.slug ?? null,
            activity.slug ?? null,
          ),
        )
      : `/me/events/${activity.id}/preview`;

  const canDeleteEvent = canShowEventDeleteAction(activity.status);
  const canArchiveEvent = canShowEventArchiveAction(activity.status);
  const promoteBlockReason = getEventPromoteBlockReason(activity.status, activity.temporalState);
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const handleArchive = async () => {
    if (!onArchive) return;

    setIsArchiving(true);
    try {
      await onArchive(activity.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось архивировать событие"));
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;

    setIsArchiving(true);
    try {
      await onUnarchive(activity.id);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Не удалось восстановить событие"));
      setIsArchiving(false);
    }
  };

  const updatedLine = formatUpdatedAgo(activity.updatedAt, activity.createdAt);
  const createdLine = `Создано: ${format(new Date(activity.createdAt), "d MMMM yyyy", { locale: ru })}`;

  // Card metrics are strictly TODAY. Historical Boost comparisons must not be
  // shown as deltas under today's figures; they remain in the Boost report.
  const cardMetrics = activity.metrics
    ? {
        views: activity.metrics.views,
        saves: activity.metrics.saves,
        planAdds: activity.metrics.planAdds,
        ctaClicks: activity.metrics.ctaClicks,
      }
    : null;

  const boostEndsAt = getActiveBoostEndAt(activity.promotionPerformance);
  const isBoostActive = Boolean(activity.isPromoted);

  const statusRow = (
    <PublicationStatusChip
      status={activity.status}
      temporalState={activity.temporalState}
    />
  );

  return (
    <>
      <BusinessPublicationCard
        type="event"
        imageUrl={coverImageUrl}
        imageAlt={activity.title}
        placeholderIcon={Calendar}
        title={activity.title}
        isPromoted={isBoostActive}
        typeChip={
          <BusinessChip tone="muted" size="default" className="text-stone-700">
            {activityTypeLabelRu(activity.type)}
          </BusinessChip>
        }
        subtitle={buildEventSubtitle(activity)}
        statusRow={statusRow}
        statusTrailing={
          isBoostActive ? <PublicationBoostLightningBadge /> : null
        }
        updatedLine={updatedLine}
        createdLine={createdLine}
        metrics={cardMetrics}
        metricsPeriodLabel="сегодня"
        actions={
          <>
            <div className={BUSINESS_PUBLICATION_ACTIONS_PRIMARY_ROW}>
              <Link
                href={`/business/events/${activity.id}/participants`}
                className={cn(BUSINESS_PUBLICATION_ACTION_BUTTON, BUSINESS_PUBLICATION_ACTION_NEUTRAL)}
              >
                <Users className="h-4 w-4 shrink-0" />
                Участники
              </Link>
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

              {isBoostActive ? (
                <PublicationBoostActiveButton endsAt={boostEndsAt} />
              ) : promoteBlockReason ? (
                <button
                  type="button"
                  disabled
                  title={EVENT_PROMOTE_BLOCK_TITLE[promoteBlockReason]}
                  className={cn(
                    BUSINESS_PUBLICATION_ACTION_BUTTON,
                    BUSINESS_PUBLICATION_ACTION_PROMOTE,
                  )}
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  Продвинуть
                </button>
              ) : (
                <BoostLauncher
                  target={{ id: activity.id, publicationType: "EVENT", title: activity.title }}
                  disabled={activity.boostDisabled !== false}
                  cooldownUntil={activity.boostNextFreeAt}
                  className={cn(
                    BUSINESS_PUBLICATION_ACTION_BUTTON,
                    BUSINESS_PUBLICATION_ACTION_PROMOTE,
                  )}
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  Продвигать
                </BoostLauncher>
              )}

              {BUSINESS_DASHBOARD_MVP.businessPaidPromotionUiEnabled ? (
                <Link
                  href={buildPromotionLaunchHref({
                    publicationType: "EVENT",
                    publicationId: activity.id,
                  })}
                  className={cn(
                    BUSINESS_PUBLICATION_ACTION_BUTTON,
                    BUSINESS_PUBLICATION_ACTION_PROMOTE,
                  )}
                >
                  <Zap className="h-4 w-4 shrink-0 fill-stone-950" />
                  Promotion выключен
                </Link>
              ) : null}
            </div>

            <div className={BUSINESS_PUBLICATION_ACTIONS_ICON_ROW}>
              <Link
                href={publicEventHref ?? `/me/events/${activity.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="Просмотр"
                aria-label="Просмотр"
              >
                <Eye className="h-4 w-4" />
              </Link>

              <Link
                href={`/business/events/${activity.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                className={BUSINESS_PUBLICATION_ACTION_ICON}
                title="Редактировать"
                aria-label="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </Link>

              {onArchive && canArchiveEvent ? (
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

              {canDeleteEvent ? (
                <button
                  type="button"
                  onClick={() => void onDelete(activity.id)}
                  className={BUSINESS_PUBLICATION_ACTION_DANGER_ICON}
                  title="Удалить черновик"
                  aria-label="Удалить черновик"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </>
        }
      />

      <PublicationStatisticsDialog
        open={statisticsOpen}
        onOpenChange={setStatisticsOpen}
        title={activity.title}
        entityLabel="события"
        entityType="EVENT"
        entityId={activity.id}
        publicationCreatedAt={activity.createdAt}
        metrics={activity.metrics}
        promotionPeriods={activity.promotionPerformance?.periods}
        repeatPromotionHref="/dashboard"
      />
    </>
  );
}
