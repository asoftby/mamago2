"use client";

/**
 * Lets an article detail page (rendered as a sibling of the header, not an
 * ancestor — see (public)/layout.tsx) publish its actual geo label so the
 * header can show it instead of falling back to the URL-derived city.
 * Mirrors the existing PublicationIntentContext bridge pattern.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ArticleGeoLabelContextValue = {
  label: string | null;
  setArticleGeoLabel: (label: string | null) => void;
};

const ArticleGeoLabelContext = createContext<ArticleGeoLabelContextValue | null>(null);

export function ArticleGeoLabelProvider({ children }: { children: ReactNode }) {
  const [label, setArticleGeoLabel] = useState<string | null>(null);
  const value = useMemo(() => ({ label, setArticleGeoLabel }), [label]);
  return (
    <ArticleGeoLabelContext.Provider value={value}>
      {children}
    </ArticleGeoLabelContext.Provider>
  );
}

/** Read the currently published article geo label (null outside article detail pages). */
export function useArticleGeoLabel(): string | null {
  return useContext(ArticleGeoLabelContext)?.label ?? null;
}

export function useSetArticleGeoLabel() {
  const ctx = useContext(ArticleGeoLabelContext);
  return useCallback(
    (label: string | null) => {
      ctx?.setArticleGeoLabel(label);
    },
    [ctx],
  );
}
