// Step 1: Offer Type (MVP)
// Choose offer kind with auto-suggestions

"use client";

import { OfferKindSelector } from "../components/OfferKindSelector";
import { applyAutoSuggestions, type OfferFormDataMVP } from "../types.mvp";

interface Step1TypeMVPProps {
  data: OfferFormDataMVP;
  onChange: (updates: Partial<OfferFormDataMVP>) => void;
  isEditable: boolean;
}

export function Step1TypeMVP({ data, onChange, isEditable }: Step1TypeMVPProps) {
  const handleKindChange = (kind: "course" | "birthday" | "service") => {
    // Apply auto-suggestions when kind changes
    const suggestions = applyAutoSuggestions(kind);
    
    onChange({
      offerKind: kind,
      ...suggestions,
    });
  };
  
  return (
    <div className="max-w-4xl mx-auto py-8">
      <OfferKindSelector
        value={data.offerKind}
        onChange={handleKindChange}
        disabled={!isEditable}
      />
    </div>
  );
}
