"use client";

import { OwnerWizardEditDropdown } from "@/components/shared/OwnerWizardEditDropdown";
import { editorPlaceEditHref } from "@/lib/content-editor/types";
import { getPlaceWizardStepConfigs } from "@/components/business/wizard/place/placeWizardSteps.config";
import { getPlaceWizardTotalSteps } from "@/components/business/wizard/place/config";
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";
import { isPlaceCtaStepFeatureEnabled } from "@/components/business/wizard/place/ctaStepFeatureFlag";

export function OwnerPlaceEditDropdown({
  placeId,
  className,
}: {
  placeId: string;
  className?: string;
}) {
  const base = editorPlaceEditHref(placeId);
  const ctaStepEnabled = isPlaceCtaStepFeatureEnabled(process.env);
  const contentSteps = getPlaceWizardStepConfigs(ctaStepEnabled);
  const totalSteps = getPlaceWizardTotalSteps(ctaStepEnabled);

  const steps = [
    ...contentSteps.map((s) => ({
      href: `${base}?step=${encodeURIComponent(String(s.id))}`,
      label: s.title,
    })),
    {
      href: `${base}?step=${encodeURIComponent(String(totalSteps))}`,
      label: businessFormCopy.reviewStepShortTitle,
    },
  ];

  return <OwnerWizardEditDropdown steps={steps} className={className} />;
}
