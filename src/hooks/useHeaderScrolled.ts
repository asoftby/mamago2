"use client";

import { useEffect, useState, useRef } from "react";

export function useHeaderScrolled(threshold: number = 80) {
  const [isScrolled, setIsScrolled] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const ENTER_THRESHOLD = threshold;
    const EXIT_THRESHOLD = threshold * 0.5;

    const updateScrollState = () => {
      const scrollY = window.scrollY;
      setIsScrolled((prev) => {
        if (!prev && scrollY > ENTER_THRESHOLD) return true;
        if (prev && scrollY < EXIT_THRESHOLD) return false;
        return prev;
      });
      ticking.current = false;
    };

    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(updateScrollState);
      }
    };

    updateScrollState();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
}