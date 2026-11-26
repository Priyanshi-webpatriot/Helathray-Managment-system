import crypto from "crypto";

/**
 * HIPAA § 164.312(a)(2)(iv) & § 164.312(e)(2)(ii)
 * Industry Standard AES-256-GCM Field-Level Data Encryption at Rest.
 *
 * 100% Backward Compatible:
 * - Existing plaintext data (without the "enc:v1:" prefix) is returned as-is.
 * - Encrypted fields are seamlessly decrypted before being sent to clients.
 */

// Derive 32-byte key from environment
const RAW_KEY = process.env.ENCRYPTION_KEY;
if (!RAW_KEY) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("🚨 [FATAL SECURITY ERROR] ENCRYPTION_KEY environment variable is missing in production!");
  } else {
    console.warn("⚠️ [CryptoUtil Security Notice] ENCRYPTION_KEY is not defined in .env. Ensure ENCRYPTION_KEY is set in environment.");
  }
}
const KEY_STRING = RAW_KEY || "carescribe_hipaa_aes256_secure_key_2026_dev";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(KEY_STRING).digest();
const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

/**
 * Encrypts plain text using AES-256-GCM.
 * @param {string|any} value
 * @returns {string} Encrypted string in format "enc:v1:ivHex:authTagHex:encryptedHex"
 */
export function encrypt(value) {
  if (value === null || value === undefined) return value;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (!text || text.trim() === "") return value;

  // Don't double encrypt
  if (text.startsWith(PREFIX)) return text;

  try {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (err) {
    console.warn("⚠️ [CryptoUtil] Encryption failed, falling back to original:", err.message);
    return value;
  }
}

/**
 * Decrypts AES-256-GCM cipher string back to plaintext.
 * Gracefully returns original value if not encrypted.
 * @param {string|any} value
 * @returns {string} Decrypted plaintext string
 */
export function decrypt(value) {
  if (!value || typeof value !== "string") return value;

  // If value does not have the encrypted prefix, it is legacy plaintext
  if (!value.startsWith(PREFIX)) {
    return value;
  }

  try {
    const parts = value.slice(PREFIX.length).split(":");
    if (parts.length !== 3) {
      return value;
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.warn("⚠️ [CryptoUtil] Decryption notice (returning raw):", err.message);
    return value;
  }
}

/**
 * Decrypts all sensitive clinical fields in a single ConsultationNote object.
 * @param {Object} note
 * @returns {Object} Note with decrypted fields
 */
export function decryptNote(note) {
  if (!note || typeof note !== "object") return note;

  const decrypted = { ...note };

  if (decrypted.transcript) {
    decrypted.transcript = decrypt(decrypted.transcript);
  }
  if (decrypted.soapNote) {
    decrypted.soapNote = decrypt(decrypted.soapNote);
  }
  if (decrypted.finalNote) {
    decrypted.finalNote = decrypt(decrypted.finalNote);
  }
  if (decrypted.patientNote) {
    decrypted.patientNote = decrypt(decrypted.patientNote);
  }
  if (decrypted.patient && decrypted.patient.medicalNotes) {
    decrypted.patient = {
      ...decrypted.patient,
      medicalNotes: decrypt(decrypted.patient.medicalNotes),
    };
  }

  return decrypted;
}

/**
 * Decrypts sensitive fields in a Patient object.
 * @param {Object} patient
 * @returns {Object}
 */
export function decryptPatient(patient) {
  if (!patient || typeof patient !== "object") return patient;
  const dec = { ...patient };
  if (dec.medicalNotes) {
    dec.medicalNotes = decrypt(dec.medicalNotes);
  }
  return dec;
}

/**
 * Decrypts a list of Patient objects.
 * @param {Array} patients
 * @returns {Array}
 */
export function decryptPatientsList(patients) {
  if (!Array.isArray(patients)) return patients;
  return patients.map(decryptPatient);
}

/**
 * Decrypts a list of ConsultationNote objects.
 * @param {Array} notes
 * @returns {Array} List of notes with decrypted fields
 */
export function decryptNotesList(notes) {
  if (!Array.isArray(notes)) return notes;
  return notes.map(decryptNote);
}

/**
 * Decrypts all sensitive clinical fields in a single MedicalRecord (EHR) object.
 * @param {Object} record
 * @returns {Object} Record with decrypted fields
 */
export function decryptMedicalRecord(record) {
  if (!record || typeof record !== "object") return record;

  const decrypted = { ...record };

  if (decrypted.symptoms) {
    decrypted.symptoms = decrypt(decrypted.symptoms);
  }
  if (decrypted.diagnosis) {
    decrypted.diagnosis = decrypt(decrypted.diagnosis);
  }
  if (decrypted.vitals) {
    decrypted.vitals = decrypt(decrypted.vitals);
  }
  if (decrypted.prescription) {
    decrypted.prescription = decrypt(decrypted.prescription);
  }
  if (decrypted.notes) {
    decrypted.notes = decrypt(decrypted.notes);
  }
  if (decrypted.redFlags) {
    decrypted.redFlags = decrypt(decrypted.redFlags);
  }
  if (decrypted.recommendations) {
    decrypted.recommendations = decrypt(decrypted.recommendations);
  }

  return decrypted;
}

/**
 * Decrypts a list of MedicalRecord objects.
 * @param {Array} records
 * @returns {Array} List of records with decrypted fields
 */
export function decryptMedicalRecordsList(records) {
  if (!Array.isArray(records)) return records;
  return records.map(decryptMedicalRecord);
}

/**
 * Decrypts sensitive fields in a Chat or DoctorChat message.
 * @param {Object} chat
 * @returns {Object}
 */
export function decryptChat(chat) {
  if (!chat || typeof chat !== "object") return chat;
  return {
    ...chat,
    message: decrypt(chat.message),
    reply: decrypt(chat.reply),
  };
}

/**
 * Decrypts a list of Chat or DoctorChat messages.
 * @param {Array} chats
 * @returns {Array}
 */
export function decryptChatList(chats) {
  if (!Array.isArray(chats)) return chats;
  return chats.map(decryptChat);
}



