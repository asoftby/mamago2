"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { NotificationStoreAuthSync } from "@/features/notifications/NotificationStoreAuthSync";
import type { NotificationUnreadBootstrapStream } from "@/features/notifications/store/notification-surface";

type NotificationSurfaceBootstrapProps = {
  surface: "public" | "business" | "admin";
};

function useDesktopVisibility(): { ready: boolean; isDesktop: boolean } {
  const [state, setState] = useState({ ready: false, isDesktop: false });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setState({ ready: true, isDesktop: media.matches });
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return state;
}

export function NotificationSurfaceBootstrap({
  surface,
}: NotificationSurfaceBootstrapProps) {
  const pathname = usePathname();
  const { mode, hydrated } = useAccountMode();
  const { ready: viewportReady, isDesktop } = useDesktopVisibility();

  let unreadStream: NotificationUnreadBootstrapStream = "none";

  if (surface === "admin") {
    unreadStream = "user";
  } else if (surface === "business") {
    unreadStream = !hydrated ? "business" : mode === "personal" ? "user" : "business";
  } else if (viewportReady) {
    if (isDesktop) {
      unreadStream = hydrated && mode === "business" ? "business" : "user";
    } else if (!shouldHideMobileBottomNav(pathname)) {
      unreadStream = "user";
    }
  }

  if (unreadStream === "none") {
    return null;
  }

  return <NotificationStoreAuthSync unreadStream={unreadStream} />;
}
