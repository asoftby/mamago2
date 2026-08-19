"use client";

import { useEffect, useState } from "react";
import { DirectRequestModal, type DirectPublicationRef } from "./DirectRequestModal";
import { readAndClearDirectRequestDraft } from "@/lib/direct/directDraftStorage";

type Props = {
  publicationRef: DirectPublicationRef;
  publicationTitle: string;
  brandName: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Button + form + resume-after-login, ready to drop into any publication
 * page's CTA row. Additive by design: this never hides/replaces the
 * existing phone/booking CTA next to it — there is no per-publication
 * "Direct only" mode yet (see Phase 2 report), so the safe default is to
 * offer Direct alongside whatever contact method already exists.
 *
 * No server-resolved auth prop needed: the form always attempts the POST
 * and only redirects to login on a 401 response (see DirectRequestModal),
 * so this component stays a drop-in with zero new server-side wiring.
 */
export function DirectRequestCta({
  publicationRef,
  publicationTitle,
  brandName,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<
    { comment: string; date?: string; childAge?: string; guestsCount?: string } | undefined
  >(undefined);

  // Resume-after-login: if a draft for this exact publication exists, reopen
  // pre-filled — the user still clicks "Отправить заявку" themselves.
  useEffect(() => {
    const draft = readAndClearDirectRequestDraft(publicationRef);
    if (draft) {
      setInitialValues({
        comment: draft.comment,
        date: draft.date,
        childAge: draft.childAge,
        guestsCount: draft.guestsCount,
      });
      setOpen(true);
    }
    // Only ever check once on mount for this publication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <DirectRequestModal
        open={open}
        onOpenChange={setOpen}
        publicationRef={publicationRef}
        publicationTitle={publicationTitle}
        brandName={brandName}
        initialValues={initialValues}
      />
    </>
  );
}
