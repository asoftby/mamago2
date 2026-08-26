"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  // Mount on the effect phase, not on the next animation frame: rAF is
  // throttled/never fires while the tab is hidden or unfocused, which left
  // this permanently un-mounted (and any scroll-lock tied to the opening
  // component's own state stuck on) whenever that happened right as a
  // portal-based sheet/modal opened.
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, container || document.body);
}