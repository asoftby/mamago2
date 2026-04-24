"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { clearLogoutClientStorage } from "@/lib/auth/logoutClientCleanup";

/**
 * После server-side redirect с `?loggedOut=1`: очистка клиентского состояния и тост.
 */
export function LogoutSuccessListener() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    if (searchParams.get("loggedOut") !== "1") {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    clearLogoutClientStorage();
    toast.success("Вы вышли из аккаунта");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("loggedOut");
    const q = next.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}
