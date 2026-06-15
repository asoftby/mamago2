"use client";

import { useState, useMemo, useCallback } from "react";
import { useRequireVerifiedEmail } from "@/features/email-verification/hooks/useRequireVerifiedEmail";
import type { BirthdayOffer } from "../../../types/birthday";
import type { BirthdayBuilderWithGate } from "../../hooks/useBirthdayBuilderWithGate";
import { BuilderProgress } from "../BuilderProgress";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatConcreteOfferPrice } from "../../../lib/formatOfferPrice";
import {
  getFormatPlaceLine,
  themeLine,
  buildCelebrationTimeline,
  buildOrganizerRequestPreviews,
  formatTotalDurationApprox,
} from "../../lib/buildPartyScenario";
import { calculateBookingInterval } from "../../lib/scheduleUtils";
import { OrganizerRequestReviewCards } from "../OrganizerRequestReviewCards";

type BuilderHook = BirthdayBuilderWithGate;

type TargetGroup = {
  key: string;
  businessName: string;
  offers: BirthdayOffer[];
};

const DEFAULT_START_TIME = "15:00";

/** Слоты с шагом 15 минут (00:00 … 23:45) */
const QUARTER_TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45] as const) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

function snapToNearestQuarter(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return DEFAULT_START_TIME;
  const total = h * 60 + m;
  const snapped = Math.round(total / 15) * 15;
  const clamped = Math.min(23 * 60 + 45, Math.max(0, snapped));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatRuDateLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StepConfirmation({ builder }: { builder: BuilderHook }) {
  const {
    selectedBase,
    selectedAddons,
    resetBuilder,
    state,
    setPartyPlanning,
  } = builder;
  const { partyPlanning } = state;
  const { currentStep } = state.ui;
  const { theme, placeType, partyForChild } = state.quiz;
  const { conflicts } = state.validation;

  const [submitted, setSubmitted] = useState(false);
  const [highlightOfferIds, setHighlightOfferIds] = useState<Set<string>>(
    () => new Set(),
  );

  const conflictIds = useMemo(
    () => new Set(conflicts.map((c) => c.offerId)),
    [conflicts],
  );

  const validOffers = useMemo(
    () =>
      [selectedBase, ...selectedAddons].filter(
        (o): o is BirthdayOffer => o != null && !conflictIds.has(o.id),
      ),
    [selectedBase, selectedAddons, conflictIds],
  );

  const targets = useMemo(() => {
    const map = new Map<string, TargetGroup>();
    validOffers.forEach((offer) => {
      const key = offer.businessId || offer.businessName || `solo-${offer.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          businessName: offer.businessName || "Организатор",
          offers: [],
        });
      }
      map.get(key)!.offers.push(offer);
    });
    return Array.from(map.values());
  }, [validOffers]);

  const targetKeySig = useMemo(
    () => targets.map((t) => t.key).sort().join("|"),
    [targets],
  );

  const [selectedTargetKeys, setSelectedTargetKeys] = useState<Set<string>>(
    () => new Set(targets.map((t) => t.key)),
  );

  const placeLine = useMemo(
    () => getFormatPlaceLine(placeType, selectedBase),
    [placeType, selectedBase],
  );
  const themeL = useMemo(() => themeLine(theme), [theme]);

  const partyDateValue = useMemo((): Date | null => {
    if (!partyPlanning.dateIso) return null;
    const parts = partyPlanning.dateIso.split("-").map(Number);
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }, [partyPlanning.dateIso]);

  const handlePartyDateChange = (d: Date | null) => {
    setPartyPlanning({ dateIso: d ? toIsoDateLocal(d) : null });
  };

  const timeStartEffective = useMemo(
    () => snapToNearestQuarter(partyPlanning.timeStart ?? DEFAULT_START_TIME),
    [partyPlanning.timeStart],
  );

  const venueBookingInterval = useMemo(() => {
    const selectedDurationHours =
      partyPlanning.selectedVenueBookingDurationHours ?? 3;
    const persistedVenueSchedule = selectedBase
      ? partyPlanning.itemSchedules?.[selectedBase.id]
      : null;

    if (persistedVenueSchedule?.startAt && persistedVenueSchedule?.endAt) {
      return {
        startsAt: persistedVenueSchedule.startAt,
        endsAt: persistedVenueSchedule.endAt,
        label: `${persistedVenueSchedule.startAt} — ${persistedVenueSchedule.endAt}`,
      };
    }

    return calculateBookingInterval(timeStartEffective, selectedDurationHours);
  }, [
    partyPlanning.itemSchedules,
    partyPlanning.selectedVenueBookingDurationHours,
    selectedBase,
    timeStartEffective,
  ]);

  const celebrationTimeline = useMemo(
    () =>
      validOffers.length > 0
        ? buildCelebrationTimeline(validOffers, timeStartEffective)
        : null,
    [validOffers, timeStartEffective],
  );

  const organizerRequestPreviews = useMemo(
    () =>
      validOffers.length > 0
        ? buildOrganizerRequestPreviews(validOffers, timeStartEffective)
        : [],
    [validOffers, timeStartEffective],
  );

  const previewByOrganizerKey = useMemo(() => {
    const m = new Map(
      organizerRequestPreviews.map((p) => [p.organizerKey, p] as const),
    );
    return m;
  }, [organizerRequestPreviews]);

  const durationSummary = useMemo(() => {
    if (celebrationTimeline) {
      return formatTotalDurationApprox(celebrationTimeline.totalMinutes);
    }
    return null;
  }, [celebrationTimeline]);

  const toggleTarget = (key: string) => {
    setSelectedTargetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scrollToTimelineAndHighlightOrganizer = (organizerKey: string) => {
    const preview = previewByOrganizerKey.get(organizerKey);
    const ids = new Set(preview?.services.map((s) => s.offerId) ?? []);
    setHighlightOfferIds(ids);
    requestAnimationFrame(() => {
      document
        .getElementById("birthday-scenario-timeline")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.setTimeout(() => setHighlightOfferIds(new Set()), 2800);
  };

  const selectedCount = selectedTargetKeys.size;

  const organizerReviewRows = targets
    .map((t) => {
      const preview = previewByOrganizerKey.get(t.key);
      if (!preview) return null;
      return {
        key: t.key,
        businessName: t.businessName,
        preview,
        isSelected: selectedTargetKeys.has(t.key),
        onToggleSelected: () => toggleTarget(t.key),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const submitParty = useCallback(() => {
    const ts = timeStartEffective;
    const timeline =
      validOffers.length > 0
        ? buildCelebrationTimeline(validOffers, ts)
        : null;

    setPartyPlanning({
      timeStart: ts,
      timeEnd: timeline?.endHHmm ?? null,
      dateIso: partyPlanning.dateIso,
      selectedVenueBookingDurationHours:
        partyPlanning.selectedVenueBookingDurationHours ?? 3,
    });

    const payload = {
      scenario: {
        format: placeLine,
        theme: themeL,
        timeline: timeline?.segments ?? [],
        durationApprox: durationSummary,
        offers: validOffers.map((o) => ({
          id: o.id,
          title: o.title,
          layer: o.layer,
          businessName: o.businessName,
          price: formatConcreteOfferPrice(o),
        })),
      },
      partyPlanning: {
        dateIso: partyPlanning.dateIso,
        timeStart: ts,
        timeEnd: timeline?.endHHmm ?? null,
        selectedVenueBookingDurationHours:
          partyPlanning.selectedVenueBookingDurationHours ?? 3,
        venueBookingInterval: selectedBase
          ? {
              offerId: selectedBase.id,
              title: selectedBase.title,
              startsAt: venueBookingInterval.startsAt,
              endsAt: venueBookingInterval.endsAt,
              label: venueBookingInterval.label,
            }
          : null,
      },
      organizers: targets.filter((t) => selectedTargetKeys.has(t.key)),
      child: partyForChild,
      theme,
      placeType,
    };
    console.log("Birthday builder submit:", payload);
    setSubmitted(true);
  }, [
    timeStartEffective,
    validOffers,
    setPartyPlanning,
    partyPlanning.dateIso,
    placeLine,
    themeL,
    durationSummary,
    targets,
    selectedTargetKeys,
    partyForChild,
    partyPlanning.selectedVenueBookingDurationHours,
    theme,
    placeType,
    selectedBase,
    venueBookingInterval,
  ]);

  const { run: runVerifiedSubmit, VerificationGate } = useRequireVerifiedEmail({
    onVerifiedAction: submitParty,
  });

  const handleSubmit = () => {
    if (builder.isAuthLoading) return;
    if (!builder.isAuthenticated) {
      builder.requestLoginToSubmit();
      return;
    }
    runVerifiedSubmit();
  };

  if (submitted) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Заявки отправлены!</h2>
          <p className="text-muted-foreground mt-2">
            Организаторы свяжутся с вами в ближайшее время
          </p>
        </div>
        <button
          type="button"
          onClick={resetBuilder}
          className="rounded-xl bg-[#EF8759] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Создать новый праздник
        </button>
      </div>
    );
  }

  const hasConflicts = conflicts.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h2 className="text-lg font-medium text-foreground/85">
            Ваш праздник почти готов 🎉
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[min(100%,28rem)]">
            Проверьте сценарий, укажите дату и время начала — мы построим
            таймлайн. Время окончания считается автоматически.
          </p>
        </div>
        <BuilderProgress currentStep={currentStep} />
      </div>

      {hasConflicts && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF8759]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Есть несовместимые позиции</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Они не попадут в заявку, пока вы не измените выбор на шаге итога
            </p>
          </div>
        </div>
      )}

      {/* 1. Сценарий */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Сценарий
        </h3>
        <div className="rounded-2xl border border-border/60 bg-white px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-sm leading-snug text-foreground/90">
            <span className="mr-1.5" aria-hidden>
              {placeLine.emoji}
            </span>
            {placeLine.text}
            {themeL ? (
              <span className="text-muted-foreground">
                {" "}
                · {themeL.emoji} {themeL.text}
              </span>
            ) : null}
          </p>
        </div>
      </section>

      {/* 2. Дата праздника — календарь из ui-lab (DateTimePicker, только дата) */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Дата праздника
        </h3>
        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-white px-4 py-4 sm:px-5 sm:py-5",
          )}
        >
          <DateTimePicker
            dateOnly
            value={partyDateValue}
            onDateChange={handlePartyDateChange}
            disablePast
            className="min-w-0"
          />
          {partyPlanning.dateIso ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRuDateLong(partyPlanning.dateIso)}
            </p>
          ) : null}
        </div>
      </section>

      {/* 3. Когда начинается + таймлайн */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Время и расписание
        </h3>

        <div className="rounded-2xl border border-border/60 bg-white px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-1.5">
            <label
              htmlFor="party-time-start"
              className="text-xs font-medium text-foreground"
            >
              Начало праздника
            </label>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Один момент начала — расписание ниже пересчитается автоматически
            </p>
            <Select
              value={timeStartEffective}
              onValueChange={(v) =>
                setPartyPlanning({ timeStart: v || null })
              }
            >
              <SelectTrigger
                id="party-time-start"
                className={cn(
                  "w-full max-w-[200px] rounded-xl border border-border bg-background px-3 py-2.5 text-sm tabular-nums shadow-none",
                  "h-auto min-h-[2.75rem] focus-visible:ring-2 focus-visible:ring-[#EF8759]/35",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="max-h-72 bg-white text-foreground"
              >
                {QUARTER_TIME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t} className="tabular-nums">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {celebrationTimeline && validOffers.length > 0 ? (
          <div
            id="birthday-scenario-timeline"
            className={cn(
              "scroll-mt-4 rounded-2xl border border-border/50 bg-gradient-to-b from-muted/30 to-white",
              "px-4 py-4 sm:px-5 sm:py-5",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Расписание
            </p>
            <ul className="divide-y divide-border/50">
              {celebrationTimeline.segments.map((seg, i) => {
                const highlight =
                  seg.offerId != null && highlightOfferIds.has(seg.offerId);
                return (
                  <li
                    key={`${seg.time}-${i}`}
                    data-offer-id={seg.offerId}
                    className={cn(
                      "flex gap-4 py-3 first:pt-0 last:pb-0 transition-colors duration-300",
                      highlight &&
                        "-mx-1 rounded-xl bg-[#EF8759]/[0.08] px-1 ring-1 ring-[#EF8759]/25",
                    )}
                  >
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {seg.time}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">
                        {seg.label}
                      </p>
                      {seg.sub ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {seg.sub}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Заявки организаторам */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Заявки организаторам
          </h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Проверьте, что уйдет каждому организатору перед отправкой
          </p>
        </div>
        {organizerReviewRows.length > 0 ? (
          <OrganizerRequestReviewCards
            rows={organizerReviewRows}
            onEdit={scrollToTimelineAndHighlightOrganizer}
          />
        ) : null}
      </section>

      {/* CTA + сводка */}
      <div className="space-y-3 pt-2">
        {selectedCount > 0 &&
        partyPlanning.dateIso &&
        validOffers.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground/90">
            <ul className="space-y-1.5 text-sm leading-relaxed">
              <li>
                <span className="text-muted-foreground">
                  Организаторов в заявке:{" "}
                </span>
                <span className="font-medium">{selectedCount}</span>
              </li>
              <li>
                <span className="text-muted-foreground">Дата: </span>
                {formatRuDateLong(partyPlanning.dateIso)}
              </li>
              <li>
                <span className="text-muted-foreground">Начало: </span>
                {timeStartEffective}
              </li>
              {celebrationTimeline ? (
                <li>
                  <span className="text-muted-foreground">Длительность: </span>
                  {durationSummary}
                  {celebrationTimeline.endHHmm ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (окончание ~{celebrationTimeline.endHHmm})
                    </span>
                  ) : null}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          disabled={selectedCount === 0 || validOffers.length === 0}
          onClick={handleSubmit}
          className={cn(
            "w-full rounded-2xl px-4 py-4 text-base font-semibold transition-all",
            selectedCount > 0 && validOffers.length > 0
              ? "bg-[#EF8759] text-white shadow-sm hover:bg-primary-hover"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          Отправить заявки организаторам
        </button>
        {selectedCount > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            {selectedCount}{" "}
            {selectedCount === 1
              ? "организатор получит заявку по этому сценарию"
              : "организаторов получат заявку по этому сценарию"}
          </p>
        ) : null}
      </div>

      <VerificationGate />
    </div>
  );
}
