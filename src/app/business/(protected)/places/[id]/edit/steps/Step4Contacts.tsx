"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Place } from "@prisma/client";
import { WizardStepHeader } from "../components/WizardStepHeader";

interface Step4ContactsProps {
  place: Place;
  onUpdate: (updates: Partial<Place>) => void;
  onPrev: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
  isRevisionMode?: boolean;
  revisionStatus?: string | null;
  isEditable?: boolean;
}

export function Step4Contacts({
  place,
  onUpdate,
  onPrev,
  onSubmit,
  isSaving = false,
  isRevisionMode = false,
  revisionStatus = null,
  isEditable = true,
}: Step4ContactsProps) {
  const [phone, setPhone] = useState(place.phone || "");
  const [website, setWebsite] = useState(place.website || "");
  const [instagram, setInstagram] = useState(place.instagramHandle || "");

  // Check if currently pending moderation
  const isPending = isRevisionMode 
    ? revisionStatus === "PENDING"
    : place.status === "PENDING";

  // Button text changes based on pending state
  const buttonText = isPending ? "⏳ На модерации" : "Отправить на модерацию";

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    onUpdate({ phone: value });
  };

  const handleWebsiteChange = (value: string) => {
    setWebsite(value);
    onUpdate({ website: value });
  };

  const handleInstagramChange = (value: string) => {
    // Normalize: remove @ and URL prefix
    let normalized = value.trim();
    if (normalized.startsWith("@")) {
      normalized = normalized.slice(1);
    }
    if (normalized.includes("instagram.com/")) {
      normalized = normalized.split("instagram.com/")[1].split("/")[0];
    }

    setInstagram(normalized);
    onUpdate({
      instagramHandle: normalized,
      instagramUrl: normalized ? `https://instagram.com/${normalized}` : null,
    });
  };

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Контакты"
        subtitle="Как с вами связаться"
        onBack={onPrev}
        onNext={onSubmit}
        canNext={!isPending && !isSaving}
        nextLabel={buttonText}
        isLastStep={true}
        isSaving={isSaving}
        isPending={isPending}
      />

      {/* Phone */}
      <div>
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="+375 29 123-45-67"
          className="mt-2"
          disabled={!isEditable}
        />
      </div>

      {/* Website */}
      <div>
        <Label htmlFor="website">Веб-сайт</Label>
        <Input
          id="website"
          type="url"
          value={website}
          onChange={(e) => handleWebsiteChange(e.target.value)}
          placeholder="https://example.com"
          className="mt-2"
          disabled={!isEditable}
        />
      </div>

      {/* Instagram */}
      <div>
        <Label htmlFor="instagram">Instagram</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="instagram"
            value={instagram}
            onChange={(e) => handleInstagramChange(e.target.value)}
            placeholder="@username или ссылка"
            className="flex-1"
            disabled={!isEditable}
          />
          {instagram && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`https://instagram.com/${instagram}`, "_blank")}
            >
              Открыть
            </Button>
          )}
        </div>
        {instagram && (
          <p className="text-xs text-muted-foreground mt-1">
            instagram.com/{instagram}
          </p>
        )}
      </div>
    </div>
  );
}
