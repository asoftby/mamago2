"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IconClose } from "@/components/ui/icons";

type Session = {
  date: string; // YYYY-MM-DD
  startsAt?: string; // ISO string
};

type ScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
  activityTitle: string;
  sessions: Session[];
  onSaveIdea: () => Promise<void>;
  onSchedule: (date: string, startsAt?: string) => Promise<void>;
};

export function ScheduleModal({
  isOpen,
  onClose,
  activityId,
  activityTitle,
  sessions,
  onSaveIdea,
  onSchedule,
}: ScheduleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState("");

  if (!isOpen) return null;

  const handleSaveIdea = async () => {
    setIsLoading(true);
    try {
      await onSaveIdea();
      onClose();
    } catch (error) {
      console.error("Failed to save idea:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async (date: string, startsAt?: string) => {
    setIsLoading(true);
    try {
      await onSchedule(date, startsAt);
      onClose();
    } catch (error) {
      console.error("Failed to schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomDateSubmit = () => {
    if (customDate) {
      handleSchedule(customDate);
    }
  };

  // Sort sessions by date ascending
  const sortedSessions = [...sessions].sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      weekday: "long",
    });
  };

  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-foreground">
                {activityTitle}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <IconClose className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* No sessions */}
            {sessions.length === 0 && !showDatePicker && (
              <>
                <PrimaryButton
                  onClick={handleSaveIdea}
                  disabled={isLoading}
                  className="w-full"
                >
                  Сохранить в идеи
                </PrimaryButton>
                <Button
                  variant="outline"
                  onClick={() => setShowDatePicker(true)}
                  disabled={isLoading}
                  className="w-full"
                >
                  Запланировать
                </Button>
              </>
            )}

            {/* One session */}
            {sessions.length === 1 && !showDatePicker && (
              <>
                <PrimaryButton
                  onClick={() => handleSchedule(sortedSessions[0].date, sortedSessions[0].startsAt)}
                  disabled={isLoading}
                  className="w-full"
                >
                  Запланировать на {formatDate(sortedSessions[0].date)}
                </PrimaryButton>
                <Button
                  variant="outline"
                  onClick={() => setShowDatePicker(true)}
                  disabled={isLoading}
                  className="w-full"
                >
                  Выбрать другую дату
                </Button>
                <button
                  onClick={handleSaveIdea}
                  disabled={isLoading}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  Сохранить в идеи
                </button>
              </>
            )}

            {/* Multiple sessions */}
            {sessions.length > 1 && !showDatePicker && (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Выберите дату:
                  </p>
                  {sortedSessions.map((session, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleSchedule(session.date, session.startsAt)}
                      disabled={isLoading}
                      className="w-full justify-start text-left"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium capitalize">
                          {formatDate(session.date)}
                        </span>
                        {session.startsAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(session.startsAt)}
                          </span>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
                <button
                  onClick={handleSaveIdea}
                  disabled={isLoading}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  Сохранить в идеи
                </button>
              </>
            )}

            {/* Custom date picker */}
            {showDatePicker && (
              <>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Выберите дату
                  </label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <PrimaryButton
                  onClick={handleCustomDateSubmit}
                  disabled={isLoading || !customDate}
                  className="w-full"
                >
                  Запланировать
                </PrimaryButton>
                <Button
                  variant="outline"
                  onClick={() => setShowDatePicker(false)}
                  disabled={isLoading}
                  className="w-full"
                >
                  Назад
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
