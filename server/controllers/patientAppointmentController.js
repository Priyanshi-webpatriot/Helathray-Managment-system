import prisma from "../prisma/client.js";
import { processReminders } from "../utils/reminderCron.js";
import { validateAppointmentDateTime, normalizeTimeTo24Hour } from "../utils/dateTimeValidator.js";

// GET BOOKED SLOTS FOR A SPECIFIC DOCTOR AND DATE
export const getDoctorBookedSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.json({ bookedSlots: [] });
    }

    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: Number(doctorId),
        OR: [
          { date: new Date(date) },
          {
            date: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        ],
      },
      select: {
        time: true,
      },
    });

    const bookedSet = new Set();
    appointments.forEach((appt) => {
      if (appt.time) {
        const raw = appt.time.trim();
        const normalized = normalizeTimeTo24Hour(raw);
        if (raw) bookedSet.add(raw);
        if (normalized) bookedSet.add(normalized);
      }
    });

    res.json({ bookedSlots: Array.from(bookedSet) });
  } catch (error) {
    console.error("Error fetching doctor booked slots:", error);
    res.status(500).json({ error: "Failed to fetch booked slots", bookedSlots: [] });
  }
};

//  PATIENT BOOK APPOINTMENT
export const bookAppointmentByPatient = async (req, res) => {
  try {
    const { doctorId, date, time } = req.body;

    // Validate that appointment date/time is not in the past
    const check = validateAppointmentDateTime(date, time);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const normalizedTime = normalizeTimeTo24Hour(time);

    // get logged-in user id from headers
    const userId = Number(req.headers.userid);

    const patient = await prisma.patient.findUnique({
      where: { userId }
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Check if THIS patient already booked this doctor (any time on that date)
    const patientExisting = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId: Number(doctorId),
        OR: [
          { date: new Date(date) },
          { date: { gte: dayStart, lte: dayEnd } },
        ],
      },
    });

    if (patientExisting) {
      return res.status(409).json({
        error: "You have already booked an appointment with this doctor on the selected date.",
      });
    }

    // Check if the DOCTOR's time slot is already taken by another patient
    const slotTaken = await prisma.appointment.findFirst({
      where: {
        doctorId: Number(doctorId),
        OR: [
          { date: new Date(date) },
          { date: { gte: dayStart, lte: dayEnd } },
        ],
        AND: [
          {
            OR: [
              { time: normalizedTime },
              { time: time },
            ],
          },
        ],
      },
    });

    if (slotTaken) {
      return res.status(409).json({
        error: "This time slot is already booked for this doctor. Please choose a different date or time.",
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: Number(doctorId),
        date: new Date(date),
        time: normalizedTime || time,
      },
    });

    res.status(201).json(appointment);

    // Process reminders immediately so patient and doctor don't wait for next cron tick
    processReminders().catch((e) => console.error("Immediate reminder trigger error:", e.message));

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to book appointment" });
  }
};
// for booked doctor list for patient
export const getPatientAppointments = async (req, res) => {
  try {

    const userId = Number(req.headers.userid);

    const patient = await prisma.patient.findUnique({
      where: { userId }
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            mobile: true,
            experience: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });
    res.json(appointments);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch patient appointments" });
  }
}