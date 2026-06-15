"use client";

import type { GeoScope } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHydrated } from "@/hooks/use-hydrated";

export type PublicationGeoScopeCity = {
  id: string;
  name: string;
  slug: string;
};

export interface PublicationGeoScopeFieldProps {
  geoScope: GeoScope | null;
  onGeoScopeChange: (scope: GeoScope | null) => void;
  cityId: string | null;
  onCityIdChange: (id: string | null) => void;
  cities: PublicationGeoScopeCity[];
  error?: string | null;
  onErrorClear?: () => void;
  disabled?: boolean;
  countryRadioId?: string;
  cityRadioId?: string;
  citySelectId?: string;
}

export function PublicationGeoScopeField({
  geoScope,
  onGeoScopeChange,
  cityId,
  onCityIdChange,
  cities,
  error,
  onErrorClear,
  disabled = false,
  countryRadioId = "pub-geo-country",
  cityRadioId = "pub-geo-city",
  citySelectId = "pub-city-select",
}: PublicationGeoScopeFieldProps) {
  const hydrated = useHydrated();

  return (
    <div className="space-y-3">
      <div>
        <Label>География публикации</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Обязательно перед публикацией. Определяет URL и аудиторию материала.
        </p>
      </div>
      {hydrated ? (
        <RadioGroup
          value={geoScope ?? "__unset__"}
          onValueChange={(v) => {
            if (v === "COUNTRY") {
              onGeoScopeChange("COUNTRY");
              onCityIdChange(null);
            } else if (v === "CITY") {
              onGeoScopeChange("CITY");
            } else {
              onGeoScopeChange(null);
              onCityIdChange(null);
            }
            onErrorClear?.();
          }}
          className="gap-3"
          disabled={disabled}
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="COUNTRY" id={countryRadioId} className="mt-0.5" disabled={disabled} />
            <Label htmlFor={countryRadioId} className="cursor-pointer font-normal">
              <span className="font-medium">Вся Беларусь</span>
              <span className="block text-xs text-muted-foreground">
                Материал не привязан к конкретному городу — URL: /blog/&#123;slug&#125;
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="CITY" id={cityRadioId} className="mt-0.5" disabled={disabled} />
            <Label htmlFor={cityRadioId} className="cursor-pointer font-normal">
              <span className="font-medium">Город</span>
              <span className="block text-xs text-muted-foreground">
                Локальный материал — URL: /&#123;город&#125;/blog/&#123;slug&#125;
              </span>
            </Label>
          </div>
        </RadioGroup>
      ) : (
        <div className="h-16 rounded-md border border-input bg-muted/40 animate-pulse" aria-hidden />
      )}

      {geoScope === "CITY" ? (
        <div className="pl-6">
          {hydrated ? (
            <Select
              value={cityId ?? "__none__"}
              onValueChange={(v) => {
                onCityIdChange(v === "__none__" ? null : v);
                onErrorClear?.();
              }}
              disabled={disabled}
            >
              <SelectTrigger id={citySelectId} className="w-full max-w-xs">
                <SelectValue placeholder="Выберите город" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не выбран</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 max-w-xs rounded-md border border-input bg-muted/40 animate-pulse" aria-hidden />
          )}
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
