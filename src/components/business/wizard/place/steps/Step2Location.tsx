"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PlaceLocationPicker } from "@/components/business/place/PlaceLocationPicker";
import { GoogleReviewsSync } from "@/components/place/GoogleReviewsSync";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { PlaceFormData } from "../types";

interface Step2LocationProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step2Location({ data, onChange, isEditable = true }: Step2LocationProps) {
  const [googleDataOpen, setGoogleDataOpen] = useState(false);
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
      
      <Collapsible open={googleDataOpen} onOpenChange={setGoogleDataOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100"
          >
            Данные Google (необязательно)
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-gray-600 transition-transform",
                googleDataOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3">
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
