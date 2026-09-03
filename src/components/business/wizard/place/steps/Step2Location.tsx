"use client";

import { ChevronDown } from "lucide-react";
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
      
      {/*
        Native <details> instead of the shared Collapsible: that primitive
        unmounts its children while closed, which would stop
        GoogleReviewsSync's own mount-time effects (its background
        preview/sync lifecycle) from running until the user opens this
        block. <details> only toggles visibility — GoogleReviewsSync stays
        mounted and its existing behavior is unaffected.
      */}
      <details className="group rounded-lg border border-gray-200 bg-gray-50">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100 marker:hidden [&::-webkit-details-marker]:hidden">
          Данные Google (необязательно)
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-600 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 pt-3">
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
      </details>
    </div>
  );
}
