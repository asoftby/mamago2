"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugifyRu } from "@/lib/slugify";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  slug: string;
  onTitleChange: (title: string) => void;
  onSlugChange: (slug: string) => void;
}

export function WizardStep2TitleSlug({ title, slug, onTitleChange, onSlugChange }: Props) {
  /** true — пользователь вручную редактировал slug */
  const slugManualRef = useRef(false);

  // Auto-generate slug from title while not manually edited
  useEffect(() => {
    if (slugManualRef.current) return;
    const generated = title.trim() ? slugifyRu(title.trim(), "offer") : "";
    onSlugChange(generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    slugManualRef.current = true;
    onSlugChange(e.target.value);
  };

  const handleSlugReset = () => {
    slugManualRef.current = false;
    const generated = title.trim() ? slugifyRu(title.trim(), "offer") : "";
    onSlugChange(generated);
  };

  const publicBase = "mamago.by/offers";
  const slugPreview = slug.trim() || "будет-сгенерирован";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Название и адрес</h2>
        <p className="text-sm text-muted-foreground">
          Как предложение будет называться и по какому URL доступно
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="wiz-title">
          Название <span className="text-red-500">*</span>
        </Label>
        <Input
          id="wiz-title"
          placeholder="Например: Пробное занятие по рисованию"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          Краткое и понятное название того, что предлагается
        </p>
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="wiz-slug">Slug (адрес страницы)</Label>
          {slugManualRef.current && title.trim() && (
            <button
              type="button"
              onClick={handleSlugReset}
              className="text-xs text-[#EF8759] hover:underline"
            >
              Сбросить к автоматическому
            </button>
          )}
        </div>
        <Input
          id="wiz-slug"
          value={slug}
          onChange={handleSlugChange}
          className="font-mono text-sm"
          placeholder="nazvanie-predlozheniya"
        />
        <p className="text-xs text-muted-foreground">
          Slug можно изменить вручную. Используется в URL.
        </p>
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-mono break-all",
            slug.trim()
              ? "border-gray-200 bg-gray-50 text-gray-600"
              : "border-dashed border-gray-200 bg-gray-50 text-gray-400",
          )}
        >
          <span className="text-gray-400">{publicBase}/</span>
          <span className={slug.trim() ? "text-gray-800 font-medium" : "text-gray-400"}>
            {slugPreview}
          </span>
        </div>
      </div>
    </div>
  );
}
