"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

// Keep SSR/hydration output empty, then show the portal as soon as React
// switches to the client snapshot. No effect-driven setState or rAF delay.
const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Portal({ children, container }: PortalProps) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) return null;
  return createPortal(children, container || document.body);
}
