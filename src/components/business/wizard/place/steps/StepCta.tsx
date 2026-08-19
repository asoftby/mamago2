"use client";

import { useMemo } from "react";
import { CtaStep } from "@/components/business/wizard/shared/CtaStep";
import {
  mapCtaStepValueToPlaceFormPatch,
  mapPlaceFormDataToCtaStepValue,
} from "../ctaStepMapper";
import type { PlaceFormData } from "../types";

interface StepCtaProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable: boolean;
}

export function StepCta({
  data,
  onChange,
  isEditable,
}: StepCtaProps) {
  const sourceEntityId = data.id ?? "place-wizard-draft";
  const ctaStepValue = useMemo(
    () => mapPlaceFormDataToCtaStepValue(data, { id: sourceEntityId }),
    [data, sourceEntityId],
  );

  return (
    <CtaStep
      value={ctaStepValue}
      source={{
        sourceEntityType: "PLACE",
        sourceEntityId,
      }}
      disabled={!isEditable}
      onChange={(nextValue) =>
        onChange(mapCtaStepValueToPlaceFormPatch(nextValue, { id: sourceEntityId }))
      }
    />
  );
}
