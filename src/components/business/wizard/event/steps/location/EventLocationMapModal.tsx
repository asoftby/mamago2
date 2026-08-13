"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";
import { toast } from "@/lib/toast";

interface EventLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (data: {
    lat: number;
    lng: number;
    formattedAddr?: string;
  }) => void;
  /** inline — встроенная карта без полноэкранного оверлея (редактор статьи и т.п.) */
  layout?: "fullscreen" | "inline";
}

export function EventLocationMapModal({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
  layout = "fullscreen",
}: EventLocationMapModalProps) {
  const [tempPin, setTempPin] = useState<{ lat: number; lng: number } | null>(() =>
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const cleanup = () => {
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (markerRef.current) {
      if ("setMap" in markerRef.current) {
        markerRef.current.setMap(null);
      } else {
        markerRef.current.map = null;
      }
      markerRef.current = null;
    }
    mapInstanceRef.current = null;
    geocoderRef.current = null;
  };

  const placeOrMovePin = async (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      if ("setMap" in markerRef.current) {
        markerRef.current.setMap(null);
      } else {
        markerRef.current.map = null;
      }
      markerRef.current = null;
    }

    try {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

      if (mapId) {
        const markerLib = await GoogleMapsService.getMarkerLibrary();
        const { AdvancedMarkerElement } = markerLib;

        const markerContent = document.createElement("div");
        markerContent.className = "relative flex flex-col items-center";
        markerContent.innerHTML = `
          <div class="relative drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
            <div class="absolute left-1/2 top-[calc(100%-4px)] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ring-2 ring-[#c2410c] animate-mg-pulse"></div>
            <svg width="44" height="56" viewBox="0 0 40 52" fill="none" aria-hidden="true">
              <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 32 20 32s20-18 20-32C40 8.954 31.046 0 20 0z" fill="#ea580c"/>
              <path d="M20 2C10.059 2 2 10.059 2 20c0 12.5 18 29 18 29s18-16.5 18-29C38 10.059 29.941 2 20 2z" fill="white"/>
              <path d="M20 4C11.163 4 4 11.163 4 20c0 11 16 26 16 26s16-15 16-26C36 11.163 28.837 4 20 4z" fill="#ea580c"/>
              <circle cx="20" cy="20" r="6" fill="white"/>
            </svg>
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          position: { lat, lng },
          map: mapInstanceRef.current,
          content: markerContent,
        });

        markerRef.current = marker;
      } else {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: mapInstanceRef.current,
          zIndex: 50,
        });
        markerRef.current = marker;
      }
    } catch (err) {
      console.error("[EventLocationMapModal] Marker error:", err);
    }
  };

  const initMap = async (initialPin: { lat: number; lng: number } | null) => {
    if (!mapRef.current) return;

    try {
      const mapsLib = await GoogleMapsService.getMapsLibrary();

      const center = initialPin ?? { lat: 53.9045, lng: 27.5615 };

      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

      const map = new mapsLib.Map(mapRef.current, {
        center,
        zoom: initialPin ? 16 : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ...(mapId ? { mapId } : {}),
      });

      mapInstanceRef.current = map;
      const geocodingLib = await GoogleMapsService.getGeocodingLibrary();
      geocoderRef.current = new geocodingLib.Geocoder();

      await new Promise<void>((resolve) => {
        google.maps.event.addListenerOnce(map, "idle", () => resolve());
      });

      clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          setTempPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      });

      if (initialPin) {
        await placeOrMovePin(initialPin.lat, initialPin.lng);
      }
    } catch (err) {
      console.error("[EventLocationMapModal] Init error:", err);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    const initialPin =
      initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null;

    void initMap(initialPin);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("keydown", handleEsc);
      cleanup();
    };
  }, [isOpen, initialLat, initialLng, onClose]);

  /** Клики по карте: сразу переносим pin (карта уже инициализирована). */
  useEffect(() => {
    if (!tempPin || !mapInstanceRef.current) return;

    let cancelled = false;
    (async () => {
      await placeOrMovePin(tempPin.lat, tempPin.lng);
      if (cancelled || !mapInstanceRef.current) return;
      mapInstanceRef.current.panTo({ lat: tempPin.lat, lng: tempPin.lng });
    })();

    return () => {
      cancelled = true;
    };
  }, [tempPin]);

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    if (!geocoderRef.current) return null;

    try {
      const response = await new Promise<google.maps.GeocoderResponse>((resolve, reject) => {
        geocoderRef.current!.geocode(
          { location: { lat, lng } },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK) {
              resolve({ results: results || [] } as google.maps.GeocoderResponse);
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          }
        );
      });

      if (response.results && response.results.length > 0) {
        return response.results[0].formatted_address;
      }
    } catch (err) {
      console.error("[EventLocationMapModal] Reverse geocoding error:", err);
    }

    return null;
  };

  const handleConfirm = async () => {
    if (!tempPin) return;

    const formattedAddr = await reverseGeocode(tempPin.lat, tempPin.lng);

    onConfirm({
      lat: tempPin.lat,
      lng: tempPin.lng,
      formattedAddr: formattedAddr || undefined,
    });

    toast.success("📍 Точка выбрана на карте", {
      duration: 1500,
    });

    onClose();
  };

  if (!isOpen) return null;

  if (layout === "inline") {
    return (
      <div className="flex h-[min(320px,50vh)] min-h-[220px] flex-col overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Кликните по карте, чтобы поставить метку</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Подтвердите точку снизу</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Свернуть карту"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
        <div ref={mapRef} className="min-h-0 flex-1 w-full" />
        <div className="flex shrink-0 justify-center border-t border-border p-3">
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!tempPin}
            size="default"
            className="shadow-sm"
            style={{ backgroundColor: "#EF8759" }}
          >
            Подтвердить точку
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[100] flex justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <div className="pointer-events-auto max-w-[min(100%,20rem)] rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:max-w-md sm:px-4">
          <p className="text-sm font-medium text-foreground">Кликните по карте, чтобы поставить метку</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Метка появится сразу; подтвердите, когда готово</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card/95 px-3 shadow-lg backdrop-blur-sm transition-colors hover:bg-muted sm:min-w-[7.5rem] sm:px-4"
          aria-label="Закрыть карту"
        >
          <X className="h-5 w-5 text-foreground" strokeWidth={2.25} />
          <span className="hidden text-sm font-semibold sm:inline">Закрыть</span>
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[100] flex justify-center p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!tempPin}
          size="lg"
          className="pointer-events-auto shadow-xl"
          style={{ backgroundColor: "#EF8759" }}
        >
          Подтвердить точку
        </Button>
      </div>

      <div ref={mapRef} className="min-h-0 flex-1 w-full" />
    </div>
  );
}
