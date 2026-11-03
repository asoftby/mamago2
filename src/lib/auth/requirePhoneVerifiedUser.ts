import { NextResponse } from "next/server";
import { getCurrentUser } from "./server";
import { hasVerifiedPhoneForComments } from "@/lib/phone-verification/businessContactVerification.shared";

/**
 * Verification gate для UGC-действий (отзывы, комментарии, заявки, жалобы).
 * 
 * По требованиям РБ для пользовательского контента нужна верификация по телефону.
 * 
 * Проверяет:
 * 1. Пользователь авторизован
 * 2. Личный телефон ИЛИ контактный номер бизнеса подтверждён через SMS.
 *    При подтверждении только бизнес-номера user.phoneE164 может быть null:
 *    не используйте его как обязательный контактный номер без отдельной проверки.
 * 
 * @returns User если все проверки пройдены, NextResponse с ошибкой если нет
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const userOrError = await requirePhoneVerifiedUser();
 *   if (userOrError instanceof NextResponse) {
 *     return userOrError;
 *   }
 *   const user = userOrError;
 *   // ... продолжить обработку
 * }
 * ```
 */
export async function requirePhoneVerifiedUser() {
  // Проверка авторизации
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { 
        error: "UNAUTHORIZED", 
        message: "Please log in to continue" 
      },
      { status: 401 }
    );
  }

  // Проверка подтверждения телефона
  if (!hasVerifiedPhoneForComments({
    accountPhoneE164: user.phoneE164,
    accountPhoneVerifiedAt: user.phoneVerifiedAt,
    businessContactVerifiedPhoneE164: user.businessContactVerifiedPhoneE164,
    businessContactPhoneVerifiedAt: user.businessContactPhoneVerifiedAt,
  })) {
    return NextResponse.json(
      { 
        error: "PHONE_NOT_VERIFIED", 
        message: "Please verify your phone number to continue",
        details: "Phone verification is required for user-generated content according to local regulations"
      },
      { status: 403 }
    );
  }

  return user;
}

/**
 * Типизированная версия requirePhoneVerifiedUser для использования в TypeScript
 */
export type PhoneVerifiedUserResult = 
  | Awaited<ReturnType<typeof getCurrentUser>>
  | NextResponse;
