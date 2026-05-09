"use client";

import { PlaceHero } from "./PlaceHero";
import { PlaceEventsSection } from "./PlaceEventsSection";
import { PlaceOffersSection } from "./PlaceOffersSection";
import { PlaceAboutSection } from "./PlaceAboutSection";
import { PlaceAddressSection } from "./PlaceAddressSection";
import { PlaceReviewsSection } from "./PlaceReviewsSection";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface MarketplacePlacePageProps {
  place: {
    id: string;
    title: string;
    slug: string;
    shortDesc: string;
    description: string;
    logoUrl?: string | null;
    rating?: number;
    reviewCount?: number;

    // Contact
    phone?: string;
    website?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    vkUrl?: string;
    youtubeUrl?: string;
    telegramUrl?: string;
    tiktokUrl?: string;

    // Location
    address?: string;
    city?: string;
    district?: string;
    metro?: string;
    latitude?: number;
    longitude?: number;
    /** Основная категория места (для hero) */
    categoryLabel?: string;

    // Breadcrumbs & Maps
    breadcrumbItems: Array<{ label: string; href?: string }>;
    mapsOpenUrl?: string;
    mapsDirectionsUrl?: string;
    workingHoursSummary?: string;

    // Additional info
    yearFounded?: number;
    ageRange?: string;
    format?: string;
    categories?: string[];

    // Media
    images?: Array<{
      id: string;
      url: string;
      alt?: string;
    }>;
  };

  events?: Array<{
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
    startDate: string;
    price?: number;
    category?: string;
  }>;

  offers?: Array<{
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
    description?: string;
    price?: number;
    category?: string;
    duration?: string;
  }>;

  reviews?: Array<{
    id: string;
    source: "MAMAGO" | "GOOGLE";
    authorName: string;
    authorAvatarUrl?: string | null;
    rating: number;
    text?: string | null;
    publishedAt: Date | string;
    relativeTimeDescription?: string | null;
    ownerReplyText?: string | null;
    ownerReplyAuthorName?: string | null;
    ownerReplyCreatedAt?: Date | string | null;
  }>;

  /** Показать «Редактировать» с шагами визарда (те же права, что у редактора места). */
  ownerEditPlaceId?: string;
}

export function MarketplacePlacePage({
  place,
  events = [],
  offers = [],
  reviews = [],
  ownerEditPlaceId,
}: MarketplacePlacePageProps) {
  const coverImage =
    place.images?.[0]?.url ?? place.logoUrl ?? undefined;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: place.title,
        text: place.shortDesc,
        url: window.location.href,
      }).catch(() => {
        // User cancelled or error
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleSave = () => {
    // TODO: Implement save to favorites
    console.log("Save to favorites");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Container */}
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600">
          {place.breadcrumbItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4" />}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-[#EF8759] transition"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-900 font-medium">{item.label}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Hero */}
        <div className="mb-12">
          <PlaceHero
            title={place.title}
            address={place.address}
            shortDesc={place.shortDesc}
            categoryLabel={place.categoryLabel}
            logoUrl={place.logoUrl}
            coverImageUrl={coverImage}
            images={place.images}
            onShareClick={handleShare}
            onSaveClick={handleSave}
            ownerEditPlaceId={ownerEditPlaceId}
          />
        </div>

        {/* Events Section */}
        {events.length > 0 && (
          <div className="mb-12">
            <PlaceEventsSection events={events} placeId={place.slug} />
          </div>
        )}

        {/* Offers Section */}
        {offers.length > 0 && (
          <div className="mb-12">
            <PlaceOffersSection offers={offers} placeId={place.slug} />
          </div>
        )}

        {/* About & Address - Two Columns on Desktop */}
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* About */}
          <PlaceAboutSection
            description={place.description}
            phone={place.phone}
            website={place.website}
            instagramUrl={place.instagramUrl}
            facebookUrl={place.facebookUrl}
            vkUrl={place.vkUrl}
            youtubeUrl={place.youtubeUrl}
            telegramUrl={place.telegramUrl}
            tiktokUrl={place.tiktokUrl}
            yearFounded={place.yearFounded}
            ageRange={place.ageRange}
            format={place.format}
            categories={place.categories}
          />

          {/* Address */}
          <PlaceAddressSection
            address={place.address}
            district={place.district}
            metro={place.metro}
            latitude={place.latitude}
            longitude={place.longitude}
            mapsOpenUrl={place.mapsOpenUrl}
            mapsDirectionsUrl={place.mapsDirectionsUrl}
            workingHoursSummary={place.workingHoursSummary}
          />
        </div>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="mb-12">
            <PlaceReviewsSection reviews={reviews} placeId={place.slug} />
          </div>
        )}
      </div>
    </div>
  );
}
