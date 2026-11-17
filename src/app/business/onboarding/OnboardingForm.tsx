"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createBusinessAction } from "./actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Input } from "@/components/ui/input";
import { PhoneVerificationField } from "@/components/phone/PhoneVerificationField";
import { UnpLookupField } from "@/components/business/UnpLookupField";
import { AccessRequestPanel } from "./AccessRequestPanel";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  clearLegacyGlobalDraft,
} from "@/lib/draft/businessOnboardingDraft";
import {
  type BusinessContactOtpClientState,
  isVerifiedPhoneMatch,
  resolveOnboardingVerifiedPhone,
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

function verifiedPhoneFromProps(
  phone: string,
  initialData: { phone?: string | null; contactPhoneVerifiedAt?: string | Date | null } | null | undefined,
  accountPhoneE164: string | null | undefined,
  accountPhoneVerifiedAt: string | null | undefined,
  businessContactVerifiedPhoneE164: string | null | undefined,
  businessContactPhoneVerifiedAt: string | null | undefined,
  recentlyOtpVerifiedPhoneE164: string | null = null
) {
  return resolveOnboardingVerifiedPhone({
    phoneE164: phone,
    existingBusinessPhoneE164: initialData?.phone,
    existingBusinessContactPhoneVerifiedAt: initialData?.contactPhoneVerifiedAt,
    accountPhoneE164,
    accountPhoneVerifiedAt,
    businessContactVerifiedPhoneE164,
    businessContactPhoneVerifiedAt,
    recentlyOtpVerifiedPhoneE164,
  });
}

export function OnboardingForm({
  registrationChangeMode = false,
  currentUserId,
  initialData,
  accountPhoneE164 = null,
  accountPhoneVerifiedAt = null,
  businessContactVerifiedPhoneE164 = null,
  businessContactPhoneVerifiedAt = null,
  initialBusinessContactOtpState,
}: {
  /** ID текущего авторизованного пользователя — используется для скоупинга localStorage draft */
  registrationChangeMode?: boolean;
  currentUserId: string;
  initialData?: { subjectType?: string; registrationFullName?: string | null; publicName?: string; unp?: string; legalName?: string; phone?: string | null; contactPhoneVerifiedAt?: string | null } | null;
  /** Номер из аккаунта (как правило, подтверждённый при регистрации) — если в заявке ещё нет телефона */
  accountPhoneE164?: string | null;
  accountPhoneVerifiedAt?: string | null;
  businessContactVerifiedPhoneE164?: string | null;
  businessContactPhoneVerifiedAt?: string | null;
  /** Серверное состояние escalation OTP (business contact) */
  initialBusinessContactOtpState?: BusinessContactOtpClientState;
}) {
  const [state, formAction] = useActionState(createBusinessAction, null);
  
  // UNP lookup state
  const [subjectType, setSubjectType] = useState(initialData?.subjectType === "UNSPECIFIED" ? "" : initialData?.subjectType || "");
  const [fullName, setFullName] = useState(initialData?.registrationFullName || "");
  const [publicName, setPublicName] = useState(initialData?.publicName || "");
  const [unp, setUnp] = useState(initialData?.unp || "");
  const [legalName, setLegalName] = useState(initialData?.legalName || "");
  const [isLegalNameTouched, setIsLegalNameTouched] = useState(!!initialData?.legalName);
  
  const [phoneE164, setPhoneE164] = useState(() =>
    defaultPhoneFromProps(initialData, accountPhoneE164)
  );
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState(() =>
    verifiedPhoneFromProps(
      defaultPhoneFromProps(initialData, accountPhoneE164),
      initialData,
      accountPhoneE164,
      accountPhoneVerifiedAt,
      businessContactVerifiedPhoneE164,
      businessContactPhoneVerifiedAt
    )
  );
  
  // Volatile UX hint from a successful OTP in this form; never stored as security evidence.
  const recentlyOtpVerifiedPhoneRef = useRef<string | null>(null);
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
      if (draft.subjectType) setSubjectType(draft.subjectType);
      if (draft.registrationFullName) setFullName(draft.registrationFullName);
      if (draft.publicName) setPublicName(draft.publicName);

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

      // A local draft is never proof of OTP; recompute from server evidence.
      const draftPhone = draft.phoneE164 || accountPhoneE164 || "";
      setVerifiedPhoneE164(verifiedPhoneFromProps(
        draftPhone,
        initialData,
        accountPhoneE164,
        accountPhoneVerifiedAt,
        businessContactVerifiedPhoneE164,
        businessContactPhoneVerifiedAt
      ));
    });
  }, [initialData, accountPhoneE164, accountPhoneVerifiedAt, businessContactVerifiedPhoneE164, businessContactPhoneVerifiedAt, currentUserId]);

  useEffect(() => {
    const timer = setTimeout(() => saveDraft(currentUserId, { subjectType, registrationFullName: fullName, publicName, companyData: { legalName }, unp, phoneE164 }), 500);
    return () => clearTimeout(timer);
  }, [currentUserId, subjectType, fullName, publicName, legalName, unp, phoneE164]);

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

    const nextVerifiedPhone = verifiedPhoneFromProps(
      e164,
      initialData,
      accountPhoneE164,
      accountPhoneVerifiedAt,
      businessContactVerifiedPhoneE164,
      businessContactPhoneVerifiedAt,
      recentlyOtpVerifiedPhoneRef.current
    );
    setVerifiedPhoneE164(nextVerifiedPhone);
    debouncedSave({
      phoneE164: e164,
      verifiedPhoneE164: nextVerifiedPhone || undefined,
    });
  };

  const handleVerifiedPhoneChange = (verifiedPhone: string | null) => {
    if (verifiedPhone) {
      // OTP just succeeded. Re-selecting the same number must not require another SMS.
      recentlyOtpVerifiedPhoneRef.current = verifiedPhone;
    }
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
      {registrationChangeMode && <input type="hidden" name="requestIdentityChange" value="true" />}
      <div>
        <label htmlFor="subjectType">Как вы работаете?</label>
        <select required id="subjectType" name="subjectType" value={subjectType} onChange={e => setSubjectType(e.target.value)} className="block w-full rounded-md border border-border bg-surface p-3 text-base">
          <option value="" disabled>Выберите форму деятельности</option><option value="COMPANY">Юридическое лицо</option><option value="SOLE_PROPRIETOR">ИП</option><option value="SELF_EMPLOYED_NPD">Самозанятый (НПД)</option>
        </select>
      </div>
      <div><label htmlFor="publicName">Публичное название</label><Input id="publicName" name="publicName" value={publicName} onChange={e => setPublicName(e.target.value)} required minLength={2} maxLength={200} />
        <p className="text-sm text-muted-foreground">Название для семей. ФИО не публикуется автоматически.</p>
      </div>
      <div>
        {subjectType === "SELF_EMPLOYED_NPD" ? <>
          <label htmlFor="unp">УНП физического лица</label><Input id="unp" name="unp" value={unp} onChange={e => handleUnpChange(e.target.value)} required pattern="[0-9]{9}" maxLength={9} />
          <p className="text-sm text-muted-foreground">Регистрацию НПД проверит администратор в официальном сервисе МНС. Допустимость деятельности проверяется отдельно.</p>
        </> : <UnpLookupField
          id="unp"
          name="unp"
          label="УНП (Учетный номер плательщика)"
          inputClassName="placeholder:text-gray-400"
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
        />}
        {showFieldErrors && state.code === "BUSINESS_UNP_ALREADY_EXISTS" && (
          <AccessRequestPanel unp={unp} />
        )}
      </div>

      <div>
        <label
          htmlFor="legalName"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {subjectType === "SELF_EMPLOYED_NPD" ? "ФИО" : subjectType === "SOLE_PROPRIETOR" ? "ФИО / наименование ИП" : "Юридическое название"}
        </label>
        <Input
          type="text"
          id="legalName"
          name={subjectType === "SELF_EMPLOYED_NPD" ? "registrationFullName" : "legalName"}
          required
          value={subjectType === "SELF_EMPLOYED_NPD" ? fullName : legalName}
          onChange={e => subjectType === "SELF_EMPLOYED_NPD" ? setFullName(e.target.value) : handleLegalNameChange(e)}
          minLength={2}
          maxLength={200}
          placeholder={subjectType === "SELF_EMPLOYED_NPD" ? "Фамилия Имя Отчество" : "Наименование по реестру"}
          className="placeholder:text-gray-400"
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

        <p className="mb-2 text-xs text-gray-500">
          Если этот номер уже подтверждён в аккаунте, повторное SMS не требуется.
          Подтверждение контактного номера также позволяет оставлять комментарии.
        </p>
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

      {showFieldErrors && state.fieldErrors && <div role="alert">{Object.entries(state.fieldErrors).filter(([key]) => key !== "phone" && key !== "unp" && key !== "legalName").flatMap(([key, errors]) => (errors || []).map(error => <p key={`${key}-${error}`} className="text-sm text-danger">{error}</p>))}</div>}
      <SubmitButton disabled={!isPhoneVerified || !subjectType} />
    </form>
  );
}
