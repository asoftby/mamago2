"use client";

import { SiteAuthModal } from "@/components/auth/SiteAuthModal";

interface MyPlanAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Post-auth redirect target (should include myPlan=open). */
  nextHref: string;
}

export function MyPlanAuthModal({ open, onOpenChange, nextHref }: MyPlanAuthModalProps) {
  return (
    <SiteAuthModal
      open={open}
      onOpenChange={onOpenChange}
      nextHref={nextHref}
      dialogTitle="Вход для «Мой план»"
      title="Войдите, чтобы открыть Мой план"
      subtitle="Сохраняйте идеи и получайте рекомендации под ваших детей"
    />
  );
}
