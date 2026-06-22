"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Instagram, Phone, Plus, X } from "lucide-react";
import { formSocialPlatformSelectTriggerClassName } from "@/components/ui/form-control-dimensions";
import { MultiPhoneFields } from "@/components/business/wizard/shared/MultiPhoneFields";
import { createDefaultSocialLink } from "../defaults";
import type { EventFormData, SocialLink } from "../types";
import { inferSocialNetworkFromUrl } from "@/lib/content-editor/importContactsHint";
import { normalizePhoneToE164 } from "@/lib/phone/e164";

interface Step7ContactsProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string;
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

export function Step7Contacts({ data, onChange, isEditable, eventId }: Step7ContactsProps) {
  const [placeContacts, setPlaceContacts] = useState<{
    phone: string;
    phoneLabel: string;
    phone2: string;
    phone2Label: string;
    phone3: string;
    phone3Label: string;
    website: string;
    socialLinks: SocialLink[];
  } | null>(null);
  const [importContacts, setImportContacts] = useState<{
    phone: string;
    website: string;
    socialUrls: string[];
  } | null>(null);

  const hasLinkedPlace = Boolean(data.placeId);
  const effectiveContactMode =
    hasLinkedPlace ? data.contactMode ?? "inherit" : "override";

  useEffect(() => {
    if (!hasLinkedPlace || !data.placeId) {
      queueMicrotask(() => {
        setPlaceContacts(null);
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/business/places/${data.placeId}/contact-summary`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        phone?: string;
        phoneLabel?: string;
        phone2?: string;
        phone2Label?: string;
        phone3?: string;
        phone3Label?: string;
        website?: string;
        socialLinks?: SocialLink[];
      };
      if (!cancelled) {
        setPlaceContacts({
          phone: payload.phone ?? "",
          phoneLabel: payload.phoneLabel ?? "",
          phone2: payload.phone2 ?? "",
          phone2Label: payload.phone2Label ?? "",
          phone3: payload.phone3 ?? "",
          phone3Label: payload.phone3Label ?? "",
          website: payload.website ?? "",
          socialLinks: Array.isArray(payload.socialLinks) ? payload.socialLinks : [],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data.placeId, hasLinkedPlace]);

  useEffect(() => {
    if (!eventId) {
      queueMicrotask(() => {
        setImportContacts(null);
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/business/events/${eventId}/contact-source`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        phone?: string;
        website?: string;
        socialUrls?: string[];
      };
      if (!cancelled) {
        const socialUrls = Array.isArray(payload.socialUrls)
          ? payload.socialUrls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
          : [];
        const phone = typeof payload.phone === "string" ? payload.phone : "";
        const website = typeof payload.website === "string" ? payload.website : "";
        if (!phone.trim() && !website.trim() && socialUrls.length === 0) {
          setImportContacts(null);
          return;
        }
        setImportContacts({
          phone,
          website,
          socialUrls,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!placeContacts || effectiveContactMode !== "inherit") return;

    if (
      data.phone === placeContacts.phone &&
      data.phoneLabel === (placeContacts.phoneLabel || null) &&
      data.phone2 === (placeContacts.phone2 || null) &&
      data.phone2Label === (placeContacts.phone2Label || null) &&
      data.phone3 === (placeContacts.phone3 || null) &&
      data.phone3Label === (placeContacts.phone3Label || null)
    ) {
      return;
    }

    onChange({
      phone: placeContacts.phone,
      phoneLabel: placeContacts.phoneLabel || null,
      phone2: placeContacts.phone2 || null,
      phone2Label: placeContacts.phone2Label || null,
      phone3: placeContacts.phone3 || null,
      phone3Label: placeContacts.phone3Label || null,
    });
  }, [
    effectiveContactMode,
    placeContacts,
    data.phone,
    data.phoneLabel,
    data.phone2,
    data.phone2Label,
    data.phone3,
    data.phone3Label,
    onChange,
  ]);

  const inheritedItems = useMemo(
    () => [
      {
        label: "Телефон",
        value:
          [placeContacts?.phone, placeContacts?.phone2, placeContacts?.phone3]
            .filter((value): value is string => Boolean(value?.trim()))
            .join(", ") || "Не указан",
        icon: Phone,
      },
      { label: "Сайт", value: placeContacts?.website?.trim() || "Не указан", icon: Globe },
      {
        label: "Соцсети",
        value:
          placeContacts && placeContacts.socialLinks.length > 0
            ? placeContacts.socialLinks.map((link) => link.url).join(", ")
            : "Не указаны",
        icon: Instagram,
      },
    ],
    [placeContacts],
  );

  const importItems = useMemo(
    () => [
      { label: "Телефон", value: importContacts?.phone?.trim() || "Не указан", icon: Phone },
      { label: "Сайт", value: importContacts?.website?.trim() || "Не указан", icon: Globe },
      {
        label: "Соцсети",
        value:
          importContacts && importContacts.socialUrls.length > 0
            ? importContacts.socialUrls.join(", ")
            : "Не указаны",
        icon: Instagram,
      },
    ],
    [importContacts],
  );

  const handleApplyImportContacts = () => {
    if (!importContacts) return;

    const socialLinks =
      importContacts.socialUrls.length > 0
        ? importContacts.socialUrls.map((url, index) => ({
            id: `import-social-${index}-${url.slice(0, 24)}`,
            network: inferSocialNetworkFromUrl(url),
            url,
          }))
        : [createDefaultSocialLink()];

    onChange({
      contactMode: "override",
      phone: importContacts.phone ? normalizePhoneToE164(importContacts.phone) : "",
      website: importContacts.website,
      socialLinks,
    });
  };

  const handleAddSocialLink = () => {
    onChange({
      contactMode: "override",
      socialLinks: [...data.socialLinks, createDefaultSocialLink()],
    });
  };

  const handleRemoveSocialLink = (id: string) => {
    const next = data.socialLinks.filter((link) => link.id !== id);
    onChange({
      contactMode: "override",
      socialLinks: next.length > 0 ? next : [createDefaultSocialLink()],
    });
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    onChange({
      contactMode: "override",
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

      {importContacts ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-sky-950">Контакты из источника</h3>
              <p className="mt-1 text-[12px] text-sky-900/70">
                Эти данные уже найдены парсером. Их можно перенести в форму одним действием.
              </p>
            </div>
            {isEditable ? (
              <Button type="button" size="sm" onClick={handleApplyImportContacts}>
                Применить контакты
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {importItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm"
              >
                <item.icon className="mt-0.5 h-4 w-4 text-sky-700" />
                <div className="min-w-0">
                  <div className="text-xs text-sky-700/70">{item.label}</div>
                  <div className="break-words text-slate-800">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hasLinkedPlace && effectiveContactMode === "inherit" ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Используются контакты площадки</h3>
              <p className="mt-1 text-[12px] text-stone-600">
                По умолчанию событие наследует телефон, сайт и соцсети связанной площадки.
              </p>
            </div>
            {isEditable ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onChange({ contactMode: "override" })}
              >
                Переопределить контакты
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {inheritedItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
              >
                <item.icon className="mt-0.5 h-4 w-4 text-stone-500" />
                <div className="min-w-0">
                  <div className="text-xs text-stone-500">{item.label}</div>
                  <div className="break-words text-stone-800">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {hasLinkedPlace ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">Переопределение контактов события</p>
                <p className="text-[12px] text-stone-600">
                  Сейчас событие использует собственные контакты вместо данных площадки.
                </p>
              </div>
              {isEditable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onChange({ contactMode: "inherit" })}
                >
                  Использовать контакты площадки
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* Phones (primary stored as E.164) */}
          <MultiPhoneFields
            idPrefix="event-contact"
            isEditable={isEditable}
            primary={{ phone: data.phone || null, label: data.phoneLabel }}
            secondary={{ phone: data.phone2, label: data.phone2Label }}
            tertiary={{ phone: data.phone3, label: data.phone3Label }}
            onChange={(slot, value) => {
              const updates: Partial<EventFormData> = { contactMode: "override" };
              if (slot === "primary") {
                updates.phone = value.phone ?? "";
                updates.phoneLabel = value.label;
              } else if (slot === "secondary") {
                updates.phone2 = value.phone;
                updates.phone2Label = value.label;
              } else {
                updates.phone3 = value.phone;
                updates.phone3Label = value.label;
              }
              onChange(updates);
            }}
            hint="Подпись поможет посетителям выбрать нужный номер: организатор, билеты."
          />

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Сайт</Label>
            <Input
              id="website"
              type="url"
              value={data.website}
              onChange={(e) => onChange({ website: e.target.value, contactMode: "override" })}
              placeholder="https://example.com"
              disabled={!isEditable}
            />
          </div>

          {/* Social Links — по умолчанию одна строка (Instagram + URL) */}
          <div className="space-y-3">
            <Label>Социальные сети</Label>

            <div className="space-y-3">
              {data.socialLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-2">
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
                      className={formSocialPlatformSelectTriggerClassName}
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
                      className="h-10 w-10 shrink-0"
                      onClick={() => handleRemoveSocialLink(link.id)}
                      aria-label="Удалить соцсеть"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
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
        </>
      )}
    </div>
  );
}
