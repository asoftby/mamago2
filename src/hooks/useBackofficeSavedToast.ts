"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SAVED_TOAST_PARAM, SAVED_TOAST_VALUE } from "@/lib/backoffice/saveFlow";

/**
 * На страницах списков admin/business: один раз показать toast после `?saved=1`
 * и убрать параметр из URL.
 */
export function useBackofficeSavedToast(message: string) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (searchParams.get(SAVED_TOAST_PARAM) !== SAVED_TOAST_VALUE) return;
    done.current = true;
    toast.success(message);
    const qs = new URLSearchParams(searchParams.toString());
    qs.delete(SAVED_TOAST_PARAM);
    const q = qs.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }, [searchParams, pathname, router, message]);
}
