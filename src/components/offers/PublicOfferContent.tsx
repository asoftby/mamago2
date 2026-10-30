import type { ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import { PublicOfferHero, type PublicOfferHeroProps } from "./PublicOfferHero";
import { PublicationFactsStrip } from "@/components/publication-page/PublicationFactsStrip";
import { PublicationAboutSection } from "@/components/publication-page/PublicationAboutSection";
import { PublicationSection } from "@/components/publication-page/PublicationSection";
import { PublicationSectionHeading } from "@/components/publication-page/PublicationSectionHeading";
import { EventRichDescription } from "@/components/event-page/EventRichDescription";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { PriceListBlock } from "@/components/shared/PriceListBlock";
import { FaqSection } from "@/components/public/FaqSection";
import { OfferUniqueSections } from "./OfferAccordion";
import { OfferSchedule } from "./OfferSchedule";
import { parsePriceData } from "@/lib/priceItems";
import { isRichTextMeaningful } from "@/lib/richtext/utils";
import { publicOfferPriceLabel, publicOfferShowsPaidPrices } from "./publicOfferPriceLabel";

type Props = PublicOfferHeroProps & {
  onShiftCta: (ctx: ShiftCtaContext) => void;
  onSaveShift: (ctx: ShiftCtaContext) => void;
  onItemCta: (itemId: string) => void;
};

/** Adapts existing presentation data only. No booking, save or CTA policy lives here. */
export function PublicOfferContent(props: Props) {
  const { data, onShiftCta, onSaveShift, onItemCta } = props;
  const description =
    data.about?.filter(isRichTextMeaningful).join("\n") ||
    data.description ||
    "";
  const priceData = parsePriceData(data.pricing.rawPriceItems);
  const showTariffs = publicOfferShowsPaidPrices(data.pricing);
  const priceItems = !showTariffs
    ? []
    : priceData.items.length
      ? priceData.items
      : (data.pricing.options ?? []).map((item) => ({
          ...item,
          label: item.title,
          unit: "",
        }));
  const priceDetails = [
    data.pricing.priceCaption,
    data.pricing.promotionDetails,
  ]
    .filter((value): value is string =>
      Boolean(value && isRichTextMeaningful(value)),
    )
    .join("\n");
  const facts = data.metaGrid.filter((fact) => fact.value?.trim());
  const priceLabel = publicOfferPriceLabel(data.pricing, props.priceLabel);
  const hours = data.openingHours;
  return (
    <>
      <PublicOfferHero {...props} priceLabel={priceLabel} />
      <PublicationFactsStrip facts={facts} />
      {isRichTextMeaningful(description) && (
        <PublicationAboutSection
          kicker="О предложении"
          title="Описание предложения"
        >
          <EventRichDescription
            htmlContent={description}
            collapsedHeight={960}
            className="border-t-0 pt-0"
          />
        </PublicationAboutSection>
      )}
      {data.perks && data.perks.length > 0 && (
        <PublicationSection className="py-14 md:py-16">
          <PublicationSectionHeading
            kicker="Особенности"
            title="Что вас ждёт"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.perks.map((perk, index) => (
              <div key={index} className="space-y-2">
                <p className="text-xl font-semibold text-text-main">
                  {perk.stat}
                </p>
                <p className="text-base text-text-main">{perk.label}</p>
                {perk.desc && (
                  <p className="text-sm text-text-muted">{perk.desc}</p>
                )}
              </div>
            ))}
          </div>
        </PublicationSection>
      )}
      {priceItems.length > 0 ||
      isRichTextMeaningful(priceDetails) ||
      priceData.note.trim() ||
      (showTariffs && data.pricing.discounts?.length) ? (
        <PublicationSection className="py-14 md:py-16">
          <PublicationSectionHeading
            kicker="Стоимость"
            title="Сколько это стоит"
          />
          <PriceListBlock
            items={priceItems}
            note={priceData.note}
            showHeader={false}
          />
          {isRichTextMeaningful(priceDetails) && <RichContentRenderer html={priceDetails} />}
          {showTariffs &&
            data.pricing.discounts?.map((discount, index) => (
              <p key={index} className="my-3 text-sm text-text-main">
                <strong className="mr-3 text-brand">{discount.rate}</strong>
                {discount.label}
              </p>
            ))}
          {data.pricing.promotionSubtitle && (
            <p className="text-sm text-text-muted">
              {data.pricing.promotionSubtitle}
            </p>
          )}
        </PublicationSection>
      ) : null}
      <FaqSection items={data.faqItems} className="!border-t-0" />
      {data.schedule && data.schedule.items.length > 0 && (
        <PublicationSection className="py-14 md:py-16">
          <PublicationSectionHeading
            kicker="Расписание"
            title={
              data.schedule.type === "shifts"
                ? "Выберите удобную смену"
                : "Выберите подходящую группу"
            }
          />
          <OfferSchedule
            showHeading={false}
            type={data.schedule.type}
            items={data.schedule.items}
            onShiftCta={onShiftCta}
            onSaveShift={onSaveShift}
            onItemCta={onItemCta}
          />
        </PublicationSection>
      )}
      {hours && (hours.lines.length > 0 || hours.closedDates.length > 0) && (
        <PublicationSection className="py-14 md:py-16">
          <PublicationSectionHeading
            kicker="Когда можно прийти"
            title="Режим работы"
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-main">
            {hours.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          {hours.closedDates.length > 0 && (
            <p className="mt-3 text-sm text-text-muted">
              Выходные даты:{" "}
              {hours.closedDates
                .map((date) => date.split("-").reverse().join("."))
                .join(", ")}
            </p>
          )}
        </PublicationSection>
      )}
      <OfferUniqueSections data={data} />
    </>
  );
}
