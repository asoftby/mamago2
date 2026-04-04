"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const isSaved = isIdea;

  useEffect(() => {
    checkSaveStatus();
  }, [activityId]);

  const checkSaveStatus = async () => {
    try {
      const res = await fetch(`/api/save/status?activityId=${activityId}`);
      if (res.ok) {
        const data = await res.json();
        setIsIdea(data.isIdea ?? false);
      }
    } catch (error) {
      console.error("Failed to check save status:", error);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    try {
      if (!isIdea) {
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
      } else {
        const res = await fetch(`/api/save/idea?activityId=${activityId}`, { method: "DELETE" });
        if (res.ok) {
          setIsIdea(false);
          onSaveChange?.(false);
        }
      }
    } catch (error) {
      console.error("Failed to toggle idea:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isSaved ? "Сохранено в идеи" : "Сохранить в идеи"}
      title={isSaved ? "Убрать из идей" : "Сохранить в идеи"}
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
  );
}
