import { parseTimeSlot } from "./dateTimeValidator.js";

/**
 * Format Date to iCalendar UTC string format: YYYYMMDDTHHmmssZ
 */
const formatToIcsDate = (date) => {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

/**
 * Build appointment start and end Date objects
 */
export const getAppointmentDateTimes = (dateInput, timeInput, durationMinutes = 30) => {
  let dateStr = "";
  if (typeof dateInput === "string") {
    dateStr = dateInput.split("T")[0];
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split("T")[0];
  }

  const [year, month, day] = (dateStr || "2026-01-01").split("-").map(Number);
  const parsedTime = parseTimeSlot(timeInput) || { hours: 10, minutes: 0 };

  // Local start time
  const startDate = new Date(year, month - 1, day, parsedTime.hours, parsedTime.minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return { startDate, endDate };
};

/**
 * Generate a standard iCalendar (.ics) string for appointment invites
 */
export const buildIcsCalendarEvent = ({
  appointmentId,
  title,
  description,
  location,
  startDate,
  endDate,
  organizerName = "CareScribe",
  organizerEmail,
  attendeeName = "Patient",
  attendeeEmail,
}) => {
  const nowUtc = formatToIcsDate(new Date());
  const startUtc = formatToIcsDate(startDate);
  const endUtc = formatToIcsDate(endDate);
  const uid = `appointment-${appointmentId || Date.now()}@carescribe.com`;

  // Clean strings for ICS (escape commas, semicolons, backslashes and remove raw newlines)
  const cleanSummary = (title || "Medical Consultation").replace(/[\\;,]/g, " ");
  const cleanDesc = (description || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
  const cleanLoc = (location || "CareScribe Clinic").replace(/[\\;,]/g, " ");

  const orgEmail = organizerEmail || process.env.EMAIL_USER || "no-reply@carescribe.com";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareScribe//Appointment System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDesc}`,
    `LOCATION:${cleanLoc}`,
    "STATUS:CONFIRMED",
    `ORGANIZER;CN="${organizerName}":mailto:${orgEmail}`,
    attendeeEmail
      ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="${attendeeName}":mailto:${attendeeEmail}`
      : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${cleanSummary} in 1 hour`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${cleanSummary} tomorrow`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
};

/**
 * Build 1-click Google Calendar web link
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...
 */
export const buildGoogleCalendarLink = ({
  title,
  description,
  location,
  startDate,
  endDate,
}) => {
  const startUtc = formatToIcsDate(startDate);
  const endUtc = formatToIcsDate(endDate);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Doctor Appointment - CareScribe",
    dates: `${startUtc}/${endUtc}`,
    details: description || "In-clinic medical consultation scheduled via CareScribe.",
    location: location || "CareScribe Clinic",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

