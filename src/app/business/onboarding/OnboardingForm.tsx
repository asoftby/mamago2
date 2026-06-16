"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createBusinessAction } from "./actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Input } from "@/components/ui/input";
import { PhoneVerificationField } from "@/components/phone/PhoneVerificationField";
import { UnpLookupField } from "@/components/business/UnpLookupField";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  clearLegacyGlobalDraft,
} from "@/lib/draft/businessOnboardingDraft";
import {
  type BusinessContactOtpClientState,
  isVerifiedPhoneMatch,
} from "@/lib/phone-verification/businessContactVerification.shared";
import "./onboarding-phone-input.css";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton
      type="submit"
      disabled={pending || disabled}
      className="w-full"
    >
      {pending ? "Отправка на проверку..." : "Отправить на проверку"}
    </PrimaryButton>
  );
}

function defaultPhoneFromProps(
  initialData: { phone?: string | null } | undefined | null,
  accountPhoneE164: string | null | undefined
) {
  if (initialData?.phone) return initialData.phone;
  if (accountPhoneE164) return accountPhoneE164;
  return "";
}

function defaultVerifiedPhoneFromProps(
  initialData:
    | { phone?: string | null; contactPhoneVerifiedAt?: string | Date | null }
    | undefined
    | null
) {
  if (initialData?.phone && initialData?.contactPhoneVerifiedAt) {
    return initialData.phone;
  }

  return "";
}

export function OnboardingForm({
  currentUserId,
  initialData,
  accountPhoneE164 = null,
  initialBusinessContactOtpState,
}: {
  /** ID текущего авторизованного пользователя — используется для скоупинга localStorage draft */
  currentUserId: string;
  initialData?: { unp?: string; legalName?: string; phone?: string | null; contactPhoneVerifiedAt?: string | null } | null;
  /** Номер из аккаунта (как правило, подтверждённый при регистрации) — если в заявке ещё нет телефона */
  accountPhoneE164?: string | null;
  /** Серверное состояние escalation OTP (business contact) */
  initialBusinessContactOtpState?: BusinessContactOtpClientState;
}) {
  const [state, formAction, isPending] = useActionState(createBusinessAction, null);
  
  // UNP lookup state
  const [unp, setUnp] = useState(initialData?.unp || "");
  const [legalName, setLegalName] = useState(initialData?.legalName || "");
  const [isLegalNameTouched, setIsLegalNameTouched] = useState(!!initialData?.legalName);
  
  const [phoneE164, setPhoneE164] = useState(() =>
    defaultPhoneFromProps(initialData, accountPhoneE164)
  );
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState(() =>
    defaultVerifiedPhoneFromProps(initialData)
  );
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount (only if no initialData)
  useEffect(() => {
    clearLegacyGlobalDraft();

    if (initialData) {
      // Skip draft loading if we have initial data from database
      return;
    }

    const draft = loadDraft(currentUserId);
    if (!draft) return;

    queueMicrotask(() => {
      console.log("📋 Loading draft:", draft);

      if (draft.unp) {
        setUnp(draft.unp);
      }

      if (draft.companyData?.legalName) {
        setLegalName(draft.companyData.legalName);
      }

      if (draft.phoneE164) {
        setPhoneE164(draft.phoneE164);
      } else if (accountPhoneE164) {
        setPhoneE164(accountPhoneE164);
      }

      if (
        draft.verifiedPhoneE164 &&
        draft.phoneE164 &&
        draft.verifiedPhoneE164 === draft.phoneE164
      ) {
        setVerifiedPhoneE164(draft.verifiedPhoneE164);
      }
    });
  }, [initialData, accountPhoneE164, currentUserId]);

  // Debounced save helper
  const debouncedSave = (data: Parameters<typeof saveDraft>[1]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(currentUserId, data);
    }, 400); // 400ms debounce
  };

  const handleUnpChange = (value: string) => {
    setUnp(value);
    debouncedSave({ unp: value });
  };

  const handleLegalNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLegalName(e.target.value);
    setIsLegalNameTouched(true);
  };

  const handlePhoneChange = (value: string | undefined) => {
    const e164 = value ?? "";
    setPhoneE164(e164);

    setVerifiedPhoneE164((currentVerifiedPhone) => {
      const nextVerifiedPhone =
        currentVerifiedPhone && currentVerifiedPhone === e164
          ? currentVerifiedPhone
          : "";
      debouncedSave({
        phoneE164: e164,
        verifiedPhoneE164: nextVerifiedPhone || undefined,
      });
      return nextVerifiedPhone;
    });
  };

  const handleVerifiedPhoneChange = (verifiedPhone: string | null) => {
    const nextVerifiedPhone = verifiedPhone ?? "";
    setVerifiedPhoneE164(nextVerifiedPhone);
    debouncedSave({
      phoneE164,
      verifiedPhoneE164: nextVerifiedPhone || undefined,
    });
  };

  // Clear draft on successful submission
  useEffect(() => {
    if (state?.ok) {
      // Form was submitted successfully (will redirect)
      clearDraft(currentUserId);
      console.log("Draft cleared after successful submission");
    }
  }, [state, currentUserId]);

  const isPhoneVerified = isVerifiedPhoneMatch({
    currentPhoneE164: phoneE164,
    verifiedPhoneE164,
  });

  // Only show field errors after form submission attempt
  const showFieldErrors = state !== null && !state.ok;

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <UnpLookupField
          id="unp"
          name="unp"
          label="УНП (Учетный номер плательщика)"
          value={unp}
          required
          onValueChange={handleUnpChange}
          fieldError={
            showFieldErrors
              ? state.fieldErrors?.unp?.[0] ??
                (state.field === "unp" ? state.message : undefined)
              : undefined
          }
          onResolved={(result) => {
            if (result.legalName && !isLegalNameTouched) {
              setLegalName(result.legalName);
            }
            if (result.legalName) {
              saveDraft(currentUserId, {
                companyData: {
                  legalName: result.legalName,
                  source: result.source ?? undefined,
                },
              });
            }
          }}
        />
      </div>

      <div>
        <label
          htmlFor="legalName"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Юридическое название
        </label>
        <Input
          type="text"
          id="legalName"
          name="legalName"
          required
          value={legalName}
          onChange={handleLegalNameChange}
          minLength={2}
          maxLength={200}
          placeholder="ООО «Детский центр Радуга»"
        />
        {showFieldErrors && state.fieldErrors?.legalName && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.legalName[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Телефон (для связи)
        </label>

        <PhoneVerificationField
          phoneE164={phoneE164}
          verifiedPhoneE164={verifiedPhoneE164}
          fieldError={showFieldErrors ? state.fieldErrors?.phone?.[0] : undefined}
          onPhoneChange={handlePhoneChange}
          onVerifiedPhoneChange={handleVerifiedPhoneChange}
          initialOtpState={initialBusinessContactOtpState}
        />
      </div>

      {showFieldErrors && state.message && !state.fieldErrors && state.field !== "unp" && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{state.message}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-800">
          После отправки ваша заявка будет проверена модератором. 
          Вы получите уведомление о результатах проверки.
        </p>
      </div>

      <SubmitButton disabled={!isPhoneVerified} />
    </form>
  );
}
