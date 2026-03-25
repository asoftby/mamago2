"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createDefaultSocialLink } from "../defaults";
import type { EventFormData, SocialLink } from "../types";

interface Step7ContactsProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

const SOCIAL_NETWORKS = [
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Другое" },
] as const;

const SOCIAL_URL_PLACEHOLDER: Record<SocialLink["network"], string> = {
  instagram: "https://instagram.com/...",
  telegram: "https://t.me/...",
  tiktok: "https://www.tiktok.com/@...",
  youtube: "https://youtube.com/...",
  other: "https://...",
};

/** Триггер select в одной системе с `Input` (высота 2.75rem как у `Input`, не h-9 из Select). */
const socialPlatformSelectTriggerClass =
  "h-[2.75rem] min-h-[2.75rem] data-[size=default]:h-[2.75rem] data-[size=default]:min-h-[2.75rem] w-[11rem] shrink-0 justify-between gap-2 rounded-md border border-input bg-white px-3 py-1 text-base shadow-xs md:text-sm data-[size=default]:py-1 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function Step7Contacts({ data, onChange, isEditable }: Step7ContactsProps) {
  const handleAddSocialLink = () => {
    onChange({ socialLinks: [...data.socialLinks, createDefaultSocialLink()] });
  };

  const handleRemoveSocialLink = (id: string) => {
    const next = data.socialLinks.filter((link) => link.id !== id);
    onChange({
      socialLinks: next.length > 0 ? next : [createDefaultSocialLink()],
    });
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    onChange({
      socialLinks: data.socialLinks.map(link =>
        link.id === id ? { ...link, ...updates } : link
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Контакты</h2>
        <p className="text-[12px] text-muted-foreground">
          Телефон, сайт и социальные сети
        </p>
      </div>

      {/* Phone (stored as E.164) */}
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <InternationalPhoneInput
          id="phone"
          value={data.phone}
          onChange={(phone) => onChange({ phone })}
          disabled={!isEditable}
        />
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">Сайт</Label>
        <Input
          id="website"
          type="url"
          value={data.website}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://example.com"
          disabled={!isEditable}
        />
      </div>

      {/* Social Links — по умолчанию одна строка (Instagram + URL) */}
      <div className="space-y-3">
        <Label>Социальные сети</Label>

        <div className="space-y-3">
          {data.socialLinks.map((link) => (
            <div key={link.id} className="flex items-stretch gap-2">
              <Select
                value={link.network}
                onValueChange={(value) =>
                  handleUpdateSocialLink(link.id, {
                    network: value as SocialLink["network"],
                  })
                }
                disabled={!isEditable}
              >
                <SelectTrigger
                  className={cn(socialPlatformSelectTriggerClass, "[&_svg]:opacity-50")}
                  size="default"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {SOCIAL_NETWORKS.map((network) => (
                    <SelectItem key={network.value} value={network.value}>
                      {network.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="url"
                value={link.url}
                onChange={(e) =>
                  handleUpdateSocialLink(link.id, { url: e.target.value })
                }
                placeholder={SOCIAL_URL_PLACEHOLDER[link.network]}
                disabled={!isEditable}
                className="min-w-0 flex-1"
              />

              {isEditable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-[2.75rem] w-10 shrink-0 border-0 bg-transparent shadow-none hover:bg-transparent dark:hover:bg-transparent"
                  onClick={() => handleRemoveSocialLink(link.id)}
                  aria-label="Удалить соцсеть"
                >
                  <X className="h-4 w-4 text-muted-foreground opacity-80 transition-opacity hover:opacity-100" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {isEditable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSocialLink}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить соцсеть
          </Button>
        )}
      </div>
    </div>
  );
}
