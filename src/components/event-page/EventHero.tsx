"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPageData } from "@/lib/event/eventPageTypes";

interface EventHeroProps {
  data: EventPageData;
  onImageClick?: () => void;
}

/**
 * Hero-зона страницы события.
 * Левая часть: галерея фото (1-3 изображения)
 * Правая часть: заголовок, подзаголовок, quick facts, рейтинг
 */
export function EventHero({ data, onImageClick }: EventHeroProps) {
  const { title, subtitle, media, factChips } = data;

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-10">
      {/* Левая часть: Фото */}
      <div className="space-y-3">
        {/* Основное фото */}
        <button
          type="button"
          onClick={onImageClick}
          className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
        >
          <img
            src={media.posterUrl}
            alt={media.posterAlt}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </button>

        {/* Дополнительные фото (если есть) - placeholder для будущего */}
        {/* TODO: добавить галерею когда будет несколько фото */}
      </div>

      {/* Правая часть: Информация */}
      <div className="flex flex-col gap-6">
        {/* Заголовок */}
        <div className="space-y-3">
          <h1 className="font-headline text-3xl font-bold leading-tight tracking-tight text-foreground lg:text-4xl">
            {title}
          </h1>

          {/* Подзаголовок (value statement) */}
          {subtitle && (
            <div className="space-y-2">
              {subtitle.split('\n').map((line, idx) => (
                <p
                  key={idx}
                  className="flex items-start gap-2 text-[15px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1 text-primary">•</span>
                  <span>{line}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Quick Facts (чипы) */}
        {factChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {factChips.map((chip) => (
              <div
                key={chip.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5",
                  "text-[13px] font-medium text-foreground"
                )}
              >
                {chip.label}
              </div>
            ))}
          </div>
        )}

        {/* Рейтинг и отзывы */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-primary text-primary" />
            <span className="font-semibold text-foreground">4.9</span>
            <span className="text-muted-foreground">(127 отзывов)</span>
          </div>
          {data.venue && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{data.venue.name}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
