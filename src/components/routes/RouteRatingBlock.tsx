"use client";

import {
  ContentEmojiRating,
  type ContentEmojiRatingProps,
} from "@/components/content/ContentEmojiRating";
import type { EmojiRatingType } from "@/lib/content-rating/emojiRating";

export interface RouteRatingBlockProps {
  routeId: string;
  onRate?: (type: EmojiRatingType) => void;
}

export function RouteRatingBlock({ routeId, onRate }: RouteRatingBlockProps) {
  const props: ContentEmojiRatingProps = {
    entityType: "ROUTE",
    entityId: routeId,
    title: "Зацени маршрут",
    getPath: `/api/routes/ratings/${routeId}`,
    postPath: "/api/routes/rate",
    postBodyKey: "routeId",
    onRate,
  };
  return <ContentEmojiRating {...props} />;
}
