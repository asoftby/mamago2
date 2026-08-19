/**
 * Generate Media Metadata by Usage Context
 * 
 * Automatically generates meaningful title, alt, caption based on:
 * - entityType (PLACE, EVENT, OFFER, etc.)
 * - entityTitle (name of the entity)
 * - field (cover, gallery, logo, etc.)
 */

import { MediaEntityType } from "@prisma/client";
import { formatShortAddress, formatCityForTitle, PlaceAddressData } from "./formatShortAddress";

export interface MediaMetadataContext {
  entityType: MediaEntityType;
  entityTitle?: string | null;
  field?: string | null;
  // For PLACE: address data for enhanced metadata
  placeAddress?: PlaceAddressData | null;
}

export interface GeneratedMediaMetadata {
  title?: string;
  alt?: string;
  caption?: string;
}

/**
 * Generate metadata based on usage context
 */
export function generateMediaMetadata(
  context: MediaMetadataContext
): GeneratedMediaMetadata {
  const { entityType, entityTitle, field } = context;

  // No context - return empty
  if (!entityTitle) {
    return {};
  }

  const fieldLabel = getFieldLabel(field);

  switch (entityType) {
    case "PLACE":
      return generatePlaceMetadata(entityTitle, field, fieldLabel, context.placeAddress);
    
    case "EVENT":
      return generateEventMetadata(entityTitle, field, fieldLabel);
    
    case "OFFER":
      return generateOfferMetadata(entityTitle, field, fieldLabel);
    
    case "ROUTE":
      return generateRouteMetadata(entityTitle, field, fieldLabel);
    
    case "ARTICLE":
      return generateArticleMetadata(entityTitle, field, fieldLabel);
    
    case "USER":
      return generateUserMetadata(entityTitle, field, fieldLabel);
    
    case "STORY":
      return generateStoryMetadata(entityTitle, field, fieldLabel);
    
    default:
      return generateGenericMetadata(entityTitle, field, fieldLabel);
  }
}

function generatePlaceMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string,
  addressData?: PlaceAddressData | null
): GeneratedMediaMetadata {
  // Get address components
  const fullAddress = formatShortAddress(addressData || {});

  // Build compact title: "PlaceName, Address"
  const compactTitle = fullAddress ? `${title}, ${fullAddress}` : title;

  // Logo: keep simple, no address
  if (field === "logo") {
    return {
      title: `Логотип ${title}`,
      alt: compactTitle,
      caption: `Логотип ${title}`,
    };
  }

  // Cover: use compact format
  if (field === "cover") {
    if (fullAddress) {
      return {
        title: `${title}, ${fullAddress}`,
        alt: `Фотография места ${title}, ${fullAddress}`,
        caption: `Изображение места ${title}, ${fullAddress}`,
      };
    }
    
    // Fallback without address
    return {
      title: title,
      alt: `Обложка места ${title}`,
      caption: `Изображение места ${title}`,
    };
  }

  // Gallery: use compact format
  if (field === "gallery") {
    if (fullAddress) {
      return {
        title: `${title}, ${fullAddress}`,
        alt: `Фотография места ${title}, ${fullAddress}`,
        caption: `Фотогалерея места ${title}, ${fullAddress}`,
      };
    }
    
    // Fallback without address
    return {
      title: title,
      alt: `Фото места ${title}`,
      caption: `Фотография места ${title}`,
    };
  }

  // Generic fallback
  return {
    title: `${title} — ${fieldLabel}`,
    alt: `${title}`,
    caption: `Изображение места ${title}`,
  };
}

function generateEventMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  if (field === "cover") {
    return {
      title: `${title} — афиша`,
      alt: `Афиша события ${title}`,
      caption: `Изображение события ${title}`,
    };
  }

  if (field === "gallery") {
    return {
      title: `${title} — фото события`,
      alt: `Фото события ${title}`,
      caption: `Фотография события ${title}`,
    };
  }

  return {
    title: `${title} — ${fieldLabel}`,
    alt: `Событие ${title}`,
    caption: `Изображение события ${title}`,
  };
}

function generateOfferMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  if (field === "cover") {
    return {
      title: `${title} — промо изображение`,
      alt: `Изображение предложения ${title}`,
      caption: `Промо изображение предложения ${title}`,
    };
  }

  if (field === "gallery") {
    return {
      title: `${title} — фото`,
      alt: `Фото предложения ${title}`,
      caption: `Изображение предложения ${title}`,
    };
  }

  return {
    title: `${title} — ${fieldLabel}`,
    alt: `Предложение ${title}`,
    caption: `Изображение предложения ${title}`,
  };
}

function generateRouteMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  if (field === "cover") {
    return {
      title: `${title} — обложка маршрута`,
      alt: `Обложка маршрута ${title}`,
      caption: `Изображение маршрута ${title}`,
    };
  }

  if (field === "gallery") {
    return {
      title: `${title} — фото маршрута`,
      alt: `Фото маршрута ${title}`,
      caption: `Изображение маршрута ${title}`,
    };
  }

  return {
    title: `${title} — ${fieldLabel}`,
    alt: `Маршрут ${title}`,
    caption: `Изображение маршрута ${title}`,
  };
}

function generateArticleMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  if (field === "cover") {
    return {
      title: `${title} — обложка статьи`,
      alt: `Обложка статьи ${title}`,
      caption: `Изображение статьи ${title}`,
    };
  }

  return {
    title: `${title} — ${fieldLabel}`,
    alt: `Статья ${title}`,
    caption: `Изображение из статьи ${title}`,
  };
}

function generateUserMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  if (field === "avatar") {
    return {
      title: "Аватар пользователя",
      alt: "Аватар пользователя",
      caption: "Изображение профиля пользователя",
    };
  }

  return {
    title: `${title} — ${fieldLabel}`,
    alt: `Пользователь ${title}`,
    caption: `Изображение пользователя ${title}`,
  };
}

function generateStoryMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  return {
    title: `${title} — обложка`,
    alt: `Обложка сторис ${title}`,
    caption: `Изображение сторис ${title}`,
  };
}

function generateGenericMetadata(
  title: string,
  field: string | null | undefined,
  fieldLabel: string
): GeneratedMediaMetadata {
  return {
    title: `${title} — ${fieldLabel}`,
    alt: title,
    caption: `Изображение ${title}`,
  };
}

function getFieldLabel(field: string | null | undefined): string {
  if (!field) return "изображение";

  const labels: Record<string, string> = {
    cover: "обложка",
    logo: "логотип",
    avatar: "аватар",
    gallery: "галерея",
    content: "изображение",
    thumbnail: "миниатюра",
    banner: "баннер",
    icon: "иконка",
    seo: "SEO изображение",
  };

  return labels[field] || field;
}

/**
 * Resolve effective metadata with priority:
 * 1. Manual values from MediaAsset
 * 2. Auto-generated from usage context
 * 3. Fallback to filename
 */
export function resolveEffectiveMetadata(
  media: {
    title?: string | null;
    alt?: string | null;
    caption?: string | null;
    filename: string;
  },
  context?: MediaMetadataContext
): GeneratedMediaMetadata {
  // Generate auto values if context provided
  const autoGenerated = context ? generateMediaMetadata(context) : {};

  return {
    title: media.title || autoGenerated.title || media.filename,
    alt: media.alt || autoGenerated.alt || media.filename,
    caption: media.caption || autoGenerated.caption || undefined,
  };
}

/**
 * Get metadata source type
 */
export type MetadataSource = "manual" | "auto" | "fallback";

export interface MetadataWithSource {
  value: string | undefined;
  source: MetadataSource;
}

/**
 * Resolve metadata with source tracking
 */
export function resolveMetadataWithSource(
  manualValue: string | null | undefined,
  autoValue: string | undefined,
  fallbackValue?: string
): MetadataWithSource {
  if (manualValue) {
    return { value: manualValue, source: "manual" };
  }
  
  if (autoValue) {
    return { value: autoValue, source: "auto" };
  }
  
  return { value: fallbackValue, source: "fallback" };
}

/**
 * Resolve all metadata with sources
 */
export function resolveEffectiveMetadataWithSources(
  media: {
    title?: string | null;
    alt?: string | null;
    caption?: string | null;
    filename: string;
  },
  context?: MediaMetadataContext
) {
  const autoGenerated = context ? generateMediaMetadata(context) : {};

  return {
    title: resolveMetadataWithSource(media.title, autoGenerated.title, media.filename),
    alt: resolveMetadataWithSource(media.alt, autoGenerated.alt, media.filename),
    caption: resolveMetadataWithSource(media.caption, autoGenerated.caption),
  };
}
