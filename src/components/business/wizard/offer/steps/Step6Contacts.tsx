"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, Phone, Plus, Store, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { PlaceSearchAutocomplete } from "@/components/business/wizard/event/steps/location/PlaceSearchAutocomplete";
import { createDefaultSocialLink } from "../defaults";
import type { OfferFormData, SocialLink } from "../types";

interface Step6ContactsProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

interface PlaceSummary {
  id: string;
  title: string;
  address: string;
  phone: string;
  website: string;
  socialLinks: SocialLink[];
}

const socialNetworkOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "telegram", label: "Telegram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Другое" },
] as const;

function sameSocialLinks(a: SocialLink[], b: SocialLink[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((link, index) => {
    const other = b[index];
    return (
      other &&
      link.network === other.network &&
      link.url.trim() === other.url.trim()
    );
  });
}

function normalizePlaceSocialLinks(links: SocialLink[]): SocialLink[] {
  return links.map((link, index) => ({
    id: link.id || `place-social-${index}`,
    network: link.network,
    url: link.url,
  }));
}

export function Step6Contacts({ data, onChange, isEditable }: Step6ContactsProps) {
  const [placeSummary, setPlaceSummary] = useState<PlaceSummary | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [isLoadingPlace, setIsLoadingPlace] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    if (!data.placeId) {
      setPlaceSummary(null);
      setPlaceError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingPlace(true);
    setPlaceError(null);

    (async () => {
      try {
        const response = await fetch(`/api/business/places/${data.placeId}/contact-summary`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить контакты места");
        }

        const payload = (await response.json()) as PlaceSummary;
        if (cancelled) return;
        setPlaceSummary({
          id: payload.id,
          title: payload.title,
          address: payload.address,
          phone: payload.phone ?? "",
          website: payload.website ?? "",
          socialLinks: Array.isArray(payload.socialLinks) ? payload.socialLinks : [],
        });
        if (!data.placeTitle || data.placeTitle !== payload.title) {
          onChange({ placeTitle: payload.title });
        }
      } catch (error) {
        if (cancelled) return;
        setPlaceSummary(null);
        setPlaceError(error instanceof Error ? error.message : "Не удалось загрузить место");
        if (data.contactSource === "place") {
          onChange({ contactSource: "manual" });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPlace(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data.placeId, data.contactSource, onChange]);

  useEffect(() => {
    if (!placeSummary || data.contactSource !== "place") return;

    const nextSocialLinks = normalizePlaceSocialLinks(placeSummary.socialLinks);
    if (
      data.phone === placeSummary.phone &&
      data.website === placeSummary.website &&
      sameSocialLinks(data.socialLinks, nextSocialLinks)
    ) {
      return;
    }

    onChange({
      phone: placeSummary.phone,
      website: placeSummary.website,
      socialLinks: nextSocialLinks,
    });
  }, [data.contactSource, data.phone, data.socialLinks, data.website, onChange, placeSummary]);

  const placeContactItems = useMemo(
    () => [
      { label: "Телефон", value: placeSummary?.phone?.trim() || "Не указан", icon: Phone },
      { label: "Сайт", value: placeSummary?.website?.trim() || "Не указан", icon: Globe },
      {
        label: "Соцсети",
        value:
          placeSummary && placeSummary.socialLinks.length > 0
            ? placeSummary.socialLinks.map((link) => link.url).join(", ")
            : "Не указаны",
        icon: Store,
      },
    ],
    [placeSummary],
  );

  const handleUsePlaceContacts = () => {
    if (!placeSummary) return;
    onChange({
      contactSource: "place",
      phone: placeSummary.phone,
      website: placeSummary.website,
      socialLinks: normalizePlaceSocialLinks(placeSummary.socialLinks),
    });
  };

  const handleSelectManual = () => {
    onChange({ contactSource: "manual" });
  };

  const handleSelectPlaceSource = () => {
    if (!data.placeId) {
      setIsPickerOpen(true);
      return;
    }
    handleUsePlaceContacts();
  };

  const handleAddSocialLink = () => {
    onChange({
      contactSource: "manual",
      socialLinks: [...data.socialLinks, createDefaultSocialLink()],
    });
  };

  const handleUpdateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    onChange({
      contactSource: "manual",
      socialLinks: data.socialLinks.map((link) =>
        link.id === id ? { ...link, ...updates } : link,
      ),
    });
  };

  const handleRemoveSocialLink = (id: string) => {
    const next = data.socialLinks.filter((link) => link.id !== id);
    onChange({
      contactSource: "manual",
      socialLinks: next,
    });
  };

  const showManualFields = data.contactSource === "manual" || !data.placeId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Контакты</h2>
        <p className="text-muted-foreground">
          Выберите место или укажите дополнительные способы связи
        </p>
      </div>

      <div className="space-y-3">
        <Label>Источник контактов</Label>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={handleSelectManual}
            disabled={!isEditable}
            className={`rounded-2xl border bg-white p-4 text-left transition-colors ${
              data.contactSource === "manual"
                ? "border-[#EF8759] ring-2 ring-[#EF8759]/15"
                : "border-border hover:border-[#EF8759]/50"
            } ${!isEditable ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="font-medium text-foreground">Ввести вручную</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Телефон, сайт и социальные сети будут заданы отдельно для предложения
            </div>
          </button>

          <button
            type="button"
            onClick={handleSelectPlaceSource}
            disabled={!isEditable}
            className={`rounded-2xl border bg-white p-4 text-left transition-colors ${
              data.contactSource === "place"
                ? "border-[#EF8759] ring-2 ring-[#EF8759]/15"
                : "border-border hover:border-[#EF8759]/50"
            } ${!isEditable ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="font-medium text-foreground">Использовать контакты места</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Подтянуть телефон, сайт и соцсети из выбранной площадки
            </div>
          </button>
        </div>
      </div>

      {data.placeId && placeSummary ? (
        <Card className="rounded-2xl border border-border bg-white shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{placeSummary.title}</div>
                <div className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{placeSummary.address || "Адрес не указан"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.contactSource !== "place" && isEditable ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#EF8759] text-white hover:bg-[#e37443]"
                    onClick={handleUsePlaceContacts}
                  >
                    Использовать данные места
                  </Button>
                ) : null}
                {isEditable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPickerOpen((prev) => !prev)}
                  >
                    Выбрать место
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {placeContactItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2"
                >
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-sm text-foreground break-words">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border border-dashed border-border bg-muted/15">
          <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-foreground">Место пока не выбрано</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Вы можете выбрать место, чтобы не вводить контакты вручную
              </div>
            </div>
            {isEditable ? (
              <Button
                type="button"
                className="bg-[#EF8759] text-white hover:bg-[#e37443]"
                onClick={() => setIsPickerOpen((prev) => !prev)}
              >
                Выбрать место
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {placeError ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Контакты места недоступны</div>
            <div className="mt-1">
              Мы переключили шаг в ручной режим. Вы можете выбрать другое место или заполнить контакты вручную.
            </div>
          </div>
        </div>
      ) : null}

      {isPickerOpen && isEditable ? (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
          <div>
            <div className="font-medium text-foreground">Выбор места</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Найдите существующую площадку и подтяните ее контакты в предложение
            </div>
          </div>
          <PlaceSearchAutocomplete
            selectedPlaceId={data.placeId}
            ownPlacesOnly
            placeholder="Название вашего места"
            onCreatePlace={(initialName) => {
              toast.message(
                initialName.trim()
                  ? `Сначала создайте место «${initialName.trim()}», затем выберите его здесь.`
                  : "Сначала создайте место, затем выберите его здесь.",
              );
            }}
            onPlaceSelect={(place) => {
              onChange({
                placeId: place.id,
                placeTitle: place.title,
                contactSource: "place",
              });
              setIsPickerOpen(false);
            }}
          />
        </div>
      ) : null}

      {data.contactSource === "place" && data.placeId ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-stone-900">Контакты будут взяты из места</div>
              <div className="mt-1 text-xs text-stone-600">
                При изменении контактов в площадке предложение тоже будет использовать обновленные данные.
              </div>
            </div>
            {isEditable ? (
              <Button type="button" size="sm" variant="outline" onClick={handleSelectManual}>
                Редактировать вручную
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showManualFields ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <InternationalPhoneInput
              id="phone"
              value={data.phone}
              onChange={(value) => onChange({ phone: value, contactSource: "manual" })}
              placeholder="+375 29 123 45 67"
              disabled={!isEditable}
            />
            <p className="text-xs text-muted-foreground">
              Дополнительный номер для связи с клиентами
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Веб-сайт</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={data.website}
              onChange={(e) => onChange({ website: e.target.value, contactSource: "manual" })}
              disabled={!isEditable}
            />
            <p className="text-xs text-muted-foreground">
              Ссылка на сайт или страницу с подробной информацией
            </p>
          </div>

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

            {data.socialLinks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">Социальные сети не добавлены</p>
              </div>
            ) : null}

            <div className="space-y-3">
              {data.socialLinks.map((link) => (
                <Card key={link.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Select
                          value={link.network}
                          onValueChange={(value) =>
                            handleUpdateSocialLink(link.id, {
                              network: value as SocialLink["network"],
                            })
                          }
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

                        <div className="md:col-span-2">
                          <Input
                            placeholder="https://instagram.com/username"
                            value={link.url}
                            onChange={(e) =>
                              handleUpdateSocialLink(link.id, { url: e.target.value })
                            }
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
        </>
      ) : null}
    </div>
  );
}
