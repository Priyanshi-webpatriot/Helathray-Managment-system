import prisma from "../prisma/client.js";
import { processReminders } from "../utils/reminderCron.js";
import { validateAppointmentDateTime, normalizeTimeTo24Hour } from "../utils/dateTimeValidator.js";

// BOOK APPOINTMENT
export const createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, date, time } = req.body;

    // Validate that appointment date/time is not in the past
    const check = validateAppointmentDateTime(date, time);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const normalizedTime = normalizeTimeTo24Hour(time);

    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Check if slot is already booked for this doctor on that date
    if (normalizedTime || time) {
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
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: Number(patientId),
        doctorId: Number(doctorId),
        date: new Date(date),
        time: normalizedTime || time || null,
      },
    });

    // If the patient was previously DISCHARGED, reactivate their status to ACTIVE
    try {
      const currentPatient = await prisma.patient.findUnique({
        where: { id: Number(patientId) },
        select: { status: true },
      });
      if (currentPatient?.status === "DISCHARGED") {
        await prisma.patient.update({
          where: { id: Number(patientId) },
          data: { status: "ACTIVE" },
        });
        console.log(`🔄 [Dynamic Patient Status] Patient #${patientId} reactivated to ACTIVE upon new appointment booking`);
      }
    } catch (statusErr) {
      console.warn("⚠️ [Dynamic Patient Status] Reactivation check notice:", statusErr.message);
    }

    res.status(201).json(appointment);

    // Process reminders immediately so patient and doctor don't wait for next cron tick
    processReminders().catch((e) => console.error("Immediate reminder trigger error:", e.message));
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
};

// GET ALL APPOINTMENTS
export const getAppointments = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const role = (req.user?.role || req.headers.role || "").toLowerCase();
    const userId = Number(req.user?.id || req.headers.userid);

    let whereCondition = {};

    // If logged in user is admin, they can view all appointments
    if (role === "admin") {
      whereCondition = {};
    }
    // If logged in user is doctor
    else if (role === "doctor") {
      // find doctor using logged-in userId
      const doctor = await prisma.doctor.findUnique({
        where: { userId }
      });

      if (!doctor) {
        return res.status(404).json({
          error: "Doctor not found"
        });
      }

      // show only this doctor's appointments
      whereCondition = {
        doctorId: doctor.id
      };
    } else if (role === "patient") {
      // find patient using logged-in userId
      const patient = await prisma.patient.findUnique({
        where: { userId }
      });

      if (!patient) {
        return res.status(404).json({
          error: "Patient not found"
        });
      }

      // show only this patient's appointments
      whereCondition = {
        patientId: patient.id
      };
    } else {
      return res.status(403).json({ error: "Access denied. Valid role required." });
    }

    const total = await prisma.appointment.count({
      where: whereCondition
    });

    const appointments = await prisma.appointment.findMany({
      where: whereCondition,
      skip,
      take: limit,

      include: {
        patient: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },

        doctor: true,
      },

      orderBy: {
        date: "desc"
      }
    });

    res.json({
      data: appointments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
};