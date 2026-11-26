/**
 * ============================================================================
 * PATIENT STATUS EVALUATOR (MANUAL DOCTOR SELECTION)
 * ============================================================================
 * The attending physician has 100% manual selection authority over patient status.
 * AI does not suggest status. The doctor selects Active, Critical, or Discharged.
 */

const VALID_STATUSES = new Set(["ACTIVE", "CRITICAL", "DISCHARGED"]);

/**
 * Returns the status manually chosen by the attending doctor.
 *
 * @param {Object} params
 * @param {string} [params.doctorChosenStatus] - Explicit status manually selected by the doctor
 * @param {string} [params.currentStatus] - Current patient status in DB (fallback)
 * @returns {string} "ACTIVE" | "CRITICAL" | "DISCHARGED"
 */
export function evaluatePatientStatus({
  doctorChosenStatus = "",
  currentStatus = "ACTIVE",
}) {
  // Pure manual doctor choice
  const normDoctor = String(doctorChosenStatus || "").toUpperCase().trim();
  if (VALID_STATUSES.has(normDoctor)) {
    return normDoctor;
  }

  const normCurrent = String(currentStatus || "").toUpperCase().trim();
  if (VALID_STATUSES.has(normCurrent)) {
    return normCurrent;
  }

  return "ACTIVE";
}

