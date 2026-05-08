"use client";

import { useCallback } from "react";
import { usePendingAction, type PendingActionType } from "@/contexts/PendingActionContext";
import { useAuthMe } from "@/lib/auth/useAuthMe";

interface EnsureCanCommentParams {
  entityType: "PLACE" | "EVENT" | "OFFER" | "ARTICLE";
  entityId: string;
  entityName?: string;
  actionType?: "CREATE_REVIEW" | "CREATE_COMMENT";
  onAllowed: () => void;
  onAuthRequired?: () => void;
  onPhoneVerificationRequired?: () => void;
}

/**
 * Hook для проверки возможности оставить комментарий/отзыв
 * 
 * Правильный flow:
 * 1. Проверить авторизацию
 * 2. Проверить верификацию телефона
 * 3. Только потом разрешить действие
 */
export function useCommentGate() {
  const { user, isLoading } = useAuthMe();
  const { setPendingAction } = usePendingAction();

  const ensureCanComment = useCallback(
    ({
      entityType,
      entityId,
      entityName,
      actionType = "CREATE_REVIEW",
      onAllowed,
      onAuthRequired,
      onPhoneVerificationRequired,
    }: EnsureCanCommentParams) => {
      // A) User not authenticated
      if (!user) {
        // Save pending action
        setPendingAction({
          type: actionType,
          entityType: entityType,
          entityId,
          entityName,
        } as PendingActionType);

        // Trigger auth modal
        if (onAuthRequired) {
          onAuthRequired();
        } else {
          // Default: dispatch event for auth modal
          window.dispatchEvent(
            new CustomEvent("openAuthModal", {
              detail: {
                reason: actionType === "CREATE_REVIEW" ? "review" : "comment",
                entityName,
              },
            })
          );
        }

        return false;
      }

      // B) User authenticated but phone not verified
      if (!user.phoneVerifiedAt) {
        // Save pending action
        setPendingAction({
          type: actionType,
          entityType: entityType,
          entityId,
          entityName,
        } as PendingActionType);

        // Trigger phone verification modal
        if (onPhoneVerificationRequired) {
          onPhoneVerificationRequired();
        } else {
          // Default: dispatch event for phone verification modal
          window.dispatchEvent(
            new CustomEvent("openPhoneVerificationModal", {
              detail: {
                reason: actionType === "CREATE_REVIEW" ? "review" : "comment",
                entityName,
              },
            })
          );
        }

        return false;
      }

      // C) All checks passed - allow action
      onAllowed();
      return true;
    },
    [user, setPendingAction]
  );

  return {
    ensureCanComment,
    isLoading,
    user,
    isAuthenticated: !!user,
    isPhoneVerified: !!user?.phoneVerifiedAt,
  };
}
