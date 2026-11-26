import express from "express";
import { createMedicalRecord, getMedicalRecordsByPatient } from "../controllers/medicalRecordController.js";
import { generateMedicalPDFController } from "../controllers/generateMedicalPDFController.js";
const router = express.Router();

router.post("/", createMedicalRecord);
router.get("/patient/:patientId", getMedicalRecordsByPatient);
router.post("/doctor/report/pdf", generateMedicalPDFController);

export default router;
