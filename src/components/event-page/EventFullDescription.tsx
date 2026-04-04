"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EventFullDescriptionProps {
  text: string;
  previewLines?: number;
}

/**
 * Полное текстовое описание события.
 * Скрыто под "Читать полностью", показывается только preview.
 * Приоритет: структурированные блоки важнее длинного текста.
 */
export function EventFullDescription({
  text,
  previewLines = 3,
}: EventFullDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  return (
    <section className="border-t border-border/40 py-10">
      <h2 className="mb-6 font-headline text-2xl font-bold text-foreground">
        Подробнее
      </h2>

      <div className="relative">
        {/* Текст */}
        <div
          className={cn(
            "prose prose-sm max-w-none text-[15px] leading-relaxed text-foreground",
            !isExpanded && "line-clamp-3"
          )}
        >
          {text.split('\n').map((paragraph, idx) => (
            <p key={idx} className="mb-4 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Градиент fade (если свёрнуто) */}
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>

      {/* Кнопка развернуть/свернуть */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-4 gap-2"
      >
        {isExpanded ? "Свернуть" : "Читать полностью"}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </Button>
    </section>
  );
}
