import prisma from "../prisma/client.js";
import axios from "axios";
import { encrypt, decrypt, decryptChat, decryptChatList, decryptMedicalRecord } from "../utils/cryptoUtil.js";
import { sanitizeTextForAi, sanitizePatientForAi } from "../utils/phiSanitizer.js";

const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

const RETIRED_MODELS = new Set([
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-1.0-pro",
]);

const CANDIDATE_CHAT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
].filter((m) => Boolean(m) && !RETIRED_MODELS.has(m));

const UNIQUE_MODELS = [...new Set(CANDIDATE_CHAT_MODELS)];

async function executeGeminiChat({ messages, json = false, tag = "Doctor AI" }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment!");
  }

  let lastError = null;

  for (let i = 0; i < UNIQUE_MODELS.length; i++) {
    const model = UNIQUE_MODELS[i];
    const startTime = Date.now();
    console.log(`🤖 [${tag}] Attempt ${i + 1}/${UNIQUE_MODELS.length}: Querying model "${model}"...`);

    try {
      const response = await axios.post(
        `${GEMINI_OPENAI_BASE}/chat/completions`,
        {
          model,
          messages,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const elapsed = Date.now() - startTime;
      const content = response.data.choices[0].message.content;
      console.log(`✅ [${tag}] Model "${model}" responded successfully in ${elapsed}ms`);
      return { content, model, elapsed };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      lastError = err;
      const status = err.response?.status || "NO_STATUS";
      const apiMsg = err.response?.data?.error?.message || err.message;
      console.warn(`⚠️ [${tag}] Model "${model}" failed after ${elapsed}ms (Status ${status}): ${apiMsg}`);

      if (i < UNIQUE_MODELS.length - 1) {
        console.log(`🔄 [${tag}] Falling over to model: "${UNIQUE_MODELS[i + 1]}"...`);
      }
    }
  }

  throw lastError;
}

/**
 * AI CHAT + MEMORY
 */
export const doctorAIChat = async (req, res) => {
  console.log("\n==================== [DOCTOR AI CHAT] ====================");
  try {
    const { message, patient } = req.body;
    const userId = req.headers.userid;

    console.log(`[Doctor AI Chat] Patient ID: ${patient?.id || "N/A"} | User ID: ${userId || "N/A"}`);

    let doctorId = null;

    if (userId) {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: Number(userId) },
      });
      doctorId = doctor?.id || null;
    }

    // CHAT MEMORY
    const oldChats = await prisma.doctorChat.findMany({
      where: { patientId: patient?.id },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const history = oldChats.flatMap((c) => [
      { role: "user", content: sanitizeTextForAi(decrypt(c.message)) },
      { role: "assistant", content: sanitizeTextForAi(decrypt(c.reply)) },
    ]);

    // GET MEDICAL RECORD
    const rawRecord = await prisma.medicalRecord.findFirst({
      where: { patientId: patient?.id },
      orderBy: { createdAt: "desc" },
    });
    const record = decryptMedicalRecord(rawRecord);

    // Apply HIPAA Safe Harbor Sanitization before prompting external AI
    const sanitizedPatient = sanitizePatientForAi(patient);
    const sanitizedMessage = sanitizeTextForAi(message);
    const sanitizedNotes = sanitizeTextForAi(decrypt(patient?.medicalNotes || ""));
    const sanitizedRecordStr = record ? sanitizeTextForAi(JSON.stringify(record, null, 2)) : "No prior recorded EHR history";

    const messages = [
      {
        role: "system",
        content: `
          You are a senior clinical doctor assistant helping real doctors.
You are an intelligent clinical AI assistant supporting an attending doctor in their OPD and clinic practice.

          STRICT RESPONSE RULES:
          - Respond like an experienced doctor
          - NEVER say: "unknown", "cannot assess", "insufficient information", "medical history unavailable", "consult Doctor", "seek professional advice"
          - NEVER sound like an AI system
          - NEVER explain limitations or robotic analysis language
          - Always give clinical observations, likely concerns, practical recommendations, preventive advice, and follow-up suggestions

          STYLE RULES:
          - Use clean markdown
          - Sound confident and clinically useful

COMMUNICATION GUIDELINES:
- Answer whatever question the doctor asks directly, normally, and professionally.
- Match the doctor's query:
  - If the doctor sends a greeting (e.g. "hi", "hello"), reply cordially and offer help regarding the active patient.
  - If the doctor asks a specific question (e.g. about medication, dosage, symptoms, drug interactions, or tests), answer that question directly, clearly, and concisely without dumping unrelated sections.
  - If the doctor asks for a full patient analysis or assessment, provide a well-structured summary.
- NEVER force a rigid template with "Clinical Assessment / Observations / Recommendations / Follow-up" unless explicitly requested by the doctor.
- Base your answers on the provided patient profile and medical records whenever available.
- Keep tone professional, evidence-based, collaborative, and clinical (like an experienced medical colleague).
- Use clean, concise markdown formatting (bullet points, bold text) where appropriate.
        `,
      },
      ...history,
      {
        role: "user",
        content: `
Doctor's Message:
"${sanitizedMessage}"

Active Patient Context:
- Name: ${sanitizedPatient?.name || "Patient"}
- Age: ${sanitizedPatient?.age ? `${sanitizedPatient.age} years` : "Not specified"}
- Gender: ${sanitizedPatient?.gender || "Not specified"}
- Blood Group: ${sanitizedPatient?.bloodGroup || "Not specified"}
- Clinical Status: ${sanitizedPatient?.status || "ACTIVE"}
- Current Notes / Chief Complaint: ${sanitizedNotes || "None"}
- Past Medical Record / Vitals:
${sanitizedRecordStr}

Respond to the doctor's message directly, professionally, and clinically.
        `,
      },
    ];

    const { content: reply, model } = await executeGeminiChat({
      messages,
      tag: "Doctor AI Chat",
    });

    await prisma.doctorChat.create({
      data: {
        message: encrypt(message),
        reply: encrypt(reply),
        doctorId,
        patientId: patient?.id,
      },
    });

    console.log(`✅ [Doctor AI Chat] Reply saved and returned (Model: ${model})`);
    res.json({ reply });
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error("❌ [Doctor AI Chat] Error:", errorMsg);
    res.status(500).json({ error: "AI failed", detail: errorMsg });
  }
};

