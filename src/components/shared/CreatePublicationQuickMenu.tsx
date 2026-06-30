"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Plus,
  MapPin,
  Calendar,
  Tag,
  Newspaper,
  FileText,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  buildAdminPath,
  buildBusinessPath,
  normalizeTargetPathForSurface,
  resolveSurfaceFromHostAndPathname,
} from "@/lib/routing/surface";

type PublicationMode = "full" | "business";

type Item =
  | {
      id: string;
      label: string;
      description?: string;
      Icon: LucideIcon;
      kind: "link";
      href: string;
    }
  | {
      id: string;
      label: string;
      description?: string;
      Icon: LucideIcon;
      kind: "admin";
      publicationType: "news" | "article" | "collection";
    };

const ITEMS: Item[] = [
  {
    id: "event",
    kind: "link",
    href: "/editor/event/new",
    label: "Событие",
    description: "Афиша и расписание",
    Icon: Calendar,
  },
  {
    id: "offer",
    kind: "link",
    href: "/editor/offer/new",
    label: "Предложение",
    description: "Услуга или товар",
    Icon: Tag,
  },
  {
    id: "place",
    kind: "link",
    href: "/editor/place/new",
    label: "Место",
    description: "Объект для посещения",
    Icon: MapPin,
  },
  {
    id: "news",
    kind: "admin",
    publicationType: "news",
    label: "Breaking news",
    description: "Короткий формат",
    Icon: Newspaper,
  },
  {
    id: "article",
    kind: "admin",
    publicationType: "article",
    label: "Статья или обзор",
    description: "Полноценная статья",
    Icon: FileText,
  },
  {
    id: "collection",
    kind: "admin",
    publicationType: "collection",
    label: "Подборка",
    description: "Тематическая подборка с лентой",
    Icon: Layers,
  },
];

/**
 * Кнопка «+» и модалка выбора.
 * `full` — все пункты; `business` — только событие, предложение и место.
 * `trigger` — кастомный триггер вместо стандартной кнопки «+».
 */
export function CreatePublicationQuickMenu({
  publicationMode = "full",
  trigger: customTrigger,
}: {
  publicationMode?: PublicationMode;
  trigger?: (onClick: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const currentSurfaceReturnTo = useMemo(() => {
    if (!hydrated) {
      return null;
    }

    const host = window.location.host;
    const surface = resolveSurfaceFromHostAndPathname(host, pathname);
    const search = searchParams?.toString();
    const visiblePath = `${pathname}${search ? `?${search}` : ""}`;

    if (surface === "admin") {
      return buildAdminPath(normalizeTargetPathForSurface("admin", visiblePath));
    }

    if (surface === "business") {
      return buildBusinessPath(normalizeTargetPathForSurface("business", visiblePath));
    }

    return null;
  }, [hydrated, pathname, searchParams]);

  const visibleItems =
    publicationMode === "full"
      ? ITEMS
      : ITEMS.filter((i) => i.kind === "link");

  const goAdminPublication = (type: "news" | "article" | "collection") => {
    setOpen(false);
    if (type === "article") {
      router.push("/admin/content/articles/new");
    } else {
      router.push(`/admin/content/publications/new?type=${type}`);
    }
  };

  const renderItems = () => (
    <div className="grid gap-2 pt-2 px-4 pb-4">
      {visibleItems.map((item) => {
        const { Icon } = item;
        const rowClass =
          "flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 hover:border-gray-300";

        if (item.kind === "link") {
          const href = (() => {
            if (!currentSurfaceReturnTo) {
              return item.href;
            }

            const params = new URLSearchParams();
            params.set("returnTo", currentSurfaceReturnTo);
            return `${item.href}?${params.toString()}`;
          })();

          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => setOpen(false)}
              className={rowClass}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-gray-900">
                  {item.label}
                </span>
                {item.description ? (
                  <span className="block text-[12px] text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => goAdminPublication(item.publicationType)}
            className={cn(rowClass, "w-full")}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-[14px] font-semibold text-gray-900">
                {item.label}
              </span>
              {item.description ? (
                <span className="block text-[12px] text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {customTrigger ? (
        customTrigger(() => setOpen(true))
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(HEADER_CHROME_ICON_BUTTON_CLASS)}
          onClick={() => setOpen(true)}
          aria-label="Создать публикацию"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      {isMobile ? (
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Что создаём?"
          showCloseButton={true}
          height="auto"
        >
          {renderItems()}
        </BottomSheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Что создаём?</DialogTitle>
              <DialogDescription>
                Выберите тип — откроется форма создания.
              </DialogDescription>
            </DialogHeader>
            {renderItems()}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
