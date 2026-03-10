"use client";

import { getPlaceCompletion } from "./completion";
import type { PlaceFormData } from "./types";

interface CompletionProgressProps {
  data: PlaceFormData;
  className?: string;
}

export function CompletionProgress({ data, className = "" }: CompletionProgressProps) {
  const completion = getPlaceCompletion(data);
  
  return (
    <div className={`text-right ${className}`}>
      <span className="text-sm text-gray-400">
        Заполнено на {completion.percent}%
      </span>
    </div>
  );
}
