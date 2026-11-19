import express from "express";

import { checkRole } from "../middleware/roleMiddleware.js";
import {
  bookAppointmentByPatient,
  getPatientAppointments,
  getDoctorBookedSlots,
} from "../controllers/patientAppointmentController.js";
const router = express.Router();

// Get booked slots for doctor on a specific date (public / patient)
router.get("/booked-slots", getDoctorBookedSlots);

//only paient can book appointment
router.post("/book", checkRole(["patient"]), bookAppointmentByPatient);
router.get('/my', checkRole(["patient"]), getPatientAppointments);
export default router;