export function formatPhoneForDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");

  if (digits.startsWith("375") && digits.length === 12) {
    const local = digits.slice(3);
    return `+375 ${local.slice(0, 2)} ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7, 9)}`;
  }

  return phoneE164;
}

export function maskPhoneForDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");

  if (digits.startsWith("375") && digits.length === 12) {
    const local = digits.slice(3);
    return `+375 ${local.slice(0, 2)} •••-••-${local.slice(7, 9)}`;
  }

  if (digits.length >= 4) {
    return `${phoneE164.slice(0, Math.max(0, phoneE164.length - 4))}••••`;
  }

  return phoneE164;
}
