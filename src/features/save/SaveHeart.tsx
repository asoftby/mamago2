"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { SaveToPlanModal, SaveScenario, SaveToPlanResult } from "@/components/activity/SaveToPlanModal";

type SaveHeartProps = {
  activityId: string;
  activityTitle: string;
  coverImageUrl?: string | null;
  className?: string;
  onSaveChange?: (isSaved: boolean) => void;
};

export function SaveHeart({
  activityId,
  activityTitle,
  coverImageUrl,
  className,
  onSaveChange,
}: SaveHeartProps) {
  const [isIdea, setIsIdea] = useState(false);
  const [inPlan, setInPlan] = useState(false);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [planStartsAt, setPlanStartsAt] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isSaved = isIdea || inPlan;

  useEffect(() => {
    checkSaveStatus();
  }, [activityId]);

  const checkSaveStatus = async () => {
    try {
      const res = await fetch(`/api/save/status?activityId=${activityId}`);
      if (res.ok) {
        const data = await res.json();
        setIsIdea(data.isIdea ?? false);
        setInPlan(data.inPlan ?? false);
        setPlanDate(data.planDate ?? null);
        setPlanStartsAt(data.planStartsAt ?? null);
      }
    } catch (error) {
      console.error("Failed to check save status:", error);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleConfirm = async (result: SaveToPlanResult) => {
    if (result.action === "cancel") return;

    setIsLoading(true);
    try {
      if (result.action === "ideas") {
        const res = await fetch("/api/save/idea", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId }),
        });
        if (res.ok) {
          setIsIdea(true);
          triggerAnimation();
          onSaveChange?.(true);
        }
      } else if (result.action === "remove-idea") {
        const res = await fetch(`/api/save/idea?activityId=${activityId}`, { method: "DELETE" });
        if (res.ok) {
          setIsIdea(false);
          if (!inPlan) onSaveChange?.(false);
        }
      } else if (result.action === "plan") {
        const res = await fetch("/api/save/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId,
            date: result.dateISO,
            startsAt: result.timeSlotId ?? null,
            title: activityTitle,
            coverImageUrl: coverImageUrl ?? null,
          }),
        });
        if (res.ok) {
          setInPlan(true);
          setPlanDate(result.dateISO);
          triggerAnimation();
          onSaveChange?.(true);
        }
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const scenario: SaveScenario = { kind: "quickdate", title: activityTitle };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        aria-label={isSaved ? "Сохранено" : "Сохранить"}
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

      <SaveToPlanModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        scenario={scenario}
        onConfirm={handleConfirm}
        isIdea={isIdea}
        inPlan={inPlan}
        planDate={planDate}
        planStartsAt={planStartsAt}
      />
    </>
  );
}
