/** Телефон предложения: цифры и «+ - ( )» с пробелами, не меньше 9 цифр (как в мастере). */
export function isValidOfferPhone(phone: string): boolean {
  return /^[\d\s+\-()]+$/.test(phone) && phone.replace(/\D/g, "").length >= 9;
}
