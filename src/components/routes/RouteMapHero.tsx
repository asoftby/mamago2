"use client";

/**
 * RouteMapHero
 * Renders a Google Map with a polyline connecting all stops and numbered markers.
 * Geocodes stops that lack lat/lng. Falls back to cover image if Maps fails.
 */

import { useEffect, useRef, useState } from "react";
import { GoogleMapsService } from "@/services/googleMaps";

type Stop = {
  order: number;
  lat?: number;
  lng?: number;
  address: string;
  title?: string;
};

interface RouteMapHeroProps {
  stops: Stop[];
  fallbackImageUrl?: string;
  className?: string;
}

export function RouteMapHero({ stops, fallbackImageUrl, className }: RouteMapHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initMap();
  }, []);

  async function resolveCoords(
    stop: Stop,
    geocoder: google.maps.Geocoder
  ): Promise<{ lat: number; lng: number } | null> {
    if (stop.lat != null && stop.lng != null) return { lat: stop.lat, lng: stop.lng };
    const query = stop.address || stop.title;
    if (!query) return null;
    try {
      const result = await geocoder.geocode({ address: query, region: "BY" });
      const loc = result.results[0]?.geometry?.location;
      if (!loc) return null;
      return { lat: loc.lat(), lng: loc.lng() };
    } catch {
      return null;
    }
  }

  async function initMap() {
    if (!containerRef.current) return;
    try {
      const [mapsLib, markerLib, geocodingLib] = await Promise.all([
        GoogleMapsService.getMapsLibrary(),
        GoogleMapsService.getMarkerLibrary(),
        GoogleMapsService.getGeocodingLibrary(),
      ]);

      const geocoder = new geocodingLib.Geocoder();

      // Resolve coordinates for all stops (parallel)
      const coordResults = await Promise.all(
        stops.map((s) => resolveCoords(s, geocoder))
      );

      const resolved = stops
        .map((s, i) => ({ stop: s, coords: coordResults[i] }))
        .filter((x) => x.coords !== null) as { stop: Stop; coords: { lat: number; lng: number } }[];

      if (resolved.length === 0) {
        setFailed(true);
        return;
      }

      const map = new mapsLib.Map(containerRef.current, {
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "route_detail_hero",
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        zoomControl: false,
      });

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      resolved.forEach(({ coords }) => bounds.extend(coords));
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });

      // Polyline
      new mapsLib.Polyline({
        path: resolved.map(({ coords }) => coords),
        map,
        strokeColor: "#1a1a1a",
        strokeOpacity: 0.75,
        strokeWeight: 3,
        geodesic: true,
      });

      // Numbered markers
      resolved.forEach(({ stop, coords }, i) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width:28px;height:28px;border-radius:50%;
          background:#1a1a1a;color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:700;font-family:sans-serif;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          border:2px solid #fff;
        `;
        el.textContent = String(i + 1);

        new markerLib.AdvancedMarkerElement({
          map,
          position: coords,
          content: el,
          title: stop.title ?? stop.address,
        });
      });
    } catch {
      setFailed(true);
    }
  }

  if (failed) {
    if (!fallbackImageUrl) return null;
    return (
      <div className={className}>
        <img src={fallbackImageUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
