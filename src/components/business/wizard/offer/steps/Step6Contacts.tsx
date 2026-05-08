// Step 6: Contacts
// Inherits Event Wizard Step7Contacts pattern

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import type { OfferFormData, SocialLink } from "../types";

interface Step6ContactsProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step6Contacts({ data, onChange, isEditable }: Step6ContactsProps) {
  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ website: e.target.value });
  };

  const handleAddSocialLink = () => {
    const newLink: SocialLink = {
      id: Date.now().toString(),
      network: "instagram",
      url: "",
    };
    
    onChange({
      socialLinks: [...data.socialLinks, newLink],
    });
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    const updatedLinks = data.socialLinks.map(link =>
      link.id === id ? { ...link, ...updates } : link
    );
    onChange({ socialLinks: updatedLinks });
  };

  const handleRemoveSocialLink = (id: string) => {
    const filteredLinks = data.socialLinks.filter(link => link.id !== id);
    onChange({ socialLinks: filteredLinks });
  };

  const socialNetworkOptions = [
    { value: "instagram", label: "Instagram" },
    { value: "telegram", label: "Telegram" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "other", label: "Другое" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Контакты</h2>
        <p className="text-muted-foreground">
          Дополнительные способы связи (необязательно)
        </p>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <InternationalPhoneInput
          id="phone"
          value={data.phone}
          onChange={(value) => onChange({ phone: value })}
          placeholder="+375 29 123 45 67"
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          Дополнительный номер для связи с клиентами
        </p>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">Веб-сайт</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          value={data.website}
          onChange={handleWebsiteChange}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          Ссылка на ваш сайт или страницу с подробной информацией
        </p>
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Социальные сети</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSocialLink}
            disabled={!isEditable}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить соцсеть
          </Button>
        </div>

        {data.socialLinks.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Социальные сети не добавлены</p>
          </div>
        )}

        <div className="space-y-3">
          {data.socialLinks.map((link, index) => (
            <Card key={link.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Select
                      value={link.network}
                      onValueChange={(value) => handleUpdateSocialLink(link.id, { network: value as SocialLink["network"] })}
                      disabled={!isEditable}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {socialNetworkOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="col-span-2">
                      <Input
                        placeholder="https://instagram.com/username"
                        value={link.url}
                        onChange={(e) => handleUpdateSocialLink(link.id, { url: e.target.value })}
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSocialLink(link.id)}
                    disabled={!isEditable}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Зачем указывать контакты?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Клиенты смогут связаться с вами напрямую</li>
          <li>• Дополнительные каналы для привлечения клиентов</li>
          <li>• Повышение доверия к предложению</li>
        </ul>
      </div>
    </div>
  );
}