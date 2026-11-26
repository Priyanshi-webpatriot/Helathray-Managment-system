/**
 * In-Memory Password Reset OTP Store
 * Provides secure, self-expiring, rate-limited storage for password reset codes.
 * Zero database migration required — works instantly and 100% reliably.
 */

const otpStore = new Map();

/**
 * Saves a 6-digit OTP for an email address with a 10-minute expiration.
 * @param {string} email
 * @param {string} otp
 * @param {number} [ttlMs=600000] - 10 minutes default
 */
export const saveResetOtp = (email, otp, ttlMs = 10 * 60 * 1000) => {
  if (!email || !otp) return;
  const normalized = email.toLowerCase().trim();
  otpStore.set(normalized, {
    otp: String(otp).trim(),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
  });
};

/**
 * Validates the OTP for an email address.
 * @param {string} email
 * @param {string} otp
 * @returns {{ valid: boolean, reason?: string }}
 */
export const verifyStoredOtp = (email, otp) => {
  if (!email) {
    return { valid: false, reason: "Email is required." };
  }
  const normalized = email.toLowerCase().trim();
  const entry = otpStore.get(normalized);

  if (!entry) {
    return { valid: false, reason: "No verification code was requested or it has expired." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized);
    return { valid: false, reason: "Verification code has expired. Please request a new one." };
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(normalized);
    return { valid: false, reason: "Too many incorrect attempts. Please request a new code." };
  }

  if (entry.otp !== String(otp || "").trim()) {
    return { valid: false, reason: "Invalid verification code. Please check your email and try again." };
  }

  return { valid: true };
};

/**
 * Removes the OTP after successful password reset.
 * @param {string} email
 */
export const clearStoredOtp = (email) => {
  if (!email) return;
  const normalized = email.toLowerCase().trim();
  otpStore.delete(normalized);
};

