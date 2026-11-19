/**
 * Helper to validate appointment date and time.
 * Rejects:
 * 1. Dates in the past (before today).
 * 2. Times in the past if the appointment is for today.
 *
 * @param {string|Date} dateInput
 * @param {string} timeInput
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateAppointmentDateTime = (dateInput, timeInput) => {
  if (!dateInput) {
    return { valid: false, error: "Appointment date is required." };
  }

  // Parse target date string into YYYY-MM-DD
  let dateStr = "";
  if (typeof dateInput === "string") {
    dateStr = dateInput.split("T")[0];
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split("T")[0];
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: "Invalid appointment date format." };
  }

  const [year, month, day] = dateStr.split("-").map(Number);

  // Current local time
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // Compare date only (midnight to midnight)
  const apptDateOnly = new Date(year, month - 1, day, 0, 0, 0, 0);
  const todayDateOnly = new Date(currentYear, currentMonth - 1, currentDay, 0, 0, 0, 0);

  if (apptDateOnly.getTime() < todayDateOnly.getTime()) {
    return {
      valid: false,
      error: "Cannot book an appointment for a past date. Please select today or a future date.",
    };
  }

  // If the appointment is for today, check the time
  if (apptDateOnly.getTime() === todayDateOnly.getTime() && timeInput) {
    const parsedTime = parseTimeSlot(timeInput);
    if (parsedTime) {
      const apptDateTime = new Date(
        currentYear,
        currentMonth - 1,
        currentDay,
        parsedTime.hours,
        parsedTime.minutes,
        0,
        0
      );

      if (apptDateTime.getTime() <= now.getTime()) {
        return {
          valid: false,
          error: "Cannot book an appointment for a past time. Please select a future time slot.",
        };
      }
    }
  }

  return { valid: true };
};

/**
 * Parses time strings like "14:30", "02:30 PM", "11:30 AM", etc.
 * @param {string} timeStr
 * @returns {{ hours: number, minutes: number } | null}
 */
export const parseTimeSlot = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;

  const trimmed = timeStr.trim().toUpperCase();

  // 12-hour format: "02:30 PM" or "2:30PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const modifier = match12[3];

    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    return { hours, minutes };
  }

  // 24-hour format: "14:30" or "14:30:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return { hours, minutes };
  }

  return null;
};

/**
 * Normalizes any time string ("02:30 PM", "2:30pm", "14:30") into standard "HH:mm" (24-hour).
 * @param {string} timeStr
 * @returns {string}
 */
export const normalizeTimeTo24Hour = (timeStr) => {
  const parsed = parseTimeSlot(timeStr);
  if (!parsed) return timeStr ? String(timeStr).trim() : "";
  return `${String(parsed.hours).padStart(2, "0")}:${String(parsed.minutes).padStart(2, "0")}`;
};


