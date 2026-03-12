"use client";

import { useEffect, useState, RefObject } from "react";

interface Position {
  top: number;
  left: number;
  width: number;
  containerLeft: number;
  containerWidth: number;
}

export function useDropdownPosition<T extends HTMLElement>(
  triggerRef: RefObject<T | null>,
  isOpen: boolean
): Position {
  const [position, setPosition] = useState<Position>({ 
    top: 0, 
    left: 0, 
    width: 0,
    containerLeft: 0,
    containerWidth: 0
  });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      
      // Find the main search container (the rounded form)
      const searchContainer = triggerRef.current.closest('[data-search-container]') || 
                             triggerRef.current.closest('.rounded-full');
      
      let containerRect = rect; // fallback to trigger rect
      if (searchContainer) {
        containerRect = searchContainer.getBoundingClientRect();
      }

      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        containerLeft: containerRect.left + window.scrollX,
        containerWidth: containerRect.width,
      });
    };

    updatePosition();

    // Update position on scroll and resize
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, triggerRef]);

  return position;
}