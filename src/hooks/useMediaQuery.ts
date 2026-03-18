"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    const id = requestAnimationFrame(() => {
      if (media.matches !== matches) {
        setMatches(media.matches);
      }
    });

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => {
      cancelAnimationFrame(id);
      media.removeEventListener("change", listener);
    };
  }, [matches, query]);

  return matches;
}
