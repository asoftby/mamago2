"use client";

import { PlaceLocationPicker } from "@/components/business/place/PlaceLocationPicker";
import { GoogleReviewsSync } from "@/components/place/GoogleReviewsSync";
import type { PlaceFormData } from "../types";

interface Step2LocationProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step2Location({ data, onChange, isEditable = true }: Step2LocationProps) {
  const hasLocation = data.lat !== null && data.lng !== null;

  const initialLocation = hasLocation
    ? {
        lat: data.lat!,
        lng: data.lng!,
        formattedAddr: data.formattedAddr || undefined,
        cityId: data.cityId || undefined,
        districtAutoId: data.districtAutoId || undefined,
        districtManualId: data.districtManualId || undefined,
        metroAutoId: data.metroAutoId || undefined,
        metroAutoDistanceM: data.metroAutoDistanceM || undefined,
        metroManualId: data.metroManualId || undefined,
        metroManualDistanceM: data.metroManualDistanceM || undefined,
        districtName: data.displayDistrictName || undefined,
        metroName: data.displayMetroName || undefined,
      }
    : null;

  return (
    <div className="space-y-6">
      <PlaceLocationPicker 
        placeId={data.id || ""} 
        placeTitle={data.title}
        initialLocation={initialLocation}
        onUpdate={onChange}
        disabled={!isEditable}
      />
      
      <GoogleReviewsSync
        placeId={data.id || null}
        placeTitle={data.title}
        placeAddress={data.formattedAddr || data.customAddress}
        googlePlaceId={data.googlePlaceId}
        googleRating={data.googleRating}
        googleUserRatingsTotal={data.googleUserRatingsTotal}
        googleReviewsSyncedAt={data.googleReviewsSyncedAt}
        googleMapsUri={data.googleMapsUri}
        googleReviewsJson={data.googleReviewsJson}
        onChange={onChange}
      />
    </div>
  );
}
