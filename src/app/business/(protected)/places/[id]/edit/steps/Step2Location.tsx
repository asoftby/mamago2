"use client";

import type { Place } from "../types";
import { PlaceLocationPicker } from "@/components/business/place/PlaceLocationPicker";
import { PlaceGroupSelector } from "@/components/business/place/PlaceGroupSelector";
import { WizardStepHeader } from "../components/WizardStepHeader";
import { GoogleReviewsSync } from "@/components/place/GoogleReviewsSync";

interface Step2LocationProps {
  place: Place & { _districtName?: string | null; _metroName?: string | null };
  onUpdate: (updates: Partial<Place>) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  isEditable?: boolean;
}

export function Step2Location({ place, onUpdate, onPrev, onNext, canNext, isEditable = true }: Step2LocationProps) {
  const hasLocation = place.lat !== null && place.lng !== null;

  const initialLocation = hasLocation
    ? {
        lat: place.lat!,
        lng: place.lng!,
        formattedAddr: place.formattedAddr || undefined,
        cityId: place.cityId || undefined,
        districtAutoId: place.districtAutoId || undefined,
        districtManualId: place.districtManualId || undefined,
        metroAutoId: place.metroAutoId || undefined,
        metroAutoDistanceM: place.metroAutoDistanceM || undefined,
        metroManualId: place.metroManualId || undefined,
        metroManualDistanceM: place.metroManualDistanceM || undefined,
        // Pass enrichment names if available (from NewPlaceWizard)
        districtName: place._districtName || undefined,
        metroName: place._metroName || undefined,
      }
    : null;

  const handleGroupIdChange = (groupId: string | null) => {
    // Update place state with new groupId
    onUpdate({ placeGroupId: groupId });
  };

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Локация"
        subtitle="Укажите где находится ваше место"
        onBack={onPrev}
        onNext={onNext}
        canNext={canNext}
        currentStep={2}
        totalSteps={6}
      />

      <PlaceLocationPicker 
        placeId={place.id} 
        placeTitle={place.title}
        initialLocation={initialLocation}
        onUpdate={onUpdate}
        disabled={!isEditable}
      />

      <GoogleReviewsSync
        placeId={place.id}
        placeTitle={place.title}
        placeAddress={place.formattedAddr || place.customAddress}
        googlePlaceId={place.googlePlaceId}
        googleRating={place.googleRating}
        googleUserRatingsTotal={place.googleUserRatingsTotal}
        googleReviewsSyncedAt={place.googleReviewsSyncedAt}
        googleMapsUri={place.googleMapsUri}
        googleReviewsJson={place.googleReviewsJson}
        onChange={onUpdate}
      />

      {/* Place Group Selector - shown after location is set */}
      {hasLocation && (
        <PlaceGroupSelector
          currentPlaceId={place.id}
          ownerUserId={place.createdByUserId}
          currentGroupId={place.placeGroupId}
          onGroupIdChange={handleGroupIdChange}
          disabled={!isEditable}
        />
      )}
    </div>
  );
}
