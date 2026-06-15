"use client";

import { OwnerWizardEditDropdown } from "@/components/shared/OwnerWizardEditDropdown";
import { editorPlaceEditHref } from "@/lib/content-editor/types";
import { PLACE_WIZARD_STEPS } from "@/components/business/wizard/place/placeWizardSteps.config";
import { TOTAL_STEPS } from "@/components/business/wizard/place/config";
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";

export function OwnerPlaceEditDropdown({
  placeId,
  className,
}: {
  placeId: string;
  className?: string;
}) {
  const base = editorPlaceEditHref(placeId);

  const steps = [
    ...PLACE_WIZARD_STEPS.map((s) => ({
      href: `${base}?step=${encodeURIComponent(String(s.id))}`,
      label: s.title,
    })),
    {
      href: `${base}?step=${encodeURIComponent(String(TOTAL_STEPS))}`,
      label: businessFormCopy.reviewStepShortTitle,
    },
  ];

  return <OwnerWizardEditDropdown steps={steps} className={className} />;
}
