"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PublicationSlugFieldProps = {
  slug: string;
  onSlugChange: (value: string) => void;
  /**
   * Live slug: auto-generated from title when not touched, or the manually
   * edited value when touched. Used as the input's displayed value so the
   * user always sees the effective slug without a separate "Предполагаемый
   * slug" line below.
   */
  previewSlug: string;
  previewUrl: string | null;
  isSlugPinned: boolean;
  showPublishedSlugWarning?: boolean;
  showPublishedSlugWarningGeneric?: boolean;
  slugHistorySupported?: boolean;
  placeholder?: string;
  id?: string;
};

export function PublicationSlugField({
  slug,
  onSlugChange,
  previewSlug,
  previewUrl,
  isSlugPinned,
  showPublishedSlugWarning = false,
  showPublishedSlugWarningGeneric = false,
  slugHistorySupported = false,
  placeholder = "например: semeynyy-vykhod-v-minsk",
  id = "publication-slug",
}: PublicationSlugFieldProps) {
  void slug; // parent holds the raw state; display uses previewSlug

  const helperText = isSlugPinned
    ? "Slug закреплён. Изменяйте его только если понимаете SEO-последствия."
    : "Slug предложен автоматически из заголовка. Можно изменить вручную до публикации.";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Slug</Label>
      <p className="text-xs text-muted-foreground">{helperText}</p>

      {/* Input shows the live slug (auto-gen or manually edited) directly. */}
      <Input
        id={id}
        value={previewSlug}
        onChange={(e) => onSlugChange(e.target.value)}
        className="font-mono text-sm"
        placeholder={previewSlug ? undefined : placeholder}
      />

      <p className="text-xs text-gray-500 break-all">
        <span className="font-medium text-gray-700">Публичный URL: </span>
        {previewUrl ?? "—"}
      </p>

      {showPublishedSlugWarning ? (
        <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
          Изменение slug изменит публичный URL. Старый адрес должен быть сохранён как редирект,
          если для этой сущности поддерживается история slug.
        </p>
      ) : null}

      {showPublishedSlugWarningGeneric ? (
        <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
          Изменение slug изменит публичный URL. Убедитесь, что для этой сущности настроен редирект
          со старого адреса.
        </p>
      ) : null}
    </div>
  );
}
