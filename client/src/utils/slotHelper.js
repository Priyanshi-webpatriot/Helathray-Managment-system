/**
 * CareScribe Slot & Doctor Timing Utility Helper
 * Standardizes slot generation, 12-hour/24-hour time formatting, and past-time checks.
 */

export const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentTimeStr = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/**
 * Formats any date string ("2026-11-17", "2026-11-17T00:00:00.000Z") to DD-MM-YYYY format ("17-11-2026")
 */
export const formatDateToDDMMYYYY = (dateInput) => {
  if (!dateInput) return "";
  let clean = "";
  if (typeof dateInput === "string") {
    clean = dateInput.includes("T") ? dateInput.split("T")[0] : dateInput;
  } else if (dateInput instanceof Date) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getDate()).padStart(2, "0");
    return `${d}-${m}-${y}`;
  }

  const parts = String(clean).split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return clean;
};

/**
 * Parses time strings ("14:30", "02:30 PM", "2:30pm") into { hours, minutes }
 */
export const parseTimeSlot = (timeStr) => {
  if (!timeStr) return null;
  const trimmed = String(timeStr).trim().toUpperCase();

  // 12-hour format: "02:30 PM", "2:30PM", "11:PM"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (match12 && (match12[3] || trimmed.includes("AM") || trimmed.includes("PM"))) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
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
 * Formats any time to user-friendly 12-hour format ("09:00 AM", "02:30 PM")
 */
export const formatTimeTo12Hour = (timeStr) => {
  if (!timeStr) return "";
  const parsed = parseTimeSlot(timeStr);
  if (!parsed) return String(timeStr);

  const { hours, minutes } = parsed;
  const period = hours >= 12 ? "PM" : "AM";
  const dispHour = hours % 12 || 12;
  return `${String(dispHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

/**
 * Formats any time to standard database 24-hour format ("09:00", "14:30")
 */
export const formatTimeTo24Hour = (timeStr) => {
  if (!timeStr) return "";
  const parsed = parseTimeSlot(timeStr);
  if (!parsed) return String(timeStr).trim();

  const { hours, minutes } = parsed;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/**
 * Parses doctor timing text from DB into shift ranges
 * e.g. "09:00 Am to 11:PM" -> [{ startHour: 9, startMin: 0, endHour: 23, endMin: 0 }]
 * e.g. "24 Hours" -> [{ startHour: 8, startMin: 0, endHour: 22, endMin: 0 }]
 */
export const parseDoctorTiming = (timingStr) => {
  if (!timingStr || typeof timingStr !== "string") {
    return [{ startHour: 9, startMin: 0, endHour: 18, endMin: 0 }];
  }
  const clean = timingStr.trim();
  if (/24\s*hours|24x7|24\/7/i.test(clean)) {
    return [{ startHour: 8, startMin: 0, endHour: 22, endMin: 0 }];
  }

  const parts = clean.split(/[,;&]|\band\b/i).map((s) => s.trim()).filter(Boolean);
  const ranges = [];

  for (const part of parts) {
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
    const matches = [...part.matchAll(timeRegex)];
    if (matches.length >= 2) {
      const parseMatch = (m, fallbackAmPm) => {
        let hour = parseInt(m[1], 10);
        let min = m[2] ? parseInt(m[2], 10) : 0;
        let mod = m[3] ? m[3].toUpperCase() : fallbackAmPm;
        if (mod === "PM" && hour < 12) hour += 12;
        if (mod === "AM" && hour === 12) hour = 0;
        return { hour, min };
      };
      const endMatch = matches[matches.length - 1];
      const startMatch = matches[0];
      const endMod = endMatch[3]
        ? endMatch[3].toUpperCase()
        : parseInt(endMatch[1], 10) >= 12
        ? "PM"
        : "PM";
      const end = parseMatch(endMatch, endMod);
      const start = parseMatch(
        startMatch,
        startMatch[3] ? startMatch[3].toUpperCase() : parseInt(startMatch[1], 10) < 8 ? "PM" : "AM"
      );
      ranges.push({ startHour: start.hour, startMin: start.min, endHour: end.hour, endMin: end.min });
    }
  }

  if (ranges.length === 0) {
    return [{ startHour: 9, startMin: 0, endHour: 18, endMin: 0 }];
  }
  return ranges;
};

/**
 * Dynamically generates 30-minute interval slots matching the doctor's OPD timing
 * Returns array of { value: "09:00", label: "09:00 AM", period: "Morning" }
 */
export const generateDoctorSlots = (timingStr, intervalMinutes = 30) => {
  const ranges = parseDoctorTiming(timingStr);
  const slots = [];
  const seen = new Set();

  for (const r of ranges) {
    let currentTotalMinutes = r.startHour * 60 + r.startMin;
    const endTotalMinutes = r.endHour * 60 + r.endMin;

    while (currentTotalMinutes <= endTotalMinutes) {
      const h = Math.floor(currentTotalMinutes / 60);
      const m = currentTotalMinutes % 60;
      if (h >= 24) break;

      const hh24 = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh24}:${mm}`;

      if (!seen.has(value)) {
        seen.add(value);
        const period = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const label = `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
        slots.push({ value, label, period });
      }

      currentTotalMinutes += intervalMinutes;
    }
  }

  return slots;
};

/**
 * Checks if a slot time has already passed for the given date
 */
export const isSlotPastForToday = (dateStr, timeValue) => {
  if (!dateStr || !timeValue) return false;
  const now = new Date();
  const todayStr = getTodayDateStr();

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const parsed = parseTimeSlot(timeValue);
  if (!parsed) return false;

  const slotDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parsed.hours,
    parsed.minutes,
    0,
    0
  );
  return slotDate.getTime() <= now.getTime();
};

