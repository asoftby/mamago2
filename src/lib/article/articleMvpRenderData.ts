import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findArticleBySlug } from "@/lib/slug/articleSlugService";
import { parseArticleContentJson, type ArticleBlockMvp } from "@/lib/publications/articleMvp";
import { collectArticlePlaceIds, resolveArticlePlaceCard } from "@/lib/article/articlePlaceResolution";
import { getOfferPageData } from "@/lib/offer/offerPageData";
import { getOfferPublicPath, getOfferPublicSection } from "@/lib/offers/offerPublicUrl";
import {
  type PlaceCardExtra,
  type ResolvedPlaceEmbedCard,
} from "@/lib/place/articlePlaceEmbedData";
import {
  loadArticlePlacesByIds,
  type ResolvedArticlePlace,
  type ResolvedArticlePlaceCard,
} from "@/lib/place/articlePlaceLiveData";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import {
  getPublicActivityDetailWhere,
  getPublicPublishedArticleWhere,
  getPublicPublishedOfferWhere,
  getPublicRouteIndexWhere,
} from "@/server/public/publicContentVisibility";

export type { PlaceCardExtra } from "@/lib/place/articlePlaceEmbedData";

/** Без coverImage / seoImageAsset — на старой БД может не быть колонки coverImageId. */
const articleMvpBaseSelect = {
  id: true,
  title: true,
  excerpt: true,
  subtitle: true,
  slug: true,
  status: true,
  publishedAt: true,
  contentJson: true,
  heroImage: true,
  seoOgImage: true,
  authorLabel: true,
  authorUser: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  category: {
    select: {
      nameRu: true,
    },
  },
  tags: {
    where: { isActive: true },
    select: {
      slug: true,
      title: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} as const;

async function fetchArticleCoverImageId(articleId: string): Promise<string | null> {
  try {
    const r = await prisma.$queryRaw<Array<{ coverImageId: string | null }>>(
      Prisma.sql`SELECT "coverImageId" FROM "Article" WHERE id = ${articleId} LIMIT 1`,
    );
    return r[0]?.coverImageId ?? null;
  } catch {
    return null;
  }
}

async function resolveCoverMedia(coverImageId: string | null): Promise<{
  publicUrl: string | null;
  alt: string | null;
} | null> {
  if (!coverImageId) return null;
  return prisma.mediaAsset.findUnique({
    where: { id: coverImageId },
    select: { publicUrl: true, alt: true },
  });
}

export type ResolvedActivityCard = {
  kind: "basic";
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
  placeExtra?: PlaceCardExtra;
};

export type ArticleShiftPreview = {
  shiftId: string;
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  price?: string;
  oldPrice?: string;
  ageRange?: string;
  promoLabel?: string;
  spotsLeft?: number;
  capacity?: number;
  duration?: string;
};

export type ResolvedOfferEmbedCard = {
  kind: "offer-embed";
  offerId: string;
  href: string;
  title: string;
  imageUrl?: string | null;
  typeLabel: string;
  placeName?: string | null;
  shortDescription?: string | null;
  ageLabel?: string | null;
  formatLabel?: string | null;
  priceLabel?: string | null;
  discountBadge?: string | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  galleryThumbs: string[];
  galleryExtraCount: number;
  metaItems: Array<{ id: string; label: string; value: string }>;
  schedulePreview: ArticleShiftPreview[];
  ctaLabel: string;
  ctaMode: "camp-shift" | "phone" | "external" | "details";
  ctaPhone?: string | null;
  ctaHref?: string | null;
};

export type ArticleMvpResolvedBlock =
  | (ArticleBlockMvp & { type: "intro" })
  | (ArticleBlockMvp & { type: "text" })
  | (ArticleBlockMvp & { type: "quote" })
  | (ArticleBlockMvp & { type: "heading" })
  | (Extract<ArticleBlockMvp, { type: "image" }> & { imageUrl: string | null })
  | (Extract<ArticleBlockMvp, { type: "gallery" }> & {
      images: Array<{
        id: string;
        url: string | null;
        alt: string | null;
        caption: string | null;
        width: number | null;
        height: number | null;
      }>;
    })
  | (Extract<ArticleBlockMvp, { type: "activityCard" }> & {
      card: ResolvedActivityCard | ResolvedOfferEmbedCard | ResolvedPlaceEmbedCard | ResolvedArticlePlaceCard | null;
    })
  | Extract<ArticleBlockMvp, { type: "embed" }>
  | Extract<ArticleBlockMvp, { type: "contacts" | "price" | "openingHours" }>;

function parseRuDateToTimestamp(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`).getTime();
}

function sortShiftsNearestFirst(shifts: ArticleShiftPreview[]): ArticleShiftPreview[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  return [...shifts].sort((left, right) => {
    const leftTs = parseRuDateToTimestamp(left.dateFrom);
    const rightTs = parseRuDateToTimestamp(right.dateFrom);
    const leftPast = leftTs < todayTs;
    const rightPast = rightTs < todayTs;
    if (leftPast !== rightPast) return leftPast ? 1 : -1;
    return leftTs - rightTs;
  });
}

async function resolveActivityCard(
  b: Extract<ArticleBlockMvp, { type: "activityCard" }>,
  prefetched?: Map<string, ResolvedActivityCard>,
): Promise<ResolvedActivityCard | ResolvedOfferEmbedCard | null> {
  if (!b.entityId.trim()) return null;
  if (b.entityType === "PLACE") return null;
  if (b.entityType !== "OFFER" && prefetched) {
    return prefetched.get(`${b.entityType}:${b.entityId}`) ?? null;
  }
  if (b.entityType === "EVENT") {
    const a = await prisma.activity.findFirst({
      where: { id: b.entityId, ...getPublicActivityDetailWhere() },
      select: {
        title: true,
        slug: true,
        type: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!a) return null;
    const citySlug = a.place?.city?.slug;
    const cs = citySlug ?? "minsk";
    const href = `/${cs}/events/${a.slug ?? b.entityId}`;
    return { kind: "basic", href, title: a.title };
  }
  if (b.entityType === "OFFER") {
    const o = await prisma.offer.findFirst({
      where: { id: b.entityId, ...getPublicPublishedOfferWhere() },
      select: {
        id: true,
        title: true,
        slug: true,
        kind: true,
        campProgramType: true,
        place: {
          select: {
            city: { select: { slug: true } },
          },
        },
      },
    });
    if (!o) return null;
    if (!o.slug) {
      return { kind: "basic", href: "#", title: o.title };
    }

    const citySlug = o.place?.city?.slug ?? "minsk";
    const href = getOfferPublicPath({ slug: o.slug }, citySlug);

    const offerData = await getOfferPageData({
      citySlug,
      section: getOfferPublicSection(o),
      slug: o.slug,
    });

    if (!offerData) return null;

    const ageLabel =
      offerData.metaGrid.find((item) => item.id === "age")?.value?.trim() || null;
    const formatLabel =
      offerData.metaGrid.find((item) => item.id === "format")?.value?.trim() || null;
    const priceLabel =
      offerData.pricing.priceFrom?.trim() ||
      offerData.pricing.singlePrice?.trim() ||
      (offerData.pricing.priceDisplay && offerData.pricing.priceUnit
        ? `${offerData.pricing.priceDisplay} ${offerData.pricing.priceUnit}`
        : null);

    const schedulePreview = sortShiftsNearestFirst(
      (offerData.schedule?.items ?? []).map((item) => ({
        shiftId: item.id,
        title: item.title,
        dateFrom: item.dateFrom,
        dateTo: item.dateTo,
        price: item.price,
        oldPrice: item.oldPrice,
        ageRange: item.ageRange,
        promoLabel: item.promoLabel,
        spotsLeft: item.spotsLeft,
        capacity: item.capacity,
        duration: item.duration,
      })),
    );

    const typeLabel =
      offerData.offerType === "CAMP"
        ? "Лагерь"
        : offerData.offerType === "REGULAR"
          ? "Программа"
          : "Предложение";

    const firstDiscount = offerData.pricing.discounts?.[0];
    const discountBadge = firstDiscount
      ? [firstDiscount.rate, firstDiscount.label].filter(Boolean).join(" • ") || null
      : null;

    const metaItems = offerData.metaGrid.map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
    }));

    let ctaMode: ResolvedOfferEmbedCard["ctaMode"] = "details";
    if (schedulePreview.length > 0 && offerData.schedule?.type === "shifts") {
      ctaMode = "camp-shift";
    } else if (offerData.cta.phone?.trim()) {
      ctaMode = "phone";
    } else if (offerData.cta.link?.trim()) {
      ctaMode = "external";
    }

    return {
      kind: "offer-embed",
      offerId: offerData.id,
      href,
      title: offerData.title,
      imageUrl: offerData.media.posterUrl || undefined,
      typeLabel,
      placeName: offerData.place?.name ?? null,
      shortDescription: offerData.shortDescription ?? null,
      ageLabel,
      formatLabel,
      priceLabel,
      discountBadge,
      ratingValue: offerData.averageRating ?? offerData.place?.rating ?? null,
      ratingCount: offerData.reviewsCount ?? offerData.place?.ratingsCount ?? null,
      galleryThumbs: offerData.media.gallery.slice(0, 3).map((image) => image.url),
      galleryExtraCount: Math.max(offerData.media.gallery.length - 3, 0),
      metaItems,
      schedulePreview,
      ctaLabel: offerData.cta.primaryLabel || "Записаться",
      ctaMode,
      ctaPhone: offerData.cta.phone ?? null,
      ctaHref: offerData.cta.link ?? null,
    };
  }
  if (b.entityType === "ROUTE") {
    const r = await prisma.route.findFirst({
      where: { id: b.entityId, ...getPublicRouteIndexWhere() },
      select: { title: true, slug: true },
    });
    if (!r) return null;
    return { kind: "basic", href: `/routes/${r.slug}`, title: r.title };
  }
  // ARTICLE
  const article = await prisma.article.findFirst({
    where: { id: b.entityId, ...getPublicPublishedArticleWhere() },
    select: {
      title: true,
      slug: true,
      geoScope: true,
      city: { select: { slug: true } },
    },
  });
  if (!article) return null;
  let articleHref = "#";
  if (article.slug) {
    if (article.geoScope === "CITY" && article.city?.slug) {
      articleHref = buildCityPublicPath({
        citySlug: article.city.slug,
        type: "article",
        slug: article.slug,
      });
    } else {
      articleHref = buildNationalArticlePath(article.slug);
    }
  }
  return {
    kind: "basic",
    href: articleHref,
    title: article.title,
  };
}

async function loadBasicActivityCards(
  blocks: ArticleBlockMvp[],
): Promise<Map<string, ResolvedActivityCard>> {
  const idsByType = {
    EVENT: new Set<string>(),
    ROUTE: new Set<string>(),
    ARTICLE: new Set<string>(),
  };
  for (const block of blocks) {
    if (block.type !== "activityCard" || block.entityType === "PLACE" || block.entityType === "OFFER") continue;
    const entityId = block.entityId.trim();
    if (entityId) idsByType[block.entityType].add(entityId);
  }

  const [events, routes, articles] = await Promise.all([
    idsByType.EVENT.size
      ? prisma.activity.findMany({
          where: { id: { in: [...idsByType.EVENT] }, ...getPublicActivityDetailWhere() },
          select: { id: true, title: true, slug: true, place: { select: { city: { select: { slug: true } } } } },
        })
      : [],
    idsByType.ROUTE.size
      ? prisma.route.findMany({
          where: { id: { in: [...idsByType.ROUTE] }, ...getPublicRouteIndexWhere() },
          select: { id: true, title: true, slug: true },
        })
      : [],
    idsByType.ARTICLE.size
      ? prisma.article.findMany({
          where: { id: { in: [...idsByType.ARTICLE] }, ...getPublicPublishedArticleWhere() },
          select: { id: true, title: true, slug: true, geoScope: true, city: { select: { slug: true } } },
        })
      : [],
  ]);

  const cards = new Map<string, ResolvedActivityCard>();
  for (const event of events) {
    const citySlug = event.place?.city?.slug ?? "minsk";
    cards.set(`EVENT:${event.id}`, { kind: "basic", href: `/${citySlug}/events/${event.slug ?? event.id}`, title: event.title });
  }
  for (const route of routes) {
    cards.set(`ROUTE:${route.id}`, { kind: "basic", href: `/routes/${route.slug}`, title: route.title });
  }
  for (const article of articles) {
    let href = "#";
    if (article.slug) {
      href = article.geoScope === "CITY" && article.city?.slug
        ? buildCityPublicPath({ citySlug: article.city.slug, type: "article", slug: article.slug })
        : buildNationalArticlePath(article.slug);
    }
    cards.set(`ARTICLE:${article.id}`, { kind: "basic", href, title: article.title });
  }
  return cards;
}

export async function buildArticleMvpResolvedBlocks(
  blocks: ArticleBlockMvp[],
  dependencies: {
    loadPlaces?: (ids: string[]) => Promise<Map<string, ResolvedArticlePlace>>;
    loadBasicCards?: (blocks: ArticleBlockMvp[]) => Promise<Map<string, ResolvedActivityCard>>;
  } = {},
): Promise<ArticleMvpResolvedBlock[]> {
  const out: ArticleMvpResolvedBlock[] = [];
  const mediaIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === "image" && b.mediaId) mediaIds.add(b.mediaId);
    if (b.type === "gallery") b.mediaIds.forEach((id) => mediaIds.add(id));
  }
  const assets =
    mediaIds.size > 0
      ? await prisma.mediaAsset.findMany({
          where: { id: { in: [...mediaIds] } },
          select: { id: true, publicUrl: true, alt: true, title: true, caption: true, width: true, height: true },
        })
      : [];
  const urlById = new Map(assets.map((a) => [a.id, a.publicUrl]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const [placesById, basicCards] = await Promise.all([
    (dependencies.loadPlaces ?? loadArticlePlacesByIds)(collectArticlePlaceIds(blocks)),
    (dependencies.loadBasicCards ?? loadBasicActivityCards)(blocks),
  ]);
  const offerCards = new Map<string, Promise<ResolvedOfferEmbedCard | ResolvedActivityCard | null>>();
  for (const block of blocks) {
    if (block.type !== "activityCard" || block.entityType !== "OFFER") continue;
    const key = block.entityId.trim();
    if (key && !offerCards.has(key)) offerCards.set(key, resolveActivityCard(block));
  }

  for (const b of blocks) {
    if (b.type === "intro" || b.type === "text" || b.type === "quote" || b.type === "heading") {
      out.push(b);
      continue;
    }
    if (b.type === "image") {
      out.push({
        ...b,
        imageUrl: b.mediaId ? urlById.get(b.mediaId) ?? null : null,
      });
      continue;
    }
    if (b.type === "gallery") {
      out.push({
        ...b,
        images: b.mediaIds.map((id) => {
          const asset = assetById.get(id);
          return {
            id,
            url: asset?.publicUrl ?? null,
            alt: asset?.alt?.trim() || asset?.title?.trim() || null,
            caption: asset?.caption?.trim() || null,
            width: asset?.width ?? null,
            height: asset?.height ?? null,
          };
        }),
      });
      continue;
    }
    if (b.type === "activityCard") {
      let card: ResolvedActivityCard | ResolvedOfferEmbedCard | ResolvedPlaceEmbedCard | ResolvedArticlePlaceCard | null;
      if (b.entityType === "PLACE") {
        card = resolveArticlePlaceCard(b, placesById);
      } else if (b.entityType === "OFFER") {
        const key = b.entityId.trim();
        let pending = offerCards.get(key);
        if (!pending) {
          pending = resolveActivityCard(b);
          offerCards.set(key, pending);
        }
        card = await pending;
      } else {
        card = await resolveActivityCard(b, basicCards);
      }
      out.push({ ...b, card });
      continue;
    }
    if (b.type === "embed" || b.type === "contacts" || b.type === "price" || b.type === "openingHours") {
      out.push(b);
    }
  }
  return out;
}

export async function loadArticleMvpBySlugPublic(
  slug: string,
  cityId: string | null,
) {
  const resolved = await findArticleBySlug(slug, cityId);
  if (!resolved) return null;
  const article = await prisma.article.findFirst({
    where: {
      id: resolved.articleId,
      ...getPublicPublishedArticleWhere(),
    },
    select: articleMvpBaseSelect,
  });
  if (!article) return null;
  const cover = await resolveCoverMedia(await fetchArticleCoverImageId(article.id));
  const content = parseArticleContentJson(article.contentJson);
  if (content.blocks.length === 0) return null;
  const blocks = await buildArticleMvpResolvedBlocks(content.blocks);
  const heroUrl = cover?.publicUrl ?? article.heroImage ?? article.seoOgImage ?? null;
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    subtitle: article.subtitle,
    slug: article.slug,
    status: article.status,
    publishedAt: article.publishedAt,
    heroUrl,
    heroAlt: cover?.alt ?? article.title,
    blocks,
    author: article.authorUser
      ? { displayName: article.authorUser.displayName, avatarUrl: article.authorUser.avatarUrl }
      : article.authorLabel
        ? { displayName: article.authorLabel, avatarUrl: null }
        : null,
    categoryLabel: article.category?.nameRu ?? null,
    tags: article.tags,
  };
}

/** Fetch 3 recent breaking news articles (by subtitle marker) excluding `excludeId`. */
export async function loadRelatedBreakingNews(excludeId: string) {
  const rows = await prisma.article.findMany({
    where: {
      ...getPublicPublishedArticleWhere(),
      subtitle: "__breaking_news__",
      id: { not: excludeId },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      heroImage: true,
      seoOgImage: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt,
    heroUrl: r.heroImage ?? r.seoOgImage ?? null,
  }));
}

export async function loadArticleMvpById(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: articleMvpBaseSelect,
  });
  if (!article) return null;
  const cover = await resolveCoverMedia(await fetchArticleCoverImageId(articleId));
  const content = parseArticleContentJson(article.contentJson);
  const blocks = await buildArticleMvpResolvedBlocks(content.blocks);
  const heroUrl = cover?.publicUrl ?? article.heroImage ?? article.seoOgImage ?? null;
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    subtitle: article.subtitle,
    slug: article.slug,
    status: article.status,
    publishedAt: article.publishedAt,
    heroUrl,
    heroAlt: cover?.alt ?? article.title,
    blocks,
    authorUserId: article.authorUser?.id ?? null,
    categoryLabel: article.category?.nameRu ?? null,
    tags: article.tags,
  };
}