/**
 * GET CHAT HISTORY
 */
export const getDoctorChats = async (req, res) => {
  try {
    const patientId = Number(req.query.patientId);
    console.log(`📋 [Doctor AI Chats] Fetching history for patientId: ${patientId}`);

    const chats = await prisma.doctorChat.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
    });

    console.log(`✅ [Doctor AI Chats] Found ${chats.length} messages`);
    res.json(decryptChatList(chats));
  } catch (err) {
    console.error("❌ [Doctor AI Chats] Fetch chats error:", err.message);
    res.status(500).json({ error: "Failed to fetch chats", detail: err.message });
  }
};

/**
 * CLEAR DOCTOR CHAT HISTORY FOR PATIENT
 */
export const clearDoctorChats = async (req, res) => {
  try {
    const patientId = Number(req.query.patientId || req.body?.patientId);
    console.log(`🗑️ [Doctor AI Chats] Clearing chat history for patientId: ${patientId}`);

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required to clear doctor chats" });
    }

    const deleted = await prisma.doctorChat.deleteMany({
      where: { patientId },
    });

    console.log(`✅ [Doctor AI Chats] Deleted ${deleted.count} messages for patientId: ${patientId}`);
    res.json({ message: "Chat history cleared successfully", count: deleted.count });
  } catch (err) {
    console.error("❌ [Doctor AI Chats] Clear chats error:", err.message);
    res.status(500).json({ error: "Failed to clear chats", detail: err.message });
  }
};

/**
 * Medical Report PDF
 */
export const generatePDFMedicalReport = async (req, res) => {
  console.log("\n==================== [GENERATE MEDICAL REPORT] ====================");
  try {
    const { patient } = req.body;

    if (!patient?.id) {
      console.warn("⚠️ [Generate Report] Missing patient in request body");
      return res.status(400).json({ error: "Patient required" });
    }

    console.log(`[Generate Report] Patient: "${patient.name}" (ID: ${patient.id})`);

    // GET CHAT HISTORY
    const chats = await prisma.doctorChat.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "asc" },
      take: 30,
    });

    const conversation = chats
      .map((c) => `Doctor: ${decrypt(c.message)}\nAI: ${decrypt(c.reply)}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: `
You are a senior clinical assistant doctor.

CRITICAL RULES:
- Return ONLY valid JSON
- NO markdown
- NO explanation
- NO text outside JSON
- NEVER leave fields empty
- NEVER use "unknown"
- Use medically accurate clinical language

You MUST return:
{
  "symptoms": "string",
  "diagnosis": "string",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "vitals": "string",
  "prescription": "string",
  "red_flags": ["string"],
  "recommendations": "string",
  "notes": "string"
}
        `,
      },
      {
        role: "user",
        content: `
Patient:
Name: ${patient.name}
Age: ${patient.age}
Gender: ${patient.gender}
Blood Group: ${patient.bloodGroup}

Chat History:
${conversation || "No chat history"}
        `,
      },
    ];

    const { content: rawContent, model } = await executeGeminiChat({
      messages,
      json: true,
      tag: "Medical Report Generation",
    });

    let raw = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("❌ [Generate Report] Invalid JSON format returned:", raw);
      return res.status(500).json({ error: "Invalid AI response format", raw });
    }

    const report = JSON.parse(raw.substring(start, end + 1));

    // SAVE INTO DATABASE
    await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        symptoms: report.symptoms,
        diagnosis: report.diagnosis,
        vitals: report.vitals,
        prescription: report.prescription,
        notes: report.notes,
        riskLevel: report.risk_level,
        redFlags: JSON.stringify(report.red_flags || []),
        recommendations: report.recommendations,
      },
    });

    console.log(`✅ [Generate Report] Medical report saved and returned (Model: ${model})`);
    res.json(report);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error("❌ [Generate Report] Error:", errorMsg);
    res.status(500).json({ error: "AI report generation failed", detail: errorMsg });
  }
};