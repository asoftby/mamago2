import { useState, useEffect } from "react";
import { useMediaQuery } from "react-responsive";

// Client-only hook to detect mobile breakpoint
// Note: Use a mounted guard to avoid hydration mismatch
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobileQuery = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
    });
    
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (mounted) {
      const id = requestAnimationFrame(() => {
        setIsMobile(isMobileQuery);
      });
      
      return () => cancelAnimationFrame(id);
    }
  }, [mounted, isMobileQuery]);

  // Always return false on server/initial render to match desktop HTML
  // Hydration will patch it to true if needed
  if (!mounted) return false;
  
  return isMobile;
}
