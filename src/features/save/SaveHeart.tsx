"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { ScheduleModal } from "./ScheduleModal";

type Session = {
  date: string; // YYYY-MM-DD
  startsAt?: string; // ISO string
};

type SaveHeartProps = {
  activityId: string;
  activityTitle: string;
  sessions?: Session[];
  className?: string;
  onSaveChange?: (isSaved: boolean) => void;
};

export function SaveHeart({
  activityId,
  activityTitle,
  sessions = [],
  className,
  onSaveChange,
}: SaveHeartProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check save status on mount
  useEffect(() => {
    checkSaveStatus();
  }, [activityId]);

  const checkSaveStatus = async () => {
    try {
      const res = await fetch(`/api/save/status?activityId=${activityId}`);
      if (res.ok) {
        const data = await res.json();
        setIsSaved(data.isSaved);
      }
    } catch (error) {
      console.error("Failed to check save status:", error);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSaved) {
      // Already saved - do nothing for now (could show unsave option)
      return;
    }
    
    // Open modal to choose save method
    setIsModalOpen(true);
  };

  const handleSaveIdea = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/save/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });

      if (res.ok) {
        setIsSaved(true);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
        onSaveChange?.(true);
      }
    } catch (error) {
      console.error("Failed to save idea:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async (date: string, startsAt?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, date, startsAt }),
      });

      if (res.ok) {
        setIsSaved(true);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
        onSaveChange?.(true);
      }
    } catch (error) {
      console.error("Failed to schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "group flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
          isSaved ? "text-primary" : "text-muted-foreground hover:text-primary",
          isLoading && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all duration-300",
            isSaved && "fill-current",
            isAnimating && "scale-125"
          )}
        />
      </button>

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activityId={activityId}
        activityTitle={activityTitle}
        sessions={sessions}
        onSaveIdea={handleSaveIdea}
        onSchedule={handleSchedule}
      />
    </>
  );
}
