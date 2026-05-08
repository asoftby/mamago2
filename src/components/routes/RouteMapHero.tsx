"use client";

/**
 * RouteMapHero
 * Renders a Google Map with directions connecting all stops and numbered markers.
 * Geocodes stops that lack lat/lng. Falls back to cover image if Maps fails.
 * Supports travelMode: "walk" | "car" — re-renders directions on change.
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
  travelMode?: "walk" | "car";
}

type ResolvedStop = { stop: Stop; coords: { lat: number; lng: number } };

async function resolveCoords(
  stop: Stop,
  geocoder: google.maps.Geocoder,
): Promise<{ lat: number; lng: number } | null> {
  if (stop.lat != null && stop.lng != null)
    return { lat: stop.lat, lng: stop.lng };
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

export function RouteMapHero({
  stops,
  fallbackImageUrl,
  className,
  travelMode = "walk",
}: RouteMapHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const resolvedRef = useRef<ResolvedStop[]>([]);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const fallbackPolylineRef = useRef<google.maps.Polyline | null>(null);
  const initialized = useRef(false);

  const renderDirections = async (mode: "walk" | "car") => {
    const map = mapRef.current;
    const resolved = resolvedRef.current;
    if (!map || resolved.length < 2) return;

    // Clear previous renderer
    if (rendererRef.current) {
      rendererRef.current.setMap(null);
      rendererRef.current = null;
    }
    if (fallbackPolylineRef.current) {
      fallbackPolylineRef.current.setMap(null);
      fallbackPolylineRef.current = null;
    }

    const strokeColor = mode === "walk" ? "#EF8759" : "#3B82F6";

    try {
      const directionsService = new google.maps.DirectionsService();

      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor,
          strokeWeight: 4,
          strokeOpacity: 0.85,
        },
      });
      rendererRef.current = renderer;

      const origin = resolved[0]!.coords;
      const destination = resolved[resolved.length - 1]!.coords;
      const waypoints = resolved.slice(1, -1).map(({ coords }) => ({
        location: new google.maps.LatLng(coords.lat, coords.lng),
        stopover: true,
      }));

      const googleMode =
        mode === "walk"
          ? google.maps.TravelMode.WALKING
          : google.maps.TravelMode.DRIVING;

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: googleMode,
        optimizeWaypoints: false,
      });

      renderer.setDirections(result);
    } catch {
      // Fallback: plain polyline
      const polyline = new google.maps.Polyline({
        path: resolved.map(({ coords }) => coords),
        map,
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        geodesic: true,
      });
      fallbackPolylineRef.current = polyline;
    }
  };

  const initMap = async (): Promise<boolean> => {
    if (!containerRef.current) return false;
    try {
      const [mapsLib, markerLib, geocodingLib] = await Promise.all([
        GoogleMapsService.getMapsLibrary(),
        GoogleMapsService.getMarkerLibrary(),
        GoogleMapsService.getGeocodingLibrary(),
      ]);

      const geocoder = new geocodingLib.Geocoder();

      const coordResults = await Promise.all(
        stops.map((s) => resolveCoords(s, geocoder)),
      );

      const resolved = stops
        .map((s, i) => ({ stop: s, coords: coordResults[i] }))
        .filter((x) => x.coords !== null) as ResolvedStop[];

      if (resolved.length === 0) return false;

      resolvedRef.current = resolved;

      const map = new mapsLib.Map(containerRef.current, {
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "route_detail_hero",
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        zoomControl: false,
      });

      mapRef.current = map;

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      resolved.forEach(({ coords }) => bounds.extend(coords));
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });

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

      // Initial directions
      await renderDirections(travelMode);

      return true;
    } catch {
      return false;
    }
  };

  // Init map once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void initMap().then((success) => {
      if (!success) setFailed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render directions on travelMode change
  useEffect(() => {
    if (!mapRef.current) return;
    void renderDirections(travelMode);
     
  }, [travelMode]);

  if (failed) {
    if (!fallbackImageUrl) return null;
    return (
      <div className={className}>
        <img
          src={fallbackImageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
