import express from "express";
import multer from "multer";
import { checkRole } from "../middleware/roleMiddleware.js";
import {
  transcribeAudio,
  formatDialogue,
  generateSOAPNote,
  saveConsultationDraft,
  updateConsultationDraft,
  approveConsultationNote,
  getConsultationNotes,
  getMyPatientNotes,
  deleteConsultationNote,
} from "../controllers/consultationNoteController.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Transcribe audio → transcript (doctor only)
router.post("/transcribe", checkRole(["doctor", "admin"]), upload.single("audio"), transcribeAudio);

// Format dialogue into Doctor/Patient turns with AI (doctor only)
router.post("/format-dialogue", checkRole(["doctor", "admin"]), formatDialogue);

// Transcript → SOAP note (doctor only)
router.post("/generate-soap", checkRole(["doctor", "admin"]), generateSOAPNote);

// Save draft note (doctor only)
router.post("/save-draft", checkRole(["doctor", "admin"]), saveConsultationDraft);

// Update existing draft note (doctor only)
router.put("/:id", checkRole(["doctor", "admin"]), updateConsultationDraft);

// Doctor approves final note → also auto-generates patient-friendly version
router.post("/approve", checkRole(["doctor", "admin"]), approveConsultationNote);

// Get all notes for a patient — doctor view
router.get("/", checkRole(["doctor", "admin"]), getConsultationNotes);

// Get logged-in patient's own approved notes — patient dashboard
router.get("/my-notes", checkRole(["patient", "admin"]), getMyPatientNotes);

// Delete consultation note (doctor or admin)
router.delete("/:id", checkRole(["doctor", "admin"]), deleteConsultationNote);

export default router;
