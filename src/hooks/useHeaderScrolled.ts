"use client";

import { useEffect, useState, useRef } from "react";

export function useHeaderScrolled(threshold: number = 80) {
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Hysteresis thresholds to prevent jitter
    const ENTER_THRESHOLD = threshold; // Enter compact at this scroll (default 80px)
    const EXIT_THRESHOLD = threshold * 0.5; // Exit compact below this (default 40px)

    const updateScrollState = () => {
      const scrollY = window.scrollY;
      
      // Only update state if crossing threshold boundaries
      if (!isScrolled && scrollY > ENTER_THRESHOLD) {
        // Entering compact state
        setIsScrolled(true);
      } else if (isScrolled && scrollY < EXIT_THRESHOLD) {
        // Exiting compact state
        setIsScrolled(false);
      }
      
      lastScrollY.current = scrollY;
      ticking.current = false;
    };

    const handleScroll = () => {
      // Use requestAnimationFrame to throttle updates
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollState);
        ticking.current = true;
      }
    };

    // Check initial scroll position
    updateScrollState();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold, isScrolled]);

  return isScrolled;
}