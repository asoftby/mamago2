"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventLocationSearchInput } from "./EventLocationSearchInput";
import { EventLocationMapModal } from "./EventLocationMapModal";
import { enrichEventLocation } from "./eventLocationUtils";

interface LocationData {
  id?: string;
  title: string;
  address: string;
  fullAddress: string;
  cityId: string | null;
  cityName: string | null;
  citySlug: string | null;
  lat: number | null;
  lng: number | null;
  districtId: string | null;
  districtName: string | null;
  metroId: string | null;
  metroName: string | null;
  metroDistanceM: number | null;
}

interface QuickPlaceCreateProps {
  onPlaceCreated: (location: LocationData) => void;
  onCancel: () => void;
  initialName?: string;
  /** Встроенный вид (редактор статьи): без «карточки события», без полноэкранной карты по умолчанию */
  embedded?: boolean;
  /** Карта: полноэкранный оверлей или встроенный блок */
  mapLayout?: "modal" | "inline";
  /** Источник создания (для аналитики/логов, не влияет на UI) */
  placeCreateSource?: string;
}

export function QuickPlaceCreate({
  onPlaceCreated,
  onCancel,
  initialName = "",
  embedded = false,
  mapLayout = "modal",
  // placeCreateSource is accepted but not used in UI
  placeCreateSource: _placeCreateSource,
}: QuickPlaceCreateProps) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [addressJson, setAddressJson] = useState<unknown[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  
  // Ref for address input to enable autofocus
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Autofocus on address field when initialName is provided
  useEffect(() => {
    if (initialName && addressInputRef.current) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        addressInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialName]);

  const handleAddressSelect = (placeData: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: unknown[];
  }) => {
    setAddress(placeData.formattedAddr);
    setLat(placeData.lat);
    setLng(placeData.lng);
    setGooglePlaceId(placeData.googlePlaceId);
    setAddressJson(placeData.addressJson);
    setError(null);
  };

  const handleMapConfirm = (mapData: {
    lat: number;
    lng: number;
    formattedAddr?: string;
  }) => {
    setLat(mapData.lat);
    setLng(mapData.lng);
    setAddress(
      mapData.formattedAddr?.trim() ||
        `Координаты: ${mapData.lat.toFixed(6)}, ${mapData.lng.toFixed(6)}`,
    );
    setGooglePlaceId(null);
    setAddressJson([]);
    setError(null);
  };

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      setError("Укажите название места");
      return;
    }

    if (!lat || !lng) {
      setError("Выберите адрес или точку на карте");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Enrich location data with district/metro
      const enrichment = await enrichEventLocation({
        lat,
        lng,
        formattedAddr: address,
        addressJson,
      });

      // Return location data WITHOUT creating Place in database
      onPlaceCreated({
        title: name.trim(),
        address: address,
        fullAddress: address,
        cityId: enrichment?.cityId || null,
        cityName: null,
        citySlug: null,
        lat,
        lng,
        districtId: enrichment?.districtAutoId || null,
        districtName: enrichment?.districtName || null,
        metroId: enrichment?.metroAutoId || null,
        metroName: enrichment?.metroName || null,
        metroDistanceM: enrichment?.metroAutoDistanceM || null,
      });
    } catch (err) {
      console.error("[QuickPlaceCreate] Save error:", err);
      setError(err instanceof Error ? err.message : "Ошибка сохранения локации");
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && lat !== null && lng !== null;

  return (
    <div
      className={cn(
        "rounded-lg p-6",
        embedded
          ? "border border-border bg-muted/30"
          : "border-2 border-primary/20 bg-primary/5",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cn("font-semibold text-gray-900", embedded ? "text-base" : "text-lg")}>
          Указать локацию вручную
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="quick-place-name">
            Название места <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quick-place-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Детский центр Песочница"
            disabled={isSaving}
            className="mt-1"
          />
        </div>

        {/* Address */}
        <div>
          <Label>
            Адрес <span className="text-red-500">*</span>
          </Label>
          <div className="mt-1 space-y-2">
            <EventLocationSearchInput
              ref={addressInputRef}
              onPlaceSelect={handleAddressSelect}
              disabled={isSaving}
              initialValue={address}
              placeholder="Притыцкого 12 или выберите на карте"
            />
            <button
              type="button"
              onClick={() => setIsMapModalOpen(true)}
              disabled={isSaving}
              className="text-sm text-muted-foreground underline decoration-dashed decoration-primary underline-offset-4 hover:text-muted-foreground hover:decoration-primary/80 disabled:opacity-50"
            >
              {mapLayout === "inline" ? "Открыть карту и выбрать точку" : "Выбрать точку на карте"}
            </button>
          </div>
        </div>

        {/* Selected Location Preview */}
        {lat && lng && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-green-900">Локация выбрана</div>
              <div className="mt-0.5 text-green-700">{address}</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!canSave || isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохраняю...
              </>
            ) : (
              "Использовать эту локацию"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Отмена
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Место будет создано или привязано к существующему при публикации события.
        </p>
      </div>

      <div className={cn(mapLayout === "inline" && isMapModalOpen ? "mt-4" : undefined)}>
        <EventLocationMapModal
          isOpen={isMapModalOpen}
          onClose={() => setIsMapModalOpen(false)}
          initialLat={lat}
          initialLng={lng}
          onConfirm={handleMapConfirm}
          layout={mapLayout === "inline" ? "inline" : "fullscreen"}
        />
      </div>
    </div>
  );
}
