"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PlaceFormData } from "../types";

export interface PlaceContactFieldsSharedProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

/** Телефон и сайт — шаг Place «Контакты» (как в Step3Contacts). */
export function PlacePhoneWebsiteFields({
  data,
  onChange,
  isEditable = true,
}: PlaceContactFieldsSharedProps) {
  return (
    <>
      <div>
        <Label htmlFor="place-phone">Телефон</Label>
        <Input
          id="place-phone"
          type="tel"
          value={data.phone ?? ""}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+375 29 123-45-67"
          className="mt-2"
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground mt-1">Необязательно, но рекомендуется</p>
      </div>

      <div>
        <Label htmlFor="place-website">Веб-сайт</Label>
        <Input
          id="place-website"
          type="url"
          value={data.website ?? ""}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://example.com"
          className="mt-2"
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground mt-1">Необязательно, но рекомендуется</p>
      </div>
    </>
  );
}

/** Instagram — единственная «соцсеть» в текущей схеме Place. */
export function PlaceInstagramField({
  data,
  onChange,
  isEditable = true,
}: PlaceContactFieldsSharedProps) {
  const handleInstagramChange = (value: string) => {
    let normalized = value.trim();
    if (normalized.startsWith("@")) {
      normalized = normalized.slice(1);
    }
    if (normalized.includes("instagram.com/")) {
      normalized = normalized.split("instagram.com/")[1].split("/")[0];
    }
    onChange({
      instagramHandle: normalized,
      instagramUrl: normalized ? `https://instagram.com/${normalized}` : null,
    });
  };

  const instagram = data.instagramHandle ?? "";

  return (
    <div>
      <Label htmlFor="place-instagram">Instagram</Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="place-instagram"
          value={instagram}
          onChange={(e) => handleInstagramChange(e.target.value)}
          placeholder="@username или ссылка"
          className="flex-1"
          disabled={!isEditable}
        />
        {instagram ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(`https://instagram.com/${instagram}`, "_blank")}
          >
            Открыть
          </Button>
        ) : null}
      </div>
      {instagram ? (
        <p className="text-xs text-muted-foreground mt-1">instagram.com/{instagram}</p>
      ) : null}
    </div>
  );
}
