"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import { EventLocationSearchInput } from "./EventLocationSearchInput";
import { EventLocationMapModal } from "./EventLocationMapModal";

interface QuickPlaceCreateProps {
  onPlaceCreated: (place: {
    id: string;
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
  }) => void;
  onCancel: () => void;
  initialName?: string;
}

export function QuickPlaceCreate({
  onPlaceCreated,
  onCancel,
  initialName = "",
}: QuickPlaceCreateProps) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [addressJson, setAddressJson] = useState<unknown[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
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

  const handleMapConfirm = (mapData: { lat: number; lng: number }) => {
    setLat(mapData.lat);
    setLng(mapData.lng);
    setAddress(`Координаты: ${mapData.lat.toFixed(6)}, ${mapData.lng.toFixed(6)}`);
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

    setIsCreating(true);
    setError(null);

    try {
      // Generate unique request ID for idempotency
      const createRequestId = `quick-place-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create place via API with DRAFT status for quick creation
      const response = await fetch("/api/business/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createRequestId,
          status: "DRAFT", // Quick creation as draft
          data: {
            title: name.trim(),
            formattedAddr: address,
            lat,
            lng,
            googlePlaceId,
            addressJson,
            // Minimal data for quick creation
            shortDesc: "Создано при добавлении события",
            description: "",
            category: "other",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Не удалось создать место");
      }

      const data = await response.json();
      const createdPlace = data.place;

      // Call onPlaceCreated with the new place
      onPlaceCreated({
        id: createdPlace.id,
        title: createdPlace.title,
        address: createdPlace.formattedAddr || createdPlace.customAddress || "",
        fullAddress: createdPlace.formattedAddr || createdPlace.customAddress || "",
        cityId: createdPlace.cityId,
        cityName: null, // Will be enriched by parent
        citySlug: null,
        lat: createdPlace.lat,
        lng: createdPlace.lng,
        districtId: createdPlace.districtAutoId || createdPlace.districtManualId,
        districtName: null,
        metroId: createdPlace.metroAutoId || createdPlace.metroManualId,
        metroName: null,
        metroDistanceM: createdPlace.metroAutoDistanceM || createdPlace.metroManualDistanceM,
      });
    } catch (err) {
      console.error("[QuickPlaceCreate] Create error:", err);
      setError(err instanceof Error ? err.message : "Ошибка создания места");
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = name.trim().length > 0 && lat !== null && lng !== null;

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Создать новое место
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
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
            disabled={isCreating}
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
              disabled={isCreating}
              initialValue={address}
              placeholder="Притыцкого 12 или выберите на карте"
            />
            <button
              type="button"
              onClick={() => setIsMapModalOpen(true)}
              disabled={isCreating}
              className="text-sm text-muted-foreground underline decoration-dashed decoration-primary underline-offset-4 hover:text-muted-foreground hover:decoration-primary/80 disabled:opacity-50"
            >
              Выбрать точку на карте
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
            disabled={!canCreate || isCreating}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создаю...
              </>
            ) : (
              "Создать место"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isCreating}
          >
            Отмена
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          После создания место будет доступно для использования в событиях.
          Вы сможете дополнить информацию о месте позже в разделе «Места».
        </p>
      </div>

      {/* Map Modal */}
      <EventLocationMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialLat={lat}
        initialLng={lng}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}
