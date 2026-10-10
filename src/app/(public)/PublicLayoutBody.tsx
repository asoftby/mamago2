"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/shell/PublicFooter";
import { BetaTipMobile } from "@/components/shared/BetaTip";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { resolveMobileBottomSlot } from "@/lib/mobile/bottomSlot";
import { cn } from "@/lib/utils";
import { useNavigationReloadDebug } from "@/hooks/useNavigationReloadDebug";
import { NotificationSurfaceBootstrap } from "@/features/notifications/NotificationSurfaceBootstrap";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

/** Плашка «Мой план» (56px) + отступ от низа 12px + небольшой зазор + safe-area. */
const MOBILE_MAIN_BOTTOM =
  "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0";

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
  // Отступ под «Мой план» нужен только в слоте `plan` (на деталях внизу свой бар покупки).
  const hasMobilePlanWidget = resolveMobileBottomSlot(pathname) === "plan";
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

      <main className="flex-1">
        {children}
      </main>

      {/* Подложка под отступом — того же цвета, что футер, иначе под ним остаётся белая полоса. */}
      <div className={cn("bg-[#F6F2EA]", hasMobilePlanWidget ? MOBILE_MAIN_BOTTOM : "pb-0 lg:pb-0")}>
        <PublicFooter withStickyCtaClearance={hideBottomBar} />
      </div>

      {!hideBottomBar ? <BetaTipMobile /> : null}
    </>
  );
}
