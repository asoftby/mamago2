"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import { normalizeTargetPathForSurface } from "@/lib/routing/surface";
import type { ResolvedContentSuccessState } from "@/lib/content-success/types";

type ContentSuccessModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ResolvedContentSuccessState | null;
};

/**
 * `editHref` совпадает с текущим адресом редактора почти всегда (мы уже на
 * этой странице после save). Реальная навигация по <Link> в этом случае —
 * лишний anchor-click, который перехватывается capture-listener'ом
 * useUnsavedChangesNavigationGuard (см. use-unsaved-changes-navigation-guard.ts)
 * и открывает leave-confirmation поверх ещё не закрытой success modal.
 * Когда href действительно совпадает с текущей страницей — просто закрываем
 * модалку без навигации; иначе (например, если вызывающий код не успел сам
 * переключить URL) навигация по-прежнему выполняется.
 *
 * Ссылки редактора статьи зашиты с префиксом `/admin/...` (resolver.ts), а
 * на host-routed поддомене `admin.*` реальный адрес браузера этот префикс
 * уже не несёт (см. ADMIN_PATH_PREFIX / stripSurfacePrefix в
 * lib/routing/surface.ts) — поэтому сравнивать пути нужно после
 * normalizeTargetPathForSurface("admin", …) с обеих сторон, иначе живой
 * поддомен всегда считает страницы разными и модалка снова навигирует по
 * живой <Link>, которую перехватывает guard.
 */
function isCurrentLocation(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const target = new URL(href, window.location.origin);
    const targetPath = normalizeTargetPathForSurface(
      "admin",
      `${target.pathname}${target.search}`,
    );
    const currentPath = normalizeTargetPathForSurface(
      "admin",
      `${window.location.pathname}${window.location.search}`,
    );
    return targetPath === currentPath;
  } catch {
    return false;
  }
}

export function ContentSuccessModal({
  open,
  onOpenChange,
  state,
}: ContentSuccessModalProps) {
  const hydrated = useHydrated();

  if (!state) {
    return null;
  }

  // Open actions deliberately preserve the resolver-provided destination:
  // published content points at the canonical public origin, while preview
  // actions are relative and therefore stay on the current admin/business host.
  // Only editor/list navigation is rebased to the current surface.
  const openHref = state.openAction?.href;
  const editHref =
    hydrated && state.continueEditingAction
      ? sameOriginUrl(state.continueEditingAction.href)
      : state.continueEditingAction?.href;
  const listHref =
    hydrated && state.listAction ? sameOriginUrl(state.listAction.href) : state.listAction?.href;
  const continueEditingIsCurrentPage = Boolean(hydrated && editHref && isCurrentLocation(editHref));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md" showCloseButton>
        <DialogHeader className="items-center gap-4 text-center sm:items-center sm:text-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20"
            aria-hidden
          >
            <PartyPopper className="h-8 w-8 text-primary" strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-balance text-xl font-semibold">
              {state.title}
            </DialogTitle>
            <DialogDescription className="text-pretty text-[15px] leading-relaxed">
              {state.description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {state.openAction && openHref ? (
            <PrimaryButton className="w-full" asChild>
              <a
                href={openHref}
                target={state.openAction.target}
                rel={state.openAction.target === "_blank" ? "noopener noreferrer" : undefined}
                onClick={() => onOpenChange(false)}
              >
                {state.openAction.label}
              </a>
            </PrimaryButton>
          ) : null}
          {state.continueEditingAction && editHref ? (
            continueEditingIsCurrentPage ? (
              <Button
                type="button"
                variant="secondary"
                className="h-auto w-full rounded-[16px] py-[14px] font-semibold"
                onClick={() => onOpenChange(false)}
              >
                {state.continueEditingAction.label}
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="h-auto w-full rounded-[16px] py-[14px] font-semibold"
                asChild
              >
                <Link href={editHref} onClick={() => onOpenChange(false)}>
                  {state.continueEditingAction.label}
                </Link>
              </Button>
            )
          ) : null}
          {state.listAction && listHref ? (
            <Button
              variant="outline"
              className="h-auto w-full rounded-[16px] py-[14px] font-semibold"
              asChild
            >
              <Link href={listHref} onClick={() => onOpenChange(false)}>
                {state.listAction.label}
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
