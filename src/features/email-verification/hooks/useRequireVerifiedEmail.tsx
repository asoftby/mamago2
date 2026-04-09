"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { EmailVerificationGate } from "../components/EmailVerificationGate";

export type RequireVerifiedEmailOptions = {
  onVerifiedAction: () => void | Promise<void>;
};

/**
 * Единая точка gating: при подтверждённом email сразу выполняет action,
 * иначе открывает EmailVerificationGate. После успешного resend action не вызывается.
 */
export function useRequireVerifiedEmail(options: RequireVerifiedEmailOptions) {
  const [gateOpen, setGateOpen] = useState(false);
  const { isEmailVerified, isLoading, isAuthenticated } = useAuthMe();
  const actionRef = useRef(options.onVerifiedAction);

  useEffect(() => {
    actionRef.current = options.onVerifiedAction;
  }, [options.onVerifiedAction]);

  const run = useCallback(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (isEmailVerified) {
      void Promise.resolve(actionRef.current());
      return;
    }
    setGateOpen(true);
  }, [isLoading, isAuthenticated, isEmailVerified]);

  const VerificationGate = () => (
    <EmailVerificationGate open={gateOpen} onOpenChange={setGateOpen} />
  );

  return { run, VerificationGate };
}
