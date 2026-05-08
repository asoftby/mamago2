"use client";

import { useEffect, useState } from "react";
import { getPlaceCompletion } from "./completion";
import type { PlaceFormData } from "./types";

interface CompletionProgressProps {
  data: PlaceFormData;
  className?: string;
}

export function CompletionProgress({ data, className = "" }: CompletionProgressProps) {
  const [mounted, setMounted] = useState(false);
  const completion = getPlaceCompletion(data);

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const percent = mounted ? completion.percent : 0;

  // Avoid hydration mismatch by not rendering until client-side calculation is done
  if (!mounted) {
    return (
      <div className={`text-right ${className}`}>
        <span className="text-sm text-gray-400">
          Заполнено на 0%
        </span>
      </div>
    );
  }

  return (
    <div className={`text-right ${className}`}>
      <span className="text-sm text-gray-400">
        Заполнено на {percent}%
      </span>
    </div>
  );
}
