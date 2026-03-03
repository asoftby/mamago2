/**
 * In-memory OTP storage for MVP.
 * In production, use Redis or database.
 */

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

export const otpStore = new Map<string, OtpEntry>();

// Clean up expired OTPs every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStore.entries()) {
      if (value.expiresAt < now) {
        otpStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}
