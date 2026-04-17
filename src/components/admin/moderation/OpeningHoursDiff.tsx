/**
 * OpeningHoursDiff component
 * Shows diff between old and new opening hours in moderation view
 */

"use client";

import React from "react";
import { Clock, Plus, Minus, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_SHORT_LABELS, ALL_DAYS, MODE_LABELS } from "@/components/openingHours/openingHours.types";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";

interface OpeningHoursDiffProps {
  oldOpeningHours: OpeningHoursWithRelations | null;
  newOpeningHours: OpeningHoursWithRelations | null;
  changeType: "added" | "removed" | "modified";
}

export function OpeningHoursDiff({
  oldOpeningHours,
  newOpeningHours,
  changeType,
}: OpeningHoursDiffProps) {
  const getChangeIcon = () => {
    switch (changeType) {
      case "added":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "removed":
        return <Minus className="w-4 h-4 text-red-600" />;
      case "modified":
        return <Edit className="w-4 h-4 text-blue-600" />;
    }
  };

  const getChangeColor = () => {
    switch (changeType) {
      case "added":
        return "border-green-200 bg-green-50";
      case "removed":
        return "border-red-200 bg-red-50";
      case "modified":
        return "border-blue-200 bg-blue-50";
    }
  };

  const getChangeLabel = () => {
    switch (changeType) {
      case "added":
        return "Режим работы добавлен";
      case "removed":
        return "Режим работы удален";
      case "modified":
        return "Режим работы изменен";
    }
  };

  const formatSchedule = (openingHours: OpeningHoursWithRelations | null) => {
    if (!openingHours) return null;

    switch (openingHours.mode) {
      case "ALWAYS_OPEN":
        return "Круглосуточно";
      case "BY_APPOINTMENT":
        return "По записи";
      case "TEMPORARILY_CLOSED":
        return openingHours.note || "Временно закрыто";
      case "WEEKLY":
        return null; // Will show detailed schedule below
    }
  };

  const renderWeeklySchedule = (openingHours: OpeningHoursWithRelations | null, isOld = false) => {
    if (!openingHours || openingHours.mode !== "WEEKLY") return null;

    return (
      <div className="space-y-1">
        {ALL_DAYS.map((dayOfWeek) => {
          const rule = openingHours.rules.find((r) => r.dayOfWeek === dayOfWeek);
          
          return (
            <div
              key={dayOfWeek}
              className={cn(
                "flex items-center justify-between py-1 px-2 rounded text-sm",
                isOld ? "bg-red-50" : "bg-green-50"
              )}
            >
              <span className="font-medium">{DAY_SHORT_LABELS[dayOfWeek]}</span>
              <span className="text-muted-foreground">
                {!rule || !rule.isOpen ? (
                  "Выходной"
                ) : rule.allDay ? (
                  "Круглосуточно"
                ) : (
                  <span className="space-x-1">
                    {rule.intervals.map((interval, idx: number) => (
                      <span key={idx}>
                        {interval.startTime}—{interval.endTime}
                        {idx < rule.intervals.length - 1 && ", "}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("border rounded-lg p-4", getChangeColor())}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-muted-foreground" />
        {getChangeIcon()}
        <span className="font-medium text-gray-900">{getChangeLabel()}</span>
      </div>

      {changeType === "added" && newOpeningHours && (
        <div>
          <div className="mb-2">
            <span className="text-sm font-medium text-green-700">
              Новый режим: {MODE_LABELS[newOpeningHours.mode as keyof typeof MODE_LABELS]}
            </span>
          </div>
          {newOpeningHours.note && (
            <div className="mb-2">
              <span className="text-sm text-gray-600">
                Примечание: {newOpeningHours.note}
              </span>
            </div>
          )}
          {formatSchedule(newOpeningHours) && (
            <div className="mb-2">
              <span className="text-sm text-gray-900">
                {formatSchedule(newOpeningHours)}
              </span>
            </div>
          )}
          {renderWeeklySchedule(newOpeningHours)}
        </div>
      )}

      {changeType === "removed" && oldOpeningHours && (
        <div>
          <div className="mb-2">
            <span className="text-sm font-medium text-red-700">
              Удаленный режим: {MODE_LABELS[oldOpeningHours.mode as keyof typeof MODE_LABELS]}
            </span>
          </div>
          {oldOpeningHours.note && (
            <div className="mb-2">
              <span className="text-sm text-gray-600">
                Примечание: {oldOpeningHours.note}
              </span>
            </div>
          )}
          {formatSchedule(oldOpeningHours) && (
            <div className="mb-2">
              <span className="text-sm text-gray-900">
                {formatSchedule(oldOpeningHours)}
              </span>
            </div>
          )}
          {renderWeeklySchedule(oldOpeningHours, true)}
        </div>
      )}

      {changeType === "modified" && oldOpeningHours && newOpeningHours && (
        <div className="space-y-4">
          {/* Old version */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Minus className="w-3 h-3 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                Было: {MODE_LABELS[oldOpeningHours.mode as keyof typeof MODE_LABELS]}
              </span>
            </div>
            {oldOpeningHours.note && (
              <div className="mb-2 ml-5">
                <span className="text-sm text-gray-600">
                  Примечание: {oldOpeningHours.note}
                </span>
              </div>
            )}
            {formatSchedule(oldOpeningHours) && (
              <div className="mb-2 ml-5">
                <span className="text-sm text-gray-900">
                  {formatSchedule(oldOpeningHours)}
                </span>
              </div>
            )}
            <div className="ml-5">
              {renderWeeklySchedule(oldOpeningHours, true)}
            </div>
          </div>

          {/* New version */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Plus className="w-3 h-3 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Стало: {MODE_LABELS[newOpeningHours.mode as keyof typeof MODE_LABELS]}
              </span>
            </div>
            {newOpeningHours.note && (
              <div className="mb-2 ml-5">
                <span className="text-sm text-gray-600">
                  Примечание: {newOpeningHours.note}
                </span>
              </div>
            )}
            {formatSchedule(newOpeningHours) && (
              <div className="mb-2 ml-5">
                <span className="text-sm text-gray-900">
                  {formatSchedule(newOpeningHours)}
                </span>
              </div>
            )}
            <div className="ml-5">
              {renderWeeklySchedule(newOpeningHours)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}