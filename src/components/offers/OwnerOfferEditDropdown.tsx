"use client";

import { OwnerWizardEditDropdown } from "@/components/shared/OwnerWizardEditDropdown";
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";
import { getStepsForOfferType } from "@/components/business/wizard/offer/offerWizardSteps.config";
import type { OfferType } from "@/lib/offer/offerPageTypes";
import { editorOfferEditHref } from "@/lib/content-editor/types";

export function OwnerOfferEditDropdown({
  offerId,
  offerType,
  className,
}: {
  offerId: string;
  offerType: OfferType;
  className?: string;
}) {
  const base = editorOfferEditHref(offerId);
  const wizardSteps = getStepsForOfferType(offerType);
  const reviewStepIndex = wizardSteps.findIndex((step) => step.key === "review");

  const steps = wizardSteps.map((step, index) => ({
    href: `${base}?step=${encodeURIComponent(String(index + 1))}`,
    label:
      index === reviewStepIndex
        ? businessFormCopy.reviewStepShortTitle
        : step.title,
  }));

  return <OwnerWizardEditDropdown steps={steps} className={className} />;
}
