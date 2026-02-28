"use client";

import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import React, { useState } from "react";

interface FavoriteButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  initialLiked?: boolean;
}

export function FavoriteButton({ 
  initialLiked = false, 
  className, 
  ...props 
}: FavoriteButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked(!liked);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    props.onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
        liked ? "text-primary" : "text-muted-foreground hover:text-primary",
        className
      )}
      {...props}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-all duration-300",
          liked && "fill-current",
          isAnimating && "scale-125"
        )}
      />
    </button>
  );
}
