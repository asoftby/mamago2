"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { UiActivityCard } from "@/components/ui/activity-card";
import { isFavorite as checkIsFavorite, toggleFavorite } from "@/lib/favorites";

type DomainActivity = {
  id: string;
  title: string;
  image: string;
  coverImage?: string | null;
  ageFrom?: number;
  dateStart?: string | null;
  workingHours?: string | null;
  priceMin?: number | null;
  currency?: string | null;
  badge?: string | null;
  rating?: number | null;
};

type AdapterProps =
  | { activity: DomainActivity; className?: string }
  | {
      id: string;
      title: string;
      image: string;
      age?: string;
      dateLabel?: string;
      priceLabel?: string;
      badge?: string;
      rating?: number;
      className?: string;
    };

export function ActivityCard(props: AdapterProps) {
  const params = useParams() as { city?: string };
  const city = params?.city || "minsk";

  const base =
    "activity" in props
      ? {
          id: props.activity.id,
          title: props.activity.title,
          image: props.activity.coverImage ?? props.activity.image ?? null,
          subtitle: undefined,
          meta: [
            typeof props.activity.ageFrom === "number" ? `${props.activity.ageFrom}+` : null,
            props.activity.dateStart
              ? new Date(props.activity.dateStart).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
              : props.activity.workingHours || null,
            props.activity.priceMin === 0
              ? "Бесплатно"
              : props.activity.priceMin
              ? `от ${props.activity.priceMin} ${props.activity.currency || ""}`.trim()
              : null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
          badges: (props.activity.badge ? [props.activity.badge] : []) as string[],
          rating: props.activity.rating ?? undefined,
          className: props.className,
        }
      : {
          id: props.id,
          title: props.title,
          image: props.image,
          subtitle: undefined,
          meta: [
            props.age || null,
            props.dateLabel || null,
            props.priceLabel || null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
          badges: props.badge ? [props.badge] : [],
          rating: props.rating,
          className: props.className,
        };

  const href = `/${city}/activity/${base.id}`;
  const [favorite, setFavorite] = useState<boolean>(false);

  useEffect(() => {
    setFavorite(checkIsFavorite(base.id));
  }, [base.id]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(base.id);
    setFavorite((f) => !f);
    window.dispatchEvent(new Event("favorites-updated"));
  };

  return (
    <UiActivityCard
      href={href}
      title={base.title}
      imageUrl={base.image}
      badges={base.badges}
      meta={base.meta}
      rating={base.rating}
      topRight={
        <FavoriteButton
          initialLiked={favorite}
          key={favorite ? "fav" : "not-fav"}
          onClick={handleFavoriteClick}
        />
      }
      className={base.className}
    />
  );
}
