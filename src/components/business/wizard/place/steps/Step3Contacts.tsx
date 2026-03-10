"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PlaceFormData } from "../types";

interface Step3ContactsProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step3Contacts({ data, onChange, isEditable = true }: Step3ContactsProps) {
  const [phone, setPhone] = useState(data.phone || "");
  const [website, setWebsite] = useState(data.website || "");
  const [instagram, setInstagram] = useState(data.instagramHandle || "");

  useEffect(() => {
    setPhone(data.phone || "");
    setWebsite(data.website || "");
    setInstagram(data.instagramHandle || "");
  }, [data.phone, data.website, data.instagramHandle]);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    onChange({ phone: value });
  };

  const handleWebsiteChange = (value: string) => {
    setWebsite(value);
    onChange({ website: value });
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
    onChange({
      instagramHandle: normalized,
      instagramUrl: normalized ? `https://instagram.com/${normalized}` : null,
    });
  };

  return (
    <div className="space-y-6">
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
        <p className="text-xs text-muted-foreground mt-1">
          Необязательно, но рекомендуется
        </p>
      </div>

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
        <p className="text-xs text-muted-foreground mt-1">
          Необязательно, но рекомендуется
        </p>
      </div>

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
