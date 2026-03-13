"use client";

import { useEffect, useState } from "react";

export function useScrollDirection(threshold: number = 10) {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const difference = Math.abs(scrollY - lastScrollY);
      
      // Update isScrolled state
      setIsScrolled(scrollY > threshold);

      // Only update direction if we've scrolled enough to avoid jitter
      if (difference < threshold) {
        ticking = false;
        return;
      }

      if (scrollY > lastScrollY && scrollY > threshold) {
        // Scrolling down
        setScrollDirection("down");
      } else if (scrollY < lastScrollY) {
        // Scrolling up
        setScrollDirection("up");
      }

      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    // Set initial state
    setIsScrolled(window.scrollY > threshold);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return { scrollDirection, isScrolled };
}