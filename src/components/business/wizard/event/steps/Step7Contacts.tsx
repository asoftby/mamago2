"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
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

export function Step7Contacts({ data, onChange, isEditable }: Step7ContactsProps) {
  const handleAddSocialLink = () => {
    const newLink: SocialLink = {
      id: `social-${Date.now()}`,
      network: "instagram",
      url: "",
    };
    onChange({ socialLinks: [...data.socialLinks, newLink] });
  };

  const handleRemoveSocialLink = (id: string) => {
    onChange({ socialLinks: data.socialLinks.filter(link => link.id !== id) });
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
        <p className="text-sm text-muted-foreground">
          Телефон, сайт и социальные сети
        </p>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          type="tel"
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+375 29 123 45 67"
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

      {/* Social Links */}
      <div className="space-y-3">
        <Label>Социальные сети</Label>
        
        {data.socialLinks.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Социальные сети не добавлены
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.socialLinks.map((link) => (
              <div key={link.id} className="flex gap-2">
                <Select
                  value={link.network}
                  onValueChange={(value) => handleUpdateSocialLink(link.id, { 
                    network: value as SocialLink["network"] 
                  })}
                  disabled={!isEditable}
                >
                  <SelectTrigger className="w-[140px]">
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
                  onChange={(e) => handleUpdateSocialLink(link.id, { url: e.target.value })}
                  placeholder="https://..."
                  disabled={!isEditable}
                  className="flex-1"
                />
                
                {isEditable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSocialLink(link.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

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
