"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useHydrated } from "@/hooks/use-hydrated";

export type PendingActionType =
  | {
      type: "CREATE_REVIEW";
      entityType: "PLACE" | "EVENT" | "OFFER";
      entityId: string;
      entityName?: string;
    }
  | {
      type: "CREATE_COMMENT";
      entityType: "ARTICLE" | "PLACE" | "EVENT" | "OFFER";
      entityId: string;
      entityName?: string;
    }
  | {
      type: "SEND_BUSINESS_REQUEST";
      businessId: string;
      businessName?: string;
    }
  | {
      type: "START_DIRECT_CHAT";
      recipientId: string;
      recipientName?: string;
    }
  | {
      type: "SAVE_IDEA";
      entityType: "OFFER";
      entityId: string;
      entityName?: string;
    }
  | {
      type: "SAVE_PLAN";
      entityType: "OFFER";
      entityId: string;
      entityName?: string;
    };

interface PendingActionContextType {
  pendingAction: PendingActionType | null;
  setPendingAction: (action: PendingActionType | null) => void;
  clearPendingAction: () => void;
  executePendingAction: () => void;
}

const PendingActionContext = createContext<PendingActionContextType | undefined>(
  undefined
);

const STORAGE_KEY = "mamago_pending_action";

export function PendingActionProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingActionState] = useState<PendingActionType | null>(
    null
  );
  const isHydrated = useHydrated();

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTimeout(() => {
          setPendingActionState(parsed);
        }, 0);
      }
    } catch (error) {
      console.error("Failed to load pending action:", error);
    }
  }, []);

  // Save to sessionStorage when changed
  const setPendingAction = (action: PendingActionType | null) => {
    setPendingActionState(action);
    if (isHydrated) {
      try {
        if (action) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(action));
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error("Failed to save pending action:", error);
      }
    }
  };

  const clearPendingAction = () => {
    setPendingAction(null);
  };

  // Execute pending action (to be called after auth/phone verification)
  const executePendingAction = () => {
    if (!pendingAction) return;

    // Dispatch custom event that components can listen to
    const event = new CustomEvent("executePendingAction", {
      detail: pendingAction,
    });
    window.dispatchEvent(event);

    // Clear after execution
    clearPendingAction();
  };

  return (
    <PendingActionContext.Provider
      value={{
        pendingAction,
        setPendingAction,
        clearPendingAction,
        executePendingAction,
      }}
    >
      {children}
    </PendingActionContext.Provider>
  );
}

export function usePendingAction() {
  const context = useContext(PendingActionContext);
  if (!context) {
    throw new Error("usePendingAction must be used within PendingActionProvider");
  }
  return context;
}
