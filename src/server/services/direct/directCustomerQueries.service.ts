/**
 * Shared read primitives for the customer-facing Direct UI.
 *
 * The Phase 2 per-thread list/detail queries that used to live here were
 * superseded by directConversation.service.ts (customer UX pivoted to one
 * merged conversation per Business, Instagram-Direct style, instead of one
 * card per publication/thread) — see that file for the aggregation and the
 * migration TODO. What's left here are the primitives it builds on:
 * resolving a thread's displayed "brand" (Place name + logo — never a
 * BusinessMember's name/email/phone) and the Prisma include shape needed to
 * do that.
 */

import "server-only";
import type { Prisma } from "@prisma/client";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";

export interface DirectBrand {
  name: string;
  logoUrl: string | null;
}

const brandPlaceSelect = {
  title: true,
  slug: true,
  logoImageId: true,
  images: { select: { id: true, url: true, kind: true } },
} satisfies Prisma.PlaceSelect;

export const threadListInclude = {
  offer: { select: { title: true, slug: true, cityId: true, place: { select: brandPlaceSelect } } },
  activity: {
    select: {
      title: true,
      slug: true,
      cityId: true,
      place: { select: brandPlaceSelect },
      business: { select: { name: true } },
    },
  },
  place: { select: brandPlaceSelect },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { body: true, senderType: true, createdAt: true, hiddenAt: true },
  },
} satisfies Prisma.DirectThreadInclude;

export type ThreadWithDisplayRelations = Prisma.DirectThreadGetPayload<{
  include: typeof threadListInclude;
}>;

/** Used by directConversation.service.ts for both single-occasion and merged rendering. */
export async function resolveDirectBrand(thread: ThreadWithDisplayRelations): Promise<{
  brand: DirectBrand;
  publicationTitle: string;
  publicationHref: string | null;
}> {
  if (thread.place) {
    const logoUrl = await resolvePlaceLogoUrlFromDb(thread.place.images, thread.place.logoImageId);
    return {
      brand: { name: thread.place.title, logoUrl: logoUrl ?? null },
      publicationTitle: thread.place.title,
      publicationHref: thread.place.slug ? `/places/${thread.place.slug}` : null,
    };
  }

  if (thread.offer) {
    const place = thread.offer.place;
    const logoUrl = place ? await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId) : undefined;
    return {
      brand: { name: place?.title ?? "mamaGo", logoUrl: logoUrl ?? null },
      publicationTitle: thread.offer.title,
      publicationHref: thread.offer.slug ? `/offers/${thread.offer.slug}` : null,
    };
  }

  if (thread.activity) {
    const place = thread.activity.place;
    if (place) {
      const logoUrl = await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId);
      return {
        brand: { name: place.title, logoUrl: logoUrl ?? null },
        publicationTitle: thread.activity.title,
        publicationHref: thread.activity.slug ? `/events/${thread.activity.slug}` : null,
      };
    }
    // Online/placeless event — fall back to the business name, no logo.
    return {
      brand: { name: thread.activity.business?.name ?? "mamaGo", logoUrl: null },
      publicationTitle: thread.activity.title,
      publicationHref: thread.activity.slug ? `/events/${thread.activity.slug}` : null,
    };
  }

  return {
    brand: { name: "mamaGo", logoUrl: null },
    publicationTitle: "Публикация недоступна",
    publicationHref: null,
  };
}
