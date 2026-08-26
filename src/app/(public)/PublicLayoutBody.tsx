"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileBottomBarShell } from "@/components/layout/MobileBottomBarShell";
import { BetaTipMobile } from "@/components/shared/BetaTip";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { cn } from "@/lib/utils";
import { useNavigationReloadDebug } from "@/hooks/useNavigationReloadDebug";
import { NotificationSurfaceBootstrap } from "@/features/notifications/NotificationSurfaceBootstrap";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

const MOBILE_MAIN_BOTTOM =
  "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0";

function isPublishedPublicSource(pathname: string): boolean {
  return !(
    pathname === "/preview" ||
    pathname.startsWith("/preview/") ||
    pathname === "/me" ||
    pathname.startsWith("/me/")
  );
}

function isContentEditDestination(url: URL): boolean {
  if (/^\/editor\/(event|offer|place)\/[^/]+\/edit\/?$/.test(url.pathname)) {
    return true;
  }

  if (/^\/admin\/content\/articles\/[^/]+\/edit\/?$/.test(url.pathname)) {
    return true;
  }

  return (
    url.pathname === "/admin/content/publications/new" &&
    url.searchParams.get("type") === "news" &&
    Boolean(url.searchParams.get("id"))
  );
}

/**
 * Обёртка (public): нижний бар только там, где не страница публикации;
 * иначе убираем отступ под бар и сам бар.
 */
export function PublicLayoutBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideBottomBar = shouldHideMobileBottomNav(pathname);
  useNavigationReloadDebug(process.env.NODE_ENV !== "production");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PUBLIC_LAYOUT_DEBUG === "true") {
      console.debug("[Home/PublicLayoutBody] mounted", { pathname });
    }
    return () => {
      if (process.env.NEXT_PUBLIC_PUBLIC_LAYOUT_DEBUG === "true") {
        console.debug("[Home/PublicLayoutBody] unmounted", { pathname });
      }
    };
  }, [pathname]);

  useEffect(() => {
    function handleContentEditNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (!isPublishedPublicSource(window.location.pathname)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (!isContentEditDestination(url)) return;
      if (url.searchParams.has("returnTo")) return;

      url.searchParams.set("returnTo", window.location.pathname);
      const nextHref = `${url.pathname}${url.search}${url.hash}`;

      // Keep modified-click / target=_blank semantics intact while still enriching the URL.
      anchor.href = nextHref;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Use a document navigation because editor/admin routes may switch surfaces/subdomains.
      event.preventDefault();
      window.location.assign(nextHref);
    }

    document.addEventListener("click", handleContentEditNavigation, true);
    return () => {
      document.removeEventListener("click", handleContentEditNavigation, true);
    };
  }, []);

  return (
    <>
      <PageViewTracker />
      <NotificationSurfaceBootstrap surface="public" />

      <main
        className={cn("flex-1", !hideBottomBar ? MOBILE_MAIN_BOTTOM : "lg:pb-0")}
      >
        {children}
      </main>

      <div className={cn(!hideBottomBar ? MOBILE_MAIN_BOTTOM : "pb-0 lg:pb-0")}>
        <PublicFooter withStickyCtaClearance={hideBottomBar} />
      </div>

      {!hideBottomBar ? (
        <>
          <BetaTipMobile />
          <MobileBottomBarShell>
            <Suspense
              fallback={<div className="h-[5.75rem] shrink-0" aria-hidden />}
            >
              <MobileBottomNav />
            </Suspense>
          </MobileBottomBarShell>
        </>
      ) : null}
    </>
  );
}
