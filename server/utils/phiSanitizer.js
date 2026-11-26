/**
 * PHI (Protected Health Information) Sanitizer for HIPAA Safe Harbor Compliance (§ 164.514)
 * Masks direct contact identifiers (phone numbers, email addresses, national IDs)
 * before prompts or transcripts are sent to third-party AI models (e.g. Gemini).
 */

// Matches Indian & International phone numbers (+91-9876543210, 9876543210, +1 555-123-4567, etc.)
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Matches email addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

// Matches 12-digit Aadhaar / SSN format (XXXX XXXX XXXX or XXX-XX-XXXX)
const NATIONAL_ID_REGEX = /\b(?:\d{4}\s\d{4}\s\d{4}|\d{3}-\d{2}-\d{4})\b/g;

/**
 * Sanitizes raw text by masking direct contact identifiers.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeTextForAi(text) {
  if (!text || typeof text !== "string") return text || "";

  return text
    .replace(EMAIL_REGEX, "[EMAIL_REDACTED]")
    .replace(NATIONAL_ID_REGEX, "[ID_REDACTED]")
    .replace(PHONE_REGEX, (match) => {
      // Don't mask blood pressure readings like 120/80 or dosage ratios
      if (match.includes("/") || match.length < 7) return match;
      return "[PHONE_REDACTED]";
    });
}

/**
 * Sanitizes patient metadata object before passing into AI prompts.
 * Keeps clinical attributes (Age, Gender, Blood Group, Diagnosis) intact for accurate scribing.
 * Masks direct contact numbers or emails.
 * @param {Object} patient
 * @returns {Object}
 */
export function sanitizePatientForAi(patient) {
  if (!patient || typeof patient !== "object") return {};

  return {
    ...patient,
    contact: patient.contact ? "[PHONE_REDACTED]" : patient.contact,
    mobile: patient.mobile ? "[PHONE_REDACTED]" : patient.mobile,
    email: patient.email ? "[EMAIL_REDACTED]" : patient.email,
  };
}

