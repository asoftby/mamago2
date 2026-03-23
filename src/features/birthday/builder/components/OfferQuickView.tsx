"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { checkAddonCompatibility } from "../lib/compatibility";
import { AddRemoveButton } from "./AddRemoveButton";
import { Star, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BirthdayOffer } from "../../types/birthday";
import { formatConcreteOfferPrice } from "../../lib/formatOfferPrice";
import type { BirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";

type BuilderHook = BirthdayBuilderWithGate;

const VENUE_INCLUDES_LABELS: Record<string, string> = {
  animator: "Аниматор",
  cake: "Торты / сладости",
  decor: "Декор",
  venue_access: "Аренда зала",
  playground: "Игровая зона",
  soft_zones: "Мягкие зоны",
  masterclass: "Мастер-класс",
  food: "Еда / меню",
  photo: "Фотограф",
};

interface OfferQuickViewProps {
  open: boolean;
  onClose: () => void;
  offer: BirthdayOffer | null;
  builder: BuilderHook;
}

function OfferQuickViewContent({
  offer,
  builder,
  onClose,
}: {
  offer: BirthdayOffer;
  builder: BuilderHook;
  onClose: () => void;
}) {
  const { state, selectedBase, toggleAddon, selectBase } = builder;
  const { placeType } = state.quiz;
  const { selectedBaseId, selectedAddonIds } = state.selection;

  const isBaseOffer = offer.layer === "BASE";
  const isAddon = !isBaseOffer;

  const isSelected = isBaseOffer
    ? selectedBaseId === offer.id
    : selectedAddonIds.includes(offer.id);

  const conflict = useMemo(
    () =>
      isAddon
        ? checkAddonCompatibility(offer, selectedBase ?? null, placeType)
        : null,
    [offer, selectedBase, placeType, isAddon]
  );
  const isIncompatible = !!conflict;

  const handleCta = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBaseOffer) {
      const wasSelected = isSelected;
      selectBase(offer.id);
      if (!wasSelected) toast.success("Добавлено в праздник");
      onClose();
    } else if (!isIncompatible) {
      const wasSelected = isSelected;
      toggleAddon(offer.id);
      if (!wasSelected) toast.success("Добавлено в праздник");
    }
  };

  const ageRange =
    offer.ageMin != null && offer.ageMax != null
      ? `${offer.ageMin}–${offer.ageMax} лет`
      : null;
  const guestsRange =
    offer.guestsMin != null && offer.guestsMax != null
      ? `${offer.guestsMin}–${offer.guestsMax} гостей`
      : null;
  const formatLabels = offer.formatTags?.map((f) => {
    if (f === "HOME") return "Дома";
    if (f === "VENUE") return "В заведении";
    if (f === "OUTDOOR") return "На природе";
    return f;
  });

  const priceLine = formatConcreteOfferPrice(offer);

  return (
    <>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {/* Hero image — full width, 220–280px on desktop */}
        <div className="relative h-48 sm:h-[260px] bg-muted shrink-0 overflow-hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm border border-border/60 hover:bg-white transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
          </button>
          <Image
            src={offer.image}
            alt={offer.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 900px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 sm:pb-6 text-white">
            {offer.businessName && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/90">
                {offer.businessName}
              </span>
            )}
            <h2 className="mt-0.5 text-xl sm:text-2xl font-semibold leading-tight drop-shadow-sm">
              {offer.title}
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-8 space-y-6">
          {/* Price + rating */}
          <div className="flex flex-wrap items-center gap-4 -mt-1">
            {priceLine && (
              <span className="text-lg font-semibold text-foreground">{priceLine}</span>
            )}
            {offer.rating && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-medium text-foreground">{offer.rating}</span>
                {offer.reviewCount != null && (
                  <span className="opacity-80">({offer.reviewCount} отзывов)</span>
                )}
              </span>
            )}
          </div>

          {/* Description */}
          {offer.shortDescription && (
            <div>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {offer.shortDescription}
              </p>
            </div>
          )}

          {/* Что входит */}
          {offer.venueIncludes && offer.venueIncludes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Что входит
              </h4>
              <div className="flex flex-wrap gap-2">
                {offer.venueIncludes.map((inc) => (
                  <span
                    key={inc}
                    className="inline-flex rounded-xl bg-muted/70 px-3 py-1.5 text-sm text-foreground border border-border/40"
                  >
                    {VENUE_INCLUDES_LABELS[inc] || inc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Подходит для */}
          {(ageRange || guestsRange || (formatLabels && formatLabels.length > 0)) && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Подходит для
              </h4>
              <div className="flex flex-wrap gap-2">
                {ageRange && (
                  <span className="text-sm text-foreground/90">{ageRange}</span>
                )}
                {guestsRange && (
                  <span className="text-sm text-foreground/90">{guestsRange}</span>
                )}
                {formatLabels?.map((l) => (
                  <span key={l} className="text-sm text-foreground/90">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compatibility context */}
          {isAddon && (
            <div
              className={cn(
                "rounded-xl p-4 text-sm",
                isIncompatible
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-green-50/80 border border-green-200/60 text-green-800"
              )}
            >
              {isIncompatible ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{conflict?.message ?? "Может не подойти (конфликт с выбранным местом)"}</span>
                </div>
              ) : (
                <span>Подходит для вашего сценария</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div className="shrink-0 p-5 sm:p-8 pt-4 sm:pt-6 border-t border-border/60 bg-background">
        {isBaseOffer ? (
          <AddRemoveButton
            variant="venue"
            size="lg"
            selected={isSelected}
            onClick={handleCta}
            labels={{ default: "Выбрать площадку" }}
            className="w-full"
          />
        ) : (
          <AddRemoveButton
            selected={isSelected}
            disabled={isIncompatible}
            onClick={handleCta}
            labels={{ default: "Добавить", selected: "Добавить", hover: "Убрать" }}
            size="lg"
            className="w-full"
          />
        )}
      </div>
    </>
  );
}

export function OfferQuickView({
  open,
  onClose,
  offer,
  builder,
}: OfferQuickViewProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!offer) return null;

  const content = (
    <OfferQuickViewContent offer={offer} builder={builder} onClose={onClose} />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "w-[min(900px,85vw)] max-w-[min(900px,85vw)] max-h-[85vh] p-0 gap-0",
            "flex flex-col overflow-hidden",
            "rounded-3xl border border-border/60 shadow-2xl",
            "sm:max-w-[min(900px,85vw)]"
          )}
        >
          <DialogTitle className="sr-only">{offer.title}</DialogTitle>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-3xl bg-background">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[90vh] max-h-[90dvh] rounded-t-2xl p-0 gap-0 flex flex-col overflow-hidden",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{offer.title}</SheetTitle>
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center py-3">
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
