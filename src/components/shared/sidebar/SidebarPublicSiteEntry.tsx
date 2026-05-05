"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  PUBLIC_SITE_DEFAULT_ENTRY_PATH,
  buildPublicSiteEntryUrl,
} from "@/lib/routing/surface";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { cn } from "@/lib/utils";

type SidebarPublicSiteEntryProps = {
  onNavigate?: () => void;
  /** Разделитель под первым пунктом */
  separatorClassName?: string;
  /** Витрина бизнеса: как аватар в выпадающем меню (sky) */
  chromeTone?: "default" | "business";
};

/**
 * Первый пункт сайдбара админки/бизнеса: переход на публичную витрину (учёт поддоменов).
 */
export function SidebarPublicSiteEntry({
  onNavigate,
  separatorClassName = "border-gray-100",
  chromeTone = "default",
}: SidebarPublicSiteEntryProps) {
  const [href, setHref] = useState(
    () =>
      `${getCanonicalPublicAppUrl().replace(/\/+$/u, "")}${PUBLIC_SITE_DEFAULT_ENTRY_PATH}`,
  );

  useEffect(() => {
    setHref(
      buildPublicSiteEntryUrl({
        currentHost: window.location.host,
        currentProtocol: window.location.protocol.replace(/:$/u, ""),
      }),
    );
  }, []);

  const handleClick = () => {
    onNavigate?.();
  };

  return (
    <div className={cn("mb-1 border-b pb-2", separatorClassName)}>
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150",
          "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
            "border border-gray-200 bg-white text-gray-700 shadow-sm",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "flex h-full w-full items-center justify-center rounded-full",
              chromeTone === "business"
                ? "bg-sky-100 text-sky-900"
                : "bg-gray-100 text-gray-700",
            )}
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
          </span>
        </span>
        <span>Перейти на сайт</span>
      </Link>
    </div>
  );
}
