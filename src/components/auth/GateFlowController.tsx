"use client";

import { useState, useEffect } from "react";
import { AuthRequiredModal } from "./AuthRequiredModal";
import { PhoneVerificationGateModal } from "./PhoneVerificationGateModal";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { usePendingAction } from "@/contexts/PendingActionContext";

/**
 * Глобальный контроллер для gate-flow модалок
 * 
 * Обрабатывает:
 * - openAuthModal event
 * - openPhoneVerificationModal event
 * - Автоматический переход после успешной авторизации
 */
export function GateFlowController() {
  const { user, isLoading } = useAuthMe();
  const { pendingAction, executePendingAction, clearPendingAction } =
    usePendingAction();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<
    "review" | "comment" | "business_request" | "chat"
  >("review");
  const [entityName, setEntityName] = useState<string | undefined>();

  // Listen for auth modal events
  useEffect(() => {
    const handleOpenAuthModal = (event: CustomEvent) => {
      setModalReason(event.detail?.reason || "review");
      setEntityName(event.detail?.entityName);
      setAuthModalOpen(true);
    };

    window.addEventListener(
      "openAuthModal",
      handleOpenAuthModal as EventListener
    );

    return () => {
      window.removeEventListener(
        "openAuthModal",
        handleOpenAuthModal as EventListener
      );
    };
  }, []);

  // Listen for phone verification modal events
  useEffect(() => {
    const handleOpenPhoneModal = (event: CustomEvent) => {
      setModalReason(event.detail?.reason || "review");
      setEntityName(event.detail?.entityName);
      setPhoneModalOpen(true);
    };

    window.addEventListener(
      "openPhoneVerificationModal",
      handleOpenPhoneModal as EventListener
    );

    return () => {
      window.removeEventListener(
        "openPhoneVerificationModal",
        handleOpenPhoneModal as EventListener
      );
    };
  }, []);

  // After successful auth, check phone verification
  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!pendingAction) return;

    // Close auth modal if open
    if (authModalOpen) {
      queueMicrotask(() => setAuthModalOpen(false));
    }

    // Check phone verification
    if (!user.phoneVerifiedAt) {
      // Need phone verification
      queueMicrotask(() => setPhoneModalOpen(true));
    } else {
      // All checks passed - execute pending action
      queueMicrotask(() => executePendingAction());
    }
  }, [user, isLoading, pendingAction, authModalOpen, executePendingAction]);

  const handleAuthModalClose = () => {
    setAuthModalOpen(false);
    // Don't clear pending action - user might try again
  };

  const handlePhoneModalClose = () => {
    setPhoneModalOpen(false);
    // Don't clear pending action - user might try again
  };

  return (
    <>
      <AuthRequiredModal
        isOpen={authModalOpen}
        onClose={handleAuthModalClose}
        reason={modalReason}
        entityName={entityName}
      />

      <PhoneVerificationGateModal
        isOpen={phoneModalOpen}
        onClose={handlePhoneModalClose}
        reason={modalReason}
        entityName={entityName}
      />
    </>
  );
}
