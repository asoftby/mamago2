"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSetPublicationIntent } from "@/contexts/PublicationIntentContext";
import { toast } from "@/lib/toast";
import type { OfferPageData, ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import { OfferHero } from "./OfferHero";
import { OfferGallery } from "./OfferGallery";
import { OfferTrailer } from "./OfferTrailer";
import { OfferMetaGrid } from "./OfferMetaGrid";
import { OfferRichDescription } from "./OfferRichDescription";
import { OfferSchedule } from "./OfferSchedule";
import { OfferAccommodation } from "./OfferAccommodation";
import { OfferLocation } from "./OfferLocation";
import { OfferReviews } from "./OfferReviews";
import { OfferHowToJoin } from "./OfferHowToJoin";
import { OfferSimilar } from "./OfferSimilar";
import { OfferStickyBar } from "./OfferStickyBar";
import { OfferBookingModal } from "./OfferBookingModal";
import { PublicationStatsPanel } from "@/components/publication-stats";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

export function OfferPageView({ data }: { data: OfferPageData }) {
  const setPublicationIntent = useSetPublicationIntent();

  // refs
  const ctaRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // plan state
  const [isPrimaryLoading, setIsPrimaryLoading] = useState(false);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const [isInPlan, setIsInPlan] = useState(false);

  // Состояние модалки записи
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftCtaContext | null>(null);

  useEffect(() => {
    setPublicationIntent(data.discoveryIntent ?? null);
    return () => setPublicationIntent(null);
  }, [data.discoveryIntent, setPublicationIntent]);

  // ── Derived flags ──
  const isCamp = data.offerType === "CAMP";
  const hasShifts = isCamp && (data.schedule?.items.length ?? 0) > 0;
  const singleShift = hasShifts && data.schedule!.items.length === 1
    ? data.schedule!.items[0]!
    : null;

  // ── Open booking overlay for a specific shift ──
  const openBooking = useCallback((shift: ShiftCtaContext) => {
    setSelectedShift(shift);
    setBookingOpen(true);
  }, []);

  // ── Primary CTA (hero button / sticky bar) ──
  const handlePrimaryAction = useCallback(() => {
    if (isCamp && hasShifts) {
      if (singleShift) {
        // Одна смена — сразу открываем форму
        openBooking({
          shiftId: singleShift.id,
          title: singleShift.title,
          dateFrom: singleShift.dateFrom,
          dateTo: singleShift.dateTo,
          price: singleShift.price,
          ageRange: singleShift.ageRange,
        });
      } else {
        // Несколько смен — скроллим к секции
        scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // Обычный offer — заглушка (фаза 3)
    setIsPrimaryLoading(true);
    toast.message(data.cta.primaryLabel, {
      description: data.cta.instructions || "Здесь будет форма записи.",
    });
    setTimeout(() => setIsPrimaryLoading(false), 500);
  }, [isCamp, hasShifts, singleShift, openBooking, data.cta.primaryLabel, data.cta.instructions]);

  // ── Shift CTA (кнопка "Записаться" на карточке смены) ──
  const handleShiftCta = useCallback((ctx: ShiftCtaContext) => {
    setSelectedShift(ctx);
    setBookingOpen(true);
  }, []);

  // ── Secondary (В план) ──
  const handleSecondaryAction = useCallback(() => {
    if (!data.cta.secondaryLabel) return;
    setIsSecondaryLoading(true);
    setIsInPlan((prev) => !prev);
    toast.success(isInPlan ? "Убрано из плана" : "Добавлено в план");
    setTimeout(() => setIsSecondaryLoading(false), 300);
  }, [data.cta.secondaryLabel, isInPlan]);

  const handleSave = useCallback(() => {
    setIsInPlan((prev) => !prev);
    toast.success(isInPlan ? "Убрано из плана" : "Добавлено в план");
  }, [isInPlan]);

  // ── Layout flags ──
  const hasSimilar = data.similar.length > 0;
  const hasSchedule = data.schedule !== undefined;
  const hasAccommodation = data.accommodation?.provided;
  const hasVideo = Boolean(data.media.videoUrl);
  const hasGallery = data.media.gallery.length > 0;
  // Для лагерей со сменами "Как записаться" не нужен — процесс очевиден
  const showHowToJoin = !(isCamp && hasShifts);

  // ── Sticky bar ──
  const stickyPrimaryLabel = isCamp ? "Записаться" : data.cta.primaryLabel;
  const stickyPrimaryAction =
    isCamp && hasShifts && !singleShift
      ? () => scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      : handlePrimaryAction;

  const priceLabel = data.pricing.priceFrom || data.pricing.singlePrice || "Уточняйте";

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">

        {/* Preview Banner */}
        {data.previewBannerLabel && (
          <div
            role="status"
            className="mb-6 flex items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-center text-[14px] font-medium text-amber-800"
          >
            {data.previewBannerLabel}
          </div>
        )}

        {/* ── 1. Hero ── */}
        <div ref={ctaRef} className="mb-8 lg:mb-10">
          <OfferHero
            data={data}
            isPrimaryLoading={isPrimaryLoading}
            isSecondaryLoading={isSecondaryLoading}
            isInPlan={isInPlan}
            onPrimary={handlePrimaryAction}
            onSecondary={handleSecondaryAction}
            onSave={handleSave}
          />
        </div>

        {/* ── 2. Facts Bar ── */}
        {data.metaGrid.length > 0 && (
          <div className="mb-10 lg:mb-14">
            <OfferMetaGrid items={data.metaGrid} />
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="space-y-14 lg:space-y-20">

          {/* ── 3. About + Video ── */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-14">
            <OfferRichDescription htmlContent={data.description} />
            {hasVideo && (
              <div className="lg:sticky lg:top-24 lg:self-start">
                <OfferTrailer
                  videoUrl={data.media.videoUrl!}
                  thumbnail={data.media.videoThumbnail}
                  duration={data.media.videoDuration}
                  label={data.media.videoLabel}
                />
              </div>
            )}
          </div>

          {/* ── 4. Photo Gallery ── */}
          {hasGallery && (
            <OfferGallery images={data.media.gallery} />
          )}

          {/* ── 5. Schedule / Shifts ── */}
          {hasSchedule && (
            <div ref={scheduleRef}>
              <OfferSchedule
                type={data.schedule!.type}
                items={data.schedule!.items}
                onShiftCta={handleShiftCta}
                onItemCta={handlePrimaryAction}
              />
            </div>
          )}

          {/* ── 6. Accommodation (CAMP only) ── */}
          {hasAccommodation && (
            <OfferAccommodation data={data.accommodation!} />
          )}

          {/* ── 7. Reviews + How to Join + Location ── */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_minmax(0,360px)] lg:gap-14">
            <div className="space-y-14">
              <OfferReviews
                reviews={data.reviews}
                averageRating={data.averageRating}
                totalCount={data.reviewsCount}
              />
              {showHowToJoin && (
                <OfferHowToJoin ctaType={data.cta.type} />
              )}
            </div>

            {data.place && (
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <OfferLocation place={data.place} />
              </aside>
            )}
          </div>
        </div>

        {/* ── Similar Offers ── */}
        {hasSimilar && (
          <div className="mt-16 border-t border-gray-100 pt-14 lg:mt-20 lg:pt-16">
            <OfferSimilar items={data.similar} />
          </div>
        )}
      </div>

      {/* Publication Stats */}
      {!data.hidePublicationStats && (
        <PublicationStatsPanel
          entityId={data.id}
          path={publicActivityPath(data.id, data.citySlug, data.slug)}
        />
      )}

      {/* ── Sticky Action Bar ── */}
      <OfferStickyBar
        ctaRef={ctaRef}
        title={data.title}
        priceLabel={priceLabel}
        primaryLabel={stickyPrimaryLabel}
        secondaryLabel={data.cta.secondaryLabel}
        isPrimaryLoading={isPrimaryLoading}
        isSecondaryLoading={isSecondaryLoading}
        isInPlan={isInPlan}
        onPrimary={stickyPrimaryAction}
        onSecondary={handleSecondaryAction}
      />

      {/* Модалка записи */}
      <OfferBookingModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        shift={selectedShift}
        onSubmit={() => {
          toast.success("Заявка успешно отправлена!");
        }}
      />
    </div>
  );
}
