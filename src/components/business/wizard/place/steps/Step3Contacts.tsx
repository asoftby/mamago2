"use client";

import type { PlaceFormData } from "../types";
import { PlaceInstagramField, PlacePhoneWebsiteFields } from "./placeContactFields";

interface Step3ContactsProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step3Contacts({ data, onChange, isEditable = true }: Step3ContactsProps) {
  return (
    <div className="space-y-6">
      <PlacePhoneWebsiteFields data={data} onChange={onChange} isEditable={isEditable} />
      <PlaceInstagramField data={data} onChange={onChange} isEditable={isEditable} />
    </div>
  );
}
