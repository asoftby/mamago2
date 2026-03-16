"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";

interface EventLocationMapPreviewProps {
  lat: number | null;
  lng: number | null;
  onOpenMap: () => void;
}

export function EventLocationMapPreview({ lat, lng, onOpenMap }: EventLocationMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);

  useEffect(() => {
    initMap();
    return () => {
      if (markerRef.current) {
        if ('setMap' in markerRef.current) {
          markerRef.current.setMap(null);
        } else {
          markerRef.current.map = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && lat !== null && lng !== null) {
      mapInstanceRef.current.setCenter({ lat, lng });
      updateMarker(lat, lng);
    }
  }, [lat, lng]);

  const initMap = async () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const mapsLib = await GoogleMapsService.getMapsLibrary();
      const center = lat !== null && lng !== null 
        ? { lat, lng } 
        : { lat: 53.9045, lng: 27.5615 };

      const map = new mapsLib.Map(mapRef.current, {
        center,
        zoom: lat !== null ? 16 : 12,
        disableDefaultUI: true,
        gestureHandling: "none",
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;

      if (lat !== null && lng !== null) {
        updateMarker(lat, lng);
      }
    } catch (err) {
      console.error("[EventLocationMapPreview] Init error:", err);
    }
  };

  const updateMarker = async (lat: number, lng: number) => {
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
      console.error("[EventLocationMapPreview] Marker error:", err);
    }
  };

  return (
    <div className="relative h-[280px] w-full rounded-xl border border-gray-300 overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      
      <Button
        onClick={onOpenMap}
        className="absolute bottom-4 right-4 rounded-full shadow-lg"
        size="sm"
        style={{ backgroundColor: "#EF8759" }}
      >
        <Maximize2 className="h-4 w-4 mr-2" />
        Открыть карту
      </Button>
    </div>
  );
}