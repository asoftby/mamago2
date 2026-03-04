"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createBusinessAction, lookupLegalNameByUnp } from "./actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { PhoneOtpVerify } from "@/components/phone/PhoneOtpVerify";
import {
  loadDraft,
  saveDraft,
  clearDraft,
} from "@/lib/draft/businessOnboardingDraft";

// Normalize phone to E.164 format
function normalizePhoneToE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  
  // If starts with 375, use as is
  if (digits.startsWith("375")) {
    return "+" + digits;
  }
  
  // If starts with 80, convert to 375
  if (digits.startsWith("80")) {
    return "+375" + digits.slice(2);
  }
  
  // If starts with mobile prefix (29/33/44/25), prepend 375
  if (/^(29|33|44|25)/.test(digits)) {
    return "+375" + digits;
  }
  
  // Default: assume it's already correct or prepend +
  return digits.startsWith("+") ? digits : "+" + digits;
}

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

export function OnboardingForm({ 
  initialData,
  isPhoneVerifiedInitial = false 
}: { 
  initialData?: any;
  isPhoneVerifiedInitial?: boolean;
}) {
  const [state, formAction] = useActionState(createBusinessAction, null);
  
  // UNP lookup state
  const [unp, setUnp] = useState(initialData?.unp || "");
  const [legalName, setLegalName] = useState(initialData?.legalName || "");
  const [isLegalNameTouched, setIsLegalNameTouched] = useState(!!initialData?.legalName);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  
  // Phone verification state - use prop as source of truth
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [phoneE164, setPhoneE164] = useState(initialData?.phone || "");
  const [isPhoneVerified, setIsPhoneVerified] = useState(isPhoneVerifiedInitial);
  
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        setPhone(draft.phoneE164);
        setPhoneE164(draft.phoneE164);
      }
    }
  }, [initialData]);

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

  const handlePhoneVerified = () => {
    setIsPhoneVerified(true);
  };

  // Handle phone change with draft save
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    
    // Normalize to E.164 for storage and verification
    const normalized = normalizePhoneToE164(value);
    setPhoneE164(normalized);
    
    debouncedSave({ phoneE164: normalized });
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
          <input
            type="text"
            id="unp"
            name="unp"
            required
            value={unp}
            onChange={handleUnpChange}
            onBlur={handleUnpBlur}
            pattern="[0-9]{9}"
            maxLength={9}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="123456789"
          />
          {isLookupLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        {isLookupLoading && (
          <p className="mt-1 text-xs text-gray-500">Ищем данные компании. Обычно это занимает около минуты. Пожалуйста, подождите.</p>
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
        <input
          type="text"
          id="legalName"
          name="legalName"
          required
          value={legalName}
          onChange={handleLegalNameChange}
          minLength={2}
          maxLength={200}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
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
        
        <input
          type="tel"
          id="phone"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={handlePhoneChange}
          disabled={isPhoneVerified}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          placeholder="+375XXXXXXXXX"
        />
        
        {/* Hidden input to submit phone value */}
        <input type="hidden" name="phone" value={phoneE164} />
        
        <p className="mt-1 text-xs text-gray-500">
          Пример: +375291234567 или 375291234567
        </p>
        
        {state && !state.ok && state.fieldErrors?.phone && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.phone[0]}
          </p>
        )}
      </div>

      {/* Phone Verification Status */}
      {isPhoneVerified ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-green-800">
            Номер телефона подтвержден
          </span>
        </div>
      ) : (
        <div>
          <PhoneOtpVerify
            phoneE164={phoneE164}
            onVerified={handlePhoneVerified}
          />
        </div>
      )}

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

      <SubmitButton disabled={!isPhoneVerified} />
      
      {!isPhoneVerified && (
        <p className="text-sm text-amber-600 text-center">
          Подтвердите номер телефона для продолжения
        </p>
      )}
    </form>
  );
}
