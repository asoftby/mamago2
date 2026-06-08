"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OfferHero } from "./OfferHero";
import { OfferEditorialInsights } from "./OfferEditorialInsights";
import { OfferSchedule } from "./OfferSchedule";
import { OfferReviews } from "./OfferReviews";
import { OfferAccordion } from "./OfferAccordion";
import { OfferPlace } from "./OfferPlace";
import { OfferPromoCta } from "./OfferPromoCta";
import { CampShiftBookingOverlay } from "./CampShiftBookingOverlay";
import { EventStickyActionBar } from "@/components/event-page/EventStickyActionBar";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import type { OfferPageData, OfferScheduleItem, ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import {
  SaveToPlanModal,
  type SaveScenario,
  type SaveToPlanResult,
} from "@/components/activity/SaveToPlanModal";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { toast } from "@/lib/toast";

interface OfferPageViewProps {
  data: OfferPageData;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  isAuthenticated?: boolean;
  canEditOffer?: boolean;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onSave?: () => void;
  onShiftCta?: (ctx: ShiftCtaContext) => void;
}

type LocalOfferSaveState = {
  kind: "plan";
  dateISO?: string | null;
  shiftId?: string | null;
};

function parseShiftDateToIso(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function mapItemToShiftContext(item: OfferScheduleItem): ShiftCtaContext {
  return {
    shiftId: item.id,
    title: item.title,
    dateFrom: item.dateFrom,
    dateTo: item.dateTo,
    price: item.price,
    ageRange: item.ageRange,
  };
}

function sortShiftContextsByNearest(shifts: ShiftCtaContext[]): ShiftCtaContext[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toTimestamp = (value?: string | null) => {
    const iso = parseShiftDateToIso(value);
    if (!iso) return Number.POSITIVE_INFINITY;
    return new Date(`${iso}T00:00:00`).getTime();
  };

  return [...shifts].sort((a, b) => {
    const aTs = toTimestamp(a.dateFrom);
    const bTs = toTimestamp(b.dateFrom);
    const aPast = aTs < today.getTime();
    const bPast = bTs < today.getTime();
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aTs - bTs;
  });
}

export function OfferPageView({
  data,
  isPrimaryLoading,
  isSecondaryLoading,
  canEditOffer = false,
  onPrimary,
  onSave,
  onShiftCta,
}: OfferPageViewProps) {
  const ctaRef = useRef<HTMLElement | null>(null);
  const storageKey = `mamago:offer-plan:${data.id}`;
  const [localSave, setLocalSave] = useState<LocalOfferSaveState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as LocalOfferSaveState) : null;
    } catch {
      return null;
    }
  });
  const [bookingShift, setBookingShift] = useState<ShiftCtaContext | null>(null);
  const [saveTargetShift, setSaveTargetShift] = useState<ShiftCtaContext | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isIdeaSaved, setIsIdeaSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        setLocalSave(raw ? (JSON.parse(raw) as LocalOfferSaveState) : null);
      } catch {
        setLocalSave(null);
      }
    });
  }, [storageKey]);

  const loadIdeaStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/save/status?offerId=${data.id}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json();
      setIsIdeaSaved(Boolean(json.isIdea));
    } catch {
      // ignore auth/network errors for guests
    }
  }, [data.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadIdeaStatus();
    });
  }, [loadIdeaStatus]);

  const persistLocalSave = useCallback((next: LocalOfferSaveState | null) => {
    setLocalSave(next);
    if (typeof window === "undefined") return;
    if (!next) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }, [storageKey]);

  const shiftDateOptions = useMemo(() => {
    return (data.schedule?.items ?? [])
      .map((item) => parseShiftDateToIso(item.dateFrom))
      .filter((value): value is string => Boolean(value));
  }, [data.schedule?.items]);

  const shiftOptions = useMemo(() => {
    if (data.schedule?.type !== "shifts") return [];
    return sortShiftContextsByNearest(data.schedule.items.map(mapItemToShiftContext));
  }, [data.schedule]);

  const stickyPriceLabel = useMemo(() => {
    const p = data.pricing;
    const raw = (p.priceDisplay || p.singlePrice || p.priceFrom || "").replace(/^от\s+/i, "");
    if (!raw) return "";
    const parts = raw.split(" ");
    const num = parts[0] ?? "";
    const unit = normalizeUiCurrencyText(p.priceUnit || parts.slice(1).join(" "));
    return unit ? `${num} ${unit}` : num;
  }, [data.pricing]);

  const stickySessionLine = useMemo(() => {
    const nearest = shiftOptions[0];
    if (!nearest?.dateFrom) return undefined;
    return nearest.dateTo
      ? `${nearest.dateFrom} — ${nearest.dateTo}`
      : nearest.dateFrom;
  }, [shiftOptions]);

  const saveScenario: SaveScenario = useMemo(() => {
    const target = saveTargetShift;
    const targetIso = parseShiftDateToIso(target?.dateFrom);
    return {
      kind: "quickdate",
      title: target?.title || data.title,
      eventPlanDateISO: targetIso ?? undefined,
      eventPlanDateOptions: targetIso ? [targetIso] : shiftDateOptions,
    };
  }, [data.title, saveTargetShift, shiftDateOptions]);

  const openBookingForShift = useCallback((ctx: ShiftCtaContext) => {
    setBookingShift(ctx);
  }, []);

  const openSaveForShift = useCallback((ctx?: ShiftCtaContext | null) => {
    setSaveTargetShift(ctx ?? null);
    setSaveModalOpen(true);
  }, []);

  const handlePrimary = useCallback(() => {
    if (onPrimary) {
      onPrimary();
      return;
    }
    const nearestShift = shiftOptions[0] ?? null;
    if (nearestShift) {
      openBookingForShift(nearestShift);
      return;
    }
    const phone = data.cta.phone?.replace(/[^\d+]/g, "");
    if (phone && typeof window !== "undefined") {
      window.location.href = `tel:${phone}`;
    }
  }, [data.cta.phone, onPrimary, openBookingForShift, shiftOptions]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave();
      return;
    }
    openSaveForShift(null);
  }, [onSave, openSaveForShift]);

  const handleShiftCta = useCallback((ctx: ShiftCtaContext) => {
    if (onShiftCta) {
      onShiftCta(ctx);
      return;
    }
    openBookingForShift(ctx);
  }, [onShiftCta, openBookingForShift]);

  const handleItemCta = useCallback(() => {
    handlePrimary();
  }, [handlePrimary]);

  const handleSavePersist = useCallback((result: SaveToPlanResult) => {
    if (result.action === "cancel") return;

    if (result.action === "remove-idea") {
      void fetch(`/api/save/idea?offerId=${data.id}`, {
        method: "DELETE",
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("offer_idea_remove_failed");
          setIsIdeaSaved(false);
          toast("Убрано из идей", { duration: 2500 });
        })
        .catch(() => {
          toast.error("Не получилось убрать предложение из идей");
        });
      return;
    }

    if (result.action === "ideas") {
      void fetch("/api/save/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offerId: data.id }),
      })
        .then(async (res) => {
          if (res.status === 401) {
            toast.error("Нужно войти в аккаунт, чтобы сохранить предложение в идеи");
            return;
          }
          if (!res.ok) throw new Error("offer_idea_save_failed");
          setIsIdeaSaved(true);
        })
        .catch(() => {
          toast.error("Не получилось сохранить предложение в идеи");
        });
      return;
    }

    if (result.action !== "plan") return;
    persistLocalSave({
      kind: "plan",
      dateISO: result.dateISO,
      shiftId: saveTargetShift?.shiftId ?? null,
    });
  }, [data.id, persistLocalSave, saveTargetShift?.shiftId]);

  const isSaved = isIdeaSaved || Boolean(localSave);
  const isPlanSaved = localSave?.kind === "plan";
  const planDate = localSave?.kind === "plan" ? localSave.dateISO ?? null : null;

  return (
    <main className="ep-surface min-h-screen">
      <div className="mx-auto max-w-[1200px] space-y-16 px-4 py-8 sm:px-6 lg:space-y-24 lg:px-8 lg:py-12">
        <div className="mb-4 md:mb-0">
          <MobileSmartBackButton fallbackUrl={`/${data.citySlug || "minsk"}`} />
        </div>

        <OfferHero
          data={data}
          canEditOffer={canEditOffer}
          isPrimaryLoading={isPrimaryLoading}
          isSecondaryLoading={isSecondaryLoading}
          isInPlan={isPlanSaved}
          isSaved={isSaved}
          onPrimary={handlePrimary}
          onSave={handleSave}
          ctaRef={ctaRef}
        />

        <OfferEditorialInsights data={data} />

        <OfferAccordion data={data} />

        {data.schedule && data.schedule.items.length > 0 && (
          <OfferSchedule
            type={data.schedule.type}
            items={data.schedule.items}
            onShiftCta={handleShiftCta}
            onSaveShift={openSaveForShift}
            onItemCta={handleItemCta}
          />
        )}

        {data.reviews && (
          <OfferReviews
            reviews={data.reviews}
            averageRating={data.averageRating}
            totalCount={data.reviews.length}
          />
        )}

        {data.place && <OfferPlace place={data.place} />}

        {data.promoCta && <OfferPromoCta {...data.promoCta} onPrimary={handlePrimary} />}
      </div>

      <EventStickyActionBar
        ctaRef={ctaRef}
        sessionLine={stickySessionLine}
        priceLabel={stickyPriceLabel}
        primaryLabel={data.cta.primaryLabel}
        onPrimary={handlePrimary}
        isPrimaryLoading={isPrimaryLoading}
        onPlan={handleSave}
        isPlanned={isSaved}
      />

      <CampShiftBookingOverlay
        open={Boolean(bookingShift)}
        onOpenChange={(open) => {
          if (!open) setBookingShift(null);
        }}
        offerId={data.id}
        offerTitle={data.title}
        shift={bookingShift}
        shifts={shiftOptions}
      />

      <SaveToPlanModal
        open={saveModalOpen}
        onOpenChange={(open) => {
          setSaveModalOpen(open);
          if (!open) setSaveTargetShift(null);
        }}
        scenario={saveScenario}
        onConfirm={handleSavePersist}
        isIdea={isIdeaSaved}
        inPlan={isPlanSaved}
        planDate={planDate}
        planStartsAt={null}
      />
    </main>
  );
}
