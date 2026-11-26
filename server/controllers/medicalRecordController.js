import prisma from "../prisma/client.js";
import { encrypt, decryptMedicalRecord, decryptMedicalRecordsList } from "../utils/cryptoUtil.js";

/**
 * HIPAA § 164.312(a)(2)(iv) Protected Health Information (EHR)
 * Encrypts clinical fields at rest using AES-256-GCM.
 */
export const createMedicalRecord = async (req, res) => {
  try {
    const { patientId, symptoms, diagnosis, vitals, prescription, notes, riskLevel, redFlags, recommendations } = req.body;

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: Number(patientId),
        symptoms: encrypt(symptoms),
        diagnosis: encrypt(diagnosis),
        vitals: encrypt(vitals),
        prescription: encrypt(prescription),
        notes: encrypt(notes),
        riskLevel: riskLevel || null,
        redFlags: encrypt(redFlags),
        recommendations: encrypt(recommendations),
      },
    });

    return res.json(decryptMedicalRecord(record));

  } catch (err) {
    console.error("❌ [MedicalRecord] Create error:", err);
    return res.status(500).json({ error: "Failed to create record" });
  }
};

/**
 * Fetches and decrypts medical records for a specific patient.
 */
export const getMedicalRecordsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.medicalRecord.findMany({
      where: { patientId: Number(patientId) },
      orderBy: { createdAt: "desc" },
    });
    return res.json(decryptMedicalRecordsList(records));
  } catch (err) {
    console.error("❌ [MedicalRecord] Fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch medical records" });
  }
};
