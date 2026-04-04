"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createBusinessAction, lookupLegalNameByUnp } from "./actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Input } from "@/components/ui/input";
import {
  loadDraft,
  saveDraft,
  clearDraft,
} from "@/lib/draft/businessOnboardingDraft";
import PhoneInput from "react-phone-number-input";
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

export function OnboardingForm({
  initialData,
  accountPhoneE164 = null,
}: {
  initialData?: any;
  /** Номер из аккаунта (как правило, подтверждённый при регистрации) — если в заявке ещё нет телефона */
  accountPhoneE164?: string | null;
}) {
  const [state, formAction] = useActionState(createBusinessAction, null);
  
  // UNP lookup state
  const [unp, setUnp] = useState(initialData?.unp || "");
  const [legalName, setLegalName] = useState(initialData?.legalName || "");
  const [isLegalNameTouched, setIsLegalNameTouched] = useState(!!initialData?.legalName);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  
  const [phoneE164, setPhoneE164] = useState(() =>
    defaultPhoneFromProps(initialData, accountPhoneE164)
  );
  
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /** Обратный отсчёт 0:59…0:00 на время запроса к ЕГР/ГРП */
  const [unpLookupSecondsLeft, setUnpLookupSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isLookupLoading) {
      setUnpLookupSecondsLeft(null);
      return;
    }
    setUnpLookupSecondsLeft(59);
    const id = window.setInterval(() => {
      setUnpLookupSecondsLeft((s) => {
        if (s === null) return null;
        return s <= 0 ? 0 : s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLookupLoading]);

  // Load draft on mount (only if no initialData)
  useEffect(() => {
    if (initialData) {
      // Skip draft loading if we have initial data from database
      return;
    }

    const draft = loadDraft();
    if (draft) {
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
    }
  }, [initialData, accountPhoneE164]);

  // Debounced save helper
  const debouncedSave = (data: Parameters<typeof saveDraft>[0]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(data);
    }, 400); // 400ms debounce
  };

  const handleUnpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 9); // Only digits, max 9
    setUnp(value);
    setLookupError("");

    // Save UNP to draft
    debouncedSave({ unp: value });

    // Clear existing timeout
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    // Only lookup if we have exactly 9 digits
    if (value.length === 9) {
      lookupTimeoutRef.current = setTimeout(() => {
        handleUnpLookup(value);
      }, 700); // 700ms debounce
    }
  };

  const handleUnpBlur = () => {
    // On blur, if we have 9 digits and haven't looked up yet, do it immediately
    if (unp.length === 9 && !isLookupLoading) {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
      handleUnpLookup(unp);
    }
  };

  const handleUnpLookup = async (unpValue: string) => {
    setIsLookupLoading(true);
    setLookupError("");

    try {
      const result = await lookupLegalNameByUnp(unpValue);

      if (result.legalName) {
        // Found - prefill if user hasn't manually edited
        if (!isLegalNameTouched) {
          setLegalName(result.legalName);
        }

        // Save company data to draft
        saveDraft({
          companyData: {
            legalName: result.legalName,
            source: result.source,
          },
        });
      } else {
        // Not found - show soft message, don't block form
        setLookupError("Не удалось определить автоматически. Проверьте УНП или заполните название вручную.");
      }
    } catch (error) {
      setLookupError("Не удалось выполнить поиск. Заполните название вручную.");
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleLegalNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLegalName(e.target.value);
    setIsLegalNameTouched(true);
  };

  const handlePhoneChange = (value: string | undefined) => {
    const e164 = value ?? "";
    setPhoneE164(e164);
    debouncedSave({ phoneE164: e164 });
  };

  // Clear draft on successful submission
  useEffect(() => {
    if (state?.ok) {
      // Form was submitted successfully (will redirect)
      clearDraft();
      console.log("Draft cleared after successful submission");
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label
          htmlFor="unp"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          УНП (Учетный номер плательщика)
        </label>
        <div className="relative">
          <Input
            type="text"
            id="unp"
            name="unp"
            required
            value={unp}
            onChange={handleUnpChange}
            onBlur={handleUnpBlur}
            pattern="[0-9]{9}"
            maxLength={9}
            className="pr-10"
            placeholder="123456789"
          />
          {isLookupLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        {isLookupLoading && (
          <div className="mt-1 space-y-0.5 text-xs text-gray-600">
            <p>
              Определяем организацию по УНП…{" "}
              <span className="tabular-nums font-medium text-gray-800">
                {unpLookupSecondsLeft !== null
                  ? `${Math.floor(unpLookupSecondsLeft / 60)}:${(unpLookupSecondsLeft % 60).toString().padStart(2, "0")}`
                  : "0:59"}
              </span>
            </p>
            <p className="text-gray-500">
              Обычно это занимает около минуты. Пожалуйста, подождите.
            </p>
          </div>
        )}
        {lookupError && (
          <p className="mt-1 text-xs text-amber-600">{lookupError}</p>
        )}
        {state && !state.ok && state.fieldErrors?.unp && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.unp[0]}
          </p>
        )}
        {!isLookupLoading && !lookupError && (
          <p className="mt-1 text-xs text-gray-500">9 цифр</p>
        )}
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
          placeholder="ООО 'Детский центр Радуга'"
        />
        {state && !state.ok && state.fieldErrors?.legalName && (
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
        
        <div className="onboarding-phone-wrap">
          <PhoneInput
            id="phone"
            international
            defaultCountry="BY"
            countryCallingCodeEditable
            autoComplete="tel"
            placeholder="Номер телефона"
            value={phoneE164 || undefined}
            onChange={handlePhoneChange}
          />
        </div>

        <input type="hidden" name="phone" value={phoneE164} />
        
        {state && !state.ok && state.fieldErrors?.phone && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.phone[0]}
          </p>
        )}
      </div>

      {state && !state.ok && state.message && !state.fieldErrors && (
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

      <SubmitButton />
    </form>
  );
}
