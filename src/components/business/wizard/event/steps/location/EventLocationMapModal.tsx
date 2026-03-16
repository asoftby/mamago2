"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";
import { toast } from "sonner";

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
}

export function EventLocationMapModal({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
}: EventLocationMapModalProps) {
  
  // Temporary pin state (not confirmed yet)
  const [tempPin, setTempPin] = useState<{ lat: number; lng: number } | null>(
    initialLat !== null && initialLat !== undefined && initialLng !== null && initialLng !== undefined
      ? { lat: initialLat, lng: initialLng }
      : null
  );

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (isOpen) {
      initMap();
      
      // ESC key handler
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
    }
    return () => {
      cleanup();
    };
  }, [isOpen]);

  // Update marker when tempPin changes
  useEffect(() => {
    if (tempPin && mapInstanceRef.current) {
      updateMarkerPosition(tempPin.lat, tempPin.lng);
      mapInstanceRef.current.panTo({ lat: tempPin.lat, lng: tempPin.lng });
    }
  }, [tempPin]);

  const cleanup = () => {
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (markerRef.current) {
      if ('setMap' in markerRef.current) {
        markerRef.current.setMap(null);
      } else {
        markerRef.current.map = null;
      }
      markerRef.current = null;
    }
  };

  const initMap = async () => {
    if (!mapRef.current) return;

    try {
      const mapsLib = await GoogleMapsService.getMapsLibrary();

      const center = tempPin
        ? { lat: tempPin.lat, lng: tempPin.lng }
        : { lat: 53.9045, lng: 27.5615 }; // Minsk default

      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

      const map = new mapsLib.Map(mapRef.current, {
        center,
        zoom: tempPin ? 16 : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ...(mapId ? { mapId } : {}),
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new google.maps.Geocoder();

      // Wait for map to be ready before adding listeners
      await new Promise<void>((resolve) => {
        google.maps.event.addListenerOnce(map, 'idle', () => resolve());
      });

      // Add initial marker if we have tempPin
      if (tempPin) {
        addMarker(tempPin.lat, tempPin.lng);
      }

      // Setup click listener for manual point selection
      clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          
          setTempPin({ lat: newLat, lng: newLng });
        }
      });
    } catch (err) {
      console.error("[EventLocationMapModal] Init error:", err);
    }
  };

  const updateMarkerPosition = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      // Update existing marker position
      if ('position' in markerRef.current && markerRef.current.position) {
        // AdvancedMarkerElement - update position property
        (markerRef.current as any).position = { lat, lng };
      } else if ('setPosition' in markerRef.current) {
        // Regular Marker
        markerRef.current.setPosition({ lat, lng });
      }
    } else {
      // Create new marker if doesn't exist
      addMarker(lat, lng);
    }
  };

  const addMarker = async (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    // Remove old marker
    if (markerRef.current) {
      if ('setMap' in markerRef.current) {
        markerRef.current.setMap(null);
      } else {
        markerRef.current.map = null;
      }
    }

    try {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

      if (mapId) {
        const markerLib = await GoogleMapsService.getMarkerLibrary();
        const { AdvancedMarkerElement } = markerLib;

        const markerContent = document.createElement("div");
        markerContent.className = "relative";
        markerContent.innerHTML = `
          <div class="relative">
            <div class="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-3 border-[#EF8759] animate-mg-pulse"></div>
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
              <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 32 20 32s20-18 20-32C40 8.954 31.046 0 20 0z" fill="#EF8759"/>
              <path d="M20 2C10.059 2 2 10.059 2 20c0 12.5 18 29 18 29s18-16.5 18-29C38 10.059 29.941 2 20 2z" fill="white"/>
              <path d="M20 4C11.163 4 4 11.163 4 20c0 11 16 26 16 26s16-15 16-26C36 11.163 28.837 4 20 4z" fill="#EF8759"/>
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
        });
        markerRef.current = marker;
      }
    } catch (err) {
      console.error("[EventLocationMapModal] Marker error:", err);
    }
  };

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

    // Try to get formatted address via reverse geocoding
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

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-gray-100 transition-colors"
        aria-label="Закрыть"
      >
        <X className="h-6 w-6 text-gray-700" />
      </button>

      {/* Hint Text */}
      <div className="absolute top-4 left-4 z-10 bg-white shadow-lg rounded-lg px-4 py-2">
        <p className="text-sm text-gray-700">Кликните на карте, чтобы выбрать точку</p>
      </div>

      {/* Confirm Button */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <Button
          onClick={handleConfirm}
          disabled={!tempPin}
          size="lg"
          className="shadow-xl"
          style={{ backgroundColor: "#EF8759" }}
        >
          Подтвердить точку
        </Button>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}