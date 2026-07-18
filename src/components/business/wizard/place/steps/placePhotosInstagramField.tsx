"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstagramAvatarImport } from "@/components/business/place/InstagramAvatarImport";
import { normalizeInstagramHandle, shouldShowInstagramAvatarImport } from "../normalizeInstagramHandle";
import type { PlaceFormData } from "../types";

interface PlacePhotosInstagramFieldProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  wizardSessionId: string | undefined;
  hasLogo: boolean;
  onImportComplete: (mediaId: string, url: string) => void;
  isEditable?: boolean;
}

/**
 * Logo-step fallback for a Place that hasn't filled in Instagram on the
 * Contacts step yet — and a permanently-editable handle field once it has,
 * so a typo doesn't force a trip back to Contacts. Writes to the exact same
 * `PlaceFormData.instagramHandle`/`instagramUrl` (via the same
 * `normalizeInstagramHandle`) as `PlaceInstagramField` on Contacts — one
 * state, two entry points, never a second source of truth.
 */
export function PlacePhotosInstagramField({
  data,
  onChange,
  wizardSessionId,
  hasLogo,
  onImportComplete,
  isEditable = true,
}: PlacePhotosInstagramFieldProps) {
  const instagramHandle = data.instagramHandle?.trim() || "";
  const showImport = shouldShowInstagramAvatarImport({ instagramHandle, wizardSessionId });

  const handleChange = (value: string) => {
    onChange(normalizeInstagramHandle(value));
  };

  return (
    <div className="mb-3 space-y-2">
      {!instagramHandle && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <p className="text-sm font-medium text-foreground">
            Мы можем взять ваш логотип из Instagram
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Укажите адрес страницы или имя профиля — на следующем действии мы
            предложим загрузить аватар как логотип.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="photos-instagram" className="text-xs text-muted-foreground">
          Instagram
        </Label>
        <Input
          id="photos-instagram"
          value={instagramHandle}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="@username или https://instagram.com/username"
          disabled={!isEditable}
          className="mt-1"
        />
      </div>

      {showImport && wizardSessionId ? (
        <InstagramAvatarImport
          instagramHandle={instagramHandle}
          wizardSessionId={wizardSessionId}
          onImportComplete={onImportComplete}
          disabled={!isEditable}
          replaceExisting={hasLogo}
        />
      ) : null}
    </div>
  );
}
