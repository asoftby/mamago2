"use client";

import React, { createContext, useContext, useCallback, useState, ReactNode } from "react";

/**
 * Deferred save action — сохраняется, когда пользователь нажимает save будучи неавторизованным.
 * После успешной авторизации этот intent автоматически выполняется.
 */
export type SaveIntent = {
  id: string;
  type: "publication" | "plan-date-selection";
  entityType: string;
  entityId: string;
  entityTitle: string;
  coverImageUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

type SaveIntentContextValue = {
  pendingIntent: SaveIntent | null;
  setPendingIntent: (intent: SaveIntent | null) => void;
  clearPendingIntent: () => void;
};

const SaveIntentContext = createContext<SaveIntentContextValue | undefined>(undefined);

export function SaveIntentProvider({ children }: { children: ReactNode }) {
  const [pendingIntent, setPendingIntent] = useState<SaveIntent | null>(null);

  const clearPendingIntent = useCallback(() => {
    setPendingIntent(null);
  }, []);

  const value: SaveIntentContextValue = {
    pendingIntent,
    setPendingIntent,
    clearPendingIntent,
  };

  return (
    <SaveIntentContext.Provider value={value}>
      {children}
    </SaveIntentContext.Provider>
  );
}

export function useSaveIntent() {
  const context = useContext(SaveIntentContext);
  if (!context) {
    throw new Error("useSaveIntent must be used within SaveIntentProvider");
  }
  return context;
}
