"use client";

import type { Place } from "@prisma/client";
import { PlaceLocationPicker } from "@/components/business/place/PlaceLocationPicker";
import { WizardStepHeader } from "../components/WizardStepHeader";

interface Step2LocationProps {
  place: Place;
  onUpdate: (updates: Partial<Place>) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}

export function Step2Location({ place, onUpdate, onPrev, onNext, canNext }: Step2LocationProps) {
  const hasLocation = place.lat !== null && place.lng !== null;

  const initialLocation = hasLocation
    ? {
        lat: place.lat,
        lng: place.lng,
        formattedAddr: place.formattedAddr || undefined,
        cityId: place.cityId || undefined,
        districtAutoId: place.districtAutoId || undefined,
        districtManualId: place.districtManualId || undefined,
        metroAutoId: place.metroAutoId || undefined,
        metroAutoDistanceM: place.metroAutoDistanceM || undefined,
        metroManualId: place.metroManualId || undefined,
        metroManualDistanceM: place.metroManualDistanceM || undefined,
      }
    : null;

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Локация"
        subtitle="Укажите где находится ваше место"
        onBack={onPrev}
        onNext={onNext}
        canNext={canNext}
      />

      <PlaceLocationPicker 
        placeId={place.id} 
        initialLocation={initialLocation}
        onUpdate={onUpdate}
      />
    </div>
  );
}
