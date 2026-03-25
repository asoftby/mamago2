"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCity } from "@/contexts/CityContext";

/**
 * Точка входа «Поиск» из bottom bar: ведёт в хаб выбранного города (каталог).
 */
export default function SearchEntryPage() {
  const router = useRouter();
  const { citySlug } = useCity();

  useEffect(() => {
    router.replace(`/${citySlug}`);
  }, [router, citySlug]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-muted-foreground">
      Переходим в каталог…
    </div>
  );
}
