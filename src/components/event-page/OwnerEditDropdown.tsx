"use client";

import { usePathname } from "next/navigation";
import { OwnerWizardEditDropdown } from "@/components/shared/OwnerWizardEditDropdown";
import { editorEventEditHref } from "@/lib/content-editor/types";
import {
  EVENT_WIZARD_STEPS,
  TOTAL_EVENT_WIZARD_STEPS,
} from "@/components/business/wizard/event/eventWizardSteps.config";
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";

/**
 * Выбор шага редактирования с страницы публикации (не только «с последнего места»).
 */
export function OwnerEditDropdown({
  eventId,
  className,
}: {
  eventId: string;
  className?: string;
}) {
  const base = editorEventEditHref(eventId);
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname);

  const steps = [
    ...EVENT_WIZARD_STEPS.map((s) => ({
      href: `${base}?step=${encodeURIComponent(String(s.id))}&returnTo=${returnTo}`,
      label: s.title,
    })),
    {
      href: `${base}?step=${encodeURIComponent(String(TOTAL_EVENT_WIZARD_STEPS))}&returnTo=${returnTo}`,
      label: businessFormCopy.reviewStepShortTitle,
    },
  ];

  return <OwnerWizardEditDropdown steps={steps} className={className} />;
}
