"use client";

import { useCallback, useEffect, useState } from "react";
import type { BirthdayCatalogItem } from "../lib/realCatalog";

type CatalogState =
  | { status: "loading"; offers: BirthdayCatalogItem[]; error: null }
  | { status: "error"; offers: BirthdayCatalogItem[]; error: string }
  | { status: "ready"; offers: BirthdayCatalogItem[]; error: null };

/** Only the public server catalog is trusted; demo fixture data is forbidden. */
export function useRealBirthdayCatalog(citySlug: string) {
  const [state, setState] = useState<CatalogState>({
    status: "loading", offers: [], error: null,
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", offers: [], error: null });
    const url = "/api/public/birthday/catalog?city=" + encodeURIComponent(citySlug);
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Не удалось получить предложения");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" || !("offers" in body) ||
            !Array.isArray(body.offers)) {
          throw new Error("Сервер вернул некорректный каталог");
        }
        const offers = body.offers.filter((entry: unknown): entry is BirthdayCatalogItem =>
          Boolean(entry && typeof entry === "object" &&
            "id" in entry && typeof entry.id === "string" &&
            "title" in entry && typeof entry.title === "string" &&
            "businessId" in entry && typeof entry.businessId === "string" &&
            "productType" in entry &&
            (entry.productType === "PARTY_SERVICE" || entry.productType === "PARTY_PACKAGE")));
        if (!controller.signal.aborted) setState({ status: "ready", offers, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error", offers: [],
          error: error instanceof Error ? error.message : "Ошибка загрузки каталога",
        });
      }
    })();
    return () => controller.abort();
  }, [citySlug, reload]);

  const retry = useCallback(() => setReload((v) => v + 1), []);
  return { ...state, retry };
}
