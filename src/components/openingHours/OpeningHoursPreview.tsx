"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DAY_SHORT_LABELS, ALL_DAYS } from "./openingHours.types";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import type { OpeningStatus } from "@/server/services/openingHours/openingHours.types";

interface OpeningHoursPreviewProps {
  openingHours: OpeningHoursWithRelations;
  status: OpeningStatus;
  className?: string;
}

/**
 * OpeningHoursPreview component
 * Displays opening hours status with expandable weekly schedule
 */
export function OpeningHoursPreview({
  openingHours,
  status,
  className,
}: OpeningHoursPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = () => {
    switch (status.status) {
      case "open":
        return "text-green-600";
      case "closed":
        return "text-red-600";
      case "always_open":
        return "text-blue-600";
      case "by_appointment":
        return "text-orange-600";
      case "temporarily_closed":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = () => {
    if (status.isOpen) {
      return "🟢";
    }
    return "⚫";
  };

  // Don't show expand button for non-weekly modes
  const canExpand = openingHours.mode === "WEEKLY";

  return (
    <div className={cn("border rounded-lg", className)}>
      {/* Status header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStatusIcon()}</span>
                <span className={cn("font-medium", getStatusColor())}>
                  {status.message}
                </span>
              </div>
            </div>
          </div>

          {canExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  Скрыть <ChevronUp className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  Показать график <ChevronDown className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded weekly schedule */}
      {expanded && canExpand && (
        <div className="border-t">
          <div className="p-4 space-y-2">
            {ALL_DAYS.map((dayOfWeek) => {
              const rule = openingHours.rules.find((r: { dayOfWeek: string }) => r.dayOfWeek === dayOfWeek);
              
              // Determine if this is today
              const now = new Date();
              const todayDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
              const dayMap: Record<number, string> = {
                1: "MON",
                2: "TUE",
                3: "WED",
                4: "THU",
                5: "FRI",
                6: "SAT",
                0: "SUN",
              };
              const isToday = dayMap[todayDay] === dayOfWeek;

              return (
                <div
                  key={dayOfWeek}
                  className={cn(
                    "flex items-center justify-between py-2 px-3 rounded",
                    isToday && "bg-muted font-medium"
                  )}
                >
                  <span className="text-sm">{DAY_SHORT_LABELS[dayOfWeek]}</span>
                  <span className="text-sm text-muted-foreground">
                    {!rule || !rule.isOpen ? (
                      "Выходной"
                    ) : rule.allDay ? (
                      "Круглосуточно"
                    ) : (
                      <span className="space-x-2">
                        {rule.intervals.map((interval: { startTime: string; endTime: string }, idx: number) => (
                          <span key={idx}>
                            {interval.startTime} — {interval.endTime}
                            {idx < rule.intervals.length - 1 && ","}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
