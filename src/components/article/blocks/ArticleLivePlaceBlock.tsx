import Link from "next/link";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
import { formatSharedPrice } from "@/domain/pricing/structuredPrice";
import type { ResolvedArticlePlaceCard } from "@/lib/place/articlePlaceLiveData";
import { ArticlePlaceEmbed } from "./ArticlePlaceEmbed";
import {
  ArticleContactsBlock,
  ArticleOpeningHoursBlock,
  ArticlePriceBlock,
} from "./ArticleStructuredInfoBlocks";

export function contactsForPlaceSections(
  contacts: SharedContactsData,
  sections: ResolvedArticlePlaceCard["sections"],
): SharedContactsData {
  return {
    phones: sections.contacts ? contacts.phones : [],
    socials: sections.contacts ? contacts.socials : [],
    ...(sections.address && contacts.address ? { address: contacts.address } : {}),
    ...(sections.contacts && contacts.email ? { email: contacts.email } : {}),
    ...(sections.contacts && contacts.website ? { website: contacts.website } : {}),
    ...(sections.address && contacts.coordinates ? { coordinates: contacts.coordinates } : {}),
    ...(sections.address && contacts.mapUrl ? { mapUrl: contacts.mapUrl } : {}),
  };
}

export function richPlaceEmbedProps(card: ResolvedArticlePlaceCard) {
  const { place, sections } = card;
  if (!place.embedCard) return null;

  return {
    card: {
      ...place.embedCard,
      coverImageUrl: sections.image ? place.embedCard.coverImageUrl : null,
      coverImageCount: sections.image ? place.embedCard.coverImageCount : 0,
      address: sections.address ? place.embedCard.address : null,
      lat: sections.address ? place.embedCard.lat : null,
      lng: sections.address ? place.embedCard.lng : null,
      mapsUrl: sections.address ? place.embedCard.mapsUrl : null,
      isOpenNow: sections.openingHours ? place.embedCard.isOpenNow : null,
      hoursMessage: sections.openingHours ? place.embedCard.hoursMessage : null,
    },
    description: sections.description ? place.description : null,
    contacts: sections.contacts ? place.contacts : null,
    priceLabel: sections.price ? formatSharedPrice(place.price) : null,
    showCta: sections.cta,
  };
}

export function ArticleLivePlaceBlock({ card }: { card: ResolvedArticlePlaceCard }) {
  const { place, sections } = card;
  const richProps = richPlaceEmbedProps(card);

  if (richProps) {
    // The approved compact/expandable Place design owns the visual shell.
    // All editor section switches are passed through as compact rich-card
    // content rather than silently disappearing in this early-return path.
    return <ArticlePlaceEmbed {...richProps} />;
  }

  // Defensive fallback for a rich resolver that returned null/failed. This
  // keeps the existing structured data visible instead of dropping the block.
  const visibleContacts = contactsForPlaceSections(place.contacts, sections);

  return (
    <section className="not-prose my-8 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm md:my-10">
      {sections.image && place.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrl} alt={place.title} className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="break-words font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          {place.title}
        </h2>
        {sections.description && place.description ? (
          <p className="mt-3 break-words text-[15px] leading-6 text-muted-foreground">
            {place.description}
          </p>
        ) : null}
        {(sections.address || sections.contacts) ? <ArticleContactsBlock data={visibleContacts} /> : null}
        {sections.openingHours && place.openingHours ? <ArticleOpeningHoursBlock data={place.openingHours} /> : null}
        {sections.price ? <ArticlePriceBlock data={place.price} /> : null}
        {sections.cta ? (
          <Link
            href={place.href}
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground no-underline"
          >
            Подробнее о месте
          </Link>
        ) : null}
      </div>
    </section>
  );
}
