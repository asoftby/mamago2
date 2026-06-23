"use client";

import { useEffect, useState } from "react";
import { getPlaceCompletion } from "./completion";
import type { PlaceFormData } from "./types";

interface CompletionProgressProps {
  data: PlaceFormData;
  className?: string;
}

function getProgressTextClass(progress: number): string {
  if (progress <= 40) return "text-muted-foreground";
  if (progress <= 75) return "text-amber-600";
  return "text-green-600";
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
        <span className="text-sm text-muted-foreground">
          Заполнено на 0%
        </span>
      </div>
    );
  }

  return (
    <div className={`text-right ${className}`}>
      <span className={`text-sm ${getProgressTextClass(percent)}`}>
        Заполнено на {percent}%
      </span>
    </div>
  );
}
