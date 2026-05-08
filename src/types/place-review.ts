/**
 * Place Review Types
 * Типы для работы с отзывами о местах
 */

import type { PlaceReviewSource, PlaceReviewStatus } from "@prisma/client";

/**
 * Базовый отзыв о месте
 */
export interface PlaceReview {
  id: string;
  placeId: string;
  source: PlaceReviewSource;
  sourceReviewId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string | null;
  language: string | null;
  publishedAt: Date;
  relativeTimeDescription: string | null;
  status: PlaceReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Данные для создания отзыва mamaGo
 */
export interface CreateMamaGoReviewInput {
  placeId: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  text?: string;
  language?: string;
  publishedAt?: Date;
}

/**
 * Данные для создания отзыва Google
 */
export interface CreateGoogleReviewInput {
  placeId: string;
  sourceReviewId: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  text?: string;
  language?: string;
  publishedAt: Date;
  relativeTimeDescription?: string;
}

/**
 * Фильтры для получения отзывов
 */
export interface PlaceReviewFilters {
  placeId?: string;
  source?: PlaceReviewSource;
  status?: PlaceReviewStatus;
  minRating?: number;
  maxRating?: number;
}

/**
 * Статистика отзывов места
 */
export interface PlaceReviewStats {
  totalCount: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  sourceBreakdown: {
    [key in PlaceReviewSource]: number;
  };
}

/**
 * Отзыв с дополнительной информацией о месте
 */
export interface PlaceReviewWithPlace extends PlaceReview {
  place: {
    id: string;
    title: string;
    slug: string | null;
  };
}
